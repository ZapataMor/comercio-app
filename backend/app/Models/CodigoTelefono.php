<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Código de 6 dígitos enviado por WhatsApp. Lo maneja App\Support\Telefono\CodigosTelefono. */
class CodigoTelefono extends Model
{
    protected $table = 'codigos_telefono';

    protected $guarded = ['id'];

    protected $hidden = ['codigo', 'token'];

    protected function casts(): array
    {
        return [
            'intentos' => 'integer',
            'expira_at' => 'datetime',
            'verificado_at' => 'datetime',
        ];
    }
}
