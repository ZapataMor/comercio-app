<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Entrada al panel web del negocio: el navegador muestra un código, la
 * persona lo aprueba desde la app (su teléfono de confianza) y el navegador
 * queda con sesión. La misma fila es la sesión web: si se cierra desde la app,
 * el navegador pierde el acceso. Lo maneja App\Gestion\AccesosWeb.
 */
class AccesoWeb extends Model
{
    protected $table = 'accesos_web';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'expira_at' => 'datetime',
            'aprobado_at' => 'datetime',
            'usado_at' => 'datetime',
            'ultimo_uso_at' => 'datetime',
            'cerrado_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** El código como se muestra: ABCD-EFGH. */
    public function codigoVisible(): string
    {
        return substr($this->codigo, 0, 4).'-'.substr($this->codigo, 4);
    }
}
