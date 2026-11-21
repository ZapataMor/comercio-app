<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Clave de 4 números (como Nequi) y teléfonos de confianza.
 *
 *  - users.pin: la clave, cifrada como una contraseña. Null en las cuentas
 *    de antes: al entrar, la app les pide crearla.
 *  - users.pin_fallidos / pin_bloqueado_at: 5 claves equivocadas seguidas la
 *    bloquean; se desbloquea con el código de WhatsApp o con Google.
 *  - dispositivos_confianza: teléfonos donde la persona ya demostró quién es
 *    (código de WhatsApp o Google). En ellos entra solo con la clave; en uno
 *    nuevo, además, con el código. El teléfono guarda el token; aquí solo su
 *    huella (sha256).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('pin')->nullable()->after('password');
            $table->unsignedTinyInteger('pin_fallidos')->default(0)->after('pin');
            $table->timestamp('pin_bloqueado_at')->nullable()->after('pin_fallidos');
        });

        Schema::create('dispositivos_confianza', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token', 64)->unique();
            $table->string('nombre', 80)->nullable();
            $table->timestamp('ultimo_uso_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispositivos_confianza');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['pin', 'pin_fallidos', 'pin_bloqueado_at']);
        });
    }
};
