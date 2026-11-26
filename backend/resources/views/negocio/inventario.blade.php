@extends('layouts.negocio')
@section('titulo', 'Inventario')
@section('contenido')
@php
    use App\Models\InventarioArticulo;
    use App\Models\InventarioMovimiento;
    $pesos = fn (?int $v) => $v === null ? null : '$ '.number_format($v, 0, ',', '.');
    $filtrado = $buscar !== '' || $categoria !== '' || $estado || $sedeFiltro;
    $urlTipo = fn (?string $t) => route('negocio.inventario', array_filter(['tipo' => $t, 'buscar' => $buscar ?: null, 'categoria' => $categoria ?: null, 'estado' => $estado, 'sede' => $sedeFiltro?->id]));
@endphp
<header class="panel-encabezado panel-encabezado-fila">
    <div>
        <span class="panel-ceja">Operación</span>
        <h1>Inventario</h1>
        <p>Materia prima, insumos, productos y herramientas del negocio, cada uno con sus propias características. Toca una tarjeta para ver toda su información{{ $puedeEditar ? ', registrar entradas y salidas o editarla' : '' }}.</p>
    </div>
    @if($puedeEditar)
        <button type="button" class="boton boton-acento" data-abrir="articulo-nuevo">+ Añadir al inventario</button>
    @endif
</header>

<div class="indicadores inventario-indicadores">
    <div class="indicador"><p>Artículos</p><strong>{{ number_format($total, 0, ',', '.') }}</strong></div>
    <div class="indicador"><p>Materia prima</p><strong>{{ number_format($porTipo['materia_prima'] ?? 0, 0, ',', '.') }}</strong></div>
    <div @class(['indicador', 'indicador-alerta' => $bajos > 0])>
        <p>Por acabarse o agotados</p><strong>{{ $bajos }}</strong>
        @if($bajos)<a class="indicador-enlace" href="{{ route('negocio.inventario', ['estado' => 'bajos']) }}">Ver cuáles</a>@endif
    </div>
    <div class="indicador"><p>Valor de lo que hay</p><strong class="indicador-dinero">{{ $conCosto ? $pesos($valorTotal) : '—' }}</strong>
        @if(! $conCosto && $total)<span class="indicador-nota">Ponle costo a los artículos para verlo.</span>@endif
    </div>
</div>

