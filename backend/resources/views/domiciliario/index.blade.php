@extends('layouts.app')

@section('titulo', 'Domiciliario')

@section('contenido')

{{-- ───── Pedidos disponibles para tomar ───── --}}
<h2 class="text-xl font-bold mb-1">Pedidos disponibles</h2>
<p class="text-slate-500 text-sm mb-3">Pedidos listos para recoger. Toma uno e indica en cuántos minutos pasas.</p>

@forelse ($disponibles as $pedido)
    <div class="bg-white rounded-2xl shadow p-5 mb-3 border-l-4 border-amber-400">
        <div class="flex items-start justify-between">
            <div>
                <p class="font-bold">Pedido #{{ $pedido->id }}</p>
                <p class="text-sm text-slate-600">🏪 {{ $pedido->negocio->nombre }}</p>
                <p class="text-slate-400 text-xs mt-1">📍 {{ $pedido->negocio->direccion ?: 'Sin dirección' }}</p>
            </div>
            <span class="font-semibold">${{ number_format($pedido->total, 0, ',', '.') }}</span>
        </div>
        <p class="text-sm text-slate-500 mt-2">{{ $pedido->items->sum('cantidad') }} producto(s)</p>

        <form method="POST" action="{{ route('domiciliario.tomar', $pedido->id) }}" class="flex items-end gap-2 mt-3">
            @csrf @method('PUT')
            <div>
                <label class="block text-xs text-slate-500 mb-1">Paso a recoger en (min)</label>
                <input type="number" name="minutos_recogida" min="1" max="240" value="15" required
                       class="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm">
            </div>
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-2">
                Tomar pedido
            </button>
        </form>
    </div>
@empty
    <div class="bg-white rounded-2xl shadow p-6 text-center mb-6">
        <div class="text-4xl mb-2">🛵</div>
        <p class="text-slate-500 text-sm">No hay pedidos disponibles ahora mismo.</p>
    </div>
@endforelse

{{-- ───── Mis entregas activas ───── --}}
<h3 class="font-bold text-slate-700 mt-6 mb-2">Mis entregas en curso</h3>
@forelse ($entregas as $pedido)
    <div class="bg-white rounded-2xl shadow p-5 mb-3 border-l-4 border-indigo-500">
        <div class="flex items-start justify-between">
            <div>
                <p class="font-bold">Pedido #{{ $pedido->id }}</p>
                <span class="text-xs font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{{ $pedido->estadoLabel() }}</span>
            </div>
            <span class="font-semibold">${{ number_format($pedido->total, 0, ',', '.') }}</span>
        </div>

        <div class="mt-3 text-sm space-y-1">
            <p>🏪 <span class="font-medium">Recoger:</span> {{ $pedido->negocio->nombre }} — {{ $pedido->negocio->direccion ?: 's/d' }}</p>
            <p>🏠 <span class="font-medium">Entregar:</span> {{ $pedido->cliente->name }} — {{ $pedido->direccion_entrega }}</p>
            <p>📞 {{ $pedido->telefono_contacto }} · 💳 <span class="capitalize">{{ $pedido->metodo_pago }}</span></p>
        </div>

        {{-- Acción según el estado --}}
        <div class="mt-4">
            @if ($pedido->estado === 'tomado')
                <form method="POST" action="{{ route('domiciliario.recogido', $pedido->id) }}">
                    @csrf @method('PUT')
                    <button class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2.5">📦 Marcar como recogido</button>
                </form>
            @elseif ($pedido->estado === 'recogido')
                <form method="POST" action="{{ route('domiciliario.encamino', $pedido->id) }}">
                    @csrf @method('PUT')
                    <button class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2.5">🛵 Salir / En camino</button>
                </form>
            @elseif ($pedido->estado === 'en_camino')
                <form method="POST" action="{{ route('domiciliario.entregado', $pedido->id) }}">
                    @csrf @method('PUT')
                    <button class="w-full bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg py-2.5">✓ Marcar como entregado</button>
                </form>
            @endif
        </div>
    </div>
@empty
    <div class="bg-white rounded-2xl shadow p-6 text-center mb-6">
        <p class="text-slate-500 text-sm">No tienes entregas en curso.</p>
    </div>
@endforelse

{{-- ───── Historial ───── --}}
<h3 class="font-bold text-slate-700 mt-6 mb-2">Historial</h3>
@forelse ($historial as $pedido)
    <div class="flex items-center justify-between bg-white rounded-xl shadow-sm p-3 mb-2 text-sm">
        <span>Pedido #{{ $pedido->id }} · 🏪 {{ $pedido->negocio->nombre }}</span>
        <span class="text-green-600 font-medium">Entregado · ${{ number_format($pedido->total, 0, ',', '.') }}</span>
    </div>
@empty
    <div class="bg-white rounded-2xl shadow p-6 text-center">
        <p class="text-slate-500 text-sm">Aún no has completado entregas.</p>
    </div>
@endforelse

@endsection
