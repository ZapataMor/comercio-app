@extends('layouts.app')

@section('titulo', 'Carrito')

@section('contenido')
<h2 class="text-xl font-bold mb-1">Tu carrito</h2>
@if ($negocio)
    <p class="text-slate-500 text-sm mb-4">Pedido de 🏪 <span class="font-medium">{{ $negocio->nombre }}</span></p>
@endif

@if ($items->isEmpty())
    <div class="bg-white rounded-2xl shadow p-8 text-center">
        <div class="text-4xl mb-3">🛒</div>
        <p class="text-slate-500 text-sm">Tu carrito está vacío.</p>
        <a href="{{ route('explorar') }}" class="inline-block mt-3 text-indigo-600 hover:underline text-sm">Explorar negocios →</a>
    </div>
@else
    <div class="bg-white rounded-2xl shadow divide-y mb-4">
        @foreach ($items as $item)
            <div class="flex items-center justify-between p-4 gap-3">
                <div class="min-w-0">
                    <p class="font-medium truncate">{{ $item->producto->nombre }}</p>
                    <p class="text-slate-500 text-sm">${{ number_format($item->producto->precio, 0, ',', '.') }} c/u</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <form method="POST" action="{{ route('carrito.actualizar', $item->id) }}" class="flex items-center gap-1">
                        @csrf @method('PUT')
                        <input type="number" name="cantidad" value="{{ $item->cantidad }}" min="1" max="99"
                               class="w-16 rounded-lg border border-slate-300 px-2 py-1 text-sm text-center"
                               onchange="this.form.submit()">
                    </form>
                    <span class="font-semibold w-20 text-right">${{ number_format($item->subtotal(), 0, ',', '.') }}</span>
                    <form method="POST" action="{{ route('carrito.quitar', $item->id) }}">
                        @csrf @method('DELETE')
                        <button class="text-red-500 hover:text-red-700" title="Quitar">&times;</button>
                    </form>
                </div>
            </div>
        @endforeach
    </div>

    <div class="bg-white rounded-2xl shadow p-5">
        <div class="flex items-center justify-between mb-4">
            <span class="text-slate-500">Total</span>
            <span class="text-2xl font-bold">${{ number_format($total, 0, ',', '.') }}</span>
        </div>
        <div class="flex gap-2">
            <a href="{{ route('carrito.checkout') }}"
               class="flex-1 text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-3">
                Continuar al pago →
            </a>
            <form method="POST" action="{{ route('carrito.vaciar') }}" onsubmit="return confirm('¿Vaciar el carrito?')">
                @csrf
                <button class="px-4 py-3 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">Vaciar</button>
            </form>
        </div>
    </div>
@endif
@endsection
