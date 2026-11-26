<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Algo que se fabricó y espera sus datos puntuales (medidas, color, foto,
 * precio) para entrar al catálogo: como producto nuevo o sumándose a las
 * existencias de uno que ya está. Ver App\Gestion\Terminados.
 */
class ProductoEnEspera extends Model
{
    protected $table = 'productos_en_espera';

    public const EN_ESPERA = 'en_espera';

    public const PUBLICADO = 'publicado';

    public const DESCARTADO = 'descartado';

    protected $fillable = ['producto_id', 'produccion_id', 'sede_id', 'user_id', 'cantidad', 'nombre', 'descripcion', 'precio', 'especificaciones', 'imagen'];

    protected function casts(): array
    {
        return [
            'cantidad' => 'float',
            'precio' => 'integer',
            'especificaciones' => 'array',
            'publicado_at' => 'datetime',
        ];
    }

    protected function asJson($value, $flags = 0)
    {
        return parent::asJson($value, $flags | JSON_UNESCAPED_UNICODE);
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class)->withTrashed();
    }

    public function produccion(): BelongsTo
    {
        return $this->belongsTo(Produccion::class);
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function publicadoEn(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'publicado_en')->withTrashed();
    }

    /** Especificaciones bien formadas: [['nombre' => ..., 'valor' => ...]]. */
    public function listaEspecificaciones(): array
    {
        return array_values(array_filter((array) ($this->especificaciones ?? []),
            fn ($c) => is_array($c) && trim((string) ($c['nombre'] ?? '')) !== '' && trim((string) ($c['valor'] ?? '')) !== ''));
    }
}
