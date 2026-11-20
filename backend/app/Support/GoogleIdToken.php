<?php

namespace App\Support;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Verifica el «ID token» que la app recibe de Google al elegir la cuenta, y
 * devuelve quién es la persona. Nunca se confía en lo que diga la app: el
 * token va firmado por Google y aquí se comprueba la firma con sus llaves
 * públicas, quién lo emitió, para qué app se emitió (`aud`) y que no venció.
 *
 * https://developers.google.com/identity/sign-in/android/backend-auth
 */
class GoogleIdToken
{
    /** Llaves públicas con que Google firma los tokens (cambian cada pocos días). */
    public const URL_LLAVES = 'https://www.googleapis.com/oauth2/v3/certs';

    private const EMISORES = ['accounts.google.com', 'https://accounts.google.com'];

    private const CACHE = 'google-id-token-llaves';

    /**
     * @return array{sub: string, email: string, nombre: string, apellidos: string}
     *
     * @throws ValidationException si el token no es válido (campo `id_token`).
     */
    public function verificar(string $idToken, string $campo = 'id_token'): array
    {
        $clientes = config('services.google.client_ids', []);
        if ($clientes === []) {
            abort(503, 'Entrar con Google no está disponible por ahora.');
        }

        $kid = $this->kid($idToken);
        if ($kid === null) {
            throw $this->invalido($campo);
        }
        $llaves = $this->llaves();
        if (! in_array($kid, array_column($llaves['keys'], 'kid'), true) && Cache::add(self::CACHE.'-recarga', true, 60)) {
            // Google rota sus llaves cada pocos días: con una llave que no
            // conocemos se vuelven a pedir (como mucho una vez por minuto).
            Cache::forget(self::CACHE);
            $llaves = $this->llaves();
        }

        $margen = JWT::$leeway;
        JWT::$leeway = 60; // relojes un poco desfasados
        try {
            $datos = (array) JWT::decode($idToken, JWK::parseKeySet($llaves, 'RS256'));
        } catch (Throwable) {
            throw $this->invalido($campo);
        } finally {
            JWT::$leeway = $margen;
        }

        $aud = $datos['aud'] ?? null;
        $correoVerificado = ($datos['email_verified'] ?? false) === true || ($datos['email_verified'] ?? null) === 'true';

        if (! in_array($datos['iss'] ?? null, self::EMISORES, true)
            || ! is_string($aud) || ! in_array($aud, $clientes, true)
            || ! is_string($datos['sub'] ?? null) || $datos['sub'] === ''
            || ! is_string($datos['email'] ?? null) || ! $correoVerificado) {
            throw $this->invalido($campo);
        }

        return [
            'sub' => $datos['sub'],
            'email' => mb_strtolower($datos['email']),
            'nombre' => trim((string) ($datos['given_name'] ?? $datos['name'] ?? '')),
            'apellidos' => trim((string) ($datos['family_name'] ?? '')),
        ];
    }

    /** Llaves de Google, guardadas el tiempo que Google dice que valen (o una hora). */
    private function llaves(): array
    {
        $guardadas = Cache::get(self::CACHE);
        if (is_array($guardadas)) {
            return $guardadas;
        }

        $respuesta = Http::timeout(8)->acceptJson()->get(self::URL_LLAVES);
        $llaves = $respuesta->json();
        if (! $respuesta->successful() || ! is_array($llaves) || ! is_array($llaves['keys'] ?? null)) {
            abort(503, 'No fue posible comprobar tu cuenta de Google. Inténtalo de nuevo.');
        }

        preg_match('/max-age=(\d+)/', (string) $respuesta->header('Cache-Control'), $m);
        Cache::put(self::CACHE, $llaves, min(max((int) ($m[1] ?? 3600), 60), 86400));

        return $llaves;
    }

    /** La llave con que dice estar firmado el token (sin confiar aún en él). */
    private function kid(string $idToken): ?string
    {
        $partes = explode('.', $idToken);
        if (count($partes) !== 3) {
            return null;
        }
        $cabecera = json_decode((string) base64_decode(strtr($partes[0], '-_', '+/'), true), true);

        return is_array($cabecera) && is_string($cabecera['kid'] ?? null) ? $cabecera['kid'] : null;
    }

    private function invalido(string $campo): ValidationException
    {
        return ValidationException::withMessages([
            $campo => ['No fue posible confirmar tu cuenta de Google. Vuelve a intentarlo.'],
        ]);
    }
}
