@extends('layouts.negocio')
@section('titulo', 'Catálogo')
@section('contenido')
<header class="panel-encabezado panel-encabezado-fila">
    <div>
        <span class="panel-ceja">Núcleo</span>
        <h1>Catálogo</h1>
        <p>Lo que se muestra en Vitrina. Toca un producto para ver toda su información{{ $puedeEditar ? ', editarlo o eliminarlo' : '' }}. Los cambios se ven al instante en la app.</p>
    </div>
    @if($puedeEditar)
        {{-- Cambia con la pestaña: en Servicios se añade un servicio. --}}
        <button type="button" class="boton boton-acento" data-abrir="producto-nuevo" data-solo-pestana="productos" @if($pestana !== 'productos') hidden @endif>+ Añadir producto</button>
        <button type="button" class="boton boton-acento" data-abrir="servicio-nuevo" data-solo-pestana="servicios" @if($pestana !== 'servicios') hidden @endif>+ Añadir servicio</button>
    @endif
</header>

{{-- Esta parte se vuelve a pedir cuando el catálogo cambia en la app o en otra pestaña. --}}
<div id="catalogo-vivo" data-vivo data-negocio="{{ $negocioWeb->id }}">
<section class="bloque">
    <div class="catalogo-barra">
        <div class="pestanas" role="tablist" aria-label="Catálogo">
            <button type="button" role="tab" class="pestana" id="pestana-productos" aria-controls="panel-productos" data-pestana="productos" aria-selected="{{ $pestana === 'productos' ? 'true' : 'false' }}" @if($pestana !== 'productos') tabindex="-1" @endif>
                Productos <span class="bloque-cuenta">{{ $productos->total() }}{{ $productos->total() !== $totalProductos ? ' de '.$totalProductos : '' }}</span>
            </button>
            <button type="button" role="tab" class="pestana" id="pestana-servicios" aria-controls="panel-servicios" data-pestana="servicios" aria-selected="{{ $pestana === 'servicios' ? 'true' : 'false' }}" @if($pestana !== 'servicios') tabindex="-1" @endif>
                Servicios <span class="bloque-cuenta">{{ $servicios->count() }}</span>
            </button>
        </div>
        <form method="GET" class="catalogo-filtros" role="search" data-solo-pestana="productos" @if($pestana !== 'productos') hidden @endif>
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

    <div role="tabpanel" id="panel-productos" aria-labelledby="pestana-productos" @if($pestana !== 'productos') hidden @endif>
        @if($productos->isEmpty())
            <p class="apagado catalogo-vacio">{{ $buscar !== '' || $estado ? 'Ningún producto coincide con la búsqueda.' : 'Todavía no hay productos.' }}</p>
        @else
            <ul class="productos">
                @foreach($productos as $p)
                    @php $foto = \App\Support\EditorProducto::urlImagen($p->imagen); @endphp
                    <li @class(['producto', 'agotado' => ! $p->disponible]) data-producto="{{ $p->id }}">
                        <button type="button" class="producto-abrir" data-abrir="producto-{{ $p->id }}" aria-haspopup="dialog">
                            <span class="producto-foto">
                                @if($foto)
                                    <img src="{{ $foto }}" alt="{{ $p->nombre }}" loading="lazy">
                                @else
                                    <span class="producto-sin-foto" role="img" aria-label="Sin imagen de {{ $p->nombre }}">{{ mb_strtoupper(mb_substr($p->nombre, 0, 1)) }}</span>
                                @endif
                                <span @class(['chip', 'producto-estado', 'chip-exito' => $p->disponible]) data-estado-texto>{{ $p->disponible ? 'Disponible' : 'Agotado' }}</span>
                            </span>
                            <span class="producto-cuerpo">
                                <span class="producto-categoria">{{ $p->categoria?->nombre ?? 'Sin sección' }}</span>
                                <span class="producto-nombre">{{ $p->nombre }}</span>
                                <span class="producto-precio">$ {{ number_format((float) $p->precio, 0, ',', '.') }}@if($p->unidad_medida && $p->unidad_medida !== 'unidad')<small> / {{ $p->unidad_medida }}</small>@endif</span>
                            </span>
                        </button>
                        @if($puedeEditar)
                            <label class="producto-pie interruptor">
                                <input type="checkbox" role="switch" data-disponible="{{ route('negocio.productos.disponible', $p->id) }}" @checked($p->disponible)
                                       aria-label="{{ $p->nombre }} disponible">
                                <span class="interruptor-pista" aria-hidden="true"></span>
                                <span class="interruptor-texto" data-estado-texto>{{ $p->disponible ? 'Disponible' : 'Agotado' }}</span>
                            </label>
                        @endif
                    </li>
                @endforeach
            </ul>
        @endif
        {{ $productos->links('negocio._paginas') }}
    </div>

    <div role="tabpanel" id="panel-servicios" aria-labelledby="pestana-servicios" @if($pestana !== 'servicios') hidden @endif>
        @if($servicios->isEmpty())
            <p class="apagado catalogo-vacio">Este negocio no ofrece servicios todavía.{{ $puedeEditar ? ' Añade el primero con «+ Añadir servicio».' : '' }}</p>
        @else
            <ul class="servicios">
                @foreach($servicios as $s)
                    <li @class(['servicio', 'agotado' => ! $s->disponible])>
                        <div class="servicio-cabeza">
                            <p class="servicio-nombre">{{ $s->nombre }}</p>
                            <span @class(['chip', 'chip-exito' => $s->disponible])>{{ $s->disponible ? 'Disponible' : 'No disponible' }}</span>
                        </div>
                        @if($s->descripcion)<p class="servicio-descripcion">{{ $s->descripcion }}</p>@endif
                        <div class="servicio-pie">
                            <span class="producto-precio">{{ $s->precio ? '$ '.number_format($s->precio, 0, ',', '.') : 'Precio a convenir' }}</span>
                            <span class="chip">{{ $s->duracion_minutos }} min</span>
                            @if($s->permite_citas)<span class="chip chip-acento">Con citas</span>@endif
                        </div>
                    </li>
                @endforeach
            </ul>
        @endif
    </div>
