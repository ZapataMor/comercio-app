<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Registro de tokens de dispositivo (FCM) para notificaciones push.
 *
 * La app móvil obtiene su token de FCM y lo manda aquí al iniciar sesión
 * (y cada vez que FCM lo rota). Al cerrar sesión, lo elimina.
 */
class DeviceTokenController extends Controller
{
    /**
     * Registra (o actualiza) el token del dispositivo para el usuario actual.
     *
     * Idempotente: si el token ya existe se reasigna al usuario que llama
     * (p. ej. si en ese teléfono inició sesión otra persona) y se refresca
     * `last_used_at`. Así nunca quedan tokens apuntando al dueño equivocado.
     */
    public function store(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'token' => ['required', 'string', 'max:255'],
            'plataforma' => ['sometimes', Rule::in(['android', 'ios'])],
        ]);

        // Buscamos por token (es único). Si existe en otro usuario, lo reasignamos
        // al actual. user_id se asigna directo (no va en $fillable, por convención).
        $device = DeviceToken::firstOrNew(['token' => $datos['token']]);
        $device->user_id = $request->user()->id;
        $device->plataforma = $datos['plataforma'] ?? 'android';
        $device->last_used_at = now();
        $device->save();

        return response()->json(['message' => 'Dispositivo registrado para notificaciones.']);
    }

    /**
     * Elimina un token (al cerrar sesión en ese dispositivo).
     * Solo borra el token si pertenece al usuario actual.
     */
    public function destroy(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'token' => ['required', 'string', 'max:255'],
        ]);

        $request->user()->deviceTokens()->where('token', $datos['token'])->delete();

        return response()->json(['message' => 'Dispositivo dado de baja.']);
    }
}
