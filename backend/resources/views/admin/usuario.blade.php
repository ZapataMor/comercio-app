@extends('layouts.app')
@section('titulo', 'Ficha del usuario')
@section('contenido')
@include('admin._nav')
<h1>Ficha del usuario</h1>
<div class="card"><h2>{{ $usuario->nombre_completo }}</h2><dl><dt>Usuario</dt><dd>{{ $usuario->username }}</dd><dt>Correo</dt><dd>{{ $usuario->email ?? 'Sin correo' }}</dd><dt>Teléfono</dt><dd>{{ $usuario->telefono ?? 'Sin teléfono' }}</dd><dt>Tipo de cuenta</dt><dd>{{ \App\Models\User::TIPOS[$usuario->tipoCuenta()] }}</dd><dt>Estado</dt><dd>{{ $usuario->suspendido_at ? 'Suspendido: '.$usuario->motivo_suspension : 'Activo' }}</dd></dl>
@if($usuario->id !== auth()->id())
@include('admin._accion',['accion'=>$usuario->suspendido_at?'reactivar':'suspender','id'=>$usuario->id,'motivo'=>!$usuario->suspendido_at,'label'=>$usuario->suspendido_at?'Reactivar cuenta':'Suspender cuenta'])
@endif</div><div class="card"><h2>Pedidos como cliente o domiciliario</h2>@forelse($pedidos as $p)<p><a href="{{ route('admin.pedido',$p) }}">{{ $p->codigo }}</a> · {{ $p->estadoLabel() }} · {{ $p->created_at->format('d/m/Y') }}</p>@empty<p>Sin pedidos.</p>@endforelse{{ $pedidos->links() }}</div>
@endsection
