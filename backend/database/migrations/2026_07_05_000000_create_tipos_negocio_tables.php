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
        Schema::create('tipos_negocio', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100)->unique();
            $table->string('slug', 120)->unique();
            $table->timestamps();
        });

        Schema::create('negocio_tipo_negocio', function (Blueprint $table) {
            $table->foreignId('negocio_id')->constrained('negocios')->cascadeOnDelete();
            $table->foreignId('tipo_negocio_id')->constrained('tipos_negocio')->cascadeOnDelete();
            $table->primary(['negocio_id', 'tipo_negocio_id']);
        });

        $this->sembrarCategoriasBase();
        $this->asignarCategoriasExistentes();
    }

    public function down(): void
    {
        Schema::dropIfExists('negocio_tipo_negocio');
        Schema::dropIfExists('tipos_negocio');
    }

    private function sembrarCategoriasBase(): void
    {
        foreach ($this->categoriasBase() as $nombre) {
            DB::table('tipos_negocio')->updateOrInsert(
                ['slug' => Str::slug($nombre)],
                [
                    'nombre' => $nombre,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            );
        }
    }

    private function asignarCategoriasExistentes(): void
    {
        DB::table('negocios')
            ->select('id', 'nombre', 'categoria')
            ->orderBy('id')
            ->chunkById(100, function ($negocios) {
                foreach ($negocios as $negocio) {
                    $nombres = $this->categoriasParaNegocio($negocio->nombre, $negocio->categoria);

                    foreach ($nombres as $nombre) {
                        $tipoId = $this->tipoId($nombre);

                        DB::table('negocio_tipo_negocio')->updateOrInsert([
                            'negocio_id' => $negocio->id,
                            'tipo_negocio_id' => $tipoId,
                        ]);
                    }
                }
            });
    }

    private function tipoId(string $nombre): int
    {
        $slug = Str::slug($nombre);

        DB::table('tipos_negocio')->updateOrInsert(
            ['slug' => $slug],
            [
                'nombre' => $nombre,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        );

        return (int) DB::table('tipos_negocio')->where('slug', $slug)->value('id');
    }

    /**
     * @return array<int, string>
     */
    private function categoriasParaNegocio(string $nombre, ?string $categoria): array
    {
        $texto = Str::of(($categoria ?? '').' '.$nombre)->ascii()->lower()->toString();
        $resultado = [];

        $agregar = function (string $nombre) use (&$resultado) {
            if (! in_array($nombre, $resultado, true)) {
                $resultado[] = $nombre;
            }
        };

        if ($categoria) {
            $agregar(Str::of($categoria)->trim()->title()->toString());
        }

        match (true) {
            str_contains($texto, 'panader') || str_contains($texto, 'trigo') || str_contains($texto, 'espiga') => $agregar('Panadería'),
            str_contains($texto, 'ferre') || str_contains($texto, 'tornillo') || str_contains($texto, 'herra') || str_contains($texto, 'constru') => $agregar('Ferretería'),
            str_contains($texto, 'repuesto') => $agregar('Repuestos'),
            str_contains($texto, 'moto') => $agregar('Taller de motos'),
            str_contains($texto, 'carro') || str_contains($texto, 'auto') => $agregar('Taller de carros'),
            str_contains($texto, 'restaurante') || str_contains($texto, 'fonda') || str_contains($texto, 'sabor') => $agregar('Restaurante'),
            str_contains($texto, 'asadero') || str_contains($texto, 'pollo') || str_contains($texto, 'brasa') => $agregar('Comidas rápidas'),
            str_contains($texto, 'helad') || str_contains($texto, 'frio') => $agregar('Heladería'),
            str_contains($texto, 'corresponsal') => $agregar('Corresponsal'),
            str_contains($texto, 'drog') || str_contains($texto, 'farma') => $agregar('Droguería'),
            str_contains($texto, 'papeler') || str_contains($texto, 'papel') || str_contains($texto, 'lapiz') => $agregar('Papelería'),
            str_contains($texto, 'market') || str_contains($texto, 'merca') || str_contains($texto, 'surt') || str_contains($texto, 'super') => $agregar('Minimercado'),
            str_contains($texto, 'cafe') || str_contains($texto, 'tinto') => $agregar('Café'),
            str_contains($texto, 'bar') || str_contains($texto, 'licor') => $agregar('Licorería'),
            str_contains($texto, 'ropa') || str_contains($texto, 'moda') || str_contains($texto, 'boutique') || str_contains($texto, 'fashion') => $agregar('Ropa'),
            str_contains($texto, 'frut') || str_contains($texto, 'verdura') || str_contains($texto, 'huerta') => $agregar('Frutería'),
            str_contains($texto, 'carne') || str_contains($texto, 'novillo') || str_contains($texto, 'ganadero') => $agregar('Carnicería'),
            default => null,
        };

        if ($resultado === []) {
            $resultado[] = 'Miscelánea';
        }

        return $resultado;
    }

    /**
     * @return array<int, string>
     */
    private function categoriasBase(): array
    {
        return [
            'Panadería',
            'Ferretería',
            'Taller de carros',
            'Taller de motos',
            'Repuestos',
            'Restaurante',
            'Comidas rápidas',
            'Heladería',
            'Corresponsal',
            'Droguería',
            'Papelería',
            'Supermercado',
            'Minimercado',
            'Café',
            'Barbería',
            'Belleza',
            'Ropa',
            'Calzado',
            'Tecnología',
            'Licorería',
            'Frutería',
            'Carnicería',
            'Veterinaria',
            'Mascotas',
            'Miscelánea',
            'Óptica',
            'Servicios técnicos',
            'Lavadero',
            'Hotel',
            'Transporte',
        ];
    }
};
