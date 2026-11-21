<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Clave de 4 números que no sea fácil de adivinar: ni repetida (0000), ni
 * seguida (1234, 9876), ni dos pares iguales (1212), ni de las más usadas.
 */
class ClaveCuatro implements ValidationRule
{
    /** Las más comunes que no caen en las otras reglas. */
    private const COMUNES = ['1004', '2000', '1122', '1010', '2001', '1001', '2580', '0852'];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! preg_match('/\A\d{4}\z/', $value)) {
            $fail('La clave debe tener exactamente 4 números.');

            return;
        }

        if ($motivo = self::motivoDebil($value)) {
            $fail($motivo);
        }
    }

    /** Por qué la clave es fácil de adivinar, o null si sirve. */
    public static function motivoDebil(string $clave): ?string
    {
        $d = array_map('intval', str_split($clave));

        if (count(array_unique($d)) === 1) {
            return 'No uses el mismo número cuatro veces.';
        }

        $sube = $baja = true;
        for ($i = 1; $i < 4; $i++) {
            $sube = $sube && $d[$i] === $d[$i - 1] + 1;
            $baja = $baja && $d[$i] === $d[$i - 1] - 1;
        }
        if ($sube || $baja) {
            return 'No uses números seguidos como 1234 o 4321.';
        }

        if ($d[0] === $d[2] && $d[1] === $d[3]) {
            return 'No repitas el mismo par, como 1212.';
        }

        if (in_array($clave, self::COMUNES, true)) {
            return 'Esa clave es de las más usadas. Elige otra.';
        }

        return null;
    }
}
