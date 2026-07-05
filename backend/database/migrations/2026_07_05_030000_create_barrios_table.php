<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Catálogo de barrios de Maicao.
     *
     * Los barrios "oficiales" (aprobado = true) se muestran en el selector de
     * la app. Cuando un cliente escribe un barrio a mano que no está en la
     * lista, se guarda aquí con aprobado = false: solo ese usuario lo ve en
     * sus datos, y el administrador puede aprobarlo para que aparezca en la
     * lista de todos.
     */
    public function up(): void
    {
        Schema::create('barrios', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 120)->unique();
            $table->boolean('aprobado')->default(true);
            // Quién lo sugirió (solo tiene sentido en los no aprobados).
            $table->foreignId('creado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('barrios');
    }
};
