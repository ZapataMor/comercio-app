@extends('layouts.negocio')
@section('titulo', $modulo['nombre'])
@section('contenido')
<header class="panel-encabezado">
    <span class="panel-ceja">Módulo</span>
    <h1>{{ $modulo['nombre'] }}</h1>
    <p>{{ $modulo['descripcion'] }}</p>
</header>
<div class="aviso aviso-info">Este módulo está en construcción. Así va a estar constituido:</div>
<div class="rejilla">
    <section class="bloque">
        <h2>Secciones en la web</h2>
        <ul class="puntos">@foreach($modulo['secciones'] as $s)<li>{{ $s }}</li>@endforeach</ul>
    </section>
    <section class="bloque">
        <h2>En la app</h2>
        @if($modulo['en_app'])
            <ul class="puntos">@foreach($modulo['en_app'] as $s)<li>{{ $s }}</li>@endforeach</ul>
        @else
            <p class="apagado">Solo en la web.</p>
        @endif
    </section>
    <section class="bloque">
        <h2>Permisos del módulo</h2>
        <ul>
            @foreach($modulo['permisos'] as $clave => $texto)
                @php $tiene = in_array($clave, $permisos, true); @endphp
                <li class="permiso"><span @class(['permiso-marca', 'si' => $tiene])>{{ $tiene ? '✓' : '·' }}</span> {{ $texto }}</li>
            @endforeach
        </ul>
        <p class="bloque-nota">✓ = lo tienes tú.</p>
    </section>
    <section class="bloque">
        <h2>Necesita</h2>
        <p>{{ collect($modulo['depende_de'])->map(fn ($d) => \App\Gestion\Modulos::get($d)['nombre'])->join(', ') ?: 'Nada más.' }}</p>
    </section>
</div>
@endsection
