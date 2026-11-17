@extends('layouts.app')
@section('titulo', 'Domiciliarios')
@section('contenido')
@include('admin._nav')
<h1>Domiciliarios</h1>
<p>Se muestran únicamente posiciones de los últimos 5 minutos. <a href="{{ route('admin.mapa') }}">Actualizar ubicaciones</a></p><div id="mapa-reparto" class="card" style="height:440px" aria-label="Mapa de domiciliarios"></div><p id="mapa-error" role="status"></p>
<div class="table-wrap"><table><thead><tr><th>Domiciliario</th><th>Estado</th><th>Última ubicación</th></tr></thead><tbody>@forelse($domiciliarios as $d)<tr><td><a href="{{ route('admin.usuario',$d['id']) }}">{{ $d['nombre'] }}</a></td><td>{{ $d['en_entrega']?'En entrega':($d['en_turno']?'En turno':'Fuera de turno') }}</td><td>Hace {{ $d['ubicacion']['hace_segundos'] }} s · <a href="https://www.openstreetmap.org/?mlat={{ $d['ubicacion']['lat'] }}&mlon={{ $d['ubicacion']['lng'] }}#map=17/{{ $d['ubicacion']['lat'] }}/{{ $d['ubicacion']['lng'] }}" target="_blank" rel="noopener noreferrer">Ver ubicación</a></td></tr>@empty<tr><td colspan="3">No hay ubicaciones recientes disponibles.</td></tr>@endforelse</tbody></table></div>
<script type="application/json" id="mapa-datos">{!! json_encode($domiciliarios, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) !!}</script>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script><script src="{{ asset('admin-mapa.js') }}" defer></script>
@endsection
