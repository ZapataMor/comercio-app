<?php

namespace Database\Seeders;

use App\Models\Producto;
use App\Models\TipoProducto;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Le da a los productos de demostración su tipo y lo que el cliente ve al
 * tocarlos: ingredientes (comida), tallas y colores (ropa y calzado) o para
 * qué sirven (medicamentos y herramientas).
 *
 * Pensado para desarrollo. Solo toca productos que aún no tienen tipo, así que
 * se puede correr varias veces y respeta lo que un comerciante ya configuró.
 */
class OpcionesDemoSeeder extends Seeder
{
    /** Tipo de negocio → tipo de producto de su catálogo. */
    private const TIPO_POR_NEGOCIO = [
        'Restaurante' => 'comida',
        'Comidas rápidas' => 'comida',
        'Café' => 'comida',
        'Bar' => 'comida',
        'Heladería' => 'comida',
        'Panadería' => 'comida',
        'Ropa' => 'ropa-y-calzado',
        'Calzado' => 'ropa-y-calzado',
        'Droguería' => 'medicamento',
        'Ferretería' => 'herramienta',
        'Construcción' => 'herramienta',
    ];

    /** Comida: lo que trae cada plato, y que el cliente puede quitar o pedir más. */
    private const INGREDIENTES = [
        'empanadas-de-carne' => ['Carne', 'Papa', 'Ají', 'Hogao'],
        'patacon-con-hogao' => ['Plátano verde', 'Hogao', 'Queso rallado'],
        'tequenos' => ['Queso', 'Salsa rosada'],
        'papas-a-la-francesa' => ['Papa', 'Sal', 'Salsa de tomate', 'Mayonesa'],
        'sancocho-de-gallina' => ['Gallina', 'Yuca', 'Papa', 'Plátano', 'Mazorca', 'Cilantro', 'Arroz'],
        'ajiaco-santafereno' => ['Pollo', 'Papa criolla', 'Mazorca', 'Guascas', 'Crema de leche', 'Alcaparras', 'Aguacate'],
        'bandeja-paisa' => ['Frijoles', 'Arroz', 'Carne molida', 'Chicharrón', 'Huevo frito', 'Plátano maduro', 'Chorizo', 'Arepa', 'Aguacate'],
        'churrasco' => ['Carne de res', 'Papa a la francesa', 'Ensalada', 'Chimichurri'],
        'mojarra-frita' => ['Mojarra', 'Patacón', 'Arroz con coco', 'Ensalada', 'Limón'],
        'pechuga-a-la-plancha' => ['Pechuga', 'Arroz', 'Papa', 'Ensalada'],
        'pollo-apanado' => ['Pollo', 'Papa a la francesa', 'Ensalada', 'Salsa de la casa'],
        'arroz-con-pollo' => ['Arroz', 'Pollo', 'Arveja', 'Zanahoria', 'Papa a la francesa', 'Mayonesa'],
        'espagueti-bolonesa' => ['Espagueti', 'Carne molida', 'Salsa de tomate', 'Queso parmesano'],
        'lasana-de-carne' => ['Pasta', 'Carne molida', 'Salsa bechamel', 'Queso gratinado'],
        'fettuccini-alfredo' => ['Fettuccini', 'Crema de leche', 'Queso parmesano', 'Mantequilla'],
        'arroz-paisa' => ['Arroz', 'Frijoles', 'Carne', 'Chicharrón', 'Plátano maduro', 'Chorizo'],
        'arroz-mixto' => ['Arroz', 'Pollo', 'Camarón', 'Cerdo', 'Verduras'],
        'arroz-chino' => ['Arroz', 'Pollo', 'Cerdo', 'Raíces chinas', 'Cebollín', 'Salsa de soya'],
        'ensalada-cesar' => ['Lechuga', 'Pollo', 'Crutones', 'Queso parmesano', 'Aderezo César'],
        'ensalada-de-la-casa' => ['Lechuga', 'Tomate', 'Cebolla', 'Zanahoria', 'Aguacate', 'Vinagreta'],
        'brownie-con-helado' => ['Brownie', 'Helado de vainilla', 'Salsa de chocolate'],
        'combo-ejecutivo' => ['Sopa del día', 'Arroz', 'Proteína', 'Ensalada', 'Jugo'],
        'combo-personal' => ['Cuarto de pollo', 'Papa a la francesa', 'Arepa', 'Ensalada'],
        'pollo-entero-asado' => ['Pollo', 'Papa salada', 'Arepa', 'Ají', 'Salsa de la casa'],
        'medio-pollo-asado' => ['Pollo', 'Papa salada', 'Arepa', 'Ají', 'Salsa de la casa'],
        'sandwich' => ['Pan', 'Jamón', 'Queso', 'Lechuga', 'Tomate', 'Mayonesa'],
        'huevos-al-gusto' => ['Huevos', 'Tomate', 'Cebolla', 'Arepa'],
        'calentado-paisa' => ['Arroz', 'Frijoles', 'Huevo frito', 'Chorizo', 'Arepa'],
        'picada-personal' => ['Chicharrón', 'Chorizo', 'Papa criolla', 'Arepa', 'Guacamole'],
        'alitas-bbq-x8' => ['Alitas', 'Salsa BBQ', 'Papa a la francesa', 'Salsa ranch'],
    ];

