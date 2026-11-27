@extends('layouts.negocio')
@section('titulo', 'Materiales y producción')
@section('contenido')
@php
    use App\Gestion\Modelos;
    $pesos = fn (int $v) => '$ '.number_format($v, 0, ',', '.');
    $hayMateriales = $articulosInv->isNotEmpty();
@endphp
<header class="panel-encabezado panel-encabezado-fila">
    <div>
        <span class="panel-ceja">Operación</span>
        <h1>Materiales y producción</h1>
        <p>Cada modelo dice qué gasta una unidad: una reja, 6 varillas y 1 galón de pintura. Al anotar una producción de ese modelo, sus materiales salen ya puestos y solo se ajusta lo que cambió.</p>
    </div>
    @if($puedeProducir && $hayMateriales)
        <button type="button" class="boton boton-acento" data-abrir="modelo-nuevo">+ Nuevo modelo</button>
    @endif
</header>

@include('negocio._materiales_pestanas', ['seccion' => 'modelos'])

<section class="bloque">
    @if($modelos->isEmpty())
        <div class="inventario-vacio">
            <p class="inventario-vacio-titulo">Todavía no hay modelos.</p>
            @if($hayMateriales)
                <p class="apagado">Crea uno por cada cosa que hacen seguido: reja de ventana, portón, puerta de lámina… En un restaurante, cada plato con sus ingredientes.</p>
                @if($puedeProducir)<button type="button" class="boton boton-oscuro boton-chico" data-abrir="modelo-nuevo">+ Crear el primero</button>@endif
            @else
                <p class="apagado">Primero añade los materiales en la pestaña <a class="enlace" href="{{ route('negocio.inventario') }}">Materiales</a>.</p>
            @endif
        </div>
    @else
        <ul class="articulos">
            @foreach($modelos as $m)
                @php $alcanza = Modelos::alcanza($m); $costo = Modelos::costo($m); @endphp
                <li @class(['articulo', 'articulo-agotado' => $alcanza === 0])>
                    <button type="button" class="articulo-abrir" data-abrir="modelo-{{ $m->id }}" aria-haspopup="dialog">
                        <span class="articulo-foto sin-foto tipo-producto">
                            <span class="articulo-inicial" aria-hidden="true">{{ mb_strtoupper(mb_substr($m->nombre, 0, 1)) }}</span>
                            @if($m->al_pedido)<span class="chip articulo-tipo">Con cada pedido</span>@endif
                            @if($alcanza !== null)<span @class(['chip', 'articulo-estado', 'chip-exito' => $alcanza > 0, 'chip-peligro' => $alcanza === 0])>{{ $alcanza === 0 ? 'No alcanza' : 'Alcanza para '.number_format($alcanza, 0, ',', '.') }}</span>@endif
                        </span>
                        <span class="articulo-cuerpo">
                            <span class="producto-categoria">{{ $m->productos->isEmpty() ? 'Sin productos en el catálogo' : $m->productos->count().' '.($m->productos->count() === 1 ? 'producto' : 'productos').' en el catálogo' }}</span>
                            <span class="articulo-nombre">{{ $m->nombre }}</span>
                            <span class="articulo-rasgos">
                                @forelse($m->materiales->take(4) as $a)<span class="rasgo"><small>{{ $a->cantidadTexto((float) $a->pivot->cantidad) }}</small> {{ $a->nombre }}</span>@empty<span class="rasgo rasgo-mas">Sin materiales</span>@endforelse
                                @if($m->materiales->count() > 4)<span class="rasgo rasgo-mas">+{{ $m->materiales->count() - 4 }}</span>@endif
                            </span>
                            <span class="articulo-existencia">
                                <strong>{{ $m->producciones_count }}</strong><span>{{ $m->producciones_count === 1 ? 'vez hecho' : 'veces hecho' }}</span>
                                @if($costo && $costo['costo'] > 0)<span class="articulo-sede">{{ $pesos($costo['costo']) }} c/u</span>@endif
                            </span>
                        </span>
                    </button>
                </li>
            @endforeach
        </ul>
    @endif
</section>

