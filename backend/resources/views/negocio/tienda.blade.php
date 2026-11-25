@extends('layouts.negocio')
@section('titulo', 'Mi tienda')
@section('contenido')
<h1 class="text-2xl font-semibold mb-1">Mi tienda</h1>
<p class="text-sm text-slate-500 mb-4">Por ahora se ve aquí y se edita en la app; la edición en la web llega en la fase 0.</p>
<section class="bg-white rounded-lg border p-4 mb-4">
    <dl class="grid grid-cols-3 gap-2 text-sm">
        <dt class="text-slate-500">Nombre</dt><dd class="col-span-2">{{ $negocioWeb->nombre }}</dd>
        <dt class="text-slate-500">Descripción</dt><dd class="col-span-2">{{ $negocioWeb->descripcion ?: '—' }}</dd>
        <dt class="text-slate-500">Dirección</dt><dd class="col-span-2">{{ $negocioWeb->direccion ?: '—' }} {{ $negocioWeb->barrio ? '· '.$negocioWeb->barrio : '' }}</dd>
        <dt class="text-slate-500">Teléfono</dt><dd class="col-span-2">{{ $negocioWeb->telefono ?: '—' }}</dd>
        <dt class="text-slate-500">Estado</dt><dd class="col-span-2">{{ \App\Support\HorarioNegocio::estadoTexto($negocioWeb) }}</dd>
        <dt class="text-slate-500">Preparación</dt><dd class="col-span-2">{{ $negocioWeb->tiempo_preparacion }} minutos</dd>
    </dl>
</section>
@if($administraWeb)
    <section class="bg-white rounded-lg border p-4">
        <h2 class="font-semibold mb-2">Cuentas para transferencias</h2>
        <ul class="text-sm space-y-1">
            @forelse($cuentas as $c)
                <li>{{ $c->nombre() }} · {{ $c->numero }} · {{ $c->titular }}</li>
            @empty
                <li class="text-slate-500">Sin cuentas.</li>
            @endforelse
        </ul>
    </section>
@endif
@endsection
