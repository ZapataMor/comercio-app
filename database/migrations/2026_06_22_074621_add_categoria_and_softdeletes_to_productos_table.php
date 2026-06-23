<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            // Categoría opcional. Si se borra la categoría, el producto queda
            // sin categoría (no se borra el producto).
            $table->foreignId('categoria_id')
                ->nullable()
                ->after('negocio_id')
                ->constrained()
                ->nullOnDelete();

            // Borrado suave: añade la columna deleted_at.
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->dropForeign(['categoria_id']);
            $table->dropColumn(['categoria_id', 'deleted_at']);
        });
    }
};
