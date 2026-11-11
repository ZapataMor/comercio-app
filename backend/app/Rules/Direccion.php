<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

// Conserva la dirección legible en la columna existente y valida sus tres partes.
class Direccion implements ValidationRule
{
    /** Palabras de letras, números o guiones separadas por un espacio. */
    public const TEXTO = '/\A[\p{L}\p{N}-]+(?: [\p{L}\p{N}-]+)*\z/u';

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)
            || ! preg_match('/\A(?:Calle ([^#\r\n]*?))?(?: ?Carrera ([^#\r\n]*?))? #\h*([^#\r\n]*)\z/u', $value, $partes)
            || (! trim($partes[1] ?? '') && ! trim($partes[2] ?? ''))
            || ! trim($partes[3] ?? '')
            // Calle y carrera admiten varias palabras («San Martín»); el número de la casa, no.
            || collect([$partes[1] ?? '', $partes[2] ?? ''])->contains(fn ($parte) => trim($parte) !== '' && ! preg_match(self::TEXTO, trim($parte)))
            || ! preg_match('/\A[\p{L}\p{N}-]+\z/u', trim($partes[3] ?? ''))) {
            $fail('Escribe la Calle o la Carrera (puedes escribir ambas) y el Número de la casa. Usa solo letras, números, espacios o guiones.');
        }
    }
}
