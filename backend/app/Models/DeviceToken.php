<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Token de un dispositivo para notificaciones push (FCM).
 */
class DeviceToken extends Model
{
    protected $fillable = [
        'token',
        'plataforma',
        'last_used_at',
    ];

    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
        ];
    }

    /** El usuario dueño de este dispositivo. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
