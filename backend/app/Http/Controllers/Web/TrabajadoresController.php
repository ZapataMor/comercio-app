<?php

namespace App\Http\Controllers\Web;

use App\Gestion\Gestion;
use App\Gestion\Horario;
use App\Http\Controllers\Controller;
use App\Models\InvitacionTrabajo;
use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\TareaTrabajo;
use App\Models\User;
use App\Notifications\TareaAsignada;
use App\Support\EquipoNegocio;
use App\Support\ErrorEquipo;
use App\Support\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

/**
 * Trabajadores del panel web (módulo del núcleo «equipo»):
 * - se asocian con el código público que cada persona tiene en su app; se
 *   crea una invitación y la persona la acepta desde la app,
 * - cada uno tiene su sede (si hay varias), su cargo y sus días y horas,
 * - el dueño o el administrador del negocio le da los permisos de Vitrina y
 *   los de los módulos,
 * - se le asignan tareas, que pueden ser atender un pedido en curso.
 */
class TrabajadoresController extends Controller
{
    /** Permisos de Vitrina (los de la app) con su texto para la web. */
    public const PERMISOS_VITRINA = [
        'gestionar_pedidos' => 'Atender los pedidos',
        'modificar_inventario' => 'Cambiar el catálogo',
        'cambiar_estado' => 'Abrir y cerrar el negocio',
        'administrador' => 'Administrador del negocio (todos los permisos)',
    ];

    public function index(Request $request): View
    {
        $negocio = $this->negocio($request);
        $user = $request->user();
        $sedes = $negocio->sedes()->where('activa', true)->orderByDesc('principal')->orderBy('nombre')->get();

        $sede = $sedes->firstWhere('id', (int) $request->query('sede'));
        $miembros = $negocio->miembrosActivos()->get()
            ->when($sede, fn ($c) => $c->filter(fn (User $m) => $m->pivot->sede_id === null || (int) $m->pivot->sede_id === $sede->id))
            ->sortBy([fn ($a, $b) => ($a->pivot->rol === Negocio::ROL_PROPIETARIO ? 0 : 1) <=> ($b->pivot->rol === Negocio::ROL_PROPIETARIO ? 0 : 1), fn ($a, $b) => strcasecmp($a->name, $b->name)])
            ->values();
        $todos = $negocio->miembrosActivos()->orderBy('name')->get();

        $estado = in_array($request->query('estado'), ['hechas', 'todas'], true) ? $request->query('estado') : 'pendientes';
        $de = (int) $request->query('trabajador');
        $tareas = $negocio->tareas()->with(['trabajador', 'creador', 'sede', 'pedido.cliente'])
            ->when($estado === 'pendientes', fn ($q) => $q->where('estado', '!=', 'hecha'))
            ->when($estado === 'hechas', fn ($q) => $q->where('estado', 'hecha'))
            ->when($de, fn ($q) => $q->where('user_id', $de))
            ->orderByRaw("CASE WHEN estado = 'hecha' THEN 1 ELSE 0 END")
            ->orderByRaw('fecha IS NULL')->orderBy('fecha')->orderByDesc('urgente')->latest('id')
            ->limit(300)->get();

        return view('negocio.trabajadores', [
            'pestana' => $request->query('pestana') === 'tareas' ? 'tareas' : 'trabajadores',
            'miembros' => $miembros,
            'todos' => $todos,
            'totalTrabajadores' => $todos->count(),
            'invitaciones' => $negocio->invitaciones()->where('estado', InvitacionTrabajo::PENDIENTE)->with(['invitado', 'sede'])->latest()->get(),
            'sedes' => $sedes,
            'sedeFiltro' => $sede,
            'tareas' => $tareas,
            'estado' => $estado,
            'trabajadorFiltro' => $de,
            // Para la tarjeta y el modal de cada trabajador, sin importar el filtro.
            'tareasDe' => $negocio->tareas()->where('estado', '!=', 'hecha')->with('pedido')
                ->orderByRaw('fecha IS NULL')->orderBy('fecha')->orderByDesc('urgente')->get()->groupBy('user_id'),
            'totalPendientes' => $negocio->tareas()->where('estado', '!=', 'hecha')->count(),
            'fechas' => $this->fechas(),
            'pedidosEnCurso' => $negocio->pedidos()->whereIn('estado', Pedido::EN_CURSO)->with('cliente')->latest()->limit(60)->get(),
            'asignables' => Gestion::permisosAsignables($negocio),
            'administra' => $negocio->administra($user),
            'puedeAsignar' => $this->puedeAsignar($request),
        ]);
    }

