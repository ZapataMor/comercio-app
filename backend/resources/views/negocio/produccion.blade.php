@extends('layouts.negocio')
@section('titulo', 'Producción')
@section('contenido')
@php
    use App\Gestion\Materiales;
    use App\Models\InventarioArticulo;
    $pesos = fn (int $v) => '$ '.number_format($v, 0, ',', '.');
@endphp
<header class="panel-encabezado panel-encabezado-fila">
    <div>
        <span class="panel-ceja">Operación</span>
        <h1>Producción y materiales</h1>
        <p>Lo que gasta cada producto del catálogo. Al registrar que se hizo uno —o cuando un pedido de Vitrina queda listo, si así lo eliges— sus materiales e insumos se descuentan solos del inventario.</p>
    </div>
    @if($puedeProducir && $sinMateriales->isNotEmpty())
        <button type="button" class="boton boton-acento" data-abrir="definir-materiales">+ Definir materiales de un producto</button>
    @endif
</header>

<div class="indicadores inventario-indicadores">
    <div class="indicador"><p>Productos con materiales</p><strong>{{ $productos->count() }}</strong></div>
    <div class="indicador"><p>Hechos este mes</p><strong>{{ InventarioArticulo::numero((float) $hechosMes) }}</strong></div>
    <div class="indicador"><p>Gastado en materiales este mes</p><strong class="indicador-dinero">{{ $costoMes ? $pesos($costoMes) : '—' }}</strong></div>
    <div @class(['indicador', 'indicador-alerta' => $materialesBajos->isNotEmpty()])>
        <p>Materiales por acabarse</p><strong>{{ $materialesBajos->count() }}</strong>
        @if($materialesBajos->isNotEmpty())<a class="indicador-enlace" href="{{ route('negocio.inventario', ['estado' => 'bajos']) }}">Ver en el inventario</a>@endif
    </div>
</div>

