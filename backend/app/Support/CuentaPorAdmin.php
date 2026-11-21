<?php

namespace App\Support;

use App\Models\User;
use App\Rules\Telefono;
use App\Support\Telefono\CodigosTelefono;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Cuentas que crea un administrador (panel web o pantalla de admin de la app).
 *
 *  - Cliente o domiciliario: entran a la app como cualquiera, con su celular
 *    (queda verificado: el admin responde por él) y una clave de 4 números
 *    que el admin les da y ellos pueden cambiar.
 *  - Administrador: entra al panel web con usuario (o correo) y contraseña.
 */
class CuentaPorAdmin
{
    /** Crea la cuenta de la app (cliente o domiciliario) con celular y clave. */
    public static function deLaApp(Request $request, string $rol): User
    {
        $request->merge(['telefono' => CodigosTelefono::normalizar($request->input('telefono')) ?? $request->input('telefono')]);
        $datos = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'apellidos' => ['nullable', 'string', 'max:255'],
            'telefono' => ['required', 'string', new Telefono],
            'pin' => ['required', 'string', new \App\Rules\ClaveCuatro],
        ], [
            'telefono.required' => 'Escribe el celular de la persona: con él entra a la app.',
            'pin.required' => 'Escribe la clave de 4 números con la que entrará.',
        ]);

        return DB::transaction(function () use ($datos, $rol) {
            if (CodigosTelefono::cuentaConTelefono($datos['telefono'])) {
                throw ValidationException::withMessages(['telefono' => ['Ese celular ya tiene una cuenta.']]);
            }
            $user = User::create([
                'name' => trim($datos['name']),
                'apellidos' => filled($datos['apellidos'] ?? null) ? trim($datos['apellidos']) : null,
                'telefono' => $datos['telefono'],
            ]);
            $user->forceFill(['telefono_verificado_at' => now(), 'pin' => $datos['pin']])->save();
            $user->syncRoles(User::rolesDelTipo($rol));

            return $user;
        });
    }
}
