<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PedidoItem extends Model
{
    protected $table = 'pedido_items';

    protected $fillable = [
        'producto_id',
        'nombre',
        'precio',
        'cantidad',
        'opciones',
    ];

    protected function casts(): array
    {
        return [
            'precio' => 'decimal:2',
            'cantidad' => 'integer',
            'opciones' => 'array',
        ];
    }

    /** Subtotal de la línea (precio copiado × cantidad). */
    public function subtotal(): float
    {
        return (float) $this->precio * $this->cantidad;
    }

    /**
     * Lo que pidió el cliente en esta línea, para leerlo de corrido.
     * Ej: "Talla M · Negro" o "Sin lechuga, tomate · Extra queso".
     */
    public function detalle(): ?string
    {
        $o = $this->opciones ?? [];
        $lista = fn (string $clave) => mb_strtolower(implode(', ', $o[$clave]));

        $partes = array_filter([
            isset($o['talla']) ? "Talla {$o['talla']}" : null,
            $o['color'] ?? null,
            empty($o['sin']) ? null : 'Sin '.$lista('sin'),
            empty($o['extra']) ? null : 'Extra '.$lista('extra'),
        ]);

        return $partes ? implode(' · ', $partes) : null;
    }

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