</section>

{{-- Un modal por producto: toda la información y, para quien puede, la edición. --}}
@foreach($productos as $p)
    @php
        $foto = \App\Support\EditorProducto::urlImagen($p->imagen);
        $precio = '$ '.number_format((float) $p->precio, 0, ',', '.');
        $venta = match ($p->unidad_medida) { 'kg' => 'Kilos', 'libra' => 'Libras', default => 'Cantidad (unidad)' };
        $atributos = array_values(array_filter((array) ($p->atributos ?? []), 'is_string'));
        $fijos = array_values(array_filter((array) ($p->ingredientes_fijos ?? []), 'is_string'));
        $opcionales = array_values(array_diff($atributos, $fijos));
        $colores = array_values(array_filter((array) ($p->colores ?? []), 'is_string'));
        $extras = array_values(array_filter((array) ($p->extras ?? []), fn ($e) => is_array($e) && trim((string) ($e['nombre'] ?? '')) !== ''));
        $esComida = $p->tipoProducto?->slug === 'comida' || $fijos || $extras;
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

                    @if($esComida)
                        <div class="detalle-extras">
                            <h3>Extras <span class="ayuda">se piden aparte</span></h3>
                            @if($extras)
                                <ul>
                                    @foreach($extras as $e)
                                        <li><span>{{ $e['nombre'] }}</span><strong>{{ (int) ($e['precio'] ?? 0) ? '+ $ '.number_format((int) $e['precio'], 0, ',', '.') : 'Gratis' }}</strong></li>
                                    @endforeach
                                </ul>
                            @else
                                <p class="apagado">Sin extras.</p>
                            @endif
                        </div>
                    @endif

                    @if($puedeEditar)
                        <div class="detalle-acciones">
                            <button type="button" class="boton boton-oscuro boton-chico" data-editar>Editar</button>
                            <form method="POST" action="{{ route('negocio.productos.disponible', $p->id) }}">@csrf @method('PATCH')
                                <input type="hidden" name="disponible" value="{{ $p->disponible ? 0 : 1 }}">
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
                @if($esComida)
                    <dt>Ingredientes opcionales</dt>
                    <dd>@forelse($opcionales as $a)<span class="chip">{{ $a }}</span>@empty<span class="apagado">—</span>@endforelse</dd>
                    <dt>Ingredientes obligatorios</dt>
                    <dd>@forelse($fijos as $a)<span class="chip chip-acento">{{ $a }}</span>@empty<span class="apagado">—</span>@endforelse</dd>
                @else
                    <dt>{{ $p->tipoProducto?->atributo_label ?? 'Características' }}</dt>
                    <dd>@forelse($atributos as $a)<span class="chip">{{ $a }}</span>@empty<span class="apagado">—</span>@endforelse</dd>
                @endif
                @if($colores)<dt>Colores</dt><dd>@foreach($colores as $a)<span class="chip">{{ $a }}</span>@endforeach</dd>@endif
                <dt>Se vende por</dt><dd>{{ $venta }}</dd>
                <dt>Sección del negocio</dt><dd>{{ $p->categoria?->nombre ?? 'Sin sección' }}</dd>
                <dt>Categorías de Vitrina</dt>
                <dd>@forelse($p->categoriasCatalogo as $c)<span class="chip">{{ $c->nombre }}</span>@empty<span class="apagado">Ninguna</span>@endforelse</dd>
                <dt>Otros nombres</dt><dd>@forelse($p->nombres_alternos ?? [] as $a)<span class="chip">{{ $a }}</span>@empty<span class="apagado">—</span>@endforelse</dd>
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
</div>

