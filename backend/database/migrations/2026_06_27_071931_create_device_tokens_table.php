<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tokens de dispositivo (FCM) para enviar notificaciones push.
     * Un usuario puede tener varios (varios teléfonos); un token es único
     * y siempre apunta al ÚLTIMO usuario que inició sesión en ese aparato.
     */
    public function up(): void
    {
        Schema::create('device_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // El token de registro que da FCM en el dispositivo. Único: si el
            // mismo aparato cambia de usuario, el token se reasigna (no se duplica).
            $table->string('token', 255)->unique();
            // Plataforma del aparato (informativo / futuros envíos iOS).
            $table->string('plataforma', 20)->default('android'); // android | ios
            // Última vez que la app reportó este token (para limpiar viejos).
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_tokens');
    }
};
