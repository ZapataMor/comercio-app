@extends('layouts.app')

@section('titulo', 'Mis pedidos')

@section('contenido')
<h2 class="text-xl font-bold mb-4">Mis pedidos</h2>

@forelse ($pedidos as $pedido)
    <a href="{{ route('pedidos.show', $pedido->id) }}"
       class="flex items-center justify-between bg-white rounded-2xl shadow-sm p-4 mb-2 hover:shadow-md transition gap-3">
        <div class="min-w-0">
            <p class="font-medium">Pedido #{{ $pedido->id }} · 🏪 {{ $pedido->negocio->nombre }}</p>
            <p class="text-slate-400 text-xs mt-1">{{ $pedido->created_at->format('d/m/Y H:i') }}</p>
        </div>
        <div class="text-right shrink-0">
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full
                {{ $pedido->estado === 'entregado' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700' }}">
                {{ $pedido->estadoLabel() }}
            </span>
            <p class="font-semibold mt-1">${{ number_format($pedido->total, 0, ',', '.') }}</p>
        </div>
    </a>
@empty
    <div class="bg-white rounded-2xl shadow p-8 text-center">
        <div class="text-4xl mb-3">📦</div>
        <p class="text-slate-500 text-sm">Aún no has hecho pedidos.</p>
        <a href="{{ route('explorar') }}" class="inline-block mt-3 text-indigo-600 hover:underline text-sm">Explorar negocios →</a>
    </div>
@endforelse
@endsection
