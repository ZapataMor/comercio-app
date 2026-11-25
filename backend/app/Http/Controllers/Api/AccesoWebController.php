<?php

namespace App\Http\Controllers\Api;

use App\Gestion\AccesosWeb;
use App\Gestion\Gestion;
use App\Http\Controllers\Controller;
use App\Models\AccesoWeb;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Desde la app: aprobar la entrada al panel web del negocio con el código que
 * muestra el navegador, y ver o cerrar las sesiones web abiertas (ADR-005).
 */
class AccesoWebController extends Controller
{
    /** ¿Esta persona puede usar la web? (para mostrar o no la opción en la app) */
    public function disponible(Request $request): JsonResponse
    {
        $negocios = Gestion::negociosConWeb($request->user());

        return response()->json([
            'disponible' => $negocios->isNotEmpty(),
            'negocios' => $negocios->map(fn ($n) => ['id' => $n->id, 'nombre' => $n->nombre])->values(),
            'url' => route('negocio.entrar'),
        ]);
    }

    /** Paso 1: la app muestra desde qué navegador se quiere entrar. */
    public function consultar(Request $request): JsonResponse
    {
        $datos = $request->validate(['codigo' => ['required', 'string', 'max:40']]);

        return response()->json(AccesosWeb::consultar($datos['codigo']));
    }

    /** Paso 2: la persona confirma y el navegador entra. */
    public function aprobar(Request $request): JsonResponse
    {
        $datos = $request->validate(['codigo' => ['required', 'string', 'max:40']]);
        $acceso = AccesosWeb::aprobar($datos['codigo'], $request->user());

        return response()->json([
            'mensaje' => 'Listo. El panel web se abrirá en '.AccesosWeb::describirNavegador($acceso->navegador).'.',
        ]);
    }

    public function sesiones(Request $request): JsonResponse
    {
        return response()->json([
            'data' => AccesosWeb::abiertas($request->user())->map(fn ($a) => AccesosWeb::resumen($a))->values(),
        ]);
    }

    public function cerrar(Request $request, AccesoWeb $acceso): JsonResponse
    {
        abort_unless($acceso->user_id === $request->user()->id, 404);
        AccesosWeb::cerrar($acceso);

        return response()->json(['mensaje' => 'Sesión web cerrada.']);
    }

    public function cerrarTodas(Request $request): JsonResponse
    {
        AccesosWeb::abiertas($request->user())->each(fn ($a) => AccesosWeb::cerrar($a));

        return response()->json(['mensaje' => 'Se cerraron todas tus sesiones web.']);
    }
}
