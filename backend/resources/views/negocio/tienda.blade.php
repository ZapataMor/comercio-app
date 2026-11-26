@extends('layouts.negocio')
@section('titulo', 'Mi tienda')
@section('contenido')
<header class="panel-encabezado">
    <span class="panel-ceja">Núcleo</span>
    <h1>Mi tienda</h1>
    <p>Por ahora se ve aquí y se edita en la app; la edición en la web llega en la fase 0.</p>
</header>
<section class="bloque">
    <dl class="datos">
        <dt>Nombre</dt><dd>{{ $negocioWeb->nombre }}</dd>
        <dt>Descripción</dt><dd>{{ $negocioWeb->descripcion ?: '—' }}</dd>
        <dt>Dirección</dt><dd>{{ $negocioWeb->direccion ?: '—' }} {{ $negocioWeb->barrio ? '· '.$negocioWeb->barrio : '' }}</dd>
        <dt>Teléfono</dt><dd>{{ $negocioWeb->telefono ?: '—' }}</dd>
        <dt>Estado</dt><dd>{{ \App\Support\HorarioNegocio::estadoTexto($negocioWeb) }}</dd>
        <dt>Preparación</dt><dd>{{ $negocioWeb->tiempo_preparacion }} minutos</dd>
    </dl>
</section>
@if($administraWeb)
    <section class="bloque">
        <h2>Cuentas para transferencias</h2>
        <ul class="filas">
            @forelse($cuentas as $c)
                <li><span class="fuerte">{{ $c->nombre() }}</span> <span>{{ $c->numero }}</span> <span class="apagado">· {{ $c->titular }}</span></li>
            @empty
                <li class="apagado">Sin cuentas.</li>
            @endforelse
        </ul>
    </section>
@endif
@endsection