<section class="bloque">
    <div class="catalogo-barra">
        <div class="pestanas" role="tablist" aria-label="Producción">
            <button type="button" role="tab" class="pestana" id="pestana-productos" aria-controls="panel-productos" data-pestana="productos" aria-selected="{{ $pestana === 'productos' ? 'true' : 'false' }}" @if($pestana !== 'productos') tabindex="-1" @endif>
                Productos <span class="bloque-cuenta">{{ $productos->count() }}</span>
            </button>
            <button type="button" role="tab" class="pestana" id="pestana-historial" aria-controls="panel-historial" data-pestana="historial" aria-selected="{{ $pestana === 'historial' ? 'true' : 'false' }}" @if($pestana !== 'historial') tabindex="-1" @endif>
                Lo que se hizo <span class="bloque-cuenta">{{ $historial->count() }}</span>
            </button>
        </div>
    </div>

    <div role="tabpanel" id="panel-productos" aria-labelledby="pestana-productos" @if($pestana !== 'productos') hidden @endif>
        @if($productos->isEmpty())
            <div class="inventario-vacio">
                <p class="inventario-vacio-titulo">Ningún producto tiene materiales todavía.</p>
                <p class="apagado">Por ejemplo: un portón gasta 10 varillas de soldadura, 1 lámina de 1,22 × 2,44 m y 6 tubos de 1"; una hamburguesa, 1 pan, 150 g de carne y 1 tajada de queso. Defínelo una vez y se descontará solo.</p>
                @if($puedeProducir && $sinMateriales->isNotEmpty())<button type="button" class="boton boton-oscuro boton-chico" data-abrir="definir-materiales">+ Definir materiales de un producto</button>@endif
            </div>
        @else
            <ul class="articulos">
                @foreach($productos as $p)
                    @php
                        $foto = \App\Support\EditorProducto::urlImagen($p->imagen);
                        $alcanza = Materiales::alcanza($p);
                        $costo = Materiales::costo($p);
                    @endphp
                    <li @class(['articulo', 'articulo-agotado' => $alcanza === 0])>
                        <button type="button" class="articulo-abrir" data-abrir="producto-{{ $p->id }}" aria-haspopup="dialog">
                            <span @class(['articulo-foto', 'sin-foto' => ! $foto, 'tipo-producto'])>
                                @if($foto)<img src="{{ $foto }}" alt="{{ $p->nombre }}" loading="lazy">@else<span class="articulo-inicial" aria-hidden="true">{{ mb_strtoupper(mb_substr($p->nombre, 0, 1)) }}</span>@endif
                                <span @class(['chip', 'articulo-estado', 'chip-exito' => $alcanza > 0, 'chip-peligro' => $alcanza === 0])>{{ $alcanza === 0 ? 'No alcanza' : 'Alcanza para '.number_format($alcanza, 0, ',', '.') }}</span>
                            </span>
                            <span class="articulo-cuerpo">
                                <span class="producto-categoria">{{ $p->categoria?->nombre ?? 'Sin sección' }}</span>
                                <span class="articulo-nombre">{{ $p->nombre }}</span>
                                <span class="produccion-modo" title="Cuándo se descuentan sus materiales del inventario">{{ $p->materiales_al === 'pedido' ? 'Los materiales se descuentan con cada pedido' : 'Los materiales se descuentan al registrarlo como hecho' }}</span>
                                <span class="articulo-rasgos">
                                    @foreach($p->materiales->take(4) as $m)<span class="rasgo"><small>{{ $m->cantidadTexto((float) $m->pivot->cantidad) }}</small> {{ $m->nombre }}</span>@endforeach
                                    @if($p->materiales->count() > 4)<span class="rasgo rasgo-mas">+{{ $p->materiales->count() - 4 }}</span>@endif
                                </span>
                                <span class="articulo-existencia">
                                    <strong>{{ $p->materiales->count() }}</strong><span>{{ $p->materiales->count() === 1 ? 'material' : 'materiales' }}</span>
                                    @if($costo && $costo['costo'] > 0)<span class="articulo-sede">{{ $pesos($costo['costo']) }} c/u</span>@endif
                                </span>
                            </span>
                        </button>
                    </li>
                @endforeach
            </ul>
        @endif
    </div>

    <div role="tabpanel" id="panel-historial" aria-labelledby="pestana-historial" @if($pestana !== 'historial') hidden @endif>
        @if($historial->isEmpty())
            <p class="apagado catalogo-vacio">Todavía no se ha registrado nada.</p>
        @else
            <ul class="producciones">
                @foreach($historial as $h)
                    <li @class(['produccion', 'anulada' => $h->anulada(), 'con-faltantes' => $h->faltantes])>
                        <span class="mov-signo" aria-hidden="true">{{ $h->origen === 'pedido' ? '🛵' : '✓' }}</span>
                        <div class="produccion-texto">
                            <p class="produccion-titulo">
                                <strong>{{ Materiales::texto($h->cantidad, $h->nombre) }}</strong>
                                @if($h->anulada())<span class="chip">Anulada</span>@endif
                                @if($h->origen === 'pedido')<span class="chip chip-acento">Pedido {{ $h->pedido?->codigo ?? '' }}</span>@endif
                                @if($h->origen !== 'pedido' && $h->destino)<span @class(['chip', 'chip-exito' => $h->destino === 'catalogo', 'chip-aviso' => $h->destino === 'espera'])>{{ ['catalogo' => 'Al catálogo', 'espera' => 'En espera', 'pedido' => 'De un encargo'][$h->destino] ?? '' }}</span>@endif
                            </p>
                            <small>{{ $h->created_at?->locale('es')->translatedFormat('j M Y, g:i a') }}{{ $h->usuario ? ' · '.$h->usuario->name : '' }}{{ $h->nota && $h->origen !== 'pedido' ? ' · '.$h->nota : '' }}</small>
                            <div class="produccion-gasto">
                                @foreach($h->movimientos->where('tipo', 'salida') as $m)
                                    <span class="rasgo"><small>−{{ InventarioArticulo::numero($m->cantidad) }}</small> {{ $m->articulo?->nombre ?? 'Material borrado' }}</span>
                                @endforeach
                            </div>
                            @if($h->faltantes)
                                <p class="produccion-falto">Faltó: {{ collect($h->faltantes)->map(fn ($f) => InventarioArticulo::numero($f['falto']).' '.InventarioArticulo::nombreUnidad($f['unidad'], $f['falto']).' de «'.$f['nombre'].'»')->join('; ') }}</p>
                            @endif
                        </div>
                        <div class="produccion-lado">
                            @if($h->costo)<span class="produccion-costo">{{ $pesos($h->costo) }}</span>@endif
                            @if($puedeProducir && ! $h->anulada() && $h->origen === 'manual')
                                <form method="POST" action="{{ route('negocio.produccion.anular', $h->id) }}" data-confirmar="¿Anular «{{ Materiales::texto($h->cantidad, $h->nombre) }}»? Los materiales vuelven al inventario.">@csrf
                                    <button class="enlace-boton">Anular</button>
                                </form>
                            @endif
                        </div>
                    </li>
                @endforeach
            </ul>
        @endif
    </div>
