<?php

namespace Database\Seeders;

use App\Models\Negocio;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\Resena;
use App\Models\User;
use App\Support\Resenas;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

/**
 * Reseñas de ejemplo para ver la función con datos: unos clientes de prueba
 * con pedidos entregados y reseñados en los primeros negocios del catálogo, y
 * un pedido sin reseñar de cliente@demo.co para probar el formulario.
 *
 * Pensado SOLO para desarrollo. Si ya hay reseñas no hace nada.
 */
class ResenasDemoSeeder extends Seeder
{
    private const NEGOCIOS = 16;

    private const CLIENTES = [
        ['Marcela', 'Iguarán'], ['Yeison', 'Epinayú'], ['Daniela', 'Mengual'], ['Andrés', 'Pushaina'],
        ['Karen', 'Brito'], ['Samir', 'Abuchaibe'], ['Luz', 'Fernández'], ['Jorge', 'Ipuana'],
    ];

    private const SOBRE_TIENDA = [
        5 => ['Muy buena atención, responden rápido.', 'Siempre cumplen, es mi sitio de confianza.', 'Todo muy bien empacado.'],
        4 => ['Buena tienda, aunque a veces se demoran un poco.', 'Buenos precios y buen trato.'],
        3 => ['Normal, ni bien ni mal.'],
        2 => ['Me faltó que confirmaran antes de enviar.'],
    ];

    private const SOBRE_PRODUCTO = [
        5 => ['Excelente, tal como en la foto.', 'Muy buena calidad, lo vuelvo a pedir.', 'Me encantó, súper recomendado.'],
        4 => ['Buena relación entre precio y calidad.', 'Muy bueno, cumple lo que promete.'],
        3 => ['Está bien por el precio.'],
        2 => ['Esperaba más por lo que cuesta.'],
    ];

    public function run(): void
    {
        if (Resena::exists()) {
            return;
        }

        mt_srand(2026);

        $clientes = collect(self::CLIENTES)->map(fn ($c, $i) => $this->cliente($c[0], $c[1], $i));
        $negocios = Negocio::query()
            ->has('productos', '>=', 3)
            ->with('productos')
            ->orderBy('id')
            ->limit(self::NEGOCIOS)
            ->get();

        foreach ($negocios as $negocio) {
            foreach ($clientes->shuffle()->take(mt_rand(3, 7)) as $cliente) {
                $this->pedidoResenado($negocio, $cliente);
            }
        }

        $paraProbar = User::where('email', 'cliente@demo.co')->first();
        $negocio = $negocios->first();
        if ($paraProbar && $negocio) {
            $this->pedido($negocio, $paraProbar, $negocio->productos->take(3), 1);
        }
    }

    private function cliente(string $nombre, string $apellido, int $i): User
    {
        $user = User::updateOrCreate(
            ['email' => "resena{$i}@demo.co"],
            ['name' => $nombre, 'apellidos' => $apellido, 'password' => 'password123'],
        );
        $user->syncRoles(User::rolesDelTipo('usuario'));

        return $user;
    }

    private function pedidoResenado(Negocio $negocio, User $cliente): void
    {
        $productos = $negocio->productos->shuffle()->take(mt_rand(1, 3));
        $dias = mt_rand(1, 25);
        $pedido = $this->pedido($negocio, $cliente, $productos, $dias);

        Resenas::guardar(
            $pedido,
            $this->opinion(self::SOBRE_TIENDA),
            $productos
                ->map(fn (Producto $p) => ['producto_id' => $p->id] + $this->opinion(self::SOBRE_PRODUCTO))
                ->values()
                ->all(),
        );

        Resena::where('pedido_id', $pedido->id)->update(['created_at' => now()->subDays($dias - 1)]);
    }

    private function pedido(Negocio $negocio, User $cliente, Collection $productos, int $dias): Pedido
    {
        $total = (float) $productos->sum('precio');
        $pedido = $negocio->pedidos()->create([
            'user_id' => $cliente->id,
            'estado' => 'entregado',
            'metodo_pago' => 'efectivo',
            'subtotal' => $total,
            'total' => $total,
            'direccion_entrega' => 'Calle 12 #9-40',
            'telefono_contacto' => '3001234567',
            'entregado_at' => now()->subDays($dias),
        ]);

        foreach ($productos as $producto) {
            $pedido->items()->create([
                'producto_id' => $producto->id,
                'nombre' => $producto->nombre,
                'precio' => $producto->precio,
                'cantidad' => 1,
            ]);
        }

        return $pedido;
    }

    /** Más buenas que malas, y no todas con comentario. */
    private function opinion(array $textos): array
    {
        $estrellas = [5, 5, 5, 5, 4, 4, 4, 3, 2][mt_rand(0, 8)];
        $opciones = $textos[$estrellas];

        return [
            'estrellas' => $estrellas,
            'comentario' => mt_rand(0, 2) === 0 ? null : $opciones[mt_rand(0, count($opciones) - 1)],
        ];
    }
}
