<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una cuenta donde el negocio recibe transferencias: Nequi, Daviplata,
 * Bancolombia, otro banco, una llave o solo un código QR. El cliente la ve
 * cuando el negocio acepta su pedido pagado por transferencia.
 */
class CuentaPago extends Model
{
    protected $table = 'negocio_cuentas_pago';

    public const TIPOS = ['llave', 'nequi', 'daviplata', 'bancolombia', 'banco', 'qr'];

    public const TIPOS_CUENTA = ['ahorros', 'corriente'];

    /** Tipos que son una cuenta de banco (llevan ahorros/corriente). */
    public const CON_TIPO_CUENTA = ['bancolombia', 'banco'];

    /** Cuántas cuentas puede tener un negocio. */
    public const MAXIMO = 6;

    public const NOMBRES = [
        'llave' => 'Llave',
        'nequi' => 'Nequi',
        'daviplata' => 'Daviplata',
        'bancolombia' => 'Bancolombia',
        'banco' => 'Banco',
        'qr' => 'Código QR',
    ];

    protected $fillable = ['tipo', 'banco', 'numero', 'tipo_cuenta', 'titular', 'orden'];

    protected function casts(): array
    {
        return ['orden' => 'integer'];
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    /** Nombre para mostrar: «Nequi», «Banco de Bogotá», «Llave»… */
    public function nombre(): string
    {
        return $this->tipo === 'banco' && $this->banco ? $this->banco : (self::NOMBRES[$this->tipo] ?? $this->tipo);
    }

    /** Lo que ven el cliente y el negocio. */
    public function datos(): array
    {
        return [
            'id' => $this->id,
            'tipo' => $this->tipo,
            'nombre' => $this->nombre(),
            'banco' => $this->banco,
            'numero' => $this->numero,
            'tipo_cuenta' => $this->tipo_cuenta,
            'titular' => $this->titular,
            'qr' => $this->qr ? '/storage/'.$this->qr : null,
        ];
    }
}
