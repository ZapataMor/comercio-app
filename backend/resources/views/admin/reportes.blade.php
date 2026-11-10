@extends('layouts.app')
@section('titulo', 'Reportes')
@section('contenido')
@include('admin._nav')
<h2 class="text-xl font-bold mb-4">Reportes de incumplimiento</h2>
<nav class="flex gap-4 mb-4" aria-label="Filtrar reportes">
    @foreach (['pendientes' => 'Pendientes', 'resueltos' => 'Resueltos', 'todos' => 'Todos'] as $clave => $nombre)
        <a href="{{ route('admin.reportes', ['estado' => $clave]) }}" class="text-indigo-600 {{ $estado === $clave ? 'font-bold underline' : '' }}">{{ $nombre }}</a>
    @endforeach
</nav>
@if ($errors->any()) <p role="alert" class="text-red-600 mb-4">{{ $errors->first() }}</p> @endif
@forelse ($reportes as $reporte)
    <article class="bg-white rounded-2xl shadow p-5 mb-4">
        <h3 class="font-bold">Pedido #{{ $reporte->pedido?->codigo }} · {{ ucfirst($reporte->objetivo) }}</h3>
        <p class="text-sm text-slate-500">{{ $reporte->created_at->format('d/m/Y H:i') }} · {{ $reporte->pedido?->estadoLabel() }}</p>
        <p class="mt-2">Cliente: {{ $reporte->pedido?->cliente?->nombre_completo }} (ID {{ $reporte->pedido?->user_id }})</p>
        <p>Comercio: {{ $reporte->pedido?->negocio?->nombre }} (ID {{ $reporte->pedido?->negocio_id }})</p>
        <p>Domiciliario: {{ $reporte->pedido?->domiciliario?->nombre_completo ?? 'Sin asignar' }}</p>
        <p class="mt-3 whitespace-pre-line">{{ $reporte->motivo }}</p>
        @if ($reporte->resuelto_at)
            <p class="mt-3 font-semibold">Resolución: {{ $reporte->resolucion }}</p>
        @else
            <form method="POST" action="{{ route('admin.reportes.resolver', $reporte->id) }}" class="mt-4">
                @csrf @method('PUT')
                <label for="resolucion-{{ $reporte->id }}" class="block text-sm font-semibold">Decisión y acciones tomadas</label>
                <textarea id="resolucion-{{ $reporte->id }}" name="resolucion" required minlength="5" maxlength="1000" class="border rounded-lg w-full p-3 mt-2"></textarea>
                <button class="bg-indigo-600 text-white rounded-lg px-4 py-2 mt-2">Guardar resolución</button>
            </form>
        @endif
    </article>
@empty
    <p>No hay reportes en esta lista.</p>
@endforelse
{{ $reportes->links() }}
@endsection
