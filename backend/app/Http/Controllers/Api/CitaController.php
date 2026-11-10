<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cita;
use App\Models\Negocio;
use App\Models\User;
use App\Notifications\CitaActualizada;
use App\Support\AgendaCitas;
use App\Support\HorarioNegocio;
use App\Support\Push;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CitaController extends Controller
{
    public function disponibilidad(Request $request, Negocio $negocio): JsonResponse
    {
        abort_if($negocio->archivado_at || $negocio->estaVetado(), 404);
        $d = $request->validate([
            'fecha' => ['required', 'date_format:Y-m-d', 'after_or_equal:today', 'before_or_equal:'.now()->addDays(90)->format('Y-m-d')],
            'servicio_id' => ['required', 'integer'], 'profesional_id' => ['nullable', 'integer'],
        ]);
        $servicio = $negocio->servicios()->where('disponible', true)->where('permite_citas', true)->findOrFail($d['servicio_id']);
        $profesionales = $negocio->miembrosActivos()->orderBy('name')->get();
        $profesional = isset($d['profesional_id']) ? $profesionales->firstWhere('id', $d['profesional_id']) : $profesionales->first();
        abort_unless($profesional, 422, 'Selecciona un profesional activo del negocio.');
        $dia = Carbon::parse($d['fecha'])->startOfDay();
        $limite = $dia->copy()->addDay();
        $ocupadas = AgendaCitas::ocupadas($profesional->id)->where('inicio', '<', $limite->copy()->addDay())->where('fin', '>', $dia)->get();
        $horas = [];
        foreach (HorarioNegocio::intervalosDeFecha($negocio->horario, $dia) as [$abre, $cierra]) {
            for ($hora = $abre->copy(); $hora->lt($cierra) && $hora->lt($limite); $hora->addMinutes(15)) {
                if ($hora->lt($dia) || $hora->lte(now()) || $hora->gt(now()->addDays(90))) {
                    continue;
                }
                $fin = $hora->copy()->addMinutes($servicio->duracion_minutos);
                if ($fin->gt($cierra)) {
                    continue;
                }
                if ($ocupadas->contains(fn ($cita) => $cita->inicio->lt($fin) && $cita->fin->gt($hora))) {
                    continue;
                }
                $horas[] = $hora->format('H:i');
            }
        }

        return response()->json([
            'fecha' => $d['fecha'], 'profesional_id' => $profesional->id,
            'profesionales' => $profesionales->map(fn ($p) => ['id' => $p->id, 'nombre' => trim($p->name.' '.$p->apellidos)]),
            'horas' => array_values(array_unique($horas)), 'duracion_minutos' => $servicio->duracion_minutos,
            'mensaje' => ! $negocio->horario ? 'El negocio debe configurar su horario automático para recibir citas.' : null,
        ]);
    }

    public function store(Request $request, Negocio $negocio): JsonResponse
    {
        return $this->crear($request, $negocio, false);
    }

    public function presencial(Request $request, Negocio $negocio): JsonResponse
    {
        abort_unless($negocio->esMiembroActivo($request->user()), 403);

        return $this->crear($request, $negocio, true);
    }

    private function crear(Request $request, Negocio $negocio, bool $presencial): JsonResponse
    {
        $d = $request->validate([
            'servicio_id' => ['required', 'integer'], 'profesional_id' => ['required', 'integer'],
            'fecha' => ['required', 'date_format:Y-m-d'], 'hora' => ['required', 'date_format:H:i'],
            'notas' => ['nullable', 'string', 'max:1000'],
            'cliente_nombre' => [$presencial ? 'required' : 'nullable', 'string', 'max:150'],
            'cliente_telefono' => ['nullable', 'string', 'max:30'],
        ]);
        $cita = AgendaCitas::crear($negocio, $request->user(), $d, $presencial);
        if (! $presencial) {
            AgendaCitas::avisar($cita, true);
        }

        return response()->json(['cita' => AgendaCitas::datos($cita)], 201);
    }

    public function index(Request $request): JsonResponse
    {
        AgendaCitas::vencer(clienteId: $request->user()->id);

        return $this->lista(Cita::where('cliente_id', $request->user()->id));
    }

    public function negocio(Request $request, Negocio $negocio): JsonResponse
    {
        abort_unless($negocio->esMiembroActivo($request->user()), 403);
        $d = $request->validate(['fecha' => ['nullable', 'date_format:Y-m-d']]);
        AgendaCitas::vencer(negocioId: $negocio->id);

        return $this->lista(Cita::where('negocio_id', $negocio->id)->when($d['fecha'] ?? null, fn ($q, $fecha) => $q->whereDate('inicio', $fecha)));
    }

    private function lista($query): JsonResponse
    {
        $pagina = $query->with(['negocio', 'profesional'])
            ->orderByRaw("CASE WHEN estado = 'pendiente' THEN 0 WHEN estado = 'confirmada' AND fin > ? THEN 1 ELSE 2 END", [now()])
            ->orderBy('inicio')->orderBy('id')->paginate(30);

        return response()->json(['citas' => $pagina->getCollection()->map(fn ($c) => AgendaCitas::datos($c)), 'pagina' => $pagina->currentPage(), 'ultima_pagina' => $pagina->lastPage()]);
    }

    public function actualizar(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        abort_unless($negocio->esMiembroActivo($request->user()), 403);
        $d = $request->validate(['estado' => ['required', Rule::in(['confirmada', 'rechazada', 'cancelada', 'completada'])], 'motivo' => ['required_if:estado,rechazada,cancelada', 'nullable', 'string', 'max:500']]);
        AgendaCitas::vencer(negocioId: $negocio->id);
        $cita = DB::transaction(function () use ($negocio, $request, $id, $d) {
            $negocio = Negocio::lockForUpdate()->findOrFail($negocio->id);
            abort_unless($negocio->esMiembroActivo($request->user()), 403);
            $cita = Cita::where('negocio_id', $negocio->id)->findOrFail($id);
            User::whereKey($cita->profesional_id)->lockForUpdate()->first();
            $cita = Cita::lockForUpdate()->findOrFail($id);
            $permitidos = ['pendiente' => ['confirmada', 'rechazada', 'cancelada'], 'confirmada' => ['cancelada', 'completada']];
            abort_unless(in_array($d['estado'], $permitidos[$cita->estado] ?? []), 409, 'La cita ya cambió de estado. Actualiza la agenda.');
            if ($d['estado'] === 'confirmada') {
                abort_unless($cita->confirmar_antes_de?->gt(now()) && $cita->inicio->gt(now()), 409, 'La solicitud ya venció.');
                abort_unless($cita->profesional && $negocio->esMiembroActivo($cita->profesional), 409, 'El profesional ya no pertenece al negocio. Rechaza esta solicitud.');
                abort_if($negocio->archivado_at || $negocio->estaVetado(), 409, 'Negocio no disponible.');
                abort_unless(AgendaCitas::disponible($negocio, $cita->inicio, $cita->fin), 409, 'El horario de atención cambió. Rechaza la solicitud para que el cliente elija otra hora.');
                abort_if(AgendaCitas::ocupadas($cita->profesional_id)->whereKeyNot($cita->id)->where('inicio', '<', $cita->fin)->where('fin', '>', $cita->inicio)->lockForUpdate()->first(['id']) !== null, 409, 'El profesional ya tiene otra cita en ese horario.');
            }
            if ($d['estado'] === 'completada') {
                abort_unless($cita->fin->lte(now()), 422, 'Todavía no termina la cita.');
            }
            $cita->update(['estado' => $d['estado'], 'motivo' => $d['motivo'] ?? null]);

            return $cita;
        });
        AgendaCitas::avisar($cita);

        return response()->json(['cita' => AgendaCitas::datos($cita)]);
    }

    public function cancelar(Request $request, int $id): JsonResponse
    {
        $cita = Cita::where('cliente_id', $request->user()->id)->findOrFail($id);
        AgendaCitas::vencer(clienteId: $request->user()->id);
        $cita = DB::transaction(function () use ($cita) {
            Negocio::whereKey($cita->negocio_id)->lockForUpdate()->first();
            $cita = Cita::lockForUpdate()->findOrFail($cita->id);
            abort_unless(in_array($cita->estado, ['pendiente', 'confirmada']) && $cita->inicio->gt(now()), 409, 'Esta cita ya no se puede cancelar.');
            $cita->update(['estado' => 'cancelada', 'motivo' => 'Cancelada por el cliente.']);

            return $cita;
        });
        AgendaCitas::avisar($cita, true);

        return response()->json(['cita' => AgendaCitas::datos($cita)]);
    }

    public function reasignar(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        abort_unless($negocio->esPropietario($request->user()), 403);
        $datos = $request->validate(['profesional_id' => ['required', 'integer']]);
        AgendaCitas::vencer(negocioId: $negocio->id);
        $cita = DB::transaction(function () use ($request, $negocio, $id, $datos) {
            $negocio = Negocio::lockForUpdate()->findOrFail($negocio->id);
            abort_unless($negocio->esPropietario($request->user()), 403);
            $cita = Cita::where('negocio_id', $negocio->id)->findOrFail($id);
            User::whereIn('id', [$cita->profesional_id, $datos['profesional_id']])->orderBy('id')->lockForUpdate()->get();
            $cita = Cita::lockForUpdate()->findOrFail($id);
            abort_unless(in_array($cita->estado, ['pendiente', 'confirmada']) && $cita->inicio->gt(now()), 409, 'Solo se reasignan citas futuras pendientes o confirmadas.');
            $profesional = User::findOrFail($datos['profesional_id']);
            abort_unless($negocio->esMiembroActivo($profesional) && ! $profesional->suspendido_at, 422, 'Elige a un trabajador activo del negocio.');
            abort_if($cita->profesional_id === $profesional->id, 422, 'Selecciona otro trabajador.');
            abort_if(AgendaCitas::ocupadas($profesional->id)->whereKeyNot($id)->where('inicio', '<', $cita->fin)->where('fin', '>', $cita->inicio)->lockForUpdate()->first(['id']), 409, 'Ese trabajador ya tiene una cita en ese horario.');
            $cita->update(['profesional_id' => $profesional->id]);

            return $cita->load('profesional');
        });
        Push::enviar(User::whereKey($cita->cliente_id)->get(), new CitaActualizada($cita, false, true));

        return response()->json(['cita' => AgendaCitas::datos($cita)]);
    }
}
