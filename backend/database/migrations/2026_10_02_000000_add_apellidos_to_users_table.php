<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Apellidos en su propio campo: el registro pide nombre(s) y apellidos por
 * separado. `name` queda con el/los nombre(s). Nullable porque las cuentas
 * existentes (y las que crea un admin) pueden no tenerlos.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('apellidos')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('apellidos');
        });
    }
};
