@extends('layouts.negocio')
@section('titulo', 'Catálogo')
@section('contenido')
<header class="panel-encabezado">
    <span class="panel-ceja">Núcleo</span>
    <h1>Catálogo</h1>
    <p>Lo que se muestra en Vitrina. La carga en cantidad, la ficha técnica y la importación de Excel llegan en la fase 0.</p>
</header>
<section class="bloque">
    <h2>Ficha técnica {{ $negocioWeb->plantillaGestion ? 'de la plantilla «'.$negocioWeb->plantillaGestion->nombre.'»' : '' }}</h2>
    @if($campos)
        <ul class="filas filas-dos">
            @foreach($campos as $c)
                <li><strong>{{ $c['etiqueta'] }}</strong>
                    <span class="apagado">{{ \App\Models\PlantillaGestion::TIPOS_CAMPO[$c['tipo']] ?? $c['tipo'] }}{{ isset($c['unidad']) ? ' ('.$c['unidad'].')' : '' }}{{ isset($c['opciones']) ? ': '.implode(', ', $c['opciones']) : '' }}</span>
                    @if(! empty($c['requerido']))<span class="chip chip-acento">obligatorio</span>@endif</li>
            @endforeach
        </ul>
    @else
        <p class="apagado">Este negocio no tiene ficha técnica (no tiene una plantilla con campos).</p>
    @endif
</section>
<section class="bloque">
    <h2>Productos <span class="bloque-cuenta">{{ $productos->total() }}</span></h2>
    @if($productos->isEmpty())
        <p class="apagado">Sin productos.</p>
    @else
        <ul class="productos">
            @foreach($productos as $p)
                @php
                    $foto = $p->imagen ? asset('storage/'.ltrim(preg_replace('#^/?storage/#', '', $p->imagen), '/')) : null;
                    $atributos = array_values(array_filter((array) ($p->atributos ?? []), 'is_string'));
                @endphp
                <li @class(['producto', 'agotado' => ! $p->disponible])>
                    <div class="producto-foto">
                        @if($foto)
                            <img src="{{ $foto }}" alt="{{ $p->nombre }}" loading="lazy">
                        @else
                            <span class="producto-sin-foto" role="img" aria-label="Sin imagen de {{ $p->nombre }}">{{ mb_strtoupper(mb_substr($p->nombre, 0, 1)) }}</span>
                        @endif
                        <span @class(['chip', 'producto-estado', 'chip-exito' => $p->disponible])>{{ $p->disponible ? 'Disponible' : 'Agotado' }}</span>
                    </div>
                    <div class="producto-cuerpo">
                        <p class="producto-categoria">{{ $p->categoria?->nombre ?? 'Sin categoría' }}</p>
                        <h3>{{ $p->nombre }}</h3>
                        @if($p->descripcion)<p class="producto-descripcion">{{ $p->descripcion }}</p>@endif
                        @if($atributos)
                            <ul class="producto-atributos">
                                @foreach(array_slice($atributos, 0, 4) as $a)<li class="chip">{{ $a }}</li>@endforeach
                                @if(count($atributos) > 4)<li class="chip">+{{ count($atributos) - 4 }}</li>@endif
                            </ul>
                        @endif
                        <p class="producto-precio">$ {{ number_format((float) $p->precio, 0, ',', '.') }}@if($p->unidad_medida && $p->unidad_medida !== 'unidad')<span> / {{ $p->unidad_medida }}</span>@endif</p>
                    </div>
                </li>
            @endforeach
        </ul>
    @endif
    {{ $productos->links('negocio._paginas') }}
</section>
<section class="bloque">
    <h2>Servicios <span class="bloque-cuenta">{{ $servicios->count() }}</span></h2>
    <ul class="filas">
        @forelse($servicios as $s)
            <li><span class="fuerte">{{ $s->nombre }}</span> <span class="chip">{{ $s->duracion_minutos }} min</span>@if($s->precio)<span class="apagado">$ {{ number_format($s->precio, 0, ',', '.') }}</span>@endif</li>
        @empty
            <li class="apagado">Sin servicios.</li>
        @endforelse
    </ul>
</section>
@endsection
