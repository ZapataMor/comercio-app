<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Entrar con Google: `google_id` es el identificador fijo de la cuenta de
 * Google (el `sub` del token), que no cambia aunque la persona cambie su
 * correo. Quien se registra con Google no tiene contraseña hasta que cree
 * una, así que `password` pasa a admitir null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('google_id', 64)->nullable()->unique()->after('email');
            $table->string('password')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Las cuentas sin contraseña reciben una al azar: podrán ponerse una
        // con «¿Olvidaste tu contraseña?».
        DB::table('users')->whereNull('password')->update(['password' => bcrypt(bin2hex(random_bytes(32)))]);

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['google_id']);
            $table->dropColumn('google_id');
            $table->string('password')->nullable(false)->change();
        });
    }
};
