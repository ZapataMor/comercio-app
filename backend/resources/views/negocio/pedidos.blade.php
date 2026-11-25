@extends('layouts.negocio')
@section('titulo', 'Pedidos')
@section('contenido')
<h1 class="text-2xl font-semibold mb-1">Pedidos</h1>
<p class="text-sm text-slate-500 mb-4">Los pedidos se atienden en la app (con la alarma); aquí se consultan.</p>
<section class="bg-white rounded-lg border p-4">
    <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-500"><th class="py-1">Código</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead>
        <tbody>
        @forelse($pedidos as $p)
            <tr class="border-t"><td class="py-1">{{ $p->codigo ?? '#'.$p->id }}</td><td>{{ $p->created_at?->format('d/m/Y H:i') }}</td><td>{{ $p->cliente?->name ?? '—' }}</td><td>{{ \App\Models\Pedido::ESTADO_LABEL[$p->estado] ?? $p->estado }}</td><td>$ {{ number_format((float) $p->total, 0, ',', '.') }}</td></tr>
        @empty
            <tr><td colspan="5" class="text-slate-500 py-2">Sin pedidos.</td></tr>
        @endforelse
        </tbody>
    </table>
    <div class="mt-2">{{ $pedidos->links() }}</div>
</section>
@endsection
