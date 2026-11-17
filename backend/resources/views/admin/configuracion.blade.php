@extends('layouts.app')
@section('titulo', 'Configuración')
@section('contenido')
@include('admin._nav')
<h1>Configuración</h1>
<div class="card"><h2>Tarifa de domicilio</h2><p>Aplica únicamente a pedidos nuevos.</p><form method="POST" action="{{ route('admin.accion','tarifa') }}" class="action-form" data-confirm="¿Guardar esta tarifa para los nuevos pedidos?">@csrf<label>Valor en COP<input type="number" name="tarifa_domicilio" min="0" max="100000" step="1" value="{{ old('tarifa_domicilio',$tarifa) }}" required></label><label>Motivo<input name="motivo" required maxlength="255"></label><button>Guardar tarifa</button></form></div>
<h2>Barrios</h2><div class="table-wrap"><table><thead><tr><th>Barrio</th><th>Sugerido por</th><th>Estado / acciones</th></tr></thead><tbody>@forelse($barrios as $b)<tr><td>{{ $b->nombre }}</td><td>{{ $b->creador?->nombre_completo }}</td><td>@if($b->aprobado)Aprobado @else Pendiente <div class="inline-actions">@include('admin._accion',['accion'=>'aprobar-barrio','id'=>$b->id,'label'=>'Aprobar']) @include('admin._accion',['accion'=>'rechazar-barrio','id'=>$b->id,'label'=>'Rechazar'])</div>@endif</td></tr>@empty<tr><td colspan="3">Sin barrios.</td></tr>@endforelse</tbody></table></div>{{ $barrios->links() }}
@endsection
