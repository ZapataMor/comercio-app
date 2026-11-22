<?php

namespace App\Support;

/**
 * Otros nombres con que la gente busca un producto, un negocio o una categoría
 * («bolígrafo» para un lapicero, «barbería» para una peluquería).
 */
class NombresAlternos
{
    public const MAXIMO = 10;

    public const LARGO = 60;

    /** Reglas de validación del campo `nombres_alternos`. */
    public static function reglas(): array
    {
        return [
            'nombres_alternos' => ['sometimes', 'nullable', 'array', 'max:'.self::MAXIMO],
            // nullable: Laravel convierte '' en null; luego se descartan.
            'nombres_alternos.*' => ['nullable', 'string', 'max:'.self::LARGO],
        ];
    }

    /**
     * Sin espacios sobrantes, vacíos ni repetidos (como suenan: «Bolígrafo» y
     * «boligrafo» son el mismo), y sin repetir el nombre principal.
     *
     * @return list<string>
     */
    public static function limpiar(?array $lista, ?string $nombre = null): array
    {
        $vistos = [Busqueda::normalizar($nombre) => true];
        $resultado = [];
        foreach ($lista ?? [] as $valor) {
            $texto = preg_replace('/\s+/u', ' ', trim((string) $valor));
            $clave = Busqueda::normalizar($texto);
            if ($clave === '' || isset($vistos[$clave])) {
                continue;
            }
            $vistos[$clave] = true;
            $resultado[] = $texto;
        }

        return array_slice($resultado, 0, self::MAXIMO);
    }

    /** Desde un campo de texto del panel web: separados por comas o renglones. */
    public static function desdeTexto(?string $texto, ?string $nombre = null): array
    {
        return self::limpiar(preg_split('/[,\n]+/', (string) $texto), $nombre);
    }
}
