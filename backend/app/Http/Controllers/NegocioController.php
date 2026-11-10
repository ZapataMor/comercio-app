<?php

namespace App\Http\Controllers;

use App\Http\Resources\NegocioResource;
use App\Models\Barrio;
use App\Models\Negocio;
use App\Models\TipoNegocio;
use App\Support\EliminarNegocio;
use App\Support\HorarioNegocio;
use App\Support\Reputacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Negocios del usuario autenticado (modelo unificado): cualquier persona
 * puede crear uno o VARIOS negocios y además ser trabajadora de otros.
 * El acceso se decide por la MEMBRESÍA (negocio_user), no por un rol global.
 */
class NegocioController extends Controller
{
    public function destroy(Request $request, Negocio $negocio): JsonResponse
    {
        EliminarNegocio::ejecutar($negocio, $request->user());

        return response()->json(['message' => 'Negocio y todos sus datos eliminados definitivamente.']);
    }

    public function desactivacion(Request $request, Negocio $negocio): JsonResponse
    {
        // La desactivación y el borrado se reservan al dueño, incluso si un
        // trabajador tiene permiso para administrar el resto del negocio.
        abort_unless($negocio->esPropietario($request->user()), 403);
        $datos = $request->validate(['desactivado' => ['required', 'boolean']]);
        $negocio = DB::transaction(function () use ($request, $negocio, $datos) {
            $negocio = Negocio::lockForUpdate()->findOrFail($negocio->id);
            abort_unless($negocio->esPropietario($request->user()), 403);
            $negocio->forceFill(['desactivado_at' => $datos['desactivado'] ? ($negocio->desactivado_at ?? now()) : null])->save();

            return $negocio;
        });

        return response()->json(['negocio' => $this->conRol($negocio, Negocio::ROL_PROPIETARIO)]);
    }

