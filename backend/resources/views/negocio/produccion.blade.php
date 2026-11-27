@extends('layouts.negocio')
@section('titulo', 'Materiales y producción')
@section('contenido')
@php
    use App\Gestion\Etapas;
    use App\Gestion\Modelos;
    use App\Models\InventarioArticulo;
    use App\Models\Produccion;
    use App\Support\EditorProducto;
    $pesos = fn (int $v) => '$ '.number_format($v, 0, ',', '.');
    $hayMateriales = $articulosInv->isNotEmpty();
    $fecha = fn ($f) => $f?->locale('es')->translatedFormat('j M, g:i a');
    $pasos = ['Por hacer', 'Ponerle nombre', 'En el catálogo'];
@endphp
<header class="panel-encabezado panel-encabezado-fila">
    <div>
        <span class="panel-ceja">Operación</span>
        <h1>Materiales y producción</h1>
        <p>Primero se anota lo que se hará, con sus materiales: los del modelo ya vienen puestos y se ajustan con − y +. Al terminarla se descuentan del inventario; luego se le pone nombre y precio para que llegue al catálogo.</p>
    </div>
    @if($puedeProducir)
        <button type="button" class="boton boton-acento" data-abrir="produccion-nueva">+ Nueva producción</button>
    @endif
</header>

@include('negocio._materiales_pestanas', ['seccion' => 'produccion'])

<div class="indicadores inventario-indicadores">
    <div class="indicador"><p>Por hacer</p><strong>{{ $porHacer->count() }}</strong></div>
    <div @class(['indicador', 'indicador-alerta' => $terminadas->isNotEmpty()])><p>Para ponerle nombre</p><strong>{{ $terminadas->count() }}</strong></div>
    <div class="indicador"><p>Hechos este mes</p><strong>{{ InventarioArticulo::numero($hechosMes) }}</strong></div>
    <div class="indicador"><p>Gastado en materiales este mes</p><strong class="indicador-dinero">{{ $costoMes ? $pesos($costoMes) : '—' }}</strong></div>
</div>