    /** Vista previa antes de invitar: de quién es el código. */
    public function resolverCodigo(Request $request): JsonResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->administra($request->user()), 403, 'Solo el dueño o el administrador del negocio asocia trabajadores.');
        $codigo = $request->validate(['codigo' => ['required', 'string', 'max:12']])['codigo'];
        $persona = EquipoNegocio::porCodigo($codigo);
        if (! $persona) {
            return response()->json(['message' => 'No existe nadie con ese código. Revisa que esté igual al de su app.'], 404);
        }

        $aviso = match (true) {
            $persona->id === $request->user()->id => 'Ese es tu propio código.',
            $negocio->miembros()->whereKey($persona->id)->exists() => 'Ya hace parte del negocio.',
            $negocio->invitaciones()->where('user_id', $persona->id)->where('estado', InvitacionTrabajo::PENDIENTE)->exists() => 'Ya tiene una invitación pendiente.',
            default => null,
        };

        return response()->json([
            'nombre' => $persona->nombre_completo,
            'codigo' => $persona->codigo_publico,
            'aviso' => $aviso,
        ]);
    }

    public function invitar(Request $request): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->administra($request->user()), 403, 'Solo el dueño o el administrador del negocio asocia trabajadores.');
        $request->validate(['codigo' => ['required', 'string', 'max:12']], [], ['codigo' => 'código']);
        $datos = $this->datosTrabajador($request, $negocio);

        try {
            $invitacion = EquipoNegocio::invitar($negocio, $request->user(), $request->input('codigo'), [
                ...$datos['pivote'],
                'horario' => $datos['horario'],
                'permisos_gestion' => $datos['modulos'],
            ]);
        } catch (ErrorEquipo $e) {
            return back()->withInput()->with('error', $e->getMessage());
        }

        return redirect()->route('negocio.equipo')->with('ok', 'Se le envió la invitación a '.$invitacion->invitado->nombre_completo.'. Queda asociado cuando la acepte en su app.');
    }

    public function cancelarInvitacion(Request $request, int $invitacion): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($negocio->administra($request->user()), 403, 'Solo el dueño o el administrador del negocio cancela invitaciones.');
        $modelo = $negocio->invitaciones()->where('estado', InvitacionTrabajo::PENDIENTE)->findOrFail($invitacion);
        $modelo->delete();

        return redirect()->route('negocio.equipo')->with('ok', 'Se canceló la invitación de '.($modelo->invitado?->nombre_completo ?? 'esa persona').'.');
    }

    /** Sede, cargo, días y horas y permisos de un trabajador. */
    public function guardar(Request $request, int $miembro): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $quien = $request->user();
        abort_unless($negocio->administra($quien), 403, 'Solo el dueño o el administrador del negocio cambia los datos de los trabajadores.');
        $persona = $negocio->miembrosActivos()->whereKey($miembro)->firstOrFail();
        $datos = $this->datosTrabajador($request, $negocio);

        // Al dueño no se le cambian permisos (los tiene todos) y nadie se
        // quita a sí mismo los suyos por error.
        $conPermisos = $persona->pivot->rol !== Negocio::ROL_PROPIETARIO && $persona->id !== $quien->id;
        DB::transaction(function () use ($negocio, $persona, $datos, $conPermisos) {
            $pivote = ['horario' => $datos['horario'] !== null ? json_encode($datos['horario']) : null] + $datos['pivote'];
            if (! $conPermisos) {
                $pivote = array_diff_key($pivote, array_flip(Negocio::PERMISOS));
            }
            $negocio->miembros()->updateExistingPivot($persona->id, $pivote);
            if ($conPermisos) {
                Gestion::guardarPermisos($negocio, $persona, $datos['modulos']);
            }
        });

        return redirect()->route('negocio.equipo')->with('ok', 'Se guardaron los datos de '.$persona->name.'.');
    }

    public function quitar(Request $request, int $miembro): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $persona = $negocio->miembros()->whereKey($miembro)->firstOrFail();
        try {
            EquipoNegocio::quitar($negocio, $persona->id, $request->user());
        } catch (ErrorEquipo $e) {
            abort_if($e->estado === 403, 403, $e->getMessage());

            return back()->with('error', $e->getMessage());
        }

        return redirect()->route('negocio.equipo')->with('ok', $persona->name.' ya no hace parte del negocio.');
    }

    // --------------------------------------------------------------- Tareas

    public function crearTarea(Request $request): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($this->puedeAsignar($request), 403, 'No tienes permiso para asignar tareas.');
        $datos = $this->datosTarea($request, $negocio, nueva: true);
        $tarea = $negocio->tareas()->create($datos + ['creada_por' => $request->user()->id]);
        $this->avisarAsignada($tarea, $request);

        return redirect()->route('negocio.equipo', ['pestana' => 'tareas'])
            ->with('ok', 'Se le asignó «'.$tarea->titulo.'» a '.$tarea->trabajador->name.'.');
    }

    public function guardarTarea(Request $request, int $tarea): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($this->puedeAsignar($request), 403, 'No tienes permiso para cambiar tareas.');
        $modelo = $negocio->tareas()->findOrFail($tarea);
        $antes = $modelo->user_id;
        $modelo->update($this->datosTarea($request, $negocio, nueva: false, actual: $modelo));
        if ($modelo->user_id !== $antes) {
            $this->avisarAsignada($modelo, $request);
        }

        return redirect()->route('negocio.equipo', ['pestana' => 'tareas'])->with('ok', 'Se guardó la tarea «'.$modelo->titulo.'».');
    }

    /** Pendiente, en curso o hecha. También la cambia el trabajador al que se le asignó. */
    public function estadoTarea(Request $request, int $tarea): RedirectResponse
    {
        $negocio = $this->negocio($request);
        $modelo = $negocio->tareas()->findOrFail($tarea);
        abort_unless($this->puedeAsignar($request) || $modelo->user_id === $request->user()->id, 403, 'Solo quien asigna tareas o el trabajador de esta tarea la cambia.');
        $estado = $request->validate(['estado' => ['required', Rule::in(array_keys(TareaTrabajo::ESTADOS))]])['estado'];
        $modelo->update(['estado' => $estado, 'hecha_at' => $estado === 'hecha' ? ($modelo->hecha_at ?? now()) : null]);

        return back()->with('ok', '«'.$modelo->titulo.'» quedó '.mb_strtolower($modelo->estadoTexto()).'.');
    }

    public function eliminarTarea(Request $request, int $tarea): RedirectResponse
    {
        $negocio = $this->negocio($request);
        abort_unless($this->puedeAsignar($request), 403, 'No tienes permiso para eliminar tareas.');
        $modelo = $negocio->tareas()->findOrFail($tarea);
        $modelo->delete();

        return redirect()->route('negocio.equipo', ['pestana' => 'tareas'])->with('ok', 'Se eliminó la tarea «'.$modelo->titulo.'».');
    }

    // ------------------------------------------------------------- Apoyo

    /**
     * Lo que se pide al asociar o editar a un trabajador.
     *
     * @return array{pivote: array<string, mixed>, horario: ?array, modulos: string[]}
     */
    private function datosTrabajador(Request $request, Negocio $negocio): array
    {
        $datos = $request->validate([
            'cargo' => ['nullable', 'string', 'max:60'],
            'sede_id' => ['nullable', 'integer', Rule::exists('sedes', 'id')->where('negocio_id', $negocio->id)->where('activa', true)],
            'vitrina' => ['array'],
            'vitrina.*' => [Rule::in(Negocio::PERMISOS)],
            'modulos' => ['array'],
            'modulos.*' => [Rule::in(array_keys(Gestion::permisosAsignables($negocio)))],
            'dias' => ['array'],
            'dias.*' => ['integer', 'between:1,7'],
            'entrada' => ['array'],
            'salida' => ['array'],
        ], [
            'modulos.*.in' => 'Ese permiso de módulo no está disponible para el negocio.',
            'sede_id.exists' => 'Elige una sede activa del negocio.',
        ], ['cargo' => 'cargo', 'sede_id' => 'sede']);

        $vitrina = $datos['vitrina'] ?? [];

        return [
            'pivote' => [
                'cargo' => filled($datos['cargo'] ?? null) ? trim($datos['cargo']) : null,
                'sede_id' => $datos['sede_id'] ?? null,
                ...collect(Negocio::PERMISOS)->mapWithKeys(fn ($p) => [$p => in_array($p, $vitrina, true)])->all(),
            ],
            'horario' => Horario::desdeFormulario($request->only(['dias', 'entrada', 'salida'])),
            'modulos' => array_values(array_unique($datos['modulos'] ?? [])),
        ];
    }

    /** @return array<string, mixed> */
    private function datosTarea(Request $request, Negocio $negocio, bool $nueva, ?TareaTrabajo $actual = null): array
    {
        $tipo = $request->input('tipo') === 'pedido' ? 'pedido' : 'tarea';
        $datos = $request->validate([
            'user_id' => ['required', 'integer'],
            'pedido_id' => [Rule::requiredIf($tipo === 'pedido'), 'nullable', 'integer'],
            'titulo' => [Rule::requiredIf($tipo === 'tarea'), 'nullable', 'string', 'max:150'],
            'descripcion' => ['nullable', 'string', 'max:2000'],
            'fecha' => ['nullable', 'date_format:Y-m-d', ...($nueva ? ['after_or_equal:today'] : [])],
        ], [
            'pedido_id.required' => 'Elige el pedido que va a atender.',
            'titulo.required' => 'Escribe qué tiene que hacer.',
            'fecha.after_or_equal' => 'La fecha no puede ser de un día que ya pasó.',
        ], ['user_id' => 'trabajador', 'pedido_id' => 'pedido', 'titulo' => 'tarea', 'descripcion' => 'detalle', 'fecha' => 'fecha']);

        $persona = $negocio->miembrosActivos()->whereKey($datos['user_id'])->first();
        if (! $persona) {
            throw ValidationException::withMessages(['user_id' => 'Elige un trabajador del negocio.']);
        }
        $pedido = null;
        if ($tipo === 'pedido') {
            $pedido = $negocio->pedidos()->find($datos['pedido_id']);
            $sigue = $pedido && (in_array($pedido->estado, Pedido::EN_CURSO, true) || $pedido->id === $actual?->pedido_id);
            if (! $sigue) {
                throw ValidationException::withMessages(['pedido_id' => 'Ese pedido ya no está en curso.']);
            }
        }

        return [
            'user_id' => $persona->id,
            'sede_id' => $actual && $actual->user_id === $persona->id ? $actual->sede_id : $persona->pivot->sede_id,
            'pedido_id' => $pedido?->id,
            'titulo' => filled($datos['titulo'] ?? null) ? trim($datos['titulo']) : 'Atender el pedido '.($pedido->codigo ?? '#'.$pedido->id),
            'descripcion' => filled($datos['descripcion'] ?? null) ? trim($datos['descripcion']) : null,
            'fecha' => $datos['fecha'] ?? null,
            'urgente' => $request->boolean('urgente'),
        ];
    }

    /**
     * Las dos próximas semanas para «Para cuándo» (el calendario del
     * navegador cambia en cada uno y a veces no abre).
     *
     * @return array<string, string>
     */
    private function fechas(): array
    {
        $fechas = [];
        for ($i = 0; $i < 14; $i++) {
            $dia = today()->addDays($i)->locale('es');
            $texto = $dia->translatedFormat('l j \d\e F');
            $fechas[$dia->format('Y-m-d')] = match ($i) {
                0 => 'Hoy · '.$texto,
                1 => 'Mañana · '.$texto,
                default => mb_strtoupper(mb_substr($texto, 0, 1)).mb_substr($texto, 1),
            };
        }

        return $fechas;
    }

    /** Push al trabajador, salvo que se la asigne uno mismo. */
    private function avisarAsignada(TareaTrabajo $tarea, Request $request): void
    {
        if ($tarea->user_id !== $request->user()->id && $tarea->trabajador) {
            Push::enviar($tarea->trabajador, new TareaAsignada($tarea));
        }
    }

    private function puedeAsignar(Request $request): bool
    {
        return Gestion::puede($request->user(), $this->negocio($request), 'equipo.tareas');
    }

    private function negocio(Request $request): Negocio
    {
        return $request->attributes->get('negocio_web');
    }
}
