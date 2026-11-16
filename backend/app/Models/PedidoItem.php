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
        'unidad_medida',
        'opciones',
    ];

    protected function casts(): array
    {
        return [
            'precio' => 'decimal:2',
            'cantidad' => 'float',
            'opciones' => 'array',
        ];
    }

    /** Subtotal de la línea (precio copiado × cantidad). */
    public function subtotal(): float
    {
        return round((float) $this->precio * $this->cantidad, 2);
    }

    /**
     * Lo que pidió el cliente en esta línea, para leerlo de corrido.
     * Ej: "Talla M · Negro" o "Sin lechuga, tomate · Extras: queso x2, tocineta".
     * `extra` (sin cantidades ni precio) es de los pedidos anteriores a los extras.
     */
    public function detalle(): ?string
    {
        $o = $this->opciones ?? [];
        $lista = fn (string $clave) => mb_strtolower(implode(', ', $o[$clave]));
        $extras = collect($o['extras'] ?? [])
            ->map(fn ($e) => mb_strtolower($e['nombre']).((int) $e['cantidad'] > 1 ? " x{$e['cantidad']}" : ''))
            ->implode(', ');

        $partes = array_filter([
            isset($o['talla']) ? "Talla {$o['talla']}" : null,
            $o['color'] ?? null,
            empty($o['sin']) ? null : 'Sin '.$lista('sin'),
            empty($o['extra']) ? null : 'Extra '.$lista('extra'),
            $extras === '' ? null : "Extras: {$extras}",
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
