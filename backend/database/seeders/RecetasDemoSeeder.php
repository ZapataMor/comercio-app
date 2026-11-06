<?php

namespace Database\Seeders;

use App\Models\Pedido;
use App\Models\Producto;
use App\Models\TipoProducto;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Dos pedidos entregados de cliente@demo.co con el mismo plato y los mismos
 * ajustes, para ver "Tus recetas preferidas" al entrar a esa tienda.
 *
 * Pensado SOLO para desarrollo. Si el cliente ya pidió ese plato con ajustes
 * no hace nada, así que se puede correr varias veces.
 */
class RecetasDemoSeeder extends Seeder
{
    public function run(): void
    {
        $cliente = User::where('email', 'cliente@demo.co')->first();
        $plato = Producto::query()
            ->where('disponible', true)
            ->whereJsonLength('atributos', '>=', 3)
            ->whereHas('tipoProducto', fn ($q) => $q->where('slug', TipoProducto::SLUG_COMIDA))
            ->whereHas('negocio', fn ($q) => $q->whereNull('vetado_at')->whereNull('archivado_at'))
            ->orderBy('negocio_id')
            ->with('negocio')
            ->first();

        if (! $cliente || ! $plato || $this->yaLoPidioConAjustes($cliente, $plato)) {
            return;
        }

        $opciones = ['sin' => [$plato->atributos[2]], 'extra' => [$plato->atributos[1]]];

        foreach ([9, 3] as $dias) {
            $pedido = $plato->negocio->pedidos()->create([
                'user_id' => $cliente->id,
                'estado' => 'entregado',
                'metodo_pago' => 'efectivo',
                'subtotal' => $plato->precio,
                'total' => $plato->precio,
                'direccion_entrega' => 'Calle 12 #9-40',
                'telefono_contacto' => '3001234567',
                'entregado_at' => now()->subDays($dias),
            ]);

            $pedido->items()->create([
                'producto_id' => $plato->id,
                'nombre' => $plato->nombre,
                'precio' => $plato->precio,
                'cantidad' => 1,
                'opciones' => $opciones,
            ]);
        }
    }

    private function yaLoPidioConAjustes(User $cliente, Producto $plato): bool
    {
        return Pedido::where('user_id', $cliente->id)
            ->whereHas('items', fn ($q) => $q->where('producto_id', $plato->id)->whereNotNull('opciones'))
            ->exists();
    }
}
