<?php

namespace App\Support;

use App\Models\Categoria;
use App\Models\Negocio;
use App\Models\Producto;
use App\Models\Servicio;
use App\Models\TipoNegocio;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Búsqueda tolerante a errores de ortografía.
 *
 * Cada modelo buscable guarda en la columna `busqueda` su texto escrito «como
 * suena»: sin tildes ni mayúsculas y con las letras que se confunden unificadas
 * (ll/y, b/v, s/z/c, k/c/q, j/g, sin h, sin letras dobles). La consulta pasa por
 * la misma normalización, así que «poyo» encuentra «Pollo» y «sebolla» encuentra
 * «Cebolla».
 *
 * Para los errores de tecleo que no se arreglan por sonido («pllo», «arrz»),
 * cada palabra que no aparezca en el catálogo se cambia por las palabras del
 * catálogo que se le parecen (distancia de edición pequeña).
 *
 * Los términos cortos no se buscan como fragmento: con dos letras cualquier
 * texto las tiene («zzzzqqq» suena «sk», que está en «uiski» y «mariskos»).
 *
 * La columna tiene la forma "{nombre}|{resto}" para poder ordenar por
 * relevancia según coincida en el nombre o en lo demás.
 */
class Busqueda
{
    /** Modelos con columna `busqueda`; de ellos sale el vocabulario. */
    public const MODELOS = [Producto::class, Servicio::class, Negocio::class, Categoria::class, TipoNegocio::class];

    private const CACHE_VOCABULARIO = 'busqueda.vocabulario';

    /** Palabras que no ayudan a encontrar nada (ya normalizadas). */
    private const VACIAS = [
        'a', 'al', 'de', 'del', 'e', 'el', 'en', 'i', 'kon', 'la', 'las', 'lo', 'los',
        'o', 'pa', 'para', 'por', 'u', 'un', 'una', 'unas', 'unos',
    ];

    /** Texto normalizado «como suena»: palabras separadas por un espacio. */
    public static function normalizar(?string $texto): string
    {
        return implode(' ', array_map(self::fonetica(...), self::palabrasEscritas($texto)));
    }

    /** Palabras tal como se escribieron, en minúscula y sin tildes. */
    private static function palabrasEscritas(?string $texto): array
    {
        return preg_split('/[^a-z0-9]+/', strtolower(Str::ascii((string) $texto)), -1, PREG_SPLIT_NO_EMPTY);
    }

    /** Valor de la columna `busqueda` a partir del nombre y del resto de textos. */
    public static function indexar(?string $nombre, array $resto = []): string
    {
        $resto = collect($resto)->flatten()->filter(fn ($v) => is_scalar($v))->implode(' ');

        return self::normalizar($nombre).'|'.self::normalizar($resto);
    }

    private static function fonetica(string $p): string
    {
        // Marcas temporales: # = ch, % = g fuerte (gue/gui).
        $p = str_replace('ch', '#', $p);
        $p = preg_replace('/qu(?=[ei])/', 'k', $p);
        $p = preg_replace('/gu(?=[ei])/', '%', $p);
        $p = preg_replace('/g(?=[ei])/', 'j', $p);
        $p = preg_replace('/c(?=[ei])/', 's', $p);
        $p = strtr($p, ['c' => 'k', 'q' => 'k', 'z' => 's', 'v' => 'b', 'w' => 'u', 'h' => '', '%' => 'g']);
        $p = str_replace(['x', 'll', '#'], ['ks', 'y', 'ch'], $p);
        $p = preg_replace('/n(?=[bp])/', 'm', $p);
        // Letras dobles, no cifras: «500» no es «50».
        $p = preg_replace('/([a-z])\1+/', '$1', $p);
        // "muy"/"mui", "rey"/"rei"; la palabra suelta "y" queda como "i".
        $p = preg_replace('/y$/', 'i', $p);

        return $p;
    }

    /**
     * Términos de la consulta, cada uno con sus alternativas (él mismo o, si no
     * aparece en el catálogo, las palabras parecidas). Vacío si la consulta no
     * tiene letras ni números (p. ej. «%»), que entonces no debe encontrar nada.
     * Un término sin alternativas no coincide con nada.
     *
     * @return list<list<string>>
     */
    public static function terminos(string $consulta): array
    {
        // Palabra normalizada => ¿se encogió a menos de la mitad al normalizarla?
        // Pasa con lo tecleado al azar: «zzzzqqq» queda en «sk».
        $palabras = [];
        foreach (self::palabrasEscritas($consulta) as $escrita) {
            $p = self::fonetica($escrita);
            if ($p !== '') {
                $palabras[$p] = ($palabras[$p] ?? true) && strlen($p) * 2 < strlen($escrita);
            }
        }
        $utiles = array_diff_key($palabras, array_flip(self::VACIAS));
        $palabras = $utiles ?: $palabras;

        $vocabulario = $palabras ? self::vocabulario() : [];

        $terminos = [];
        foreach ($palabras as $p => $encogida) {
            $terminos[] = self::alternativas((string) $p, $vocabulario, $encogida);
        }

        return $terminos;
    }