@if($puedeEditar)
    <dialog class="modal modal-solo-edicion" id="producto-nuevo" aria-labelledby="producto-nuevo-titulo">
        <div class="modal-cabeza">
            <h2 id="producto-nuevo-titulo">Nuevo producto</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">@include('negocio._producto_form', ['p' => null])</div>
    </dialog>

    @php $sOld = old('_servicio') === 'nuevo'; @endphp
    <dialog class="modal modal-solo-edicion modal-mediano" id="servicio-nuevo" aria-labelledby="servicio-nuevo-titulo">
        <div class="modal-cabeza">
            <h2 id="servicio-nuevo-titulo">Nuevo servicio</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">
            <form method="POST" enctype="multipart/form-data" class="formulario producto-form" action="{{ route('negocio.servicios.crear') }}">
                @csrf
                <input type="hidden" name="_servicio" value="nuevo">
                <label class="campo-panel ancho">Nombre<input name="nombre" required maxlength="150" value="{{ $sOld ? old('nombre') : '' }}" placeholder="Pintura de puerta"></label>
                <label class="campo-panel ancho">Descripción<textarea name="descripcion" rows="3" required maxlength="5000" placeholder="Qué incluye el servicio">{{ $sOld ? old('descripcion') : '' }}</textarea></label>
                <label class="campo-panel">Precio (pesos)<input name="precio" inputmode="numeric" value="{{ $sOld ? old('precio') : '' }}" placeholder="Vacío = a convenir"></label>
                <label class="campo-panel">Duración (minutos)<input name="duracion_minutos" type="number" min="5" max="480" step="5" required value="{{ $sOld ? old('duracion_minutos', 30) : 30 }}"></label>
                <label class="campo-panel ancho">Fotos <span class="ayuda">Hasta {{ \App\Support\EditorServicio::MAX_FOTOS }}, JPG o PNG de hasta 4 MB cada una.</span>
                    <input type="file" name="imagenes[]" accept="image/*" multiple>
                </label>
                <div class="ancho casillas-dos">
                    <label class="casilla"><input type="checkbox" name="permite_citas" value="1" @checked(! $sOld || old('permite_citas'))> Los clientes pueden agendar cita</label>
                    <label class="casilla"><input type="checkbox" name="disponible" value="1" @checked(! $sOld || old('disponible'))> Disponible</label>
                </div>
                <div class="ancho botonera producto-form-acciones">
                    <button class="boton boton-oscuro boton-chico">Añadir servicio</button>
                    <button type="button" class="enlace-boton" data-cerrar>Cancelar</button>
                </div>
            </form>
        </div>
    </dialog>
@endif

<section class="bloque catalogo-extra">
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

{{-- Para nuevas filas de las listas «uno por uno». --}}
<template id="plantilla-lista-item">
    <li class="lista-item">
        <span class="lista-item-texto"></span>
        <input type="hidden">
        <label class="lista-item-obligatorio"><input type="checkbox" name="fijos_lista[]"> Obligatorio</label>
        <button type="button" class="lista-item-quitar" data-lista-quitar>✕</button>
    </li>
</template>
@endsection

@push('pie')
<script>window.vitrinaEnVivo = {!! json_encode(['clave' => config('broadcasting.connections.reverb.key'), 'puerto' => 8080]) !!};</script>
<script src="{{ asset('vendor/pusher-8.5.0.min.js') }}"></script>
<script src="{{ asset('panel-catalogo.js') }}?v={{ filemtime(public_path('panel-catalogo.js')) }}"></script>
@if($errors->any() && old('_producto'))
    {{-- Volvió con errores: reabrir el formulario de ese producto. --}}
    <script>window.panelCatalogo && window.panelCatalogo.abrir('producto-{{ preg_replace('/[^0-9a-z]/', '', old('_producto')) }}', true);</script>
@endif
@if(($errors->any() || session('error')) && old('_servicio') === 'nuevo')
    <script>window.panelCatalogo && window.panelCatalogo.abrir('servicio-nuevo', true);</script>
@endif
@endpush