<section class="bloque">
    <div class="catalogo-barra inventario-barra">
        <nav class="pestanas inventario-tipos" aria-label="Tipo de artículo">
            <a href="{{ $urlTipo(null) }}" class="pestana" aria-selected="{{ $tipo ? 'false' : 'true' }}" @if(! $tipo) aria-current="page" @endif>Todo <span class="bloque-cuenta">{{ $total }}</span></a>
            @foreach(InventarioArticulo::TIPOS as $clave => $texto)
                @if(($porTipo[$clave] ?? 0) > 0 || $tipo === $clave)
                    <a href="{{ $urlTipo($clave) }}" class="pestana" aria-selected="{{ $tipo === $clave ? 'true' : 'false' }}" @if($tipo === $clave) aria-current="page" @endif>{{ $texto }} <span class="bloque-cuenta">{{ $porTipo[$clave] ?? 0 }}</span></a>
                @endif
            @endforeach
        </nav>
        <form method="GET" class="catalogo-filtros" role="search">
            @if($tipo)<input type="hidden" name="tipo" value="{{ $tipo }}">@endif
            <input type="search" name="buscar" value="{{ $buscar }}" placeholder="Buscar por nombre, característica…" aria-label="Buscar en el inventario">
            @if($categorias->isNotEmpty())
                <select name="categoria" aria-label="Filtrar por categoría" onchange="this.form.submit()">
                    <option value="">Todas las categorías</option>
                    @foreach($categorias as $c)<option value="{{ $c }}" @selected($categoria === $c)>{{ $c }}</option>@endforeach
                </select>
            @endif
            <select name="estado" aria-label="Filtrar por existencias" onchange="this.form.submit()">
                <option value="">Todas las existencias</option>
                <option value="bajos" @selected($estado === 'bajos')>Por acabarse o agotados</option>
                <option value="agotados" @selected($estado === 'agotados')>Solo agotados</option>
            </select>
            @if($sedes->count() > 1)
                <select name="sede" aria-label="Filtrar por sede" onchange="this.form.submit()">
                    <option value="">Todas las sedes</option>
                    @foreach($sedes as $s)<option value="{{ $s->id }}" @selected($sedeFiltro?->id === $s->id)>{{ $s->nombre }}</option>@endforeach
                </select>
            @endif
            <button class="boton boton-claro boton-chico">Buscar</button>
            @if($filtrado)<a class="enlace" href="{{ route('negocio.inventario', array_filter(['tipo' => $tipo])) }}">Quitar filtros</a>@endif
        </form>
    </div>

    @if($articulos->isEmpty())
        <div class="inventario-vacio">
            @if($total === 0)
                <p class="inventario-vacio-titulo">Todavía no hay nada en el inventario.</p>
                <p class="apagado">Empieza por la materia prima: tubos, láminas, tela, harina… Cada artículo lleva las características que necesites (calibre, color, medida, material) y se cuenta en su unidad: unidades, kilos, metros o láminas.</p>
                @if($puedeEditar)<button type="button" class="boton boton-oscuro boton-chico" data-abrir="articulo-nuevo">+ Añadir el primero</button>@endif
            @else
                <p class="apagado">Ningún artículo coincide con la búsqueda.</p>
            @endif
        </div>
    @else
        <ul class="articulos">
            @foreach($articulos as $a)
                @php
                    $foto = \App\Support\EditorProducto::urlImagen($a->imagen);
                    $rasgos = $a->listaCaracteristicas();
                    $estadoA = $a->estado();
                    // Nivel frente al mínimo: lleno cuando hay el triple del mínimo.
                    $nivel = $a->minimo ? max(0, min(100, (int) round($a->cantidad / ($a->minimo * 3) * 100))) : null;
                @endphp
                <li @class(['articulo', 'articulo-'.$estadoA])>
                    <button type="button" class="articulo-abrir" data-abrir="articulo-{{ $a->id }}" aria-haspopup="dialog">
                        <span @class(['articulo-foto', 'sin-foto' => ! $foto, 'tipo-'.$a->tipo])>
                            @if($foto)
                                <img src="{{ $foto }}" alt="{{ $a->nombre }}" loading="lazy">
                            @else
                                <span class="articulo-inicial" aria-hidden="true">{{ mb_strtoupper(mb_substr($a->nombre, 0, 1)) }}</span>
                            @endif
                            <span class="chip articulo-tipo">{{ $a->tipoTexto() }}</span>
                            @if($estadoA !== 'ok')<span @class(['chip', 'articulo-estado', 'chip-peligro' => $estadoA === 'agotado', 'chip-aviso' => $estadoA === 'bajo'])>{{ $a->estadoTexto() }}</span>@endif
                        </span>
                        <span class="articulo-cuerpo">
                            <span class="producto-categoria">{{ $a->categoria ?? 'Sin categoría' }}@if($a->referencia)<span class="articulo-ref"> · {{ $a->referencia }}</span>@endif</span>
                            <span class="articulo-nombre">{{ $a->nombre }}</span>
                            @if($rasgos)
                                <span class="articulo-rasgos">
                                    @foreach(array_slice($rasgos, 0, 4) as $r)<span class="rasgo"><small>{{ $r['nombre'] }}</small> {{ $r['valor'] }}</span>@endforeach
                                    @if(count($rasgos) > 4)<span class="rasgo rasgo-mas">+{{ count($rasgos) - 4 }}</span>@endif
                                </span>
                            @endif
                            <span class="articulo-existencia">
                                <strong>{{ InventarioArticulo::numero($a->cantidad) }}</strong>
                                <span>{{ InventarioArticulo::nombreUnidad($a->unidad, $a->cantidad) }}</span>
                                @if($sedes->count() > 1 && $a->sede)<span class="articulo-sede">{{ $a->sede->nombre }}</span>@endif
                            </span>
                            @if($nivel !== null)
                                <span class="articulo-nivel" role="img" aria-label="Mínimo: {{ $a->cantidadTexto($a->minimo) }}"><span style="width: {{ $nivel }}%"></span></span>
                            @endif
                        </span>
                    </button>
                </li>
            @endforeach
        </ul>
        {{ $articulos->links('negocio._paginas') }}
    @endif
</section>

