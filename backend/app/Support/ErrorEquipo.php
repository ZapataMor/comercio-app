<?php

namespace App\Support;

use RuntimeException;

/** Lo que no se pudo hacer con el equipo de un negocio, con el código HTTP para la API. */
final class ErrorEquipo extends RuntimeException
{
    public function __construct(string $mensaje, public readonly int $estado = 422)
    {
        parent::__construct($mensaje);
    }
}
