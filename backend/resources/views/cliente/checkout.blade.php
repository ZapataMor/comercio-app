@extends('layouts.app')

@section('titulo', 'Confirmar pedido')

@section('contenido')
<a href="{{ route('carrito') }}" class="text-sm text-slate-500 hover:underline">← Volver al carrito</a>
<h2 class="text-xl font-bold mt-2 mb-4">Confirmar pedido</h2>

@if ($errors->any())
    <div class="mb-4 rounded-lg bg-red-100 text-red-800 px-4 py-2 text-sm">{{ $errors->first() }}</div>
@endif

{{-- Resumen --}}
<div class="bg-white rounded-2xl shadow p-5 mb-4">
    <h3 class="font-bold mb-2">Resumen — 🏪 {{ $negocio->nombre }}</h3>
    <div class="divide-y text-sm">
        @foreach ($items as $item)
            <div class="flex justify-between py-2">
                <span>{{ $item->cantidad }}× {{ $item->producto->nombre }}</span>
                <span class="font-medium">${{ number_format($item->subtotal(), 0, ',', '.') }}</span>
            </div>
        @endforeach
    </div>
    <div class="flex justify-between mt-3 pt-3 border-t font-bold">
        <span>Total</span>
        <span>${{ number_format($total, 0, ',', '.') }}</span>
    </div>
</div>

{{-- Datos de entrega y pago --}}
<form method="POST" action="{{ route('carrito.confirmar') }}" class="bg-white rounded-2xl shadow p-5 space-y-4">
    @csrf

    <div>
        <label class="block text-sm font-medium mb-1">Dirección de entrega</label>
        <input name="direccion_entrega" value="{{ old('direccion_entrega') }}" required
               placeholder="Calle, número, barrio…"
               class="w-full rounded-lg border border-slate-300 px-3 py-2">
        <p class="text-slate-400 text-xs mt-1">📍 Por ahora escrita; más adelante se podrá compartir en el mapa.</p>
    </div>

    <div>
        <label class="block text-sm font-medium mb-1">Teléfono de contacto</label>
        <input name="telefono_contacto" value="{{ old('telefono_contacto') }}" required
               placeholder="300 123 4567"
               class="w-full rounded-lg border border-slate-300 px-3 py-2">
    </div>

    <div>
        <label class="block text-sm font-medium mb-2">Forma de pago</label>
        <div class="grid grid-cols-2 gap-3">
            <label class="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-3 cursor-pointer hover:bg-slate-50">
                <input type="radio" name="metodo_pago" value="efectivo" @checked(old('metodo_pago','efectivo')==='efectivo')>
                💵 Efectivo
            </label>
            <label class="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-3 cursor-pointer hover:bg-slate-50">
                <input type="radio" name="metodo_pago" value="transferencia" @checked(old('metodo_pago')==='transferencia')>
                🏦 Transferencia
            </label>
        </div>
    </div>

    <button class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg py-3">
        Confirmar pedido · ${{ number_format($total, 0, ',', '.') }}
    </button>
</form>
@endsection
