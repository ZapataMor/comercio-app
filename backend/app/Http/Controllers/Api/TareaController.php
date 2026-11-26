<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Negocio;
use App\Models\TareaTrabajo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * «Mis tareas» en la app: las que el negocio le asignó a la persona desde el
 * panel web. Se ven en el Inicio del negocio y se marcan con un check.
 */
class TareaController extends Controller
{
    /** Las que faltan y las que hizo hoy (para que el check no desaparezca de una). */
    public function index(Request $request, Negocio $negocio): JsonResponse
    {
        abort_unless($negocio->esMiembroActivo($request->user()), 403, 'No tienes acceso a este negocio.');

        $tareas = $negocio->tareas()->where('user_id', $request->user()->id)
            ->where(fn ($q) => $q->where('estado', '!=', 'hecha')->orWhere('hecha_at', '>=', today()))
            ->with(['pedido', 'creador'])
            ->orderByRaw("CASE WHEN estado = 'hecha' THEN 1 ELSE 0 END")
            ->orderByDesc('urgente')->orderByRaw('fecha IS NULL')->orderBy('fecha')->oldest('id')
            ->get();

        return response()->json(['tareas' => $tareas->map(fn (TareaTrabajo $t) => self::datos($t))->values()]);
    }

    /** Marcar hecha (o volver a pendiente). Solo la propia. */
    public function estado(Request $request, Negocio $negocio, int $id): JsonResponse
    {
        abort_unless($negocio->esMiembroActivo($request->user()), 403, 'No tienes acceso a este negocio.');
        $tarea = $negocio->tareas()->where('user_id', $request->user()->id)->find($id);
        abort_unless($tarea, 404, 'Esa tarea ya no existe o no es tuya.');
        $estado = $request->validate(['estado' => ['required', Rule::in(array_keys(TareaTrabajo::ESTADOS))]])['estado'];
        $tarea->update(['estado' => $estado, 'hecha_at' => $estado === 'hecha' ? ($tarea->hecha_at ?? now()) : null]);

        return response()->json(['message' => $estado === 'hecha' ? '¡Tarea hecha!' : 'La tarea quedó '.mb_strtolower($tarea->estadoTexto()).'.', 'tarea' => self::datos($tarea->load(['pedido', 'creador']))]);
    }

    /** @return array<string, mixed> */
    private static function datos(TareaTrabajo $t): array
    {
        return [
            'id' => $t->id,
            'titulo' => $t->titulo,
            'descripcion' => $t->descripcion,
            'fecha' => $t->fecha?->format('Y-m-d'),
            'urgente' => $t->urgente,
            'estado' => $t->estado,
            'atrasada' => $t->atrasada(),
            'hecha_at' => $t->hecha_at?->toIso8601String(),
            'asignada_por' => $t->creador?->name,
            'pedido' => $t->pedido ? ['id' => $t->pedido->id, 'codigo' => $t->pedido->codigo, 'estado' => $t->pedido->estado] : null,
        ];
    }
}
