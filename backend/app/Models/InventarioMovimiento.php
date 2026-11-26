<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Entrada, salida o ajuste (conteo) de un artículo del inventario. En un
 * ajuste, «cantidad» es lo que se contó; «saldo» es la existencia que quedó.
 */
class InventarioMovimiento extends Model
{
    protected $table = 'inventario_movimientos';

    public const TIPOS = [
        'entrada' => 'Entrada',
        'salida' => 'Salida',
        'ajuste' => 'Ajuste por conteo',
    ];

    protected $fillable = ['user_id', 'tipo', 'cantidad', 'saldo', 'nota'];

    protected function casts(): array
    {
        return ['cantidad' => 'float', 'saldo' => 'float'];
    }

    public function articulo(): BelongsTo
    {
        return $this->belongsTo(InventarioArticulo::class, 'articulo_id');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function tipoTexto(): string
    {
        return self::TIPOS[$this->tipo] ?? $this->tipo;
    }
}
