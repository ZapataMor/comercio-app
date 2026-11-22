<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Una entrada de un cliente a ver una tienda (ver VisitaNegocioController). */
class NegocioVisita extends Model
{
    protected $table = 'negocio_visitas';

    public const UPDATED_AT = null;

    protected $fillable = ['negocio_id', 'user_id'];

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
