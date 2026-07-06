<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        // Tipos de producto GLOBALES (pre-creados por la app, no por el
        // comerciante). Cada tipo define la sección de atributos que pide el
        // formulario: la pregunta (atributo_label), el texto del botón para
        // añadir valores propios (atributo_boton) y las opciones sugeridas
        // que se marcan con un toque (sugerencias).
        Schema::create('tipos_producto', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100)->unique();
            $table->string('slug', 120)->unique();
            $table->string('atributo_label', 100);
            $table->string('atributo_boton', 60);
            $table->json('sugerencias')->nullable();
            // Orden de presentación en la app (el comodín "Otro" va de último).
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });

        Schema::table('productos', function (Blueprint $table) {
            // Nullable: los productos creados antes de esta función no tienen
            // tipo; al crear productos nuevos la API sí lo exige.
            $table->foreignId('tipo_producto_id')
                ->nullable()
                ->after('categoria_id')
                ->constrained('tipos_producto')
                ->nullOnDelete();
            // Ingredientes, usos, tallas... según el tipo (array de textos).
            $table->json('atributos')->nullable()->after('tipo_producto_id');
        });

        $this->sembrarTiposBase();
    }

    public function down(): void
    {
        Schema::table('productos', function (Blueprint $table) {
            $table->dropConstrainedForeignId('tipo_producto_id');
            $table->dropColumn('atributos');
        });

        Schema::dropIfExists('tipos_producto');
    }

    private function sembrarTiposBase(): void
    {
        foreach ($this->tiposBase() as $orden => $tipo) {
            DB::table('tipos_producto')->updateOrInsert(
                ['slug' => Str::slug($tipo['nombre'])],
                [
                    'nombre' => $tipo['nombre'],
                    'atributo_label' => $tipo['atributo_label'],
                    'atributo_boton' => $tipo['atributo_boton'],
                    'sugerencias' => $tipo['sugerencias'] ? json_encode($tipo['sugerencias']) : null,
                    'orden' => $orden,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }
    }

    /**
     * @return array<int, array{nombre: string, atributo_label: string, atributo_boton: string, sugerencias: ?array<int, string>}>
     */
    private function tiposBase(): array
    {
        return [
            [
                'nombre' => 'Comida',
                'atributo_label' => 'Ingredientes',
                'atributo_boton' => 'Añadir ingrediente',
                'sugerencias' => null,
            ],
            [
                'nombre' => 'Medicamento',
                'atributo_label' => '¿Para qué sirve?',
                'atributo_boton' => 'Añadir',
                'sugerencias' => [
                    'Dolor de cabeza', 'Gripa', 'Fiebre', 'Cólicos', 'Dolor muscular',
                    'Alergias', 'Gastritis', 'Diarrea', 'Tos', 'Vitaminas',
                ],
            ],
            [
                'nombre' => 'Herramienta',
                'atributo_label' => '¿Para qué se usa?',
                'atributo_boton' => 'Añadir',
                'sugerencias' => [
                    'Carpintería', 'Plomería', 'Electricidad', 'Pintura',
                    'Construcción', 'Jardinería', 'Mecánica',
                ],
            ],
            [
                'nombre' => 'Ropa y calzado',
                'atributo_label' => 'Tallas y colores disponibles',
                'atributo_boton' => 'Añadir',
                'sugerencias' => ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
            ],
            [
                'nombre' => 'Tecnología',
                'atributo_label' => 'Características',
                'atributo_boton' => 'Añadir',
                'sugerencias' => null,
            ],
            [
                'nombre' => 'Belleza y aseo',
                'atributo_label' => '¿Para qué sirve?',
                'atributo_boton' => 'Añadir',
                'sugerencias' => [
                    'Cabello', 'Piel', 'Maquillaje', 'Aseo personal', 'Limpieza del hogar',
                ],
            ],
            [
                'nombre' => 'Otro',
                'atributo_label' => 'Etiquetas',
                'atributo_boton' => 'Añadir',
                'sugerencias' => null,
            ],
        ];
    }
};
