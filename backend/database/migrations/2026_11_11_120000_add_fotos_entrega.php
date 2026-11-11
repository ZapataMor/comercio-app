<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('cliente_direcciones', fn (Blueprint $t) => $t->json('fotos')->nullable());
        Schema::table('pedidos', fn (Blueprint $t) => $t->json('entrega_fotos')->nullable());
    }
    public function down(): void
    {
        Schema::table('cliente_direcciones', fn (Blueprint $t) => $t->dropColumn('fotos'));
        Schema::table('pedidos', fn (Blueprint $t) => $t->dropColumn('entrega_fotos'));
    }
};
