<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Unificación de usuarios: ya no existe "el comerciante" como tipo de cuenta.
 * Todo usuario es cliente por defecto y puede TENER negocios (uno o varios).
 *
 * - negocio_user: membresías usuario↔negocio con un rol por negocio
 *   ('propietario' o 'trabajador'). Las autorizaciones de la zona de
 *   administración se hacen contra esta tabla, no contra roles globales.
 * - users.codigo_publico: código corto único (ej. "U34F4D") que una persona
 *   comparte para que un negocio la invite como trabajador. La app NO permite
 *   buscar personas: solo se resuelve el código exacto.
 * - invitaciones_trabajo: invitación pendiente que el invitado debe aceptar
 *   (el código solo no basta: nadie entra a un negocio sin su consentimiento).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('negocio_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('rol', 20)->default('trabajador'); // 'propietario' | 'trabajador'
            // Permite suspender a un trabajador sin borrar su historial.
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->unique(['negocio_id', 'user_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('codigo_publico', 10)->nullable()->unique()->after('email');
        });

        Schema::create('invitaciones_trabajo', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained()->cascadeOnDelete();
            // El invitado. Si borra su cuenta, la invitación desaparece.
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Quién lo invitó (para mostrar "Te invitó Fulano").
            $table->foreignId('invitado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->string('estado', 20)->default('pendiente'); // pendiente | aceptada | rechazada
            $table->timestamps();

            $table->index(['user_id', 'estado']);
        });

        // Backfill 1: cada dueño actual (negocios.user_id) pasa a ser miembro
        // 'propietario' de su negocio.
        $ahora = now();
        $duenos = DB::table('negocios')->select('id', 'user_id')->get();
        foreach ($duenos as $n) {
            DB::table('negocio_user')->insertOrIgnore([
                'negocio_id' => $n->id,
                'user_id' => $n->user_id,
                'rol' => 'propietario',
                'activo' => true,
                'created_at' => $ahora,
                'updated_at' => $ahora,
            ]);
        }

        // Backfill 2: código público para los usuarios existentes.
        $sinCodigo = DB::table('users')->whereNull('codigo_publico')->pluck('id');
        foreach ($sinCodigo as $id) {
            DB::table('users')->where('id', $id)->update([
                'codigo_publico' => self::codigoUnico(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('invitaciones_trabajo');
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['codigo_publico']);
            $table->dropColumn('codigo_publico');
        });
        Schema::dropIfExists('negocio_user');
    }

    /** Código de 6 caracteres sin ambiguos (sin 0/O, 1/I/L), único en users. */
    private static function codigoUnico(): string
    {
        $alfabeto = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
        do {
            $codigo = 'U';
            for ($i = 0; $i < 5; $i++) {
                $codigo .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
            }
        } while (DB::table('users')->where('codigo_publico', $codigo)->exists());

        return $codigo;
    }
};
