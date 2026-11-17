@extends('layouts.app')
@section('titulo', 'Negocios')
@section('contenido')
@include('admin._nav')

<h1>Negocios</h1>
<section class="negocios-map-section" aria-label="Ubicación de los negocios">
    <div id="mapa-negocios" aria-label="Mapa de negocios"></div>
    <div class="negocios-map-footer">
        <span>{{ $ubicaciones->count() }} negocios en el mapa · {{ $negocios->total() }} en total</span>
        <span><i class="map-dot abierto"></i> Abierto <i class="map-dot cerrado"></i> Cerrado</span>
    </div>
    <p id="negocios-map-status" role="status" class="muted">
        @if($ubicaciones->isEmpty()) No hay ubicaciones registradas para estos resultados.
        @elseif($negocios->total() > $ubicaciones->count()) {{ $negocios->total() - $ubicaciones->count() }} negocios sin ubicación válida en el mapa. Puedes consultarlos en las tarjetas.
        @endif
    </p>
</section>

<form class="filters" method="GET">
    <label>Buscar negocio<input name="buscar" value="{{ request('buscar') }}" placeholder="Nombre del negocio" maxlength="100"></label>
    <label>Estado<select name="abiertos"><option value="0">Todos</option><option value="1" @selected(request('abiertos')==='1')>Abiertos</option></select></label>
    <button>Buscar</button><a href="{{ route('admin.negocios') }}">Limpiar</a>
</form>
<p class="muted">Los filtros se aplican al mapa y a las tarjetas.</p>
<h2>Todos los negocios ({{ $negocios->total() }})</h2>
<div class="negocios-cards">
    @forelse($negocios as $n)
        <article class="negocio-card">
            <div class="negocio-card-top">
                <span class="negocio-avatar" aria-hidden="true">{{ mb_strtoupper(mb_substr($n->nombre, 0, 1)) }}</span>
                <span class="negocio-estado {{ $n->activo ? 'abierto' : 'cerrado' }}">{{ $n->activo ? 'Abierto' : 'Cerrado' }}</span>
            </div>
            <h3><a href="{{ route('admin.negocio', $n) }}">{{ $n->nombre }}</a></h3>
            <p class="muted">{{ $n->direccion ?: 'Sin dirección registrada' }}@if($n->barrio) · {{ $n->barrio }}@endif</p>
            <dl><dt>Propietario</dt><dd>{{ $n->user?->nombre_completo ?? 'Sin propietario' }}</dd><dt>Catálogo</dt><dd>{{ $n->productos_count }} productos</dd></dl>
            <div class="negocio-card-actions">
                <a href="{{ route('admin.negocio', $n) }}">Ver negocio →</a>
                @if($n->lat !== null && $n->lng !== null && abs($n->lat)<=90 && abs($n->lng)<=180)
                    <button type="button" class="negocio-ver-mapa" data-negocio-id="{{ $n->id }}" hidden>Ver en mapa</button>
                @else
                    <span class="muted">Sin ubicación</span>
                @endif
            </div>
        </article>
    @empty
        <p class="card">No hay negocios con estos filtros.</p>
    @endforelse
</div>
{{ $negocios->links() }}
<script type="application/json" id="negocios-map-data">{!! json_encode($ubicaciones, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) !!}</script>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
<script src="{{ asset('admin-negocios.js') }}" defer></script>
@endsection
