<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tarea que el negocio le asigna a un trabajador desde el panel web. Si trae
 * pedido, la tarea es atender ese pedido (prepararlo, empacarlo…).
 */
class TareaTrabajo extends Model
{
    protected $table = 'tareas_trabajo';

    public const ESTADOS = [
        'pendiente' => 'Pendiente',
        'en_curso' => 'En curso',
        'hecha' => 'Hecha',
    ];

    protected $fillable = ['user_id', 'sede_id', 'pedido_id', 'creada_por', 'titulo', 'descripcion', 'fecha', 'urgente', 'estado', 'hecha_at'];

    protected $attributes = ['estado' => 'pendiente', 'urgente' => false];

    protected function casts(): array
    {
        return [
            'fecha' => 'date',
            'urgente' => 'boolean',
            'hecha_at' => 'datetime',
        ];
    }

    public function negocio(): BelongsTo
    {
        return $this->belongsTo(Negocio::class);
    }

    /** A quién se le asignó. */
    public function trabajador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function creador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creada_por');
    }

    public function sede(): BelongsTo
    {
        return $this->belongsTo(Sede::class);
    }

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }

    public function estadoTexto(): string
    {
        return self::ESTADOS[$this->estado] ?? $this->estado;
    }

    /** Pendiente y con la fecha ya pasada. */
    public function atrasada(): bool
    {
        return $this->estado !== 'hecha' && $this->fecha && $this->fecha->lt(today());
    }
}
