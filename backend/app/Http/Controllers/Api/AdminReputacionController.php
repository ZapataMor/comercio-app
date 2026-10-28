<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\ReputacionEvento;
use App\Models\User;
use App\Support\Reputacion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ADMIN: supervisar la confiabilidad de domiciliarios y negocios. Ver quién
 * está vetado o en riesgo, revisar sus eventos, anular uno injusto (por
 * ejemplo un cliente que mintió) y dar una segunda oportunidad a un vetado.
 */
class AdminReputacionController extends Controller
{
    /** Domiciliarios o negocios, primero los vetados y luego del peor al mejor. */
    public function index(Request $request): JsonResponse
    {
        $tipo = $request->get('tipo') === Reputacion::NEGOCIO ? Reputacion::NEGOCIO : Reputacion::DOMICILIARIO;

        if ($tipo === Reputacion::NEGOCIO) {
            $sujetos = Negocio::with('user:id,name,apellidos')
                ->orderByRaw('vetado_at is null')
                ->orderBy('reputacion')
                ->orderBy('nombre')
                ->get()
                ->map(fn (Negocio $n) => [
                    'id' => $n->id,
                    'nombre' => $n->nombre,
                    'detalle' => $n->user?->nombre_completo,
                    'reputacion' => Reputacion::resumen($tipo, $n),
                ]);
        } else {
            $sujetos = User::role('domiciliario')
                ->orderByRaw('domiciliario_vetado_at is null')
                ->orderBy('reputacion_domiciliario')
                ->orderBy('name')
                ->get()
                ->map(fn (User $u) => [
                    'id' => $u->id,
                    'nombre' => $u->nombre_completo,
                    'detalle' => $u->email,
                    'reputacion' => Reputacion::resumen($tipo, $u),
                ]);
        }

        return response()->json([
            'tipo' => $tipo,
            'sujetos' => $sujetos,
            'vetados' => $sujetos->where('reputacion.vetado', true)->count(),
            'en_riesgo' => $sujetos->where('reputacion.nivel', 'riesgo')->count(),
        ]);
    }

    /** Detalle: nivel + todos los eventos (también los anulados). */
    public function show(string $tipo, int $id): JsonResponse
    {
        $sujeto = $this->sujeto($tipo, $id);
        if (! $sujeto) {
            return response()->json(['message' => 'No encontrado.'], 404);
        }

        return response()->json([
            'reputacion' => Reputacion::resumen($tipo, $sujeto),
            'eventos' => Reputacion::historial($tipo, $sujeto, limite: 100, conAnulados: true),
        ]);
    }

    /** Anula un evento injusto; el puntaje se recalcula y puede levantar el veto. */
    public function anular(Request $request, int $id): JsonResponse
    {
        $evento = ReputacionEvento::whereNull('anulado_at')->find($id);
        $sujeto = $evento ? $this->sujeto($evento->tipo, $evento->sujeto_id) : null;

        if (! $evento || ! $sujeto) {
            return response()->json(['message' => 'Ese evento no existe o ya fue anulado.'], 404);
        }

        Reputacion::anular($evento, $sujeto, $request->user()->id);

        return response()->json([
            'message' => 'Evento anulado.',
            'reputacion' => Reputacion::resumen($evento->tipo, $sujeto->refresh()),
        ]);
    }

    /** Veto manual del admin (aunque el puntaje esté bien), con su motivo. */
    public function suspender(Request $request, string $tipo, int $id): JsonResponse
    {
        $datos = $request->validate([
            'motivo' => ['required', 'string', 'max:200'],
        ]);

        $sujeto = $this->sujeto($tipo, $id);
        if (! $sujeto) {
            return response()->json(['message' => 'No encontrado.'], 404);
        }

        if (Reputacion::resumen($tipo, $sujeto)['vetado']) {
            return response()->json(['message' => 'Ya está vetado.'], 409);
        }

        Reputacion::suspender($tipo, $sujeto, $request->user()->id, trim($datos['motivo']));

        return response()->json([
            'message' => 'Suspendido.',
            'reputacion' => Reputacion::resumen($tipo, $sujeto->refresh()),
        ]);
    }

    /** Levanta el veto: queda en "En riesgo" y las faltas graves viejas no cuentan. */
    public function levantarVeto(Request $request, string $tipo, int $id): JsonResponse
    {
        $sujeto = $this->sujeto($tipo, $id);
        if (! $sujeto) {
            return response()->json(['message' => 'No encontrado.'], 404);
        }

        if (! Reputacion::resumen($tipo, $sujeto)['vetado']) {
            return response()->json(['message' => 'No está vetado.'], 409);
        }

        Reputacion::darSegundaOportunidad($tipo, $sujeto, $request->user()->id);

        return response()->json([
            'message' => 'Veto levantado. Queda en observación.',
            'reputacion' => Reputacion::resumen($tipo, $sujeto->refresh()),
        ]);
    }

    private function sujeto(string $tipo, int $id): ?Model
    {
        return match ($tipo) {
            Reputacion::NEGOCIO => Negocio::find($id),
            Reputacion::DOMICILIARIO => User::find($id),
            default => null,
        };
    }
}
