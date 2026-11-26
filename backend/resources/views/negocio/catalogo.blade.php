@extends('layouts.negocio')
@section('titulo', 'Catálogo')
@section('contenido')
<header class="panel-encabezado panel-encabezado-fila">
    <div>
        <span class="panel-ceja">Núcleo</span>
        <h1>Catálogo</h1>
        <p>Lo que se muestra en Vitrina. Toca un producto para ver toda su información{{ $puedeEditar ? ', editarlo o eliminarlo' : '' }}.</p>
    </div>
    @if($puedeEditar)
        <button type="button" class="boton boton-acento" data-abrir="producto-nuevo">+ Nuevo producto</button>
    @endif
</header>

<section class="bloque">
    <div class="catalogo-barra">
        <h2>Productos <span class="bloque-cuenta">{{ $productos->total() }}{{ $productos->total() !== $totalProductos ? ' de '.$totalProductos : '' }}</span></h2>
        <form method="GET" class="catalogo-filtros" role="search">
            <input type="search" name="buscar" value="{{ $buscar }}" placeholder="Buscar producto" aria-label="Buscar producto">
            <select name="estado" aria-label="Filtrar por disponibilidad" onchange="this.form.submit()">
                <option value="">Todos</option>
                <option value="disponibles" @selected($estado === 'disponibles')>Disponibles</option>
                <option value="agotados" @selected($estado === 'agotados')>Agotados</option>
            </select>
            <button class="boton boton-claro boton-chico">Buscar</button>
            @if($buscar !== '' || $estado)<a class="enlace" href="{{ route('negocio.catalogo') }}">Quitar filtros</a>@endif
        </form>
    </div>

    @if($productos->isEmpty())
        <p class="apagado catalogo-vacio">{{ $buscar !== '' || $estado ? 'Ningún producto coincide con la búsqueda.' : 'Todavía no hay productos.' }}</p>
    @else
        <ul class="productos">
            @foreach($productos as $p)
                @php $foto = \App\Support\EditorProducto::urlImagen($p->imagen); @endphp
                <li>
                    <button type="button" @class(['producto', 'agotado' => ! $p->disponible]) data-abrir="producto-{{ $p->id }}" aria-haspopup="dialog">
                        <span class="producto-foto">
                            @if($foto)
                                <img src="{{ $foto }}" alt="{{ $p->nombre }}" loading="lazy">
                            @else
                                <span class="producto-sin-foto" role="img" aria-label="Sin imagen de {{ $p->nombre }}">{{ mb_strtoupper(mb_substr($p->nombre, 0, 1)) }}</span>
                            @endif
                            <span @class(['chip', 'producto-estado', 'chip-exito' => $p->disponible])>{{ $p->disponible ? 'Disponible' : 'Agotado' }}</span>
                        </span>
                        <span class="producto-cuerpo">
                            <span class="producto-categoria">{{ $p->categoria?->nombre ?? 'Sin sección' }}</span>
                            <span class="producto-nombre">{{ $p->nombre }}</span>
                            <span class="producto-precio">$ {{ number_format((float) $p->precio, 0, ',', '.') }}@if($p->unidad_medida && $p->unidad_medida !== 'unidad')<small> / {{ $p->unidad_medida }}</small>@endif</span>
                        </span>
                    </button>
                </li>
            @endforeach
        </ul>
    @endif
    {{ $productos->links('negocio._paginas') }}
</section>

