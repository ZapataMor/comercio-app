<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Lo que hizo un admin con una reseña (ver Support\ModeracionResenas). */
class ResenaModeracion extends Model
{
    protected $table = 'resena_moderaciones';

    protected $fillable = ['resena_id', 'admin_id', 'accion', 'motivo'];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }
}
