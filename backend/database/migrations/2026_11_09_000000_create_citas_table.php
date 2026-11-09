<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servicios', function (Blueprint $table) {
            $table->unsignedSmallInteger('duracion_minutos')->default(30);
            $table->unsignedInteger('precio')->nullable();
            $table->boolean('permite_citas')->default(true);
            $table->json('galeria')->nullable();
        });

        Schema::create('citas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            $table->foreignId('servicio_id')->nullable()->constrained('servicios')->nullOnDelete();
            $table->foreignId('cliente_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('profesional_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('servicio_nombre', 150);
            $table->string('cliente_nombre', 150);
            $table->string('cliente_telefono', 30)->nullable();
            $table->string('origen', 20)->default('app');
            $table->string('estado', 20)->default('pendiente');
            $table->dateTime('inicio');
            $table->dateTime('fin');
            $table->dateTime('confirmar_antes_de')->nullable();
            $table->text('notas')->nullable();
            $table->string('motivo', 500)->nullable();
            $table->timestamps();
            $table->index(['profesional_id', 'estado', 'inicio']);
            $table->index(['negocio_id', 'inicio']);
            $table->index(['cliente_id', 'inicio']);
            $table->index(['estado', 'confirmar_antes_de']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('citas');
        Schema::table('servicios', fn (Blueprint $table) => $table->dropColumn(['duracion_minutos', 'precio', 'permite_citas', 'galeria']));
    }
};
