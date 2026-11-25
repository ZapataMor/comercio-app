@extends('layouts.negocio')
@section('titulo', 'Agenda')
@section('contenido')
<h1 class="text-2xl font-semibold mb-4">Agenda</h1>
<section class="bg-white rounded-lg border p-4">
    <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-500"><th class="py-1">Fecha</th><th>Servicio</th><th>Cliente</th><th>Profesional</th><th>Estado</th></tr></thead>
        <tbody>
        @forelse($citas as $c)
            <tr class="border-t"><td class="py-1">{{ $c->inicio?->format('d/m/Y H:i') }}</td><td>{{ $c->servicio_nombre }}</td><td>{{ $c->cliente_nombre }}</td><td>{{ $c->profesional?->name ?? '—' }}</td><td>{{ ucfirst($c->estado) }}</td></tr>
        @empty
            <tr><td colspan="5" class="text-slate-500 py-2">Sin citas próximas.</td></tr>
        @endforelse
        </tbody>
    </table>
    <div class="mt-2">{{ $citas->links() }}</div>
</section>
@endsection
