@extends('layouts.app')
@section('titulo', 'Resumen de operación')
@section('contenido')
@include('admin._nav')
<h1>Resumen de operación</h1>
<p class="muted">{{ now()->format('d/m/Y H:i') }} · <a href="{{ route('admin.panel') }}">Actualizar</a></p>
<div class="stats">
@foreach(['pedidos_en_curso'=>['Pedidos en curso','pedidos'],'demorados'=>['Sin cambios hace 30 min o más','pedidos'],'reportes_pendientes'=>['Reportes pendientes','reportes'],'resenas_reportadas'=>['Reseñas reportadas','resenas'],'entregados_hoy'=>['Entregados hoy','pedidos'],'cancelados_hoy'=>['Cancelados hoy','pedidos'],'usuarios'=>['Usuarios','usuarios'],'negocios_activos'=>['Negocios abiertos','negocios']] as $key=>[$label,$ruta])
<a class="card" href="{{ route('admin.'.$ruta, match($key) {'entregados_hoy'=>['estado'=>'entregado','fecha'=>'resultado','desde'=>now()->toDateString(),'hasta'=>now()->toDateString()], 'cancelados_hoy'=>['estado'=>'cancelado','fecha'=>'resultado','desde'=>now()->toDateString(),'hasta'=>now()->toDateString()], 'demorados'=>['demorados'=>1], 'negocios_activos'=>['abiertos'=>1], default=>[]}) }}"><strong class="stat">{{ $stats[$key] }}</strong><span>{{ $label }}</span></a>
@endforeach
</div>
<div class="card"><h2>Ventas de pedidos entregados</h2><p class="stat">$ {{ number_format($stats['ventas_hoy'], 0, ',', '.') }} <small>COP hoy</small></p><p>Este mes: $ {{ number_format($stats['ventas_mes'], 0, ',', '.') }} COP · Incluye domicilio.</p><a href="{{ route('admin.pedidos', ['estado'=>'entregado']) }}">Consultar historial y exportar →</a></div>
<p class="muted">La alerta de 30 minutos sirve para revisión; no implica por sí sola un incumplimiento.</p>
@endsection
