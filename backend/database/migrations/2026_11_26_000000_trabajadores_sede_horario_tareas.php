<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Trabajadores del panel web (Vitrina Gestión):
 *
 * - negocio_user: sede donde trabaja (vacía = todas), cargo y horario por
 *   día de la semana: {"1": {"entrada": "08:00", "salida": "17:00"}, ...}
 *   con 1 = lunes … 7 = domingo; un día que no está es de descanso y
 *   horario NULL = sin definir.
 * - invitaciones_trabajo: lo mismo, más los permisos de módulos, para que la
 *   membresía nazca así cuando el trabajador acepte en su app.
 * - tareas_trabajo: tareas asignadas a un trabajador; si traen pedido_id es
 *   «atender este pedido».
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['negocio_user', 'invitaciones_trabajo'] as $tabla) {
            Schema::table($tabla, function (Blueprint $table) use ($tabla) {
                $table->foreignId('sede_id')->nullable()->constrained('sedes')->nullOnDelete();
                $table->string('cargo', 60)->nullable();
                $table->json('horario')->nullable();
                if ($tabla === 'invitaciones_trabajo') {
                    $table->json('permisos_gestion')->nullable();
                }
            });
        }

        Schema::create('tareas_trabajo', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            // A quién se le asignó. Si sale del negocio, sus tareas se borran con la membresía (ver EquipoNegocio::quitar).
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sede_id')->nullable()->constrained('sedes')->nullOnDelete();
            $table->foreignId('pedido_id')->nullable()->constrained('pedidos')->nullOnDelete();
            $table->foreignId('creada_por')->nullable()->constrained('users')->nullOnDelete();
            $table->string('titulo', 150);
            $table->text('descripcion')->nullable();
            $table->date('fecha')->nullable();
            $table->boolean('urgente')->default(false);
            // pendiente | en_curso | hecha
            $table->string('estado', 15)->default('pendiente');
            $table->timestamp('hecha_at')->nullable();
            $table->timestamps();

            $table->index(['negocio_id', 'estado']);
            $table->index(['user_id', 'estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tareas_trabajo');
        foreach (['negocio_user', 'invitaciones_trabajo'] as $tabla) {
            Schema::table($tabla, function (Blueprint $table) use ($tabla) {
                $table->dropConstrainedForeignId('sede_id');
                $table->dropColumn(array_merge(['cargo', 'horario'], $tabla === 'invitaciones_trabajo' ? ['permisos_gestion'] : []));
            });
        }
    }
};
