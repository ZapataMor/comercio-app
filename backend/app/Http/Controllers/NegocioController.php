<?php

namespace App\Http\Controllers;

use App\Http\Resources\NegocioResource;
use App\Models\Negocio;
use App\Models\TipoNegocio;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Negocios del usuario autenticado (modelo unificado): cualquier persona
 * puede crear uno o VARIOS negocios y además ser trabajadora de otros.
 * El acceso se decide por la MEMBRESÍA (negocio_user), no por un rol global.
 */
class NegocioController extends Controller
{
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
        $data = $request->validate([
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            // Tipo de negocio: restaurante, almacén de ropa, farmacia, etc.
            'categoria' => ['required_without:categorias', 'nullable', 'string', 'max:100'],
            'categorias' => ['required_without:categoria', 'array', 'min:1'],
            'categorias.*' => ['required', 'string', 'max:100', 'distinct'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'activo' => ['sometimes', 'boolean'],
            'imagen' => ['sometimes', 'image', 'max:4096'], // máx 4 MB
        ]);

        $categorias = $this->normalizarCategorias($data);
        unset($data['categorias']);
        $data['categoria'] = $categorias[0] ?? null;

        // Se crea ligado al usuario autenticado: imposible crearlo para otro.
        $negocio = $request->user()->negocio()->create($data);
        $this->sincronizarCategorias($negocio, $categorias);

        $this->guardarImagen($request, $negocio);

        return response()->json([
            'negocio' => $this->conRol($negocio, Negocio::ROL_PROPIETARIO),
        ], 201);
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
     * Actualizar un negocio. Solo el PROPIETARIO puede editar los datos del
     * negocio (los trabajadores gestionan catálogo y pedidos, no esto).
     */
    public function update(Request $request, Negocio $negocio): JsonResponse
    {
        if (! $negocio->esPropietario($request->user())) {
            return $this->sinAcceso('Solo el propietario puede editar el negocio.');
        }

        $data = $request->validate([
            'nombre' => ['sometimes', 'required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string'],
            'categoria' => ['sometimes', 'required_without:categorias', 'nullable', 'string', 'max:100'],
            'categorias' => ['sometimes', 'array', 'min:1'],
            'categorias.*' => ['required', 'string', 'max:100', 'distinct'],
            'direccion' => ['nullable', 'string', 'max:255'],
            'telefono' => ['nullable', 'string', 'max:30'],
            'activo' => ['sometimes', 'boolean'],
            'imagen' => ['sometimes', 'image', 'max:4096'],
        ]);

        if (array_key_exists('categorias', $data) || array_key_exists('categoria', $data)) {
            $categorias = $this->normalizarCategorias($data);
            unset($data['categorias']);
            $data['categoria'] = $categorias[0] ?? null;
        }

        $negocio->update($data);

        if (isset($categorias)) {
            $this->sincronizarCategorias($negocio, $categorias);
        }

        $this->guardarImagen($request, $negocio);

        return response()->json([
            'negocio' => $this->conRol($negocio, Negocio::ROL_PROPIETARIO),
        ]);
    }

    /** Resource del negocio + el rol del usuario en él (para la app). */
    private function conRol(Negocio $negocio, ?string $rol): array
    {
        return (new NegocioResource($negocio->load('tiposNegocio')))->resolve() + ['rol' => $rol];
    }

    private function sinAcceso(string $mensaje = 'No tienes acceso a este negocio.'): JsonResponse
    {
        return response()->json(['message' => $mensaje], 403);
    }

    /**
     * @param array<string, mixed> $data
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
     * @param array<int, string> $categorias
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
