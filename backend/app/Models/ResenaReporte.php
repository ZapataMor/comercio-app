<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Un usuario avisa que una reseña no debería estar publicada. */
class ResenaReporte extends Model
{
    protected $table = 'resena_reportes';

    protected $fillable = ['resena_id', 'user_id', 'motivo', 'resuelto_at'];

    protected function casts(): array
    {
        return ['resuelto_at' => 'datetime'];
    }
}