</section>

{{-- Un modal por producto con sus materiales y «Registrar como hecho». --}}
@foreach($modales as $p)
    @php $foto = \App\Support\EditorProducto::urlImagen($p->imagen); @endphp
    <dialog class="modal modal-mediano" id="producto-{{ $p->id }}" aria-labelledby="producto-{{ $p->id }}-titulo">
        <div class="modal-cabeza">
            <p class="producto-categoria">{{ $p->categoria?->nombre ?? 'Sin sección' }}</p>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-detalle">
            <div class="produccion-ficha">
                <span class="produccion-ficha-foto">@if($foto)<img src="{{ $foto }}" alt="">@else<span class="producto-sin-foto">{{ mb_strtoupper(mb_substr($p->nombre, 0, 1)) }}</span>@endif</span>
                <div>
                    <h2 id="producto-{{ $p->id }}-titulo">{{ $p->nombre }}</h2>
                    <p class="apagado">$ {{ number_format((float) $p->precio, 0, ',', '.') }}{{ $p->unidad_medida && $p->unidad_medida !== 'unidad' ? ' / '.$p->unidad_medida : '' }} · <a class="enlace" href="{{ route('negocio.catalogo', ['buscar' => $p->nombre]) }}">Ver en el catálogo</a></p>
                </div>
            </div>
            @include('negocio._materiales_producto', ['p' => $p])
        </div>
    </dialog>
@endforeach

@if($puedeProducir && $sinMateriales->isNotEmpty())
    <dialog class="modal modal-chico modal-solo-edicion" id="definir-materiales" aria-labelledby="definir-materiales-titulo">
        <div class="modal-cabeza">
            <h2 id="definir-materiales-titulo">Definir materiales</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">
            <form method="GET" class="formulario">
                <label class="campo-panel ancho">¿De qué producto?
                    <select name="producto" required>
                        <option value="">Elige un producto del catálogo</option>
                        @foreach($sinMateriales as $s)<option value="{{ $s->id }}">{{ $s->nombre }}</option>@endforeach
                    </select>
                </label>
                <div class="ancho botonera">
                    <button class="boton boton-oscuro boton-chico">Continuar</button>
                    <button type="button" class="enlace-boton" data-cerrar>Cancelar</button>
                </div>
            </form>
        </div>
    </dialog>
@endif

@if($puedeProducir)
    <template id="plantilla-material">@include('negocio._material_fila', ['i' => 0, 'articuloId' => 0, 'cantidad' => ''])</template>
@endif
@endsection

@push('pie')
<script src="{{ asset('panel-catalogo.js') }}?v={{ filemtime(public_path('panel-catalogo.js')) }}"></script>
<script src="{{ asset('panel-produccion.js') }}?v={{ filemtime(public_path('panel-produccion.js')) }}"></script>
@php
    $abrir = session('abrir') ?? (old('_materiales') ? 'producto-'.(int) old('_materiales') : (old('_hecho') ? 'producto-'.(int) old('_hecho') : null)) ?? ($elegido ? 'producto-'.$elegido->id : null);
@endphp
@if($abrir)
    <script>window.panelCatalogo && window.panelCatalogo.abrir(@json($abrir));</script>
@endif
@if($elegido && $elegido->materiales->isEmpty() && $puedeProducir && ! $errors->any())
    {{-- Llegó desde «Definir materiales»: abre directo el formulario. --}}
    <script>document.querySelector('#producto-{{ $elegido->id }} [data-materiales-editar]')?.click();</script>
@endif
@endpush
