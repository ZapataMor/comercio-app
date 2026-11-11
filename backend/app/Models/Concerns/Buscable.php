<?php

namespace App\Models\Concerns;

use App\Support\Busqueda;

/**
 * Mantiene al día la columna `busqueda` (texto normalizado «como suena») y el
 * vocabulario de la búsqueda tolerante a errores. Ver App\Support\Busqueda.
 */
trait Buscable
{
    /** Valor de la columna `busqueda`: Busqueda::indexar($nombre, [...]). */
    abstract public function textoBusqueda(): string;

    /** La columna es interna: no sale en las respuestas JSON. */
    public function initializeBuscable(): void
    {
        $this->makeHidden('busqueda');
    }

    protected static function bootBuscable(): void
    {
        static::saving(function ($modelo) {
            $modelo->busqueda = $modelo->textoBusqueda();
        });
        static::saved(function ($modelo) {
            if ($modelo->wasRecentlyCreated || $modelo->wasChanged('busqueda')) {
                Busqueda::olvidarVocabulario();
            }
        });
        static::deleted(fn () => Busqueda::olvidarVocabulario());
    }
}
