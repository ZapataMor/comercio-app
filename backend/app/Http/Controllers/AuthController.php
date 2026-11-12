<?php

namespace App\Http\Controllers;

use App\Http\Middleware\CuentaActiva;
use App\Models\Barrio;
use App\Models\User;
use App\Support\Telefono\CodigosTelefono;
use App\Support\UbicacionDomiciliario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    /**
     * Registro de un nuevo usuario. Devuelve un token Sanctum.
     *
     * Toda cuenta nueva es de tipo Cliente (rol 'usuario'). Desde ahí la
     * persona puede crear sus negocios ("Mis negocios") y hacerse
     * domiciliaria (hacerseDomiciliario). El rol 'administrador' lo asigna
     * otro admin.
     */
    public function register(Request $request, CodigosTelefono $codigos): JsonResponse
    {
        $request->merge(['telefono' => CodigosTelefono::normalizar($request->input('telefono')) ?? $request->input('telefono')]);
        if (is_string($request->input('email')) && trim($request->input('email')) === '') {
            $request->merge(['email' => null]);
        }
        $data = $request->validate([
            // Nombre(s) y apellidos se piden por separado.
            'name' => ['required', 'string', 'max:255'],
            'apellidos' => ['required', 'string', 'max:255'],
            // Opcional: se entra con el celular verificado; el correo es otra forma más.
            'email' => ['nullable', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['present', 'string', 'min:5', 'confirmed'],
            'direccion' => ['required', 'string', 'max:255', new \App\Rules\Direccion],
            'barrio' => ['required', 'string', 'max:120', 'regex:/\A[\p{L}\p{N}-]+\z/u'],
            'telefono' => ['required', 'string', new \App\Rules\Telefono],
            // Token de /telefono/verificar: el número se confirmó por WhatsApp.
            'verificacion' => ['required', 'string', 'max:100'],
            // Autorización previa del tratamiento de datos (Ley 1581 de 2012).
            'acepta_terminos' => ['accepted'],
        ], [
            'acepta_terminos.accepted' => 'Debes aceptar la política de privacidad para crear la cuenta.',
            'verificacion.required' => 'Confirma tu número de celular con el código de WhatsApp.',
        ]);

        $user = DB::transaction(function () use ($data, $codigos) {
            $codigos->consumirTokenRegistro($data['telefono'], $data['verificacion']);
            if (CodigosTelefono::cuentaConTelefono($data['telefono'])) {
                throw ValidationException::withMessages([
                    'telefono' => ['Este número ya tiene una cuenta. Inicia sesión o recupera tu contraseña.'],
                ]);
            }

            $user = User::create([
                'name' => $data['name'],
                'apellidos' => $data['apellidos'],
                'email' => $data['email'] ?? null,
                'password' => $data['password'], // se hashea solo (cast 'hashed' en el modelo)
                'direccion' => $data['direccion'],
                'barrio' => $data['barrio'],
                'telefono' => $data['telefono'],
            ]);
            // Prueba de cuándo autorizó el tratamiento de sus datos, y del
            // celular confirmado por WhatsApp.
            $user->forceFill(['terminos_aceptados_at' => now(), 'telefono_verificado_at' => now()])->save();

            $user->assignRole('usuario');

            // Si escribió un barrio que no está en el catálogo, queda como
            // sugerencia pendiente: solo él lo usa hasta que el admin lo apruebe.
            Barrio::registrarSiEsNuevo($data['barrio'], $user->id);

            $user->clienteDirecciones()->create([
                'direccion' => $data['direccion'],
                'barrio' => $data['barrio'],
                'es_principal' => true,
            ]);

            return $user;
        });

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user' => self::userPayload($user),
            'token' => $token,
        ], 201);
    }

    /**
     * Login con correo, celular verificado o nombre de usuario (campo
     * `usuario`) + password. Devuelve un token Sanctum. Se sigue aceptando
     * el campo `email` de las versiones anteriores de la app.
     */
    public function login(Request $request): JsonResponse
    {
        $campo = $request->has('usuario') ? 'usuario' : 'email';
        $data = $request->validate([
            $campo => $campo === 'usuario' ? ['required', 'string', 'max:255'] : ['required', 'string', 'email'],
            'password' => ['present', 'string', 'min:1'],
        ], [
            'usuario.required' => 'Escribe tu correo, celular o usuario.',
        ]);

        $user = self::buscarParaAcceso($data[$campo]);

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            // Mensaje genérico: no revelamos si la cuenta existe o no.
            throw ValidationException::withMessages([
                $campo => ['Las credenciales no son correctas.'],
            ]);
        }

        if ($user->suspendido_at !== null) {
            throw ValidationException::withMessages([
                $campo => [CuentaActiva::mensajeSuspension($user)],
            ]);
        }

        $token = $user->createToken('api')->plainTextToken;

        return response()->json([
            'user' => self::userPayload($user),
            'token' => $token,
        ]);
    }

    /**
     * La cuenta a la que se refiere lo que la persona escribió al entrar:
     * correo si tiene "@", celular si son 10 dígitos que empiezan por 3 (o
     * con +57) y solo si está verificado, o si no, nombre de usuario.
     */
    public static function buscarParaAcceso(string $identificador): ?User
    {
        $identificador = trim($identificador);
        if (str_contains($identificador, '@')) {
            return User::where('email', $identificador)->first();
        }
        $telefono = CodigosTelefono::normalizar($identificador);
        if ($telefono !== null) {
            return CodigosTelefono::cuentaConTelefono($telefono);
        }

        return User::where('username', mb_strtolower($identificador))->first();
    }

    /**
     * Actualiza el perfil PERSONAL del usuario autenticado (cualquier rol).
     *
     * Es el perfil de la persona (nombre, email, contraseña), NO el del
     * negocio: eso vive en /negocios/{negocio}. Para cambiar la contraseña
     * se exige la contraseña actual.
     */
    public function actualizarPerfil(Request $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $request->user()->newQuery()->lockForUpdate()->findOrFail($request->user()->id);

            return $this->guardarPerfil($request);
        });
    }

    private function guardarPerfil(Request $request): JsonResponse
    {
        $user = $request->user();
        // Los clientes necesitan sus datos de contacto para los pedidos; las
        // cuentas creadas por un admin (domiciliario, admin) pueden no tenerlos.
        $esCliente = $user->hasRole('usuario');

        if (is_string($request->input('email')) && trim($request->input('email')) === '') {
            $request->merge(['email' => null]);
        }
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            // Opcional aquí: las cuentas creadas antes (o por un admin) pueden no tenerlos.
            'apellidos' => ['sometimes', 'nullable', 'string', 'max:255'],
            // Puede quedar vacío si la persona entra con su celular verificado.
            'email' => ['present', 'nullable', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:5', 'confirmed'],
            'password_actual' => ['exclude_without:password', 'present', 'string', 'min:1'],
            // Datos de contacto: obligatorios para clientes, opcionales para el resto.
            'direccion' => [$esCliente ? 'required' : 'sometimes', 'nullable', 'string', 'max:255', new \App\Rules\Direccion],
            'barrio' => [$esCliente ? 'required' : 'sometimes', 'nullable', 'string', 'max:120', 'regex:/\A[\p{L}\p{N}-]+\z/u'],
            'telefono' => [$esCliente ? 'required' : 'sometimes', 'nullable', 'string', new \App\Rules\Telefono],
        ]);

        // Cambiar el número a mano le quita la verificación (no se confirmó el
        // nuevo). La cuenta debe conservar al menos una forma de entrar.
        $cambiaTelefono = array_key_exists('telefono', $data) && $data['telefono'] !== $user->telefono;
        $conservaCelular = $user->telefono_verificado_at !== null && ! $cambiaTelefono;
        if (blank($data['email']) && blank($user->username) && ! $conservaCelular) {
            throw ValidationException::withMessages([
                $cambiaTelefono ? 'telefono' : 'email' => [$cambiaTelefono
                    ? 'Tu celular es tu forma de entrar: para cambiarlo, verifica el número nuevo con el código de WhatsApp.'
                    : 'El campo correo es obligatorio.'],
            ]);
        }

        if (! empty($data['password'])) {
            if (! Hash::check($data['password_actual'], $user->password)) {
                throw ValidationException::withMessages([
                    'password_actual' => ['La contraseña actual no es correcta.'],
                ]);
            }
            $user->password = $data['password']; // se hashea solo (cast 'hashed')

            $user->remember_token = Str::random(60);
        }

        $user->name = $data['name'];
        if (array_key_exists('apellidos', $data)) {
            $user->apellidos = $data['apellidos'];
        }
        $user->email = $data['email'] ?? null;
        if (array_key_exists('direccion', $data)) {
            $user->direccion = $data['direccion'];
        }
        if (array_key_exists('barrio', $data)) {
            $user->barrio = $data['barrio'];
        }
        if ($cambiaTelefono) {
            $user->telefono = $data['telefono'];
            $user->telefono_verificado_at = null;
        }
        $user->save();

        if (! empty($data['password'])) {
            $actual = $user->currentAccessToken();
            $user->tokens()->when($actual instanceof PersonalAccessToken, fn ($q) => $q->whereKeyNot($actual->getKey()))->delete();
            if (config('session.driver') === 'database') {
                DB::connection(config('session.connection'))->table(config('session.table', 'sessions'))
                    ->where('user_id', $user->id)
                    ->when($request->hasSession(), fn ($q) => $q->where('id', '!=', $request->session()->getId()))->delete();
            }
        }

        // Mantener sincronizada la ubicación principal del cliente con su perfil.
        if ($esCliente && ! empty($data['direccion']) && ! empty($data['barrio'])) {
            // Si escribió un barrio nuevo, queda como sugerencia pendiente (igual que en el registro).
            Barrio::registrarSiEsNuevo($data['barrio'], $user->id);

            $principal = $user->clienteDirecciones()->where('es_principal', true)->first();
            if ($principal) {
                if ($principal->direccion !== $data['direccion'] || $principal->barrio !== $data['barrio']) {
                    $principal->update(['direccion' => $data['direccion'], 'barrio' => $data['barrio'], 'lat' => null, 'lng' => null, 'fotos' => null]);
                }
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
            'user' => self::userPayload($user),
        ]);
    }

    /**
     * Un cliente se vuelve domiciliario: sigue siendo cliente y además puede
     * entrar en turno y tomar pedidos. Necesita un teléfono, porque el
     * cliente y el negocio lo ven para llamarlo durante la entrega.
     */
    public function hacerseDomiciliario(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasRole('usuario')) {
            return response()->json(['message' => 'Solo una cuenta de cliente puede hacerse domiciliaria.'], 403);
        }

        if (blank($user->telefono)) {
            return response()->json([
                'message' => 'Agrega tu teléfono en Mi información: el cliente y el negocio lo usan para llamarte.',
            ], 422);
        }

        $user->assignRole('domiciliario');

        return response()->json([
            'message' => 'Ya eres domiciliario. Entra en turno para recibir pedidos.',
            'user' => self::userPayload($user->fresh()),
        ]);
    }

    /**
     * El domiciliario deja de repartir y queda solo como cliente. No puede
     * con entregas en curso. Su confiabilidad (y un veto, si lo tiene) se
     * conserva por si vuelve.
     */
    public function dejarDeSerDomiciliario(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasRole('domiciliario')) {
            return response()->json(['message' => 'Tu cuenta no es de domiciliario.'], 409);
        }

        DB::transaction(function () use ($user) {
            $user = User::lockForUpdate()->findOrFail($user->id);
            abort_if(UbicacionDomiciliario::tieneEntregaEnCurso($user), 409, 'Tienes entregas en curso. Termínalas antes de dejar de ser domiciliario.');
            $user->removeRole('domiciliario');
            if (! $user->hasRole('usuario')) {
                $user->assignRole('usuario');
            }
            $user->forceFill(['en_turno' => false])->save();
            UbicacionDomiciliario::borrar($user);
        });
        $user->unsetRelation('roles');

        return response()->json([
            'message' => 'Ya no eres domiciliario. Sigues siendo cliente.',
            'user' => self::userPayload($user->fresh()),
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

    /** Lo que la app guarda de la persona en su sesión (también lo da /api/en-vivo/canales). */
    public static function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'name' => $user->name,
            'apellidos' => $user->apellidos,
            'email' => $user->email,
            'roles' => $user->getRoleNames(),
            'direccion' => $user->direccion,
            'barrio' => $user->barrio,
            'telefono' => $user->telefono,
            // Confirmado por WhatsApp: sirve para entrar y recuperar la contraseña.
            'telefono_verificado' => $user->telefono_verificado_at !== null,
            // Domiciliario: si está en turno (le llegan los avisos de pedidos).
            'en_turno' => (bool) $user->en_turno,
            // Código único para que un negocio lo invite como trabajador.
            'codigo_publico' => $user->codigo_publico,
            // Negocios donde es miembro activo, con su rol en cada uno.
            'negocios' => $user->negociosActivos()->get()->map(fn ($n) => [
                'id' => $n->id,
                'nombre' => $n->nombre,
                'rol' => $n->pivot->rol,
            ]),
        ];
    }
}