{{-- Un modal por artículo: toda la información, los movimientos y, para quien puede, la edición. --}}
@foreach($articulos as $a)
    @php
        $foto = \App\Support\EditorProducto::urlImagen($a->imagen);
        $rasgos = $a->listaCaracteristicas();
        $estadoA = $a->estado();
        $mOld = old('_movimiento') === (string) $a->id;
    @endphp
    <dialog class="modal" id="articulo-{{ $a->id }}" aria-labelledby="articulo-{{ $a->id }}-titulo">
        <div class="modal-cabeza">
            <p class="producto-categoria">{{ $a->tipoTexto() }}{{ $a->categoria ? ' · '.$a->categoria : '' }}</p>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>

        <div class="modal-detalle">
            <div class="detalle-portada articulo-portada">
                <div @class(['detalle-foto', 'articulo-foto-grande', 'tipo-'.$a->tipo])>
                    @if($foto)<img src="{{ $foto }}" alt="{{ $a->nombre }}" loading="lazy">@else<span class="articulo-inicial">{{ mb_strtoupper(mb_substr($a->nombre, 0, 1)) }}</span>@endif
                </div>
                <div class="detalle-principal">
                    <h2 id="articulo-{{ $a->id }}-titulo">{{ $a->nombre }}</h2>
                    <p class="articulo-existencia-grande"><strong>{{ InventarioArticulo::numero($a->cantidad) }}</strong> {{ InventarioArticulo::nombreUnidad($a->unidad, $a->cantidad) }}</p>
                    <div class="detalle-chips">
                        <span @class(['chip', 'chip-exito' => $estadoA === 'ok', 'chip-aviso' => $estadoA === 'bajo', 'chip-peligro' => $estadoA === 'agotado'])>{{ $a->estadoTexto() }}</span>
                        <span class="chip">{{ $a->tipoTexto() }}</span>
                        @if($a->minimo !== null)<span class="chip">Mínimo {{ $a->cantidadTexto($a->minimo) }}</span>@endif
                        @if($sedes->count() > 1 && $a->sede)<span class="chip chip-acento">{{ $a->sede->nombre }}</span>@endif
                    </div>
                    @if($a->descripcion)<p class="detalle-descripcion">{{ $a->descripcion }}</p>@endif

                    @if($puedeEditar)
                        <form method="POST" action="{{ route('negocio.inventario.mover', $a->id) }}" class="movimiento-form" data-movimiento>
                            @csrf
                            <input type="hidden" name="_movimiento" value="{{ $a->id }}">
                            <h3>Registrar un movimiento</h3>
                            <div class="movimiento-tipos" role="radiogroup" aria-label="Tipo de movimiento">
                                @foreach(InventarioMovimiento::TIPOS as $clave => $texto)
                                    <label class="movimiento-tipo"><input type="radio" name="tipo" value="{{ $clave }}" @checked(($mOld ? old('tipo') : 'entrada') === $clave)><span>{{ $clave === 'ajuste' ? 'Conteo' : $texto }}</span></label>
                                @endforeach
                            </div>
                            <div class="movimiento-campos">
                                <label class="campo-panel"><span data-movimiento-etiqueta>¿Cuánto entró?</span>
                                    <span class="campo-unidad"><input name="cantidad" inputmode="decimal" required autocomplete="off" value="{{ $mOld ? old('cantidad') : '' }}" placeholder="0"><span>{{ InventarioArticulo::UNIDADES[$a->unidad][2] ?? $a->unidad }}</span></span>
                                </label>
                                <label class="campo-panel"><span>Nota <span class="ayuda">opcional</span></span>
                                    <input name="nota" maxlength="255" value="{{ $mOld ? old('nota') : '' }}" placeholder="Compra al proveedor, trabajo de la puerta…" data-movimiento-nota>
                                </label>
                            </div>
                            @if($mOld && $errors->any())<p class="campo-error" role="alert">{{ $errors->first() }}</p>@endif
                            <p class="ayuda" data-movimiento-ayuda>Se suma a lo que hay.</p>
                            <button class="boton boton-oscuro boton-chico" data-movimiento-boton>Registrar entrada</button>
                        </form>

                        <div class="detalle-acciones">
                            <button type="button" class="boton boton-claro boton-chico" data-editar>Editar</button>
                            <form method="POST" action="{{ route('negocio.inventario.eliminar', $a->id) }}" data-confirmar="¿Eliminar «{{ $a->nombre }}» del inventario? También se borra su historial de movimientos.">@csrf @method('DELETE')
                                <button class="boton boton-chico boton-peligro">Eliminar</button>
                            </form>
                        </div>
                    @endif
                </div>
            </div>

            <dl class="detalle-datos">
                @if($rasgos)
                    @foreach($rasgos as $r)<dt>{{ $r['nombre'] }}</dt><dd class="dato-rasgo">{{ $r['valor'] }}</dd>@endforeach
                @else
                    <dt>Características</dt><dd><span class="apagado">Sin características.</span></dd>
                @endif
                <dt>Se cuenta en</dt><dd>{{ mb_strtolower(InventarioArticulo::UNIDADES[$a->unidad][0] ?? $a->unidad) }}</dd>
                <dt>Costo por {{ InventarioArticulo::UNIDADES[$a->unidad][1] ?? $a->unidad }}</dt><dd>{{ $pesos($a->costo) ?? '—' }}</dd>
                @if($a->valor() !== null)<dt>Valor de lo que hay</dt><dd>{{ $pesos($a->valor()) }}</dd>@endif
                <dt>Proveedor</dt><dd>{{ $a->proveedor ?? '—' }}</dd>
                <dt>Referencia o código</dt><dd>{{ $a->referencia ?? '—' }}</dd>
                @if($sedes->count() > 1)<dt>Sede</dt><dd>{{ $a->sede?->nombre ?? 'Sin sede' }}</dd>@endif
                <dt>Creado</dt><dd>{{ $a->created_at?->format('d/m/Y H:i') }}</dd>
                <dt>Última edición</dt><dd>{{ $a->updated_at?->format('d/m/Y H:i') }}</dd>
            </dl>

            <div class="articulo-movimientos">
                <h3>Últimos movimientos</h3>
                @if($a->movimientos->isEmpty())
                    <p class="apagado">Sin movimientos todavía.</p>
                @else
                    <ul>
                        @foreach($a->movimientos as $m)
                            <li class="mov-{{ $m->tipo }}">
                                <span class="mov-signo" aria-hidden="true">{{ ['entrada' => '+', 'salida' => '−', 'ajuste' => '='][$m->tipo] ?? '·' }}</span>
                                <span class="mov-texto">
                                    <strong>{{ $m->tipoTexto() }}: {{ $a->cantidadTexto($m->cantidad) }}</strong>
                                    <small>{{ $m->created_at?->locale('es')->translatedFormat('j M Y, g:i a') }}{{ $m->usuario ? ' · '.$m->usuario->name : '' }}{{ $m->nota ? ' · '.$m->nota : '' }}</small>
                                </span>
                                <span class="mov-saldo">Quedó en {{ InventarioArticulo::numero($m->saldo) }}</span>
                            </li>
                        @endforeach
                    </ul>
                @endif
            </div>
        </div>

        @if($puedeEditar)
            <div class="modal-edicion">
                <h2>Editar «{{ $a->nombre }}»</h2>
                @include('negocio._articulo_form', ['a' => $a])
            </div>
        @endif
    </dialog>
