<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Resena;
use App\Support\ModeracionResenas;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * ADMIN: revisar las reseñas públicas. Ver las reportadas, ocultar o restaurar
 * una con su motivo y descartar los reportes de una reseña que no tiene nada
 * malo. Las reseñas no tocan la confiabilidad: ver AdminReputacionController.
 */
class AdminResenaController extends Controller
{
    private const FILTROS = ['reportadas', 'ocultas', 'todas'];

    /** 20 por página: las reportadas, primero las que tienen más reportes. */
    public function index(Request $request): JsonResponse
    {
        $filtro = in_array($request->get('filtro'), self::FILTROS, true) ? $request->get('filtro') : self::FILTROS[0];

        $resenas = Resena::with([
            'user', 'negocio:id,nombre', 'moderaciones.admin', 'reportes',
            'producto' => fn ($q) => $q->withTrashed()->select('id', 'nombre'),
        ]);

        match ($filtro) {
            'reportadas' => $resenas->reportadas()->withCount('reportesPendientes')->orderByDesc('reportes_pendientes_count')->latest(),
            'ocultas' => $resenas->whereNotNull('oculta_at')->latest('oculta_at'),
            'todas' => $resenas->latest(),
        };

        $pagina = $resenas->latest('id')->paginate(20);

        return response()->json([
            'filtro' => $filtro,
            'resenas' => collect($pagina->items())->map(fn (Resena $r) => ModeracionResenas::paraAdmin($r))->values(),
            'reportadas' => Resena::reportadas()->count(),
            'ocultas' => Resena::whereNotNull('oculta_at')->count(),
            'pagina' => $pagina->currentPage(),
            'ultima_pagina' => $pagina->lastPage(),
        ]);
    }

    public function ocultar(Request $request, int $id): JsonResponse
    {
        $motivo = $this->motivo($request);
        $resena = Resena::find($id);

        if (! $resena) {
            return response()->json(['message' => 'Reseña no encontrada.'], 404);
        }

        return ModeracionResenas::ocultar($resena, $request->user(), $motivo)
            ? response()->json(['message' => 'Reseña oculta.'])
            : response()->json(['message' => 'Esa reseña ya está oculta.'], 409);
    }

    public function restaurar(Request $request, int $id): JsonResponse
    {
        $motivo = $this->motivo($request);
        $resena = Resena::find($id);

        if (! $resena) {
            return response()->json(['message' => 'Reseña no encontrada.'], 404);
        }

        return ModeracionResenas::restaurar($resena, $request->user(), $motivo)
            ? response()->json(['message' => 'Reseña restaurada.'])
            : response()->json(['message' => 'Esa reseña no está oculta.'], 409);
    }

    public function descartarReportes(Request $request, int $id): JsonResponse
    {
        $resena = Resena::find($id);

        if (! $resena) {
            return response()->json(['message' => 'Reseña no encontrada.'], 404);
        }

        return ModeracionResenas::descartarReportes($resena, $request->user())
            ? response()->json(['message' => 'Reportes descartados.'])
            : response()->json(['message' => 'Esa reseña no tiene reportes pendientes.'], 409);
    }

    private function motivo(Request $request): string
    {
        $datos = $request->validate([
            'motivo' => ['required', 'string', 'max:200'],
        ], [
            'motivo.required' => 'Escribe el motivo.',
        ]);

        return trim($datos['motivo']);
    }
}
