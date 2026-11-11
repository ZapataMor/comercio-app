<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\Controller;
use App\Support\EnVivo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Los canales en vivo que la app debe escuchar con esta sesión (ver
 * App\Support\EnVivo), junto con los datos actuales de la persona. La app lo
 * vuelve a pedir cuando le avisan que cambió su perfil o sus negocios (entra a
 * un equipo, el admin le cambia el rol…): así sus pantallas y canales quedan
 * al día sin cerrar sesión.
 */
class EnVivoController extends Controller
{
    public function canales(Request $request): JsonResponse
    {
        $user = $request->user();

        $negocios = DB::table('negocio_user')
            ->join('negocios', 'negocios.id', '=', 'negocio_user.negocio_id')
            ->where('negocio_user.user_id', $user->id)
            ->where('negocio_user.activo', true)
            ->whereNull('negocios.archivado_at')
            ->pluck('negocios.id');

        $privados = [
            EnVivo::usuario($user->id),
            ...$negocios->map(fn ($id) => EnVivo::negocio((int) $id)),
            ...($user->hasRole('domiciliario') ? [EnVivo::DOMICILIARIOS] : []),
            ...($user->hasRole('administrador') ? [EnVivo::ADMIN] : []),
        ];

        return response()->json([
            'publicos' => [EnVivo::CATALOGO],
            'privados' => array_values($privados),
            'user' => AuthController::userPayload($user),
        ]);
    }
}
