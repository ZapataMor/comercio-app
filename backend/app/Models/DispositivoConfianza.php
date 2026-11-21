<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Teléfono donde la persona ya demostró quién es (código de WhatsApp o
 * Google): ahí entra solo con su clave. Lo maneja App\Support\ClavePin.
 */
class DispositivoConfianza extends Model
{
    protected $table = 'dispositivos_confianza';

    protected $guarded = ['id'];

    protected $hidden = ['token'];

    protected function casts(): array
    {
        return [
            'ultimo_uso_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
