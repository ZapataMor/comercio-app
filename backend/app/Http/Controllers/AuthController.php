<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Roles que un usuario puede elegir al registrarse por su cuenta.
     *
     * IMPORTANTE (seguridad): NUNCA incluir 'administrador' ni 'domiciliario'.
     * Esos roles los asigna un admin manualmente. Si dejaras que el cliente
     * mande cualquier rol, cualquiera podría registrarse como administrador.
     */
    private const ROLES_PUBLICOS = ['usuario', 'comerciante'];

    /**
     * Registro de un nuevo usuario. Devuelve un token Sanctum.
     */
    public function register(Request $request): JsonResponse
    {
        $role = $request->input('role', 'usuario');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['sometimes', Rule::in(self::ROLES_PUBLICOS)],
            'direccion' => [Rule::requiredIf($role === 'usuario'), 'nullable', 'string', 'max:255'],
            'barrio' => [Rule::requiredIf($role === 'usuario'), 'nullable', 'string', 'max:120'],
        ]);

        $user = DB::transaction(function () use ($data, $role) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'], // se hashea solo (cast 'hashed' en el modelo)
                'direccion' => $role === 'usuario' ? $data['direccion'] : null,
                'barrio' => $role === 'usuario' ? $data['barrio'] : null,
            ]);

            $user->assignRole($role);

            if ($role === 'usuario') {
                $user->clienteDirecciones()->create([
                    'direccion' => $data['direccion'],
                    'barrio' => $data['barrio'],
                    'es_principal' => true,
                ]);
            }

            return $user;
        });

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user' => $this->userPayload($user),
            'token' => $token,
        ], 201);
    }

    /**
     * Login con email + password. Devuelve un token Sanctum.
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            // Mensaje genérico: no revelamos si el email existe o no.
            throw ValidationException::withMessages([
                'email' => ['Las credenciales no son correctas.'],
            ]);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user' => $this->userPayload($user),
            'token' => $token,
        ]);
    }

    /**
     * Actualiza el perfil PERSONAL del usuario autenticado (cualquier rol).
     *
     * Es el perfil de la persona (nombre, email, contraseña), NO el del
     * negocio: eso vive en /comerciante/negocio. Para cambiar la contraseña
     * se exige la contraseña actual.
     */
    public function actualizarPerfil(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'confirmed'],
            'password_actual' => ['required_with:password', 'string'],
        ]);

        if (! empty($data['password'])) {
            if (! Hash::check($data['password_actual'], $user->password)) {
                throw ValidationException::withMessages([
                    'password_actual' => ['La contraseña actual no es correcta.'],
                ]);
            }
            $user->password = $data['password']; // se hashea solo (cast 'hashed')
        }

        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->save();

        return response()->json([
            'message' => 'Perfil actualizado.',
            'user' => $this->userPayload($user),
        ]);
    }

    /**
     * Logout: revoca SOLO el token con el que se hizo la petición.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Sesión cerrada correctamente.',
        ]);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->getRoleNames(),
            'direccion' => $user->direccion,
            'barrio' => $user->barrio,
        ];
    }
}