    /**
     * Mis negocios: todos aquellos donde soy miembro activo, con mi rol en
     * cada uno. Incluye mi código público (para que me inviten a trabajar).
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $negocios = $user->negociosActivos()
            ->with('tiposNegocio')
            ->orderBy('nombre')
            ->get()
            ->map(fn (Negocio $n) => (new NegocioResource($n))->resolve() + [
                'rol' => $n->pivot->rol,
                'permisos' => $n->permisosPara($user),
            ]);

        return response()->json([
            'negocios' => $negocios,
            'codigo_publico' => $user->codigo_publico,
        ]);
    }

    /**
     * Crear un negocio nuevo. Sin límite: una persona puede tener varios.
     * El creador queda como miembro 'propietario' (hook del modelo).
     */
    public function store(Request $request): JsonResponse
    {
        $this->horarioDesdeJson($request);

        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            // Tipo de negocio: restaurante, almacén de ropa, farmacia, etc.
            'categoria' => ['required_without:categorias', 'nullable', 'string', 'max:100'],
            'categorias' => ['required_without:categoria', 'array', 'min:1'],
            'categorias.*' => ['required', 'string', 'max:100', 'distinct'],
            'direccion' => ['required', 'string', 'max:255', new \App\Rules\Direccion],
            'barrio' => ['required', 'string', 'max:100'],
            'telefono' => ['nullable', 'string', new \App\Rules\Telefono],
            'activo' => ['sometimes', 'boolean'],
            // Tiempo promedio que promete para tener listo un pedido (minutos).
            'tiempo_preparacion' => ['sometimes', 'integer', 'min:5', 'max:180'],
            'imagen' => ['sometimes', 'image', 'max:4096'], // máx 4 MB
        ] + self::reglasUbicacion() + HorarioNegocio::reglas());

        if (array_key_exists('horario', $data)) {
            $data['horario'] = HorarioNegocio::normalizar($data['horario']);
        }

        $categorias = $this->normalizarCategorias($data);
        unset($data['categorias']);
        $data['categoria'] = $categorias[0] ?? null;

        // Se crea ligado al usuario autenticado: imposible crearlo para otro.
        $negocio = $request->user()->negocio()->create($data);
        Barrio::registrarSiEsNuevo($data['barrio'], $request->user()->id);
        $this->sincronizarCategorias($negocio, $categorias);

        $this->guardarImagen($request, $negocio);

        return response()->json([
            'negocio' => $this->conRol($negocio, Negocio::ROL_PROPIETARIO),
        ], 201);
    }

    /**
     * Cierres del horario automático que debo confirmar: los de mis negocios
     * que cierran en menos de HorarioNegocio::PREGUNTA_CIERRE_MINUTOS. Solo el
     * propietario abre y cierra el negocio, así que solo a él se le pregunta.
     */
    public function cierresPorConfirmar(Request $request): JsonResponse
    {
        $ahora = now();

        $cierres = $request->user()->negociosActivos()
            ->whereNotNull('negocios.horario')
            ->whereNull('negocios.desactivado_at')
            ->get()
            ->filter(fn (Negocio $n) => $n->puede($request->user(), 'cambiar_estado'))
            ->map(function (Negocio $negocio) use ($ahora) {
                $cierre = HorarioNegocio::cierreSinConfirmar($negocio, $ahora);

                return $cierre ? [
                    'id' => $negocio->id,
                    'nombre' => $negocio->nombre,
                    'cierra_texto' => HorarioNegocio::hora($cierre->format('H:i')),
                    'segundos' => (int) $ahora->diffInSeconds($cierre),
                ] : null;
            })
            ->filter()
            ->values();

        return response()->json(['cierres' => $cierres]);
    }

    /**
     * Responder si cierro a la hora del horario. Sin `hora`, sí; con `hora`
     * (HH:mm), cierro a esa, solo por hoy: el horario semanal no cambia.
     */
    public function confirmarCierre(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->puede($request->user(), 'cambiar_estado')) {
            return response()->json(['message' => 'No tienes permiso para abrir o cerrar el negocio.'], 403);
        }

        $datos = $request->validate(
            ['hora' => ['nullable', 'date_format:H:i']],
            ['hora.date_format' => 'Escribe la hora como 21:30.'],
        );

        $ahora = now();
        $cierre = HorarioNegocio::cierreSinConfirmar($negocio, $ahora);
        if (! $cierre) {
            return response()->json(['message' => 'Ya no hay un cierre por confirmar.'], 409);
        }

        $nuevo = null;
        if (! empty($datos['hora'])) {
            // La próxima vez que el reloj marque esa hora.
            $nuevo = $ahora->copy()->setTimeFromTimeString($datos['hora']);
            if ($nuevo->lte($ahora)) {
                $nuevo->addDay();
            }
            if ($nuevo->gt($cierre->copy()->addHours(HorarioNegocio::MAX_HORAS_AJUSTE))) {
                throw ValidationException::withMessages([
                    'hora' => ['Esa hora ya pasó o queda muy lejos. Escribe una hora cercana.'],
                ]);
            }
        }

        HorarioNegocio::responderCierre($negocio, $cierre, $nuevo);

        return response()->json(['message' => 'Listo, quedó guardado.']);
    }

    /**
     * Ver UN negocio mío (soy miembro activo: propietario o trabajador).
     */
    public function show(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        $rol = $negocio->miembros()->whereKey($request->user()->id)->first()?->pivot->rol;

        return response()->json(['negocio' => $this->conRol($negocio, $rol)]);
    }

    /**
     * Nivel de confiabilidad del negocio y por qué (últimos eventos), para
     * que el equipo sepa qué mejorar. Cualquier miembro activo lo ve.
     */
    public function reputacion(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->esMiembroActivo($request->user())) {
            return $this->sinAcceso();
        }

        return response()->json([
            'reputacion' => Reputacion::resumen(Reputacion::NEGOCIO, $negocio),
            'tiempo_preparacion' => $negocio->tiempo_preparacion,
            'eventos' => Reputacion::historial(Reputacion::NEGOCIO, $negocio),
        ]);
    }

    /**
     * Actualizar un negocio. Solo el PROPIETARIO puede editar los datos del
     * negocio (los trabajadores gestionan catálogo y pedidos, no esto).
     */
    public function update(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->administra($request->user())) {
            if (! $negocio->puede($request->user(), 'cambiar_estado') || ! $request->exists('activo')
                || array_diff(array_keys($request->all()), ['activo', '_method'])) {
                return $this->sinAcceso('No tienes permiso para editar la información del negocio.');
            }
        }

        $this->horarioDesdeJson($request);

        $data = $request->validate([
            'nombre' => ['sometimes', 'required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'categoria' => ['sometimes', 'required_without:categorias', 'nullable', 'string', 'max:100'],
            'categorias' => ['sometimes', 'array', 'min:1'],
            'categorias.*' => ['required', 'string', 'max:100', 'distinct'],
            'direccion' => ['sometimes', 'required', 'string', 'max:255', new \App\Rules\Direccion],
            'barrio' => ['sometimes', 'required', 'string', 'max:100'],
            'telefono' => ['nullable', 'string', new \App\Rules\Telefono],
            'activo' => ['sometimes', 'boolean'],
            // Tiempo promedio que promete para tener listo un pedido (minutos).
            'tiempo_preparacion' => ['sometimes', 'integer', 'min:5', 'max:180'],
            'imagen' => ['sometimes', 'image', 'max:4096'],
        ] + self::reglasUbicacion() + HorarioNegocio::reglas());

        if (array_key_exists('horario', $data)) {
            $data['horario'] = HorarioNegocio::normalizar($data['horario']);
        }

        // Abrir/cerrar a mano se respeta hasta la próxima hora del horario.
        if (array_key_exists('activo', $data) && (bool) $data['activo'] !== $negocio->activo) {
            $negocio->activo_cambiado_at = now();
        }

        if (array_key_exists('categorias', $data) || array_key_exists('categoria', $data)) {
            $categorias = $this->normalizarCategorias($data);
            unset($data['categorias']);
            $data['categoria'] = $categorias[0] ?? null;
        }

        $negocio->update($data);
        if (array_key_exists('barrio', $data)) {
            Barrio::registrarSiEsNuevo($data['barrio'], $request->user()->id);
        }

        if (isset($categorias)) {
            $this->sincronizarCategorias($negocio, $categorias);
        }

        $this->guardarImagen($request, $negocio);

        return response()->json([
            'negocio' => $this->conRol($negocio, $negocio->miembros()->whereKey($request->user()->id)->first()?->pivot->rol),
        ]);
    }

    /**
     * La app manda el formulario del negocio como multipart (por la imagen),
     * así que el horario llega como texto JSON: se convierte a arreglo.
     */
    private function horarioDesdeJson(Request $request): void
    {
        $horario = $request->input('horario');
        if (is_string($horario)) {
            if ($horario === '') {
                $request->merge(['horario' => null]);

                return;
            }
            try {
                $horario = json_decode($horario, true, flags: JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                throw ValidationException::withMessages(['horario' => 'El horario no tiene un formato válido. Revisa los días y las horas.']);
            }
            $request->merge(['horario' => $horario]);
        }
    }

    /**
     * Pin del negocio en el mapa: van juntos, y vacíos lo quitan del mapa.
     *
     * @return array<string, array<int, string>>
     */
    private static function reglasUbicacion(): array
    {
        return [
            'lat' => ['nullable', 'required_with:lng', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'required_with:lat', 'numeric', 'between:-180,180'],
        ];
    }

    /** Resource del negocio + el rol del usuario en él (para la app). */
    private function conRol(Negocio $negocio, ?string $rol): array
    {
        return (new NegocioResource($negocio->load('tiposNegocio')))->resolve() + ['rol' => $rol, 'permisos' => $negocio->permisosPara(request()->user())];
    }

    private function sinAcceso(string $mensaje = 'No tienes acceso a este negocio.'): JsonResponse
    {
        return response()->json(['message' => $mensaje], 403);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<int, string>
     */
    private function normalizarCategorias(array $data): array
    {
        $categorias = $data['categorias'] ?? [];

        if (! is_array($categorias)) {
            $categorias = [];
        }

        if (isset($data['categoria']) && is_string($data['categoria']) && trim($data['categoria']) !== '') {
            array_unshift($categorias, $data['categoria']);
        }

        return collect($categorias)
            ->map(fn ($valor) => Str::of((string) $valor)->squish()->title()->toString())
            ->filter()
            ->unique(fn (string $valor) => Str::slug($valor))
            ->values()
            ->all();
    }

    /**
     * @param  array<int, string>  $categorias
     */
    private function sincronizarCategorias(Negocio $negocio, array $categorias): void
    {
        $ids = collect($categorias)->map(function (string $nombre) {
            return TipoNegocio::firstOrCreate(
                ['slug' => Str::slug($nombre)],
                ['nombre' => $nombre],
            )->id;
        });

        $negocio->tiposNegocio()->sync($ids);
    }

    /**
     * Guarda la imagen subida (si viene) en storage/public/negocios y la
     * asigna al negocio, borrando la anterior. `imagen` no está en $fillable:
     * se asigna explícitamente para evitar mass-assignment de rutas arbitrarias.
     */
    private function guardarImagen(Request $request, Negocio $negocio): void
    {
        if (! $request->hasFile('imagen')) {
            return;
        }

        if ($negocio->imagen) {
            Storage::disk('public')->delete($negocio->imagen);
        }

        $negocio->imagen = $request->file('imagen')->store('negocios', 'public');
        $negocio->save();
    }
}