    /**
     * La consulta normalizada con cada palabra corregida por la más parecida
     * del catálogo ("gasiosa" -> "gaseosa"), para ordenar por relevancia.
     */
    public static function fraseCorregida(string $consulta, array $terminos): string
    {
        $correcciones = [];
        foreach ($terminos as $alternativas) {
            if (count($alternativas) > 1) {
                $correcciones[$alternativas[0]] = $alternativas[1];
            }
        }

        return implode(' ', array_map(fn ($p) => $correcciones[$p] ?? $p, explode(' ', self::normalizar($consulta))));
    }

    /**
     * Alternativas de un término. Las cortas no se buscan como fragmento (ver
     * contiene()), así que solo se aceptan si el catálogo las tiene igual: una
     * de una o dos letras como palabra completa, una de tres como comienzo de
     * palabra. Lo que se encogió al normalizarlo tampoco se corrige: vale solo
     * si es una palabra del catálogo.
     *
     * @return list<string>
     */
    private static function alternativas(string $termino, array $vocabulario, bool $encogida = false): array
    {
        $largo = strlen($termino);
        if ($encogida || $largo < 3) {
            return in_array($termino, $vocabulario, true) ? [$termino] : [];
        }
        foreach ($vocabulario as $palabra) {
            if ($largo === 3 ? str_starts_with($palabra, $termino) : str_contains($palabra, $termino)) {
                return [$termino];
            }
        }

        $maximo = $largo <= 5 ? 1 : 2;
        $candidatas = [];
        foreach ($vocabulario as $palabra) {
            if (strlen($palabra) < 3 || in_array($palabra, self::VACIAS, true)) {
                continue;
            }
            $diferencia = abs(strlen($palabra) - $largo);
            $distancia = $diferencia <= $maximo ? self::distancia($termino, $palabra) : PHP_INT_MAX;
            // Palabra a medio escribir y con error: "asetamim" -> "asetaminofen".
            if ($distancia > $maximo && $largo >= 5 && strlen($palabra) > $largo) {
                $distancia = self::distancia($termino, substr($palabra, 0, $largo)) <= 1 ? $maximo : PHP_INT_MAX;
            }
            if ($distancia <= $maximo) {
                $candidatas[$palabra] = $distancia;
            }
        }
        asort($candidatas);

        return [$termino, ...array_slice(array_keys($candidatas), 0, 15)];
    }

    /** Distancia de edición contando como un solo error dos letras cambiadas de lugar. */
    private static function distancia(string $a, string $b): int
    {
        $la = strlen($a);
        $lb = strlen($b);
        $d = [];
        for ($i = 0; $i <= $la; $i++) {
            $d[$i][0] = $i;
        }
        for ($j = 0; $j <= $lb; $j++) {
            $d[0][$j] = $j;
        }
        for ($i = 1; $i <= $la; $i++) {
            for ($j = 1; $j <= $lb; $j++) {
                $costo = $a[$i - 1] === $b[$j - 1] ? 0 : 1;
                $d[$i][$j] = min($d[$i - 1][$j] + 1, $d[$i][$j - 1] + 1, $d[$i - 1][$j - 1] + $costo);
                if ($i > 1 && $j > 1 && $a[$i - 1] === $b[$j - 2] && $a[$i - 2] === $b[$j - 1]) {
                    $d[$i][$j] = min($d[$i][$j], $d[$i - 2][$j - 2] + 1);
                }
            }
        }

        return $d[$la][$lb];
    }

    /** Palabras distintas de todo lo buscable (en caché hasta que algo cambie). */
    public static function vocabulario(): array
    {
        return Cache::remember(self::CACHE_VOCABULARIO, now()->addDay(), function () {
            $palabras = [];
            foreach (self::MODELOS as $modelo) {
                $modelo::query()->whereNotNull('busqueda')->pluck('busqueda')
                    ->each(function ($texto) use (&$palabras) {
                        foreach (preg_split('/[ |]+/', $texto, -1, PREG_SPLIT_NO_EMPTY) as $p) {
                            $palabras[$p] = true;
                        }
                    });
            }

            return array_keys($palabras);
        });
    }