    /** Ropa: tallas según la categoría del catálogo (sin entrada = sin talla). */
    private const TALLAS = [
        'Camisetas' => ['S', 'M', 'L', 'XL'],
        'Pantalones' => ['28', '30', '32', '34', '36'],
        'Vestidos' => ['XS', 'S', 'M', 'L'],
        'Ropa interior' => ['S', 'M', 'L'],
        'Calzado' => ['36', '37', '38', '39', '40', '41', '42'],
        'Abrigo' => ['S', 'M', 'L', 'XL', 'XXL'],
    ];

    private const COLORES = [
        'Camisetas' => ['Negro', 'Blanco', 'Azul', 'Gris'],
        'Pantalones' => ['Azul', 'Negro', 'Beige'],
        'Vestidos' => ['Negro', 'Rojo', 'Verde', 'Rosado'],
        'Calzado' => ['Negro', 'Blanco', 'Café'],
        'Accesorios' => ['Negro', 'Café'],
        'Abrigo' => ['Negro', 'Gris', 'Verde'],
    ];

    /** Medicamentos y herramientas: se ven como información, no se eligen. */
    private const USOS = [
        'acetaminofen' => ['Dolor de cabeza', 'Fiebre', 'Dolor muscular'],
        'ibuprofeno' => ['Dolor muscular', 'Fiebre', 'Cólicos'],
        'aspirina' => ['Dolor de cabeza', 'Fiebre'],
        'martillo' => ['Carpintería', 'Construcción'],
        'destornillador' => ['Electricidad', 'Carpintería', 'Mecánica'],
        'alicate' => ['Electricidad', 'Plomería', 'Mecánica'],
        'taladro' => ['Carpintería', 'Construcción', 'Electricidad'],
    ];

    public function run(): void
    {
        $tipos = TipoProducto::pluck('id', 'slug');

        Producto::query()
            ->whereNull('tipo_producto_id')
            ->with(['negocio.tiposNegocio', 'categoria'])
            ->chunkById(200, function ($productos) use ($tipos) {
                foreach ($productos as $producto) {
                    $tipo = $this->tipoDe($producto);
                    if ($tipo === null) {
                        continue;
                    }

                    $producto->update([
                        'tipo_producto_id' => $tipos[$tipo],
                        'atributos' => $this->atributosDe($producto, $tipo),
                        'colores' => $tipo === 'ropa-y-calzado'
                            ? self::COLORES[$producto->categoria?->nombre] ?? []
                            : null,
                    ]);
                }
            });
    }

    private function tipoDe(Producto $producto): ?string
    {
        return $producto->negocio->tiposNegocio
            ->map(fn ($t) => self::TIPO_POR_NEGOCIO[$t->nombre] ?? null)
            ->filter()
            ->first();
    }

    /** @return array<int, string> */
    private function atributosDe(Producto $producto, string $tipo): array
    {
        $clave = Str::slug($producto->nombre);

        return match ($tipo) {
            'comida' => self::INGREDIENTES[$clave] ?? [],
            'ropa-y-calzado' => self::TALLAS[$producto->categoria?->nombre] ?? [],
            default => self::USOS[$clave] ?? [],
        };
    }
}
