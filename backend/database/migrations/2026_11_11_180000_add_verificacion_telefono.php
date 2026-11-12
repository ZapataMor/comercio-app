<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Acceso con el celular: el número queda verificado con un código que llega
 * por WhatsApp, y solo un número verificado sirve para entrar o recuperar la
 * contraseña. Cada código vive en `codigos_telefono` hasta que se usa o vence.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('telefono_verificado_at')->nullable()->after('telefono');
            $table->index(['telefono', 'telefono_verificado_at']);
        });

        Schema::create('codigos_telefono', function (Blueprint $table) {
            $table->id();
            $table->string('telefono', 10);
            // registro | clave | cambio
            $table->string('proposito', 20);
            // Cuenta a la que pertenece (recuperar la clave o cambiar el número).
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('codigo');
            $table->unsignedTinyInteger('intentos')->default(0);
            $table->timestamp('expira_at');
            // Registro: el número ya se confirmó y la app tiene este token
            // (guardado como sha256) para crear la cuenta.
            $table->timestamp('verificado_at')->nullable();
            $table->string('token', 64)->nullable();
            $table->timestamps();

            $table->index(['telefono', 'proposito']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('codigos_telefono');

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['telefono', 'telefono_verificado_at']);
            $table->dropColumn('telefono_verificado_at');
        });
    }
};
