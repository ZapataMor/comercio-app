<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('citas', fn (Blueprint $table) => $table->dateTime('llegada_at')->nullable());
    }

    public function down(): void
    {
        Schema::table('citas', fn (Blueprint $table) => $table->dropColumn('llegada_at'));
    }
};
