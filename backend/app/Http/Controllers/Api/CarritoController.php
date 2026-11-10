<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use App\Models\User;
use App\Support\PrecioCarrito;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class CarritoController extends Controller
{
    public function actualizar(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'items' => ['present', 'array', 'max:99'], 'items.*.producto_id' => ['required', 'integer', 'distinct'],
            'items.*.precio_token' => ['required', 'string', 'max:2048'],
            'vence_at' => ['nullable', 'integer'],
        ]);
        $usuarioId = $request->user()->id;
        $reservas = [];
        foreach ($datos['items'] as $item) {
            $producto = Producto::findOrFail($item['producto_id']);
            $precio = PrecioCarrito::deItem($producto, $item, $usuarioId);
            $reserva = PrecioCarrito::reserva($item['precio_token']);
            $reservas[] = ['user_id' => $usuarioId, 'producto_id' => $producto->id, 'precio' => $precio,
                'vence_at' => Carbon::createFromTimestamp(min($reserva['vence'], (int) ($datos['vence_at'] ?? $reserva['vence'])), config('app.timezone'))];
        }
        DB::transaction(function () use ($usuarioId, $reservas) {
            User::whereKey($usuarioId)->lockForUpdate()->firstOrFail();
            DB::table('carrito_reservas')->where('user_id', $usuarioId)->delete();
            if ($reservas) {
                DB::table('carrito_reservas')->insert($reservas);
            }
        });

        return response()->json(['message' => 'Carrito actualizado.']);
    }
}