@endforeach

@if($puedeEditar)
    <dialog class="modal modal-solo-edicion" id="articulo-nuevo" aria-labelledby="articulo-nuevo-titulo">
        <div class="modal-cabeza">
            <h2 id="articulo-nuevo-titulo">Añadir al inventario</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">@include('negocio._articulo_form', ['a' => null])</div>
    </dialog>

    {{-- Sugerencias para las características: nombres y, por cada nombre, los valores que ya usó el negocio. --}}
    <datalist id="inv-nombres">@foreach($sugerencias['nombres'] as $n)<option value="{{ $n }}">@endforeach</datalist>
    <datalist id="inv-categorias">@foreach($categorias as $c)<option value="{{ $c }}">@endforeach</datalist>
    <datalist id="inv-proveedores">@foreach($proveedores as $p)<option value="{{ $p }}">@endforeach</datalist>
    @php $listas = []; @endphp
    @foreach($sugerencias['valores'] as $nombre => $valores)
        @php $listas[mb_strtolower($nombre)] = 'inv-valores-'.$loop->index; @endphp
        <datalist id="inv-valores-{{ $loop->index }}">@foreach($valores as $v)<option value="{{ $v }}">@endforeach</datalist>
    @endforeach
    <script type="application/json" id="inv-listas-valores">{!! json_encode((object) $listas, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) !!}</script>

    <template id="plantilla-caracteristica">
        <li class="caracteristica-fila">
            <input data-car-nombre list="inv-nombres" maxlength="40" placeholder="Ej.: Calibre" aria-label="Característica">
            <input data-car-valor maxlength="80" placeholder="Ej.: 18" aria-label="Valor">
            <button type="button" class="lista-item-quitar" data-car-quitar aria-label="Quitar característica">✕</button>
        </li>
    </template>
@endif
@endsection

@push('pie')
<script src="{{ asset('panel-catalogo.js') }}?v={{ filemtime(public_path('panel-catalogo.js')) }}"></script>
<script src="{{ asset('panel-inventario.js') }}?v={{ filemtime(public_path('panel-inventario.js')) }}"></script>
@if($errors->any() && old('_articulo'))
    {{-- Volvió con errores: reabrir el formulario de ese artículo. --}}
    <script>window.panelCatalogo && window.panelCatalogo.abrir('articulo-{{ preg_replace('/[^0-9a-z]/', '', old('_articulo')) }}', true);</script>
@elseif($errors->any() && old('_movimiento'))
    <script>window.panelCatalogo && window.panelCatalogo.abrir('articulo-{{ (int) old('_movimiento') }}');</script>
@endif
@endpush
