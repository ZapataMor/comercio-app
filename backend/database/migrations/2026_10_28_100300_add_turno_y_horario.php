<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * - `users.en_turno`: el domiciliario avisa que está trabajando; solo a los
 *   que están en turno les llega el push de "pedido listo para recoger".
 *   Los domiciliarios que ya existían quedan en turno para no dejar de
 *   recibir avisos de un día para otro.
 * - `negocios.horario`: horario semanal (lun..dom → {abre, cierra} o null).
 *   La tarea programada `negocios:aplicar-horario` abre y cierra el negocio
 *   a esas horas. `activo_cambiado_at` guarda cuándo se tocó el switch a
 *   mano, para respetarlo hasta la siguiente hora de apertura o cierre.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('en_turno')->default(false);
        });

        $domiciliario = DB::table('roles')->where('name', 'domiciliario')->value('id');
        if ($domiciliario) {
            $ids = DB::table('model_has_roles')->where('role_id', $domiciliario)->pluck('model_id');
            DB::table('users')->whereIn('id', $ids)->update(['en_turno' => true]);
        }

        Schema::table('negocios', function (Blueprint $table) {
            $table->json('horario')->nullable();
            $table->timestamp('activo_cambiado_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('en_turno');
        });

        Schema::table('negocios', function (Blueprint $table) {
            $table->dropColumn(['horario', 'activo_cambiado_at']);
        });
    }
};