@foreach($modelos as $m)
    @php $necesidades = Modelos::necesidades($m); $alcanza = Modelos::alcanza($m); $costo = Modelos::costo($m); @endphp
    <dialog class="modal modal-mediano" id="modelo-{{ $m->id }}" aria-labelledby="modelo-{{ $m->id }}-titulo">
        <div class="modal-cabeza">
            <p class="producto-categoria">Modelo{{ $m->al_pedido ? ' · se descuenta con cada pedido' : '' }}</p>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-detalle">
            <h2 id="modelo-{{ $m->id }}-titulo">{{ $m->nombre }}</h2>
            @if($m->descripcion)<p class="detalle-descripcion">{{ $m->descripcion }}</p>@endif

            <h3 class="etapa-subtitulo">Materiales de una unidad</h3>
            @if($necesidades->isEmpty())
                <p class="apagado">No tiene materiales predeterminados.</p>
            @else
                <ul class="materiales-lista">
                    @foreach($necesidades as $n)
                        @php $a = $n['articulo']; $corto = $n['hay'] + 0.0005 < $n['por_unidad']; @endphp
                        <li @class(['corto' => $corto])>
                            <span class="material-nombre"><strong>{{ $a->nombre }}</strong>@if($a->rasgosTexto())<small>{{ $a->rasgosTexto() }}</small>@endif</span>
                            <span class="material-gasta">{{ $a->cantidadTexto($n['por_unidad']) }}</span>
                            <span @class(['material-hay', 'chip', 'chip-peligro' => $corto, 'chip-aviso' => ! $corto && $a->estado() === 'bajo'])>Hay {{ $a->cantidadTexto() }}</span>
                        </li>
                    @endforeach
                </ul>
                <div class="materiales-resumen">
                    <span @class(['chip', 'chip-exito' => $alcanza > 0, 'chip-peligro' => $alcanza === 0])>{{ $alcanza === 0 ? 'No alcanza para ninguno' : 'Alcanza para '.number_format($alcanza, 0, ',', '.') }}</span>
                    @if($costo && $costo['costo'] > 0)<span class="chip chip-acento">Materiales: {{ $pesos($costo['costo']) }}{{ $costo['completo'] ? '' : ' (faltan costos)' }}</span>@endif
                </div>
            @endif

            @if($m->productos->isNotEmpty())
                <h3 class="etapa-subtitulo">En el catálogo</h3>
                <div class="detalle-chips">@foreach($m->productos as $pc)<a class="chip chip-enlace" href="{{ route('negocio.catalogo', ['buscar' => $pc->nombre]) }}">{{ $pc->nombre }}</a>@endforeach</div>
            @endif

            @if($puedeProducir)
                <div class="detalle-acciones">
                    @unless($m->al_pedido)
                        <form method="POST" action="{{ route('negocio.inventario.produccion.crear') }}">@csrf
                            <input type="hidden" name="modelo_id" value="{{ $m->id }}"><input type="hidden" name="cantidad" value="1">
                            <button class="boton boton-oscuro boton-chico">Producir uno</button>
                        </form>
                    @endunless
                    <button type="button" class="boton boton-claro boton-chico" data-editar>Editar</button>
                    <form method="POST" action="{{ route('negocio.inventario.modelos.eliminar', $m->id) }}" data-confirmar="¿Eliminar el modelo «{{ $m->nombre }}»? Lo que ya se hizo y los productos del catálogo se quedan.">@csrf @method('DELETE')
                        <button class="boton boton-chico boton-peligro">Eliminar</button>
                    </form>
                </div>
            @endif
        </div>
        @if($puedeProducir)
            <div class="modal-edicion">
                <h2>Editar «{{ $m->nombre }}»</h2>
                @include('negocio._modelo_form', ['m' => $m])
            </div>
        @endif
    </dialog>
@endforeach

@if($puedeProducir && $hayMateriales)
    <dialog class="modal modal-mediano modal-solo-edicion" id="modelo-nuevo" aria-labelledby="modelo-nuevo-titulo">
        <div class="modal-cabeza">
            <h2 id="modelo-nuevo-titulo">Nuevo modelo</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">@include('negocio._modelo_form', ['m' => null])</div>
    </dialog>
    <template id="plantilla-material">@include('negocio._material_fila', ['i' => 0, 'articuloId' => 0, 'cantidad' => ''])</template>
@endif
@endsection

@push('pie')
<script src="{{ asset('panel-catalogo.js') }}?v={{ filemtime(public_path('panel-catalogo.js')) }}"></script>
<script src="{{ asset('panel-produccion.js') }}?v={{ filemtime(public_path('panel-produccion.js')) }}"></script>
@php $modeloOld = old('_modelo'); @endphp
@if($errors->any() && $modeloOld)
    <script>window.panelCatalogo && window.panelCatalogo.abrir(@json('modelo-'.preg_replace('/[^0-9a-z]/', '', $modeloOld)), true);</script>
@elseif($abrir && $modelos->contains('id', $abrir))
    <script>window.panelCatalogo && window.panelCatalogo.abrir(@json('modelo-'.$abrir));</script>
@endif
@endpush