<section class="bloque">
    <div class="catalogo-barra">
        <div class="pestanas" role="tablist" aria-label="Producción">
            <button type="button" role="tab" class="pestana" id="pestana-proceso" aria-controls="panel-proceso" data-pestana="proceso" aria-selected="{{ $pestana === 'proceso' ? 'true' : 'false' }}" @if($pestana !== 'proceso') tabindex="-1" @endif>
                En proceso <span class="bloque-cuenta">{{ $porHacer->count() + $terminadas->count() }}</span>
            </button>
            <button type="button" role="tab" class="pestana" id="pestana-historial" aria-controls="panel-historial" data-pestana="historial" aria-selected="{{ $pestana === 'historial' ? 'true' : 'false' }}" @if($pestana !== 'historial') tabindex="-1" @endif>
                Historial <span class="bloque-cuenta">{{ $historial->count() }}</span>
            </button>
        </div>
    </div>

    <div role="tabpanel" id="panel-proceso" aria-labelledby="pestana-proceso" @if($pestana !== 'proceso') hidden @endif>
        @if($porHacer->isEmpty() && $terminadas->isEmpty())
            <div class="inventario-vacio">
                <p class="inventario-vacio-titulo">No hay nada en proceso.</p>
                <p class="apagado">Anota lo que se va a hacer: una reja, un portón, una puerta… Si tiene modelo, sus materiales ya vienen puestos (una reja: 6 varillas y 1 galón de pintura) y solo ajustas lo que cambió.</p>
                @if($puedeProducir)<button type="button" class="boton boton-oscuro boton-chico" data-abrir="produccion-nueva">+ Nueva producción</button>@endif
            </div>
        @endif

        @foreach([[1, 'Por hacer', 'Se ajustan sus materiales; todavía no se descuenta nada.', $porHacer], [2, 'Ponerle nombre', 'Ya se descontaron sus materiales. Ponle nombre, precio y foto para llevarla al catálogo.', $terminadas]] as [$paso, $titulo, $ayuda, $lista])
            @if($lista->isNotEmpty())
                <div class="etapa-grupo">
                    <h2 class="etapa-grupo-titulo"><span class="etapa-numero">{{ $paso }}</span> {{ $titulo }} <span class="bloque-cuenta">{{ $lista->count() }}</span></h2>
                    <p class="apagado">{{ $ayuda }}</p>
                    <ul class="articulos">
                        @foreach($lista as $p)
                            @php
                                $foto = EditorProducto::urlImagen($p->imagen);
                                $falta = $paso === 1 && $p->materiales->contains(fn ($m) => (float) $m->pivot->cantidad > $m->cantidad + 0.0005);
                            @endphp
                            <li @class(['articulo', 'articulo-agotado' => $falta])>
                                <button type="button" class="articulo-abrir" data-abrir="produccion-{{ $p->id }}" aria-haspopup="dialog">
                                    <span @class(['articulo-foto', 'sin-foto' => ! $foto, 'tipo-producto'])>
                                        @if($foto)<img src="{{ $foto }}" alt="{{ $p->nombre }}" loading="lazy">@else<span class="articulo-inicial" aria-hidden="true">{{ mb_strtoupper(mb_substr($p->nombre, 0, 1)) }}</span>@endif
                                        <span class="chip articulo-tipo">{{ InventarioArticulo::numero($p->cantidad) }} {{ abs($p->cantidad - 1) < 0.0005 ? 'unidad' : 'unidades' }}</span>
                                        @if($falta)<span class="chip articulo-estado chip-peligro">Falta material</span>@elseif($paso === 2)<span class="chip articulo-estado chip-aviso">Ponerle nombre</span>@endif
                                    </span>
                                    <span class="articulo-cuerpo">
                                        <span class="producto-categoria">{{ $p->modelo ? 'Modelo: '.$p->modelo->nombre : 'Sin modelo' }}</span>
                                        <span class="articulo-nombre">{{ $p->nombre }}</span>
                                        <span class="articulo-existencia">
                                            <span>{{ $fecha($paso === 1 ? $p->created_at : $p->terminada_at) }}{{ $p->usuario ? ' · '.$p->usuario->name : '' }}</span>
                                            @if($p->sede)<span class="articulo-sede">{{ $p->sede->nombre }}</span>@endif
                                        </span>
                                    </span>
                                </button>
                            </li>
                        @endforeach
                    </ul>
                </div>
            @endif
        @endforeach
    </div>

    <div role="tabpanel" id="panel-historial" aria-labelledby="pestana-historial" @if($pestana !== 'historial') hidden @endif>
        @if($historial->isEmpty())
            <p class="apagado catalogo-vacio">Todavía no se ha terminado nada.</p>
        @else
            <ul class="producciones">
                @foreach($historial as $h)
                    <li @class(['produccion', 'anulada' => $h->anulada(), 'con-faltantes' => $h->faltantes])>
                        <span class="mov-signo" aria-hidden="true">{{ $h->origen === 'pedido' ? '🛵' : '✓' }}</span>
                        <div class="produccion-texto">
                            <p class="produccion-titulo">
                                <strong>{{ Etapas::texto($h->cantidad, $h->nombre) }}</strong>
                                <span @class(['chip', 'chip-exito' => $h->estado === Produccion::PUBLICADA && ! $h->anulada(), 'chip-acento' => $h->estado === Produccion::PEDIDO && ! $h->anulada()])>
                                    {{ $h->anulada() ? 'Anulada' : ($h->estado === Produccion::PEDIDO ? 'Pedido '.($h->pedido?->codigo ?? '') : $h->estadoTexto()) }}
                                </span>
                                @if($h->estado === Produccion::PUBLICADA && $h->producto && ! $h->anulada())<a class="enlace" href="{{ route('negocio.catalogo', ['buscar' => $h->producto->nombre]) }}">Ver en el catálogo</a>@endif
                            </p>
                            <small>{{ $fecha($h->terminada_at ?? $h->created_at) }}{{ $h->usuario ? ' · '.$h->usuario->name : '' }}{{ $h->nota && $h->origen !== 'pedido' ? ' · '.$h->nota : '' }}</small>
                            <div class="produccion-gasto">
                                @foreach($h->movimientos->where('tipo', 'salida') as $m)
                                    <span class="rasgo"><small>−{{ InventarioArticulo::numero($m->cantidad) }}</small> {{ $m->articulo?->nombre ?? 'Material borrado' }}</span>
                                @endforeach
                            </div>
                            @if($h->faltantes)<p class="produccion-falto">Faltó: {{ Etapas::textoFaltantes($h->faltantes) }}</p>@endif
                        </div>
                        <div class="produccion-lado">
                            @if($h->costo)<span class="produccion-costo">{{ $pesos($h->costo) }}</span>@endif
                            @if($puedeProducir && ! $h->anulada() && $h->origen === 'manual')
                                <form method="POST" action="{{ route('negocio.inventario.produccion.anular', $h->id) }}" data-confirmar="¿Anular «{{ Etapas::texto($h->cantidad, $h->nombre) }}»? Los materiales vuelven al inventario{{ $h->estado === Produccion::PUBLICADA ? ' y se quitan sus unidades del catálogo' : '' }}.">@csrf
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

