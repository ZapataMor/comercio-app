<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pedidos', fn (Blueprint $table) => $table->timestamp('efectivo_ocupado_at')->nullable());
    }

    public function down(): void
    {
        Schema::table('pedidos', fn (Blueprint $table) => $table->dropColumn('efectivo_ocupado_at'));
    }
};
