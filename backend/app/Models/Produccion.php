<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Algo que se hace, por etapas (App\Gestion\Etapas):
 *
 * 1. por_hacer: se dijo que se hará; sus materiales (los del modelo más lo
 *    que se añadió) se ajustan con − y + y todavía no se descuentan.
 * 2. terminada: se descontaron del inventario; falta ponerle nombre, precio
 *    y foto para que vaya al catálogo.
 * Y queda publicada (en el catálogo), encargo (no va al catálogo) o pedido
 * (se descontó sola porque un pedido de Vitrina quedó listo).
 *
 * Las salidas de inventario están en movimientos(); si se anula, se devuelven.
 */
class Produccion extends Model
{
    protected $table = 'producciones';

    public const POR_HACER = 'por_hacer';

    public const TERMINADA = 'terminada';

    public const PUBLICADA = 'publicada';

    public const ENCARGO = 'encargo';

    public const PEDIDO = 'pedido';

    public const ESTADOS = [
        self::POR_HACER => 'Por hacer',
        self::TERMINADA => 'Ponerle nombre',
        self::PUBLICADA => 'En el catálogo',
        self::ENCARGO => 'Encargo',
        self::PEDIDO => 'Por un pedido',
    ];

    protected $fillable = [
        'modelo_id', 'producto_id', 'nombre', 'cantidad', 'origen', 'pedido_id', 'user_id', 'nota',
        'faltantes', 'costo', 'estado', 'sede_id', 'categoria_id', 'descripcion', 'precio', 'especificaciones',
    ];

    protected $attributes = ['estado' => self::POR_HACER, 'origen' => 'manual'];

    protected function casts(): array
    {
        return [
            'cantidad' => 'float',
            'faltantes' => 'array',
            'costo' => 'integer',
            'precio' => 'integer',
            'especificaciones' => 'array',
            'anulada_at' => 'datetime',
            'terminada_at' => 'datetime',
            'publicada_at' => 'datetime',
        ];
    }

    protected function asJson($value, $flags = 0)
    {
        return parent::asJson($value, $flags | JSON_UNESCAPED_UNICODE);
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    public function modelo(): BelongsTo
    {
        return $this->belongsTo(ModeloProduccion::class, 'modelo_id');
    }

    /** El producto del catálogo donde quedó (o el del pedido). */
    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class)->withTrashed();
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class);
    }

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Lo que se va a gastar (etapa 1) o se gastó, con lo normal del modelo. */
    public function materiales(): BelongsToMany
    {
        return $this->belongsToMany(InventarioArticulo::class, 'produccion_materiales', 'produccion_id', 'articulo_id')
            ->withPivot(['cantidad', 'normal'])->withTimestamps()->orderBy('inventario_articulos.nombre');
    }

    public function movimientos(): HasMany
    {
        return $this->hasMany(InventarioMovimiento::class);
    }

    public function anulada(): bool
    {
        return $this->anulada_at !== null;
    }

    public function porHacer(): bool
    {
        return $this->estado === self::POR_HACER && ! $this->anulada();
    }

    public function terminada(): bool
    {
        return $this->estado === self::TERMINADA && ! $this->anulada();
    }

    public function estadoTexto(): string
    {
        return $this->anulada() ? 'Anulada' : (self::ESTADOS[$this->estado] ?? $this->estado);
    }

    /** Especificaciones bien formadas: [['nombre' => ..., 'valor' => ...]]. */
    public function listaEspecificaciones(): array
    {
        return array_values(array_filter((array) ($this->especificaciones ?? []),
            fn ($c) => is_array($c) && trim((string) ($c['nombre'] ?? '')) !== '' && trim((string) ($c['valor'] ?? '')) !== ''));
    }
}
