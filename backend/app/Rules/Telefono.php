<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class Telefono implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! preg_match('/\A3[0-9]{9}\z/', $value)) {
            $fail('El teléfono debe tener exactamente 10 números y empezar por 3.');
        }
    }
}
