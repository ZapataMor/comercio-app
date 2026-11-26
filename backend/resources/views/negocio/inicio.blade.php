@extends('layouts.negocio')
@section('titulo', 'Inicio')
@section('contenido')
<header class="panel-encabezado">
    <span class="panel-ceja">Panel del negocio</span>
    <h1>Inicio</h1>
</header>
<div class="indicadores">
    @foreach(['Pedidos de hoy' => $pedidosHoy, 'Pedidos en curso' => $enCurso, 'Citas de hoy' => $citasHoy, 'Productos' => $productos] as $titulo => $valor)
        <div class="indicador"><p>{{ $titulo }}</p><strong>{{ $valor }}</strong></div>
    @endforeach
</div>
<div class="rejilla">
    <section class="bloque">
        <h2>Sedes <span class="bloque-cuenta">{{ $sedes->count() }}</span></h2>
        <ul class="filas">
            @foreach($sedes as $s)
                <li><span>{{ $s->nombre }}</span> <span class="apagado">· {{ $s->tipoTexto() }}</span> @if($s->principal)<span class="chip chip-acento">principal</span>@endif</li>
            @endforeach
        </ul>
    </section>
    <section class="bloque">
        <h2>Módulos del negocio</h2>
        @if($opcionales)
            <ul class="filas">
                @foreach($opcionales as $m)
                    @php $funciona = \App\Gestion\Modulos::get($m)['estado'] === 'disponible'; @endphp
                    <li><span>{{ \App\Gestion\Modulos::get($m)['nombre'] }}</span> <span @class(['chip', 'chip-exito' => $funciona])>{{ $funciona ? 'funciona' : 'en construcción' }}</span></li>
                @endforeach
            </ul>
        @else
            <p class="apagado">Solo el núcleo. Vitrina enciende los demás módulos según el plan.</p>
        @endif
        <p class="bloque-nota">Trabajadores activos: {{ $equipo }}.</p>
    </section>
</div>
@endsection
