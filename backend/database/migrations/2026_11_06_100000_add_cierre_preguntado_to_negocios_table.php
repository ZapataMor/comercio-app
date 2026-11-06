<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `cierre_preguntado`: el cierre del horario por el que ya se le envió el push
 * al dueño, para no repetírselo cada minuto.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->timestamp('cierre_preguntado')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->dropColumn('cierre_preguntado');
        });
    }
};
