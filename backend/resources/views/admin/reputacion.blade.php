@extends('layouts.app')
@section('titulo', 'Reputación')
@section('contenido')
@include('admin._nav')
<h1>Reputación</h1>
<form class="filters"><label>Tipo<select name="tipo"><option value="domiciliario" @selected($tipo==='domiciliario')>Domiciliarios</option><option value="negocio" @selected($tipo==='negocio')>Negocios</option></select></label><button>Consultar</button></form><p>{{ $vetados }} vetados · {{ $en_riesgo }} en riesgo</p><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Puntaje</th><th>Nivel</th><th>Acción</th></tr></thead><tbody>@forelse($sujetos as $s)<tr><td>{{ $s['nombre'] }}<small>{{ $s['detalle'] }}</small></td><td>{{ $s['reputacion']['puntaje'] }}</td><td>{{ $s['reputacion']['nivel_label'] }}</td><td><a href="{{ route('admin.reputacion-detalle',[$tipo,$s['id']]) }}">Revisar historial</a></td></tr>@empty<tr><td colspan="4">Sin resultados.</td></tr>@endforelse</tbody></table></div>
@endsection
