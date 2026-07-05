<?php

namespace App\Http\Controllers;

use App\Models\Barrio;
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
            'telefono' => [Rule::requiredIf($role === 'usuario'), 'nullable', 'string', 'max:30'],
        ]);

        $user = DB::transaction(function () use ($data, $role) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'], // se hashea solo (cast 'hashed' en el modelo)
                'direccion' => $role === 'usuario' ? $data['direccion'] : null,
                'barrio' => $role === 'usuario' ? $data['barrio'] : null,
                'telefono' => $role === 'usuario' ? $data['telefono'] : null,
            ]);

            $user->assignRole($role);

            if ($role === 'usuario') {
                // Si escribió un barrio que no está en el catálogo, queda como
                // sugerencia pendiente: solo él lo usa hasta que el admin lo apruebe.
                Barrio::registrarSiEsNuevo($data['barrio'], $user->id);

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
        $esCliente = $user->hasRole('usuario');

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:8', 'confirmed'],
            'password_actual' => ['required_with:password', 'string'],
            // Datos de contacto: obligatorios para clientes, opcionales para el resto.
            'direccion' => [$esCliente ? 'required' : 'sometimes', 'nullable', 'string', 'max:255'],
            'barrio' => [$esCliente ? 'required' : 'sometimes', 'nullable', 'string', 'max:120'],
            'telefono' => [$esCliente ? 'required' : 'sometimes', 'nullable', 'string', 'max:30'],
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
        if (array_key_exists('direccion', $data)) {
            $user->direccion = $data['direccion'];
        }
        if (array_key_exists('barrio', $data)) {
            $user->barrio = $data['barrio'];
        }
        if (array_key_exists('telefono', $data)) {
            $user->telefono = $data['telefono'];
        }
        $user->save();

        // Mantener sincronizada la ubicación principal del cliente con su perfil.
        if ($esCliente && ! empty($data['direccion']) && ! empty($data['barrio'])) {
            // Si escribió un barrio nuevo, queda como sugerencia pendiente (igual que en el registro).
            Barrio::registrarSiEsNuevo($data['barrio'], $user->id);

            $principal = $user->clienteDirecciones()->where('es_principal', true)->first();
            if ($principal) {
                $principal->update(['direccion' => $data['direccion'], 'barrio' => $data['barrio']]);
            } else {
                $user->clienteDirecciones()->create([
                    'direccion' => $data['direccion'],
                    'barrio' => $data['barrio'],
                    'es_principal' => true,
                ]);
            }
        }

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
            'telefono' => $user->telefono,
        ];
    }
}
