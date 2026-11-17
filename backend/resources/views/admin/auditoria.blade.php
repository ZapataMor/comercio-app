@extends('layouts.app')
@section('titulo', 'Registro de acciones')
@section('contenido')
@include('admin._nav')
<h1>Registro de acciones</h1>
<p>Acciones realizadas desde el panel web a partir de la instalación de este módulo.</p><form class="filters"><label>Buscar administrador, acción o recurso<input name="buscar" value="{{ request('buscar') }}"></label><button>Buscar</button></form><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Administrador</th><th>Acción / recurso</th><th>Detalle</th></tr></thead><tbody>@forelse($acciones as $a)<tr><td>{{ $a->created_at }}</td><td>{{ $a->administrador ?? 'Cuenta eliminada' }} (#{{ $a->admin_id }})</td><td>{{ $a->accion }}<small>{{ $a->recurso }}</small></td><td>@foreach(json_decode($a->detalle ?? '{}',true) as $k=>$v)<p>{{ $k }}: {{ $v }}</p>@endforeach</td></tr>@empty<tr><td colspan="4">Todavía no hay acciones registradas.</td></tr>@endforelse</tbody></table></div>{{ $acciones->links() }}
@endsection
