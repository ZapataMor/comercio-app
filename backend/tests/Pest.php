<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| The closure you provide to your test functions is always bound to a specific PHPUnit test
| case class. By default, that class is "PHPUnit\Framework\TestCase". Of course, you may
| need to change it using the "pest()" function to bind different classes or traits.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

function fotosReferenciaPrueba(): array
{
    \Illuminate\Support\Facades\Storage::fake('local');
    return collect(['frente', 'izquierda', 'derecha'])->mapWithKeys(fn ($tipo) => [
        'foto_'.$tipo => \Illuminate\Http\UploadedFile::fake()->image($tipo.'.jpg'),
    ])->all();
}

function direccionPedidoPrueba(?\App\Models\User $cliente = null, string $texto = 'Calle 1 #2-3'): array
{
    $direccion = ($cliente ?? auth()->user())->clienteDirecciones()->create([
        'direccion' => $texto, 'barrio' => 'Centro', 'lat' => 11.379, 'lng' => -72.24,
        'fotos' => ['frente' => 'frente.jpg', 'izquierda' => 'izquierda.jpg', 'derecha' => 'derecha.jpg'],
    ]);
    return ['direccion_id' => $direccion->id, 'direccion_entrega' => $texto];
}