{{-- Un modal por producto: toda la información y, para quien puede, la edición. --}}
@foreach($productos as $p)
    @php
        $foto = \App\Support\EditorProducto::urlImagen($p->imagen);
        $precio = '$ '.number_format((float) $p->precio, 0, ',', '.');
        $venta = match ($p->unidad_medida) { 'kg' => 'Kilos', 'libra' => 'Libras', default => 'Cantidad (unidad)' };
        $atributos = array_values(array_filter((array) ($p->atributos ?? []), 'is_string'));
        $fijos = array_values(array_filter((array) ($p->ingredientes_fijos ?? []), 'is_string'));
        $colores = array_values(array_filter((array) ($p->colores ?? []), 'is_string'));
        $extras = array_values(array_filter((array) ($p->extras ?? []), 'is_array'));
    @endphp
    <dialog class="modal" id="producto-{{ $p->id }}" aria-labelledby="producto-{{ $p->id }}-titulo">
        <div class="modal-cabeza">
            <p class="producto-categoria">{{ $p->categoria?->nombre ?? 'Sin sección' }}</p>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>

        <div class="modal-detalle">
            <div class="detalle-portada">
                <div class="detalle-foto">
                    @if($foto)<img src="{{ $foto }}" alt="{{ $p->nombre }}" loading="lazy">@else<span class="producto-sin-foto">{{ mb_strtoupper(mb_substr($p->nombre, 0, 1)) }}</span>@endif
                </div>
                <div class="detalle-principal">
                    <h2 id="producto-{{ $p->id }}-titulo">{{ $p->nombre }}</h2>
                    <p class="detalle-precio">{{ $precio }}@if($p->unidad_medida && $p->unidad_medida !== 'unidad')<small> / {{ $p->unidad_medida }}</small>@endif</p>
                    <div class="detalle-chips">
                        <span @class(['chip', 'chip-exito' => $p->disponible])>{{ $p->disponible ? 'Disponible' : 'Agotado' }}</span>
                        @if($p->tipoProducto)<span class="chip">{{ $p->tipoProducto->nombre }}</span>@endif
                        @if($p->resenas_total)<span class="chip chip-acento">★ {{ number_format((float) $p->resenas_promedio, 1, ',', '.') }} · {{ $p->resenas_total }} {{ $p->resenas_total === 1 ? 'reseña' : 'reseñas' }}</span>@endif
                    </div>
                    <p class="detalle-descripcion">{{ $p->descripcion ?: 'Sin descripción.' }}</p>
                    @if($puedeEditar)
                        <div class="detalle-acciones">
                            <button type="button" class="boton boton-oscuro boton-chico" data-editar>Editar</button>
                            <form method="POST" action="{{ route('negocio.productos.disponible', $p->id) }}">@csrf @method('PATCH')
                                <button class="boton boton-claro boton-chico">{{ $p->disponible ? 'Marcar agotado' : 'Marcar disponible' }}</button>
                            </form>
                            <form method="POST" action="{{ route('negocio.productos.eliminar', $p->id) }}" data-confirmar="¿Eliminar «{{ $p->nombre }}» del catálogo? Los pedidos anteriores lo conservan.">@csrf @method('DELETE')
                                <button class="boton boton-chico boton-peligro">Eliminar</button>
                            </form>
                        </div>
                    @endif
                </div>
            </div>

            <dl class="detalle-datos">
                <dt>{{ $p->tipoProducto?->atributo_label ?? 'Características' }}</dt>
                <dd>@forelse($atributos as $a)<span class="chip">{{ $a }}</span>@empty<span class="apagado">—</span>@endforelse</dd>
                @if($fijos)<dt>No se pueden quitar</dt><dd>@foreach($fijos as $a)<span class="chip chip-acento">{{ $a }}</span>@endforeach</dd>@endif
                @if($extras)
                    <dt>Extras</dt>
                    <dd>@foreach($extras as $e)<span class="chip">{{ $e['nombre'] ?? '' }} · {{ (int) ($e['precio'] ?? 0) ? '$ '.number_format((int) $e['precio'], 0, ',', '.') : 'gratis' }}</span>@endforeach</dd>
                @endif
                @if($colores)<dt>Colores</dt><dd>@foreach($colores as $a)<span class="chip">{{ $a }}</span>@endforeach</dd>@endif
                <dt>Se vende por</dt><dd>{{ $venta }}</dd>
                <dt>Sección del negocio</dt><dd>{{ $p->categoria?->nombre ?? 'Sin sección' }}</dd>
                <dt>Categorías de Vitrina</dt>
                <dd>@forelse($p->categoriasCatalogo as $c)<span class="chip">{{ $c->nombre }}</span>@empty<span class="apagado">Ninguna</span>@endforelse</dd>
                <dt>Otros nombres</dt><dd>{{ implode(', ', $p->nombres_alternos ?? []) ?: '—' }}</dd>
                <dt>Creado</dt><dd>{{ $p->created_at?->format('d/m/Y H:i') }}</dd>
                <dt>Última edición</dt><dd>{{ $p->updated_at?->format('d/m/Y H:i') }}</dd>
            </dl>
        </div>

        @if($puedeEditar)
            <div class="modal-edicion">
                <h2>Editar «{{ $p->nombre }}»</h2>
                @include('negocio._producto_form', ['p' => $p])
            </div>
        @endif
    </dialog>
@endforeach

@if($puedeEditar)
    <dialog class="modal modal-solo-edicion" id="producto-nuevo" aria-labelledby="producto-nuevo-titulo">
        <div class="modal-cabeza">
            <h2 id="producto-nuevo-titulo">Nuevo producto</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">@include('negocio._producto_form', ['p' => null])</div>
    </dialog>
@endif

<div class="rejilla catalogo-extra">
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
    <section class="bloque">
        <h2>Ficha técnica {{ $negocioWeb->plantillaGestion ? 'de la plantilla «'.$negocioWeb->plantillaGestion->nombre.'»' : '' }}</h2>
        @if($campos)
            <ul class="filas">
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
</div>
@endsection

@push('pie')
<script src="{{ asset('panel-catalogo.js') }}?v={{ filemtime(public_path('panel-catalogo.js')) }}"></script>
@if($errors->any() && old('_producto'))
    {{-- Volvió con errores: reabrir el formulario de ese producto. --}}
    <script>window.panelCatalogo && window.panelCatalogo.abrir('producto-{{ preg_replace('/[^0-9a-z]/', '', old('_producto')) }}', true);</script>
@endif
@endpush