{{-- ------------------------------------------------ Etapa 1: Por hacer --}}
@foreach($porHacer as $p)
    @php
        $pOld = old('_produccion') === (string) $p->id;
        $conError = $pOld && $errors->any();
        $porUnidad = $p->modelo ? Modelos::necesidades($p->modelo->loadMissing('materiales'))->mapWithKeys(fn ($n) => [$n['articulo']->id => $n['por_unidad']]) : collect();
        // Con errores se vuelven a pintar las filas que se mandaron.
        $filas = $p->materiales->map(fn ($a) => ['a' => $a, 'cantidad' => (float) $a->pivot->cantidad, 'normal' => $a->pivot->normal !== null ? (float) $a->pivot->normal : null]);
        if ($conError) {
            $enviadas = collect((array) old('materiales', []))->filter(fn ($f) => is_array($f) && filled($f['articulo_id'] ?? null));
            $porId = $articulosInv->flatten(1)->keyBy('id');
            $filas = $enviadas->map(fn ($f) => ($a = $porId->get((int) $f['articulo_id'])) ? ['a' => $a, 'cantidad' => (float) (\App\Gestion\Inventario::leerNumero($f['cantidad'] ?? 0) ?: 0), 'normal' => $p->materiales->firstWhere('id', $a->id)?->pivot->normal] : null)->filter()->values();
        }
    @endphp
    <dialog class="modal modal-mediano" id="produccion-{{ $p->id }}" aria-labelledby="produccion-{{ $p->id }}-titulo">
        <div class="modal-cabeza">
            <ol class="etapas-pasos" aria-label="Etapas">@foreach($pasos as $i => $paso)<li @class(['actual' => $i === 0])>{{ $paso }}</li>@endforeach</ol>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-detalle">
            <h2 id="produccion-{{ $p->id }}-titulo">{{ $p->nombre }}</h2>
            <p class="apagado">{{ $p->modelo ? 'Modelo «'.$p->modelo->nombre.'»' : 'Sin modelo' }} · Anotada {{ $fecha($p->created_at) }}{{ $p->usuario ? ' por '.$p->usuario->name : '' }}{{ $p->sede ? ' en '.$p->sede->nombre : '' }}</p>

            @if($puedeProducir)
                <form method="POST" action="{{ route('negocio.inventario.produccion.guardar', $p->id) }}" class="etapa-form" data-etapa-form>
                    @csrf @method('PUT')
                    <input type="hidden" name="_produccion" value="{{ $p->id }}">
                    @if($conError)
                        <div class="aviso aviso-error" role="alert"><strong>Revisa esto</strong><ul>@foreach($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
                    @endif
                    <div class="producir-campos">
                        <label class="campo-panel"><span>¿Cuántas se hacen?</span>
                            <span class="campo-unidad"><input name="cantidad" inputmode="decimal" required autocomplete="off" value="{{ $conError ? old('cantidad') : InventarioArticulo::numero($p->cantidad) }}" data-etapa-total data-anterior="{{ $p->cantidad }}"><span>unidades</span></span>
                        </label>
                        <label class="campo-panel"><span>Nota <span class="ayuda">opcional</span></span>
                            <input name="nota" maxlength="255" value="{{ $conError ? old('nota') : $p->nota }}" placeholder="Para el señor Pérez, 2 × 1,5 m…">
                        </label>
                    </div>

                    <h3 class="etapa-subtitulo">Materiales</h3>
                    <p class="ayuda">{{ $p->modelo ? 'Estos son los de siempre para «'.$p->modelo->nombre.'». Usa − y + si se usó menos o más, y añade lo que se usó aparte.' : 'Añade los materiales que se usan.' }}</p>
                    <ul class="etapa-materiales" data-etapa-filas>
                        @foreach($filas as $i => $f)
                            @include('negocio._etapa_material', ['i' => $i, 'a' => $f['a'], 'cantidad' => $f['cantidad'], 'normal' => $f['normal'], 'porUnidad' => $porUnidad->get($f['a']->id), 'editable' => true])
                        @endforeach
                    </ul>
                    <p class="apagado etapa-sin-materiales" data-etapa-vacio @if($filas->isNotEmpty()) hidden @endif>Sin materiales todavía.</p>

                    @if($hayMateriales)
                        <div class="etapa-anadir">
                            <select data-etapa-elegir aria-label="Material para añadir">
                                <option value="">Añadir otro material…</option>
                                @foreach($articulosInv as $categoria => $lista)
                                    <optgroup label="{{ $categoria }}">
                                        @foreach($lista as $a)
                                            <option value="{{ $a->id }}" data-nombre="{{ $a->nombre }}" data-rasgos="{{ $a->rasgosTexto() }}" data-hay="{{ $a->cantidad }}" data-hay-texto="{{ $a->cantidadTexto() }}" data-plural="{{ InventarioArticulo::UNIDADES[$a->unidad][2] ?? $a->unidad }}" data-uno="{{ InventarioArticulo::nombreUnidad($a->unidad, 1) }}" data-varios="{{ InventarioArticulo::nombreUnidad($a->unidad, 2) }}">{{ $a->nombre }}{{ $a->rasgosTexto() ? ' · '.$a->rasgosTexto() : '' }} (hay {{ $a->cantidadTexto() }})</option>
                                        @endforeach
                                    </optgroup>
                                @endforeach
                            </select>
                            <button type="button" class="boton boton-claro boton-chico" data-etapa-anadir>+ Añadir material</button>
                        </div>
                    @else
                        <p class="apagado">No hay materiales en el inventario. Añádelos en la pestaña <a class="enlace" href="{{ route('negocio.inventario') }}">Materiales</a>.</p>
                    @endif

                    <div class="producir-vista" data-etapa-aviso aria-live="polite"></div>
                    <label class="casilla" data-etapa-aunque @unless($conError && $errors->has('materiales')) hidden @endunless><input type="checkbox" name="aunque_falte" value="1"> Terminarla de todas formas y descontar lo que haya</label>

                    <div class="botonera etapa-acciones">
                        <button class="boton boton-oscuro boton-chico" name="accion" value="terminar">Terminada: descontar materiales</button>
                        <button class="boton boton-claro boton-chico" name="accion" value="guardar">Guardar</button>
                    </div>
                </form>
                <form method="POST" action="{{ route('negocio.inventario.produccion.cancelar', $p->id) }}" class="espera-descartar" data-confirmar="¿Cancelar «{{ $p->nombre }}»? Todavía no se había descontado nada.">@csrf @method('DELETE')
                    <button class="enlace-boton enlace-peligro">Cancelar esta producción</button>
                </form>
            @else
                <ul class="etapa-materiales">
                    @foreach($filas as $i => $f)
                        @include('negocio._etapa_material', ['i' => $i, 'a' => $f['a'], 'cantidad' => $f['cantidad'], 'normal' => $f['normal'], 'porUnidad' => null, 'editable' => false])
                    @endforeach
                </ul>
            @endif
        </div>
    </dialog>
@endforeach

{{-- ------------------------------------------------ Etapa 2: Ponerle nombre --}}
@foreach($terminadas as $p)
    @php
        $nOld = old('_nombrar') === (string) $p->id;
        $specs = $nOld ? array_values(array_filter((array) old('especificaciones', []), 'is_array')) : $p->listaEspecificaciones();
        if (! $specs) {
            $specs = collect($campos)->map(fn ($c) => ['nombre' => $c['etiqueta'].(isset($c['unidad']) ? ' ('.$c['unidad'].')' : ''), 'valor' => ''])->all() ?: [['nombre' => '', 'valor' => ''], ['nombre' => '', 'valor' => '']];
        }
        $foto = EditorProducto::urlImagen($p->imagen);
        $unidades = InventarioArticulo::numero($p->cantidad).' '.(abs($p->cantidad - 1) < 0.0005 ? 'unidad' : 'unidades');
        $modo = $nOld ? old('modo', 'nuevo') : 'nuevo';
        $mismos = $p->modelo_id ? $productosCatalogo->where('modelo_id', $p->modelo_id) : collect();
    @endphp
    <dialog class="modal modal-mediano" id="produccion-{{ $p->id }}" aria-labelledby="produccion-{{ $p->id }}-titulo">
        <div class="modal-cabeza">
            <ol class="etapas-pasos" aria-label="Etapas">@foreach($pasos as $i => $paso)<li @class(['hecho' => $i === 0, 'actual' => $i === 1])>{{ $paso }}</li>@endforeach</ol>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-detalle">
            <h2 id="produccion-{{ $p->id }}-titulo">Ponerle nombre</h2>
            <p class="espera-origen">Se terminó {{ $fecha($p->terminada_at) }}{{ $p->usuario ? ' (la anotó '.$p->usuario->name.')' : '' }}: {{ $unidades }}{{ $p->modelo ? ' del modelo «'.$p->modelo->nombre.'»' : '' }}{{ $p->sede ? ' en '.$p->sede->nombre : '' }}.</p>
            <div class="produccion-gasto">
                @foreach($p->movimientos->where('tipo', 'salida') as $m)<span class="rasgo"><small>−{{ InventarioArticulo::numero($m->cantidad) }}</small> {{ $m->articulo?->nombre ?? 'Material borrado' }}</span>@endforeach
                @if($p->costo)<span class="rasgo"><small>Costo</small> {{ $pesos($p->costo) }}</span>@endif
            </div>
            @if($p->faltantes)<p class="produccion-falto">Faltó: {{ Etapas::textoFaltantes($p->faltantes) }}</p>@endif

            @if($puedePublicar)
                @if($nOld && $errors->any())
                    <div class="aviso aviso-error" role="alert"><strong>Revisa estos datos</strong><ul>@foreach($errors->all() as $er)<li>{{ $er }}</li>@endforeach</ul></div>
                @endif
                <form method="POST" enctype="multipart/form-data" class="formulario producto-form articulo-form" action="{{ route('negocio.inventario.produccion.nombrar', $p->id) }}">
                    @csrf @method('PUT')
                    <input type="hidden" name="_nombrar" value="{{ $p->id }}">
                    <div class="ancho producto-form-foto">
                        <div class="producto-form-vista" data-vista-foto>@if($foto)<img src="{{ $foto }}" alt="">@else<span>Sin foto</span>@endif</div>
                        <div class="campo-panel"><span>Foto <span class="ayuda">La de lo que se hizo.</span></span>
                            <input type="file" name="imagen" accept="image/*" data-elegir-foto aria-label="Foto">
                            @if($p->imagen)<label class="casilla"><input type="checkbox" name="quitar_imagen" value="1"> Quitar la foto</label>@endif
                        </div>
                    </div>
                    <label class="campo-panel ancho">Nombre en el catálogo<input name="nombre" required maxlength="255" value="{{ $nOld ? old('nombre') : $p->nombre }}" placeholder="Reja de ventana 1,2 × 1 m"></label>
                    <label class="campo-panel">Precio (pesos)<input name="precio" inputmode="numeric" value="{{ $nOld ? old('precio') : $p->precio }}" placeholder="680000"></label>
                    <label class="campo-panel">Sección del catálogo
                        <select name="categoria_id">
                            <option value="">Sin sección</option>
                            @foreach($categorias as $c)<option value="{{ $c->id }}" @selected((int) ($nOld ? old('categoria_id') : $p->categoria_id) === $c->id)>{{ $c->nombre }}</option>@endforeach
                        </select>
                    </label>
                    <div class="campo-panel ancho">
                        <span>Especificaciones <span class="ayuda">Lo puntual de esta pieza: medidas, color, apertura, calibre…</span></span>
                        <div class="caracteristicas" data-caracteristicas data-campo="especificaciones">
                            <ul class="caracteristicas-filas" data-car-filas>
                                @foreach($specs as $i => $r)
                                    <li class="caracteristica-fila">
                                        <input name="especificaciones[{{ $i }}][nombre]" data-car-nombre list="espec-nombres" maxlength="40" value="{{ $r['nombre'] ?? '' }}" placeholder="Ej.: Ancho" aria-label="Especificación {{ $i + 1 }}">
                                        <input name="especificaciones[{{ $i }}][valor]" data-car-valor maxlength="80" value="{{ $r['valor'] ?? '' }}" placeholder="Ej.: 90 cm" aria-label="Valor {{ $i + 1 }}">
                                        <button type="button" class="lista-item-quitar" data-car-quitar aria-label="Quitar especificación">✕</button>
                                    </li>
                                @endforeach
                            </ul>
                            <div class="caracteristicas-rapidas"><button type="button" class="boton boton-claro boton-chico" data-car-agregar="">+ Agregar especificación</button></div>
                        </div>
                    </div>
                    <label class="campo-panel ancho"><span>Descripción <span class="ayuda">opcional</span></span><textarea name="descripcion" rows="3" maxlength="5000">{{ $nOld ? old('descripcion') : $p->descripcion }}</textarea></label>

                    <fieldset class="ancho producir-destino">
                        <legend>¿Cómo entra al catálogo?</legend>
                        <label class="articulo-tipo-opcion"><input type="radio" name="modo" value="nuevo" @checked($modo === 'nuevo')><span><strong>Como producto nuevo</strong><small>Con este nombre, precio, foto y especificaciones; queda con {{ $unidades }} en stock.</small></span></label>
                        @if($productosCatalogo->isNotEmpty())
                            <label class="articulo-tipo-opcion"><input type="radio" name="modo" value="sumar" @checked($modo === 'sumar')><span><strong>Sumar a un producto que ya está</strong><small>Es igual a uno del catálogo: solo se suman sus unidades.</small></span></label>
                            <label class="campo-panel etapa-sumar">¿A cuál?
                                <select name="producto_id">
                                    <option value="">Elige el producto</option>
                                    @if($mismos->isNotEmpty())
                                        <optgroup label="Del mismo modelo">@foreach($mismos as $pc)<option value="{{ $pc->id }}" @selected((int) old('producto_id') === $pc->id && $nOld)>{{ $pc->nombre }}{{ $pc->existencias !== null ? ' ('.Etapas::textoExistencias($pc->existencias).')' : '' }}</option>@endforeach</optgroup>
                                    @endif
                                    <optgroup label="Todo el catálogo">@foreach($productosCatalogo->diff($mismos) as $pc)<option value="{{ $pc->id }}" @selected((int) old('producto_id') === $pc->id && $nOld)>{{ $pc->nombre }}{{ $pc->existencias !== null ? ' ('.Etapas::textoExistencias($pc->existencias).')' : '' }}</option>@endforeach</optgroup>
                                </select>
                            </label>
                        @endif
                    </fieldset>
                    <div class="ancho botonera producto-form-acciones">
                        <button class="boton boton-oscuro boton-chico" name="accion" value="publicar">Publicar en el catálogo</button>
                        <button class="boton boton-claro boton-chico" name="accion" value="guardar">Guardar sin publicar</button>
                    </div>
                </form>
            @else
                <p class="apagado">Solo quien puede cambiar el catálogo le pone nombre y lo publica.</p>
            @endif

            @if($puedeProducir)
                <div class="etapa-otras">
                    <form method="POST" action="{{ route('negocio.inventario.produccion.nombrar', $p->id) }}" data-confirmar="¿«{{ $p->nombre }}» es un encargo? No va al catálogo.">@csrf @method('PUT')
                        <input type="hidden" name="accion" value="encargo">
                        <button class="enlace-boton">Es un encargo: no va al catálogo</button>
                    </form>
                    <form method="POST" action="{{ route('negocio.inventario.produccion.anular', $p->id) }}" data-confirmar="¿Anular «{{ Etapas::texto($p->cantidad, $p->nombre) }}»? Los materiales vuelven al inventario.">@csrf
                        <button class="enlace-boton enlace-peligro">Anular (devuelve los materiales)</button>
                    </form>
                </div>
            @endif
        </div>
    </dialog>
@endforeach

{{-- ------------------------------------------------ Nueva producción --}}
@if($puedeProducir)
    @php $nuevaOld = old('_nueva') !== null; $modeloOld = $nuevaOld ? old('modelo_id') : ($modelos->first()?->id); @endphp
    <dialog class="modal modal-mediano modal-solo-edicion" id="produccion-nueva" aria-labelledby="produccion-nueva-titulo">
        <div class="modal-cabeza">
            <h2 id="produccion-nueva-titulo">¿Qué se va a hacer?</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">
            <form method="POST" action="{{ route('negocio.inventario.produccion.crear') }}" class="formulario" data-nueva-produccion>
                @csrf
                <input type="hidden" name="_nueva" value="1">
                @if($nuevaOld && $errors->any())
                    <div class="aviso aviso-error ancho" role="alert"><strong>Revisa esto</strong><ul>@foreach($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
                @endif
                <fieldset class="ancho nueva-modelos">
                    <legend>De un modelo <span class="ayuda">sus materiales ya vienen puestos</span></legend>
                    @forelse($modelos as $m)
                        @php $alcanza = Modelos::alcanza($m); @endphp
                        <label class="articulo-tipo-opcion">
                            <input type="radio" name="modelo_id" value="{{ $m->id }}" @checked((string) $modeloOld === (string) $m->id)>
                            <span>
                                <strong>{{ $m->nombre }}</strong>
                                <small>{{ $m->materiales->isEmpty() ? 'Sin materiales predeterminados' : $m->materiales->take(4)->map(fn ($a) => $a->cantidadTexto((float) $a->pivot->cantidad).' de '.$a->nombre)->join(', ').($m->materiales->count() > 4 ? '…' : '') }}{{ $alcanza !== null ? ' · alcanza para '.$alcanza : '' }}</small>
                            </span>
                        </label>
                    @empty
                        <p class="apagado">Todavía no hay modelos. Créalos en la pestaña <a class="enlace" href="{{ route('negocio.inventario.modelos') }}">Modelos</a> para que sus materiales salgan solos.</p>
                    @endforelse
                    <label class="articulo-tipo-opcion">
                        <input type="radio" name="modelo_id" value="" @checked($modeloOld === null || $modeloOld === '')>
                        <span><strong>Sin modelo</strong><small>Algo distinto: escribe qué es y añade sus materiales.</small></span>
                    </label>
                </fieldset>
                <label class="campo-panel ancho"><span>¿Qué es? <span class="ayuda">Con modelo puedes dejarlo vacío y usa el nombre del modelo.</span></span>
                    <input name="nombre" maxlength="255" value="{{ $nuevaOld ? old('nombre') : '' }}" placeholder="Reja para la casa del señor Pérez">
                </label>
                <label class="campo-panel"><span>¿Cuántas?</span>
                    <span class="campo-unidad"><input name="cantidad" inputmode="decimal" required autocomplete="off" value="{{ $nuevaOld ? old('cantidad') : '1' }}"><span>unidades</span></span>
                </label>
                <label class="campo-panel"><span>Nota <span class="ayuda">opcional</span></span><input name="nota" maxlength="255" value="{{ $nuevaOld ? old('nota') : '' }}" placeholder="Entregar el viernes"></label>
                <div class="ancho botonera">
                    <button class="boton boton-oscuro boton-chico">Anotar y ver sus materiales</button>
                    <button type="button" class="enlace-boton" data-cerrar>Cancelar</button>
                </div>
            </form>
        </div>
    </dialog>
@endif

<datalist id="espec-nombres">@foreach(collect($campos)->map(fn ($c) => $c['etiqueta'].(isset($c['unidad']) ? ' ('.$c['unidad'].')' : ''))->merge(InventarioArticulo::CARACTERISTICAS_SUGERIDAS)->unique() as $n)<option value="{{ $n }}">@endforeach</datalist>
<template id="plantilla-caracteristica">
    <li class="caracteristica-fila">
        <input data-car-nombre list="espec-nombres" maxlength="40" placeholder="Ej.: Ancho" aria-label="Especificación">
        <input data-car-valor maxlength="80" placeholder="Ej.: 90 cm" aria-label="Valor">
        <button type="button" class="lista-item-quitar" data-car-quitar aria-label="Quitar especificación">✕</button>
    </li>
</template>
@endsection

@push('pie')
<script src="{{ asset('panel-catalogo.js') }}?v={{ filemtime(public_path('panel-catalogo.js')) }}"></script>
<script src="{{ asset('panel-inventario.js') }}?v={{ filemtime(public_path('panel-inventario.js')) }}"></script>
<script src="{{ asset('panel-produccion.js') }}?v={{ filemtime(public_path('panel-produccion.js')) }}"></script>
@php
    $abrir = session('abrir')
        ?? (old('_produccion') ? 'produccion-'.(int) old('_produccion') : null)
        ?? (old('_nombrar') ? 'produccion-'.(int) old('_nombrar') : null)
        ?? (old('_nueva') ? 'produccion-nueva' : null);
@endphp
@if($abrir)
    <script>window.panelCatalogo && window.panelCatalogo.abrir(@json($abrir));</script>
@endif
@endpush
