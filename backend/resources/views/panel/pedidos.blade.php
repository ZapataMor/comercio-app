@extends('layouts.app')

@section('titulo', 'Pedidos')

@section('contenido')
<div class="flex items-center justify-between mb-4">
    <h2 class="text-xl font-bold">Pedidos recibidos</h2>
    <a href="{{ route('panel') }}" class="text-sm text-slate-500 hover:underline">← Mi negocio</a>
</div>

@forelse ($pedidos as $pedido)
    <div class="bg-white rounded-2xl shadow p-5 mb-3">
        <div class="flex items-start justify-between gap-3">
            <div>
                <p class="font-bold">Pedido #{{ $pedido->id }}</p>
                <p class="text-slate-400 text-xs">{{ $pedido->created_at->format('d/m/Y H:i') }}</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full
                {{ $pedido->estado === 'pendiente' ? 'bg-amber-100 text-amber-700' : ($pedido->estado === 'entregado' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700') }}">
                {{ $pedido->estadoLabel() }}
            </span>
        </div>

        {{-- Info del cliente --}}
        <div class="mt-3 text-sm bg-slate-50 rounded-lg p-3">
            <p class="font-medium">👤 {{ $pedido->cliente->name }}</p>
            <p class="text-slate-600">📍 {{ $pedido->direccion_entrega }}</p>
            <p class="text-slate-600">📞 {{ $pedido->telefono_contacto }} · 💳 <span class="capitalize">{{ $pedido->metodo_pago }}</span></p>
        </div>

        {{-- Items --}}
        <div class="mt-3 text-sm divide-y">
            @foreach ($pedido->items as $item)
                <div class="flex justify-between py-1.5">
                    <span>{{ $item->cantidad }}× {{ $item->nombre }}</span>
                    <span class="font-medium">${{ number_format($item->subtotal(), 0, ',', '.') }}</span>
                </div>
            @endforeach
        </div>
        <div class="flex justify-between mt-2 pt-2 border-t font-bold">
            <span>Total</span>
            <span>${{ number_format($pedido->total, 0, ',', '.') }}</span>
        </div>

        {{-- Acción / estado --}}
        <div class="mt-4">
            @if ($pedido->estado === 'pendiente')
                <form method="POST" action="{{ route('panel.pedidos.listo', $pedido->id) }}">
                    @csrf @method('PUT')
                    <button class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2.5">
                        Marcar como listo para recoger
                    </button>
                </form>
            @elseif ($pedido->estado === 'listo')
                <p class="text-sm text-center text-slate-500">⏳ Esperando que un domiciliario lo tome…</p>
            @elseif ($pedido->estado === 'entregado')
                <p class="text-sm text-center text-green-600 font-medium">✓ Entregado al cliente</p>
            @else
                <p class="text-sm text-center text-slate-500">
                    🛵 {{ $pedido->estadoLabel() }}
                    @if ($pedido->domiciliario) — {{ $pedido->domiciliario->name }} @endif
                </p>
            @endif
        </div>
    </div>
@empty
    <div class="bg-white rounded-2xl shadow p-8 text-center">
        <div class="text-4xl mb-3">📭</div>
        <p class="text-slate-500 text-sm">Aún no has recibido pedidos.</p>
    </div>
@endforelse
@endsection
