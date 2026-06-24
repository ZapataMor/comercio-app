@extends('layouts.app')

@section('titulo', 'Pedido #'.$pedido->id)

@section('contenido')
<a href="{{ route('pedidos') }}" class="text-sm text-slate-500 hover:underline">← Mis pedidos</a>
<h2 class="text-xl font-bold mt-2 mb-1">Pedido #{{ $pedido->id }}</h2>
<p class="text-slate-500 text-sm mb-4">🏪 {{ $pedido->negocio->nombre }} · {{ $pedido->created_at->format('d/m/Y H:i') }}</p>

<div class="grid sm:grid-cols-2 gap-4">
    {{-- Seguimiento --}}
    <div class="bg-white rounded-2xl shadow p-5">
        <h3 class="font-bold mb-3">Seguimiento</h3>
        @include('pedidos._seguimiento', ['pedido' => $pedido])

        @if ($pedido->estado === 'tomado' && $pedido->minutos_recogida)
            <p class="text-xs text-indigo-600 mt-3">🛵 El domiciliario pasa a recoger en ~{{ $pedido->minutos_recogida }} min.</p>
        @endif
        @if ($pedido->domiciliario)
            <p class="text-xs text-slate-500 mt-1">Domiciliario: {{ $pedido->domiciliario->name }}</p>
        @endif
    </div>

    {{-- Detalle --}}
    <div class="bg-white rounded-2xl shadow p-5">
        <h3 class="font-bold mb-3">Detalle</h3>
        <div class="divide-y text-sm">
            @foreach ($pedido->items as $item)
                <div class="flex justify-between py-2">
                    <span>{{ $item->cantidad }}× {{ $item->nombre }}</span>
                    <span class="font-medium">${{ number_format($item->subtotal(), 0, ',', '.') }}</span>
                </div>
            @endforeach
        </div>
        <div class="flex justify-between mt-3 pt-3 border-t font-bold">
            <span>Total</span>
            <span>${{ number_format($pedido->total, 0, ',', '.') }}</span>
        </div>

        <div class="mt-4 text-sm text-slate-500 space-y-1">
            <p>💳 Pago: <span class="font-medium text-slate-700 capitalize">{{ $pedido->metodo_pago }}</span></p>
            <p>📍 Entrega: <span class="text-slate-700">{{ $pedido->direccion_entrega }}</span></p>
            <p>📞 {{ $pedido->telefono_contacto }}</p>
        </div>
    </div>
</div>
@endsection
