<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('negocios', function (Blueprint $table) {
            $table->timestamp('desactivado_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('negocios', fn (Blueprint $table) => $table->dropIndex(['desactivado_at']));
        Schema::table('negocios', fn (Blueprint $table) => $table->dropColumn('desactivado_at'));
    }
};
