<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['sometimes', Rule::in(self::ROLES_PUBLICOS)],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'], // se hashea solo (cast 'hashed' en el modelo)
        ]);

        // Si no envían rol, por defecto es 'usuario' (cliente).
        $user->assignRole($data['role'] ?? 'usuario');

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->getRoleNames(),
            ],
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
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => $user->getRoleNames(),
            ],
            'token' => $token,
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
}
