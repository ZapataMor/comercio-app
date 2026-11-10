<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PedidoReporte extends Model
{
    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['resuelto_at' => 'datetime'];
    }

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }

    public static function registrar(Pedido $pedido, string $objetivo, string $tipo, string $motivo, ?int $autor = null): self
    {
        return self::firstOrCreate(
            ['pedido_id' => $pedido->id, 'objetivo' => $objetivo, 'tipo' => $tipo],
            ['motivo' => $motivo, 'reportado_por' => $autor],
        );
    }
}
