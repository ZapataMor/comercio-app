<?php

// Ejecutado exclusivamente en el contenedor de carga, nunca en desarrollo.
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Negocio;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

if (config('app.env') !== 'staging' || config('database.connections.mysql.database') !== 'vitrina_load') {
    throw new RuntimeException('Los datos de carga solo pueden crearse en vitrina_load/staging.');
}
if (User::where('email', 'like', '%@carga.invalid')->exists()) {
    throw new RuntimeException('La BD ya contiene datos de carga. Usa las fixtures existentes.');
}

$password = Hash::make('Carga-local-2026');
$users = [];
$tokens = [];
DB::transaction(function () use ($password, &$users, &$tokens) {
    for ($i = 0; $i < 1000; $i++) {
        $user = User::create([
            'name' => 'Carga '.$i, 'email' => 'usuario-'.$i.'@carga.invalid',
            'password' => $password, 'direccion' => 'Calle de pruebas 1',
            'barrio' => 'Centro', 'telefono' => '3000000000',
        ]);
        $user->assignRole('usuario');
        $users[] = $user;
        $tokens[] = $user->createToken('carga')->plainTextToken;
    }
});
$stores = [];
DB::transaction(function () use ($users, &$stores) {
    for ($i = 0; $i < 100; $i++) {
        $store = $users[$i]->negocio()->create([
            'nombre' => sprintf('Tienda carga %03d', $i), 'activo' => true,
            'descripcion' => 'Catalogo sintetico para medicion de capacidad',
            'direccion' => 'Calle 1', 'barrio' => 'Centro', 'telefono' => '3000000000',
        ]);
        $category = $store->categorias()->create(['nombre' => 'Catalogo']);
        $products = [];
        for ($j = 0; $j < 20; $j++) {
            $product = $store->productos()->create([
                'nombre' => "Arroz carga $i-$j", 'precio' => 5000 + $j * 100,
                'categoria_id' => $category->id, 'disponible' => true,
            ]);
            $products[] = $product->id;
        }
        $stores[] = ['id' => $store->id, 'product' => $products[0]];
    }
});
// 20 pedidos historicos por usuario; suficientes para llenar una pagina.
$now = now();
$orders = [];
for ($i = 0; $i < 20000; $i++) {
    $orders[] = [
        'codigo' => sprintf('L%07d', $i), 'user_id' => $users[$i % 1000]->id,
        'negocio_id' => $stores[$i % 100]['id'], 'estado' => 'entregado',
        'metodo_pago' => 'efectivo', 'subtotal' => 5000, 'costo_domicilio' => 4000,
        'total' => 9000, 'direccion_entrega' => 'Calle de pruebas 1',
        'telefono_contacto' => '3000000000', 'created_at' => $now->copy()->subDays(2),
        'updated_at' => $now, 'entregado_at' => $now->copy()->subDay(),
    ];
    if (count($orders) === 500) {
        DB::table('pedidos')->insert($orders);
        $orders = [];
    }
}
file_put_contents('/results/fixtures.json', json_encode([
    'tokens' => $tokens, 'stores' => $stores,
    'dataset' => ['users' => 1000, 'stores' => 100, 'products' => 2000, 'historical_orders' => 20000],
], JSON_THROW_ON_ERROR));
echo "Fixtures listas: 1000 usuarios, 100 negocios, 2000 productos, 20000 pedidos.\n";
