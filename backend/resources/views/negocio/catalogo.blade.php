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
    <div class="tabla-scroll">
        <table class="tabla">
            <thead><tr><th>Producto</th><th>Categoría</th><th class="numero">Precio</th><th>Disponible</th></tr></thead>
            <tbody>
            @forelse($productos as $p)
                <tr>
                    <td class="fuerte">{{ $p->nombre }}</td>
                    <td>{{ $p->categoria?->nombre ?? '—' }}</td>
                    <td class="numero">$ {{ number_format((float) $p->precio, 0, ',', '.') }}</td>
                    <td><span @class(['chip', 'chip-exito' => $p->disponible])>{{ $p->disponible ? 'Sí' : 'Agotado' }}</span></td>
                </tr>
            @empty
                <tr><td colspan="4" class="vacia">Sin productos.</td></tr>
            @endforelse
            </tbody>
        </table>
    </div>
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
