<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

// Conserva la dirección legible en la columna existente y valida sus tres partes.
class Direccion implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)
            || ! preg_match('/\A(?:Calle ([^#\r\n]*?))?(?: ?Carrera ([^#\r\n]*?))? #\h*([^#\r\n]*)\z/u', $value, $partes)
            || (! trim($partes[1] ?? '') && ! trim($partes[2] ?? ''))
            || ! trim($partes[3] ?? '')
            || collect(array_slice($partes, 1))->contains(fn ($parte) => $parte !== '' && ! preg_match('/\A[\p{L}\p{N}-]+\z/u', trim($parte)))) {
            $fail('Escribe la Calle o la Carrera (puedes escribir ambas) y el Número de la casa. Usa solo letras, números o guiones en cada campo.');
        }
    }
}