    /**
     * Recalcula la columna `busqueda` de todo (tras cambiar las reglas de
     * normalización, o para filas creadas sin pasar por Eloquent).
     */
    public static function reindexar(): int
    {
        $total = 0;
        foreach (self::MODELOS as $modelo) {
            $consulta = $modelo::query();
            if (method_exists($modelo, 'bootSoftDeletes')) {
                $consulta->withTrashed();
            }
            $consulta->chunkById(500, function ($filas) use (&$total) {
                foreach ($filas as $fila) {
                    $fila->newQuery()->withoutGlobalScopes()->whereKey($fila->getKey())
                        ->toBase()->update(['busqueda' => $fila->textoBusqueda()]);
                    $total++;
                }
            });
        }
        self::olvidarVocabulario();

        return $total;
    }

    public static function olvidarVocabulario(): void
    {
        Cache::forget(self::CACHE_VOCABULARIO);
    }

    /**
     * Patrones LIKE que equivalen a contiene(). Una alternativa de una o dos
     * letras debe ser una palabra completa; una de tres, el comienzo de una
     * palabra; las demás, cualquier fragmento. Así «te» no encuentra «aceite»
     * ni «ron» encuentra «toronja». Las palabras de la columna van separadas
     * por un espacio o por la «|» entre el nombre y el resto.
     *
     * @return list<string>
     */
    private static function patrones(string $alternativa): array
    {
        $largo = strlen($alternativa);
        if ($largo >= 4) {
            return ['%'.$alternativa.'%'];
        }
        $antes = ['', '% ', '%|'];
        $despues = $largo === 3 ? ['%'] : ['', ' %', '|%'];
        $patrones = [];
        foreach ($antes as $a) {
            foreach ($despues as $d) {
                $patrones[] = $a.$alternativa.$d;
            }
        }

        return $patrones;
    }

    /** ¿Un texto ya normalizado contiene la alternativa? (como patrones()) */
    private static function contiene(string $texto, string $alternativa): bool
    {
        $largo = strlen($alternativa);
        if ($largo >= 4) {
            return str_contains($texto, $alternativa);
        }

        return (bool) preg_match('/(?:^|[ |])'.preg_quote($alternativa, '/').($largo === 3 ? '/' : '(?:$|[ |])/'), $texto);
    }

    /**
     * Añade una condición OR por cada alternativa sobre la columna dada. Las
     * alternativas solo tienen letras y números, así que no llevan comodines.
     * Sin alternativas, añade una condición falsa: un grupo vacío dejaría
     * pasar todas las filas.
     */
    public static function orContiene(Builder|Relation $q, string $columna, array $alternativas): Builder|Relation
    {
        if ($alternativas === []) {
            return $q->orWhereRaw('1 = 0');
        }
        foreach ($alternativas as $alternativa) {
            foreach (self::patrones($alternativa) as $patron) {
                $q->orWhere($columna, 'like', $patron);
            }
        }

        return $q;
    }

    /**
     * Exige que la columna contenga alguna de las alternativas, agrupadas entre
     * paréntesis. Es la que va dentro de whereHas: sin el grupo, los OR quedan
     * al nivel de la unión con la tabla padre y coincide cualquier fila.
     */
    public static function contieneAlguna(Builder|Relation $q, string $columna, array $alternativas): Builder|Relation
    {
        return $q->where(fn ($w) => self::orContiene($w, $columna, $alternativas));
    }

    /**
     * Exige que cada término aparezca (con alguna de sus alternativas) en la
     * columna. Sin términos (consulta sin letras ni números) no encuentra nada.
     */
    public static function contieneTodos(Builder|Relation $q, string $columna, array $terminos): Builder|Relation
    {
        if ($terminos === []) {
            return $q->whereRaw('1 = 0');
        }
        foreach ($terminos as $alternativas) {
            $q->where(fn ($w) => self::orContiene($w, $columna, $alternativas));
        }

        return $q;
    }

    /** ¿Un texto ya normalizado contiene todos los términos? */
    public static function coincide(string $texto, array $terminos): bool
    {
        foreach ($terminos as $alternativas) {
            if (! collect($alternativas)->contains(fn ($a) => self::contiene($texto, $a))) {
                return false;
            }
        }

        return $terminos !== [];
    }

    /**
     * LIKE "contiene" literal para columnas sin `busqueda` (correos, usuarios):
     * escapa % y _ para que se busquen tal cual. Funciona en MySQL y SQLite.
     */
    public static function orWhereLiteral(Builder|Relation $q, string $columna, string $texto): Builder|Relation
    {
        $escapado = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $texto);

        return $q->orWhereRaw("{$q->getQuery()->getGrammar()->wrap($columna)} LIKE ? ESCAPE '!'", ['%'.$escapado.'%']);
    }
}
