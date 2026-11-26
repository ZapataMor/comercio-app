<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Algo que el negocio guarda en su inventario: materia prima, insumos,
 * productos terminados, herramientas… Se cuenta en su unidad y sus
 * características son libres (nombre y valor) para que sirva a cualquier
 * negocio: calibre y largo en una latonería, talla y color en una tienda de
 * ropa, presentación y sabor en una panadería.
 *
 * La existencia (cantidad) solo cambia con movimientos (App\Gestion\Inventario).
 */
class InventarioArticulo extends Model
{
    protected $table = 'inventario_articulos';

    public const TIPOS = [
        'materia_prima' => 'Materia prima',
        'insumo' => 'Insumo',
        'producto' => 'Producto terminado',
        'herramienta' => 'Herramienta o equipo',
        'otro' => 'Otro',
    ];

    /** Ayuda corta de cada tipo para el formulario. */
    public const TIPOS_AYUDA = [
        'materia_prima' => 'Con lo que se fabrica: tubos, láminas, tela, harina…',
        'insumo' => 'Lo que se gasta al trabajar: soldadura, discos, pintura, empaques…',
        'producto' => 'Lo que ya está listo para vender.',
        'herramienta' => 'Lo que se usa y no se gasta: pulidoras, taladros, moldes…',
        'otro' => 'Cualquier otra cosa que quieras contar.',
    ];

    /** clave => [en el formulario, singular, plural] */
    public const UNIDADES = [
        'unidad' => ['Unidades', 'unidad', 'unidades'],
        'par' => ['Pares', 'par', 'pares'],
        'juego' => ['Juegos', 'juego', 'juegos'],
        'caja' => ['Cajas', 'caja', 'cajas'],
        'paquete' => ['Paquetes', 'paquete', 'paquetes'],
        'bulto' => ['Bultos', 'bulto', 'bultos'],
        'rollo' => ['Rollos', 'rollo', 'rollos'],
        'lamina' => ['Láminas', 'lámina', 'láminas'],
        'kg' => ['Kilos (kg)', 'kg', 'kg'],
        'g' => ['Gramos (g)', 'g', 'g'],
        'lb' => ['Libras (lb)', 'lb', 'lb'],
        'm' => ['Metros (m)', 'm', 'm'],
        'cm' => ['Centímetros (cm)', 'cm', 'cm'],
        'm2' => ['Metros cuadrados (m²)', 'm²', 'm²'],
        'l' => ['Litros (L)', 'L', 'L'],
        'ml' => ['Mililitros (mL)', 'mL', 'mL'],
        'gal' => ['Galones', 'galón', 'galones'],
    ];

    /** Características que se sugieren siempre (las del negocio van primero). */
    public const CARACTERISTICAS_SUGERIDAS = [
        'Material', 'Color', 'Medida', 'Largo', 'Ancho', 'Alto', 'Espesor', 'Calibre',
        'Diámetro', 'Peso', 'Marca', 'Modelo', 'Talla', 'Acabado', 'Presentación', 'Sabor',
    ];

    public const MAX_CARACTERISTICAS = 20;

    protected $fillable = [
        'sede_id', 'tipo', 'nombre', 'categoria', 'referencia', 'descripcion', 'imagen',
        'unidad', 'minimo', 'costo', 'proveedor', 'caracteristicas',
    ];

    protected $attributes = ['tipo' => 'materia_prima', 'unidad' => 'unidad', 'cantidad' => 0];

    protected function casts(): array
    {
        return [
            'cantidad' => 'float',
            'minimo' => 'float',
            'costo' => 'integer',
            'caracteristicas' => 'array',
        ];
    }

    /** Tildes tal cual en el JSON, para que la búsqueda encuentre «lámina». */
    protected function asJson($value, $flags = 0)
    {
        return parent::asJson($value, $flags | JSON_UNESCAPED_UNICODE);
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(InventarioMovimiento::class, 'articulo_id');
    }

    public function tipoTexto(): string
    {
        return self::TIPOS[$this->tipo] ?? $this->tipo;
    }

    /** Características bien formadas: [['nombre' => ..., 'valor' => ...]]. */
    public function listaCaracteristicas(): array
    {
        return array_values(array_filter((array) ($this->caracteristicas ?? []),
            fn ($c) => is_array($c) && trim((string) ($c['nombre'] ?? '')) !== '' && trim((string) ($c['valor'] ?? '')) !== ''));
    }

    /** agotado | bajo | ok */
    public function estado(): string
    {
        return match (true) {
            $this->cantidad <= 0 => 'agotado',
            $this->minimo !== null && $this->cantidad <= $this->minimo => 'bajo',
            default => 'ok',
        };
    }

    public function estadoTexto(): string
    {
        return ['agotado' => 'Agotado', 'bajo' => 'Por acabarse', 'ok' => 'Hay existencias'][$this->estado()];
    }

    /** «24 láminas», «2,5 kg», «1 unidad». */
    public function cantidadTexto(?float $cantidad = null): string
    {
        $cantidad ??= $this->cantidad;

        return self::numero($cantidad).' '.self::nombreUnidad($this->unidad, $cantidad);
    }

    /** Valor de lo que hay (existencia × costo), si tiene costo. */
    public function valor(): ?int
    {
        return $this->costo !== null ? (int) round($this->cantidad * $this->costo) : null;
    }

    public static function nombreUnidad(string $unidad, float $cantidad): string
    {
        $u = self::UNIDADES[$unidad] ?? [$unidad, $unidad, $unidad];

        return abs($cantidad - 1) < 0.0005 ? $u[1] : $u[2];
    }

    /** 1500 → «1.500»; 2.5 → «2,5»; hasta tres decimales, sin ceros de más. */
    public static function numero(float $n): string
    {
        $texto = number_format($n, 3, ',', '.');

        return rtrim(rtrim($texto, '0'), ',');
    }
}
