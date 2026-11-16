<?php

namespace Database\Seeders;

use App\Models\Producto;
use App\Models\TipoProducto;
use Illuminate\Database\Seeder;

/**
 * Ingredientes fijos y extras con precio de los platos demo, para ver cómo el
 * cliente personaliza la comida: la carne de la hamburguesa no se puede quitar,
 * y una porción de papas de más en la picada suma $3.000.
 *
 * Pensado SOLO para desarrollo. Busca los platos por nombre en cualquier
 * negocio y solo toca los que aún no tienen extras: no pisa lo que el
 * comerciante haya configurado, así que se puede correr varias veces.
 */
class ExtrasComidaDemoSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->platos() as $nombre => [$fijos, $extras]) {
            Producto::query()
                ->where('nombre', $nombre)
                ->whereNull('extras')
                ->whereHas('tipoProducto', fn ($q) => $q->where('slug', TipoProducto::SLUG_COMIDA))
                ->get()
                ->each(fn (Producto $plato) => $plato->update([
                    // Solo los que de verdad trae el plato.
                    'ingredientes_fijos' => array_values(array_intersect($plato->atributos ?? [], $fijos)),
                    'extras' => array_map(fn ($e) => ['nombre' => $e[0], 'precio' => $e[1]], $extras),
                ]));
        }
    }

    /**
     * Plato => [ingredientes que no se pueden quitar, [[extra, precio por porción], ...]].
     *
     * @return array<string, array{0: array<int, string>, 1: array<int, array{0: string, 1: int}>}>
     */
    private function platos(): array
    {
        $papas = ['Porción de papas', 3000];
        $huevo = ['Huevo frito', 2000];
        $arepa = ['Arepa', 1500];
        $pizza = [['Queso extra', 3000], ['Pepperoni', 3500], ['Champiñones', 2500], ['Borde de queso', 5000]];
        $shawarma = [['Salsa de ajo', 0], ['Queso', 2500], ['Carne extra', 5000], $papas];
        $perro = [['Queso', 2000], ['Tocineta', 2500], ['Huevo de codorniz', 1500], ['Salchicha', 3000]];
        $arepas = [['Queso costeño', 2000], ['Huevo', 1500], ['Mantequilla', 0]];
        $pollo = [$papas, $arepa, ['Salsa de ajo', 0]];
        $alitas = [['Salsa BBQ', 0], ['Salsa picante', 0], $papas];

        return [
            'Bandeja paisa' => [['Fríjoles', 'Arroz'], [$huevo, ['Chicharrón', 5000], ['Aguacate', 2500], $arepa]],
            'Hamburguesa sencilla' => [['Pan artesanal', 'Carne de res 150 g'], [['Salsa de la casa', 0], ['Queso cheddar', 2500], ['Tocineta', 3000], ['Carne de res 150 g', 6000], $papas]],
            'Hamburguesa doble carne' => [['Pan artesanal', 'Carne de res 150 g x2'], [['Salsa de la casa', 0], ['Queso cheddar', 2500], ['Tocineta', 3000], $huevo, $papas]],
            'Salchipapa sencilla' => [['Papa a la francesa', 'Salchicha'], [$papas, ['Salchicha', 3500], ['Queso gratinado', 3000]]],
            'Salchipapa especial' => [['Papa a la francesa', 'Salchicha'], [$papas, ['Tocineta', 3000], ['Huevos de codorniz x3', 2000]]],
            'Almuerzo ejecutivo' => [['Arroz', 'Carne del día'], [$huevo, ['Aguacate', 2500], $papas]],
            'Churrasco' => [['Carne de res'], [$papas, $huevo, ['Chimichurri', 0]]],
            'Picada para dos' => [['Carne de res', 'Pechuga'], [$papas, ['Chorizo', 4000], ['Chicharrón', 5000], ['Guacamole', 3000]]],
            'Picada familiar' => [['Carne de res', 'Costilla de cerdo', 'Pechuga'], [$papas, ['Chorizo', 4000], ['Chicharrón', 5000], $arepa]],
            'Picada personal' => [['Carne de res'], [$papas, ['Chorizo', 4000], ['Guacamole', 3000]]],
            'Pizza hawaiana personal' => [['Masa de pizza'], $pizza],
            'Pizza de pepperoni personal' => [['Masa de pizza'], $pizza],
            'Pizza mexicana mediana' => [['Masa de pizza'], $pizza],
            'Pizza de la casa grande' => [['Masa de pizza'], $pizza],
            'Shawarma de pollo' => [['Pan árabe', 'Pollo marinado'], $shawarma],
            'Shawarma de carne' => [['Pan árabe', 'Carne de res'], $shawarma],
            'Shawarma mixto' => [['Pan árabe', 'Pollo marinado', 'Carne de res'], $shawarma],
            'Perro sencillo' => [['Pan', 'Salchicha'], $perro],
            'Perro especial' => [['Pan', 'Salchicha'], $perro],
            'Arepa de queso' => [['Arepa de maíz'], $arepas],
            'Arepa mixta' => [['Arepa de maíz'], $arepas],
            'Arepa reina pepiada' => [['Arepa de maíz'], $arepas],
            'Arepa de huevo' => [['Arepa de maíz', 'Huevo'], $arepas],
            'Patacón con todo' => [['Patacón'], [['Queso gratinado', 3000], ['Carne desmechada', 4000], ['Pollo desmechado', 4000]]],
            'Medio pollo asado' => [['Pollo'], $pollo],
            'Cuarto de pollo' => [['Pollo'], $pollo],
            'Combo personal' => [['Cuarto de pollo'], $pollo],
            'Broaster 2 presas' => [['Pollo apanado'], [['Presa adicional', 5000], $papas, ['Salsa de ajo', 0]]],
            'Broaster 4 presas' => [['Pollo apanado'], [['Presa adicional', 5000], $papas, ['Salsa de ajo', 0]]],
            'Alitas BBQ x8' => [['Alitas'], $alitas],
            'Alitas picantes x8' => [['Alitas'], $alitas],
            'Salchipollo' => [['Papa a la francesa', 'Salchicha', 'Pollo apanado'], [$papas, ['Queso gratinado', 3000]]],
            'Nachos con todo' => [['Totopos'], [['Queso cheddar', 3000], ['Guacamole', 3000], ['Jalapeños', 0]]],
            'Huevos al gusto' => [['Huevos'], [$arepa, ['Queso', 2000], ['Chocolate caliente', 3500]]],
            'Calentado paisa' => [['Arroz', 'Fríjoles'], [$huevo, ['Chorizo', 4000], ['Aguacate', 2500]]],
            'Vaso de dos bolas' => [['Helado artesanal x2'], [['Bola adicional', 3500], ['Salsa de chocolate', 0], ['Chispas de colores', 1000]]],
            'Capuchino' => [['Espresso'], [['Shot de espresso', 2000], ['Leche deslactosada', 0], ['Crema batida', 1500]]],
        ];
    }
}
