{{--
    Materiales de un producto del catálogo (módulo «produccion»): lo que gasta,
    para cuántos alcanza, «Registrar como hecho» y el formulario para cambiarlos.
    Lo usan el modal del producto en Catálogo y en Producción.
    $p (con materiales), $articulosInv (agrupados por tipo), $puedeProducir.
--}}
@php
    use App\Gestion\Materiales;
    use App\Models\InventarioArticulo;
    $necesidades = Materiales::necesidades($p);
    $alcanza = Materiales::alcanza($p);
    $costo = Materiales::costo($p);
    $porCada = match ($p->unidad_medida) { 'kg' => 'kilo', 'libra' => 'libra', default => 'unidad' };
    $editandoOld = old('_materiales') === (string) $p->id;
    $hechoOld = old('_hecho') === (string) $p->id;
    $filas = $editandoOld
        ? array_values(array_filter((array) old('materiales', []), 'is_array'))
        : $necesidades->map(fn ($n) => ['articulo_id' => $n['articulo']->id, 'cantidad' => InventarioArticulo::numero($n['por_unidad'])])->all();
    $modo = $editandoOld ? old('materiales_al', $p->materiales_al) : ($p->materiales_al ?: 'fabricar');
    $hayArticulos = $articulosInv->isNotEmpty();
@endphp
<section @class(['materiales-producto', 'editando-materiales' => $editandoOld && $errors->any()]) data-materiales>
    <div class="caja-barra">
        <h3>Materiales que gasta <span class="ayuda">por cada {{ $porCada }}</span></h3>
        @if($puedeProducir && $hayArticulos)
            <button type="button" class="boton boton-claro boton-chico" data-materiales-editar>{{ $necesidades->isEmpty() ? '+ Definir materiales' : 'Cambiar materiales' }}</button>
        @endif
    </div>

    <div class="materiales-vista">
        @if($necesidades->isEmpty())
            <p class="apagado">
                @if(! $hayArticulos)
                    Todavía no hay nada en el inventario. Añade ahí la materia prima o los insumos y luego di cuánto gasta este producto.
                @else
                    No tiene materiales. Si los defines, se descuentan solos del inventario cada vez que se haga.
                @endif
            </p>
        @else
            <ul class="materiales-lista">
                @foreach($necesidades as $n)
                    @php $a = $n['articulo']; $corto = $n['hay'] + 0.0005 < $n['por_unidad']; @endphp
                    <li @class(['corto' => $corto])>
                        <span class="material-nombre">
                            <strong>{{ $a->nombre }}</strong>
                            @if($a->rasgosTexto())<small>{{ $a->rasgosTexto() }}</small>@endif
                        </span>
                        <span class="material-gasta">{{ $a->cantidadTexto($n['por_unidad']) }}</span>
                        <span @class(['material-hay', 'chip', 'chip-peligro' => $corto, 'chip-aviso' => ! $corto && $a->estado() === 'bajo'])>Hay {{ $a->cantidadTexto() }}</span>
                    </li>
                @endforeach
            </ul>
            <div class="materiales-resumen">
                <span @class(['chip', 'chip-exito' => $alcanza > 0, 'chip-peligro' => $alcanza === 0])>{{ $alcanza === 0 ? 'No alcanza para ninguno' : 'Alcanza para '.number_format($alcanza, 0, ',', '.') }}</span>
                <span class="chip">Se descuenta {{ mb_strtolower(Materiales::MODOS[$p->materiales_al] ?? Materiales::MODOS['fabricar']) }}</span>
                @if($p->existencias !== null)<span class="chip chip-acento">{{ \App\Gestion\Terminados::textoExistencias($p->existencias) }} en el catálogo</span>@endif
                @if($costo && $costo['costo'] > 0)
                    <span class="chip chip-acento">Materiales: $ {{ number_format($costo['costo'], 0, ',', '.') }}{{ $costo['completo'] ? '' : ' (faltan costos)' }}@if((float) $p->precio > 0) · {{ (int) round($costo['costo'] / (float) $p->precio * 100) }} % del precio @endif</span>
                @endif
            </div>

            @if($puedeProducir)
                @php
                    $datosJs = $necesidades->map(fn ($n) => [
                        'nombre' => $n['articulo']->nombre, 'por' => $n['por_unidad'], 'hay' => $n['hay'],
                        'uno' => InventarioArticulo::nombreUnidad($n['articulo']->unidad, 1), 'varios' => InventarioArticulo::nombreUnidad($n['articulo']->unidad, 2),
                    ])->all();
                @endphp
                <form method="POST" action="{{ route('negocio.produccion.registrar', $p->id) }}" class="producir-form" data-producir data-necesidades="{{ json_encode($datosJs, JSON_UNESCAPED_UNICODE) }}">
                    @csrf
                    <input type="hidden" name="_hecho" value="{{ $p->id }}">
                    <h4>Registrar como hecho</h4>
                    @if($p->materiales_al === 'pedido')<p class="ayuda">Con cada pedido de Vitrina se descuenta solo al quedar listo; regístralo aquí si lo preparaste aparte.</p>@endif
                    <div class="producir-campos">
                        <label class="campo-panel"><span>¿Cuántos se hicieron?</span>
                            <span class="campo-unidad"><input name="cantidad" inputmode="decimal" required autocomplete="off" value="{{ $hechoOld ? old('cantidad') : '1' }}" data-producir-cantidad><span>{{ $porCada === 'unidad' ? 'unidades' : $porCada.'s' }}</span></span>
                        </label>
                        <label class="campo-panel"><span>Nota <span class="ayuda">opcional</span></span>
                            <input name="nota" maxlength="255" value="{{ $hechoOld ? old('nota') : '' }}" placeholder="Para el señor Pérez, pedido de la semana…">
                        </label>
                    </div>
                    @php $destinoActual = $hechoOld ? old('destino', 'catalogo') : 'catalogo'; @endphp
                    <fieldset class="producir-destino">
                        <legend>¿Qué pasa con lo que se hizo?</legend>
                        @foreach(\App\Gestion\Terminados::DESTINOS as $clave => $texto)
                            <label class="articulo-tipo-opcion">
                                <input type="radio" name="destino" value="{{ $clave }}" @checked($destinoActual === $clave)>
                                <span><strong>{{ $texto }}</strong><small>{{ \App\Gestion\Terminados::DESTINOS_AYUDA[$clave] }}</small></span>
                            </label>
                        @endforeach
                    </fieldset>
                    <div class="producir-vista" data-producir-vista aria-live="polite"></div>
                    @if($hechoOld && $errors->any())<p class="campo-error" role="alert">{{ $errors->first() }}</p>@endif
                    <label class="casilla" data-producir-aunque @unless($hechoOld && $errors->any()) hidden @endunless><input type="checkbox" name="aunque_falte" value="1"> Registrar de todas formas y descontar lo que haya</label>
                    <button class="boton boton-oscuro boton-chico">Registrar como hecho</button>
                </form>
            @endif
        @endif
    </div>

    @if($puedeProducir && $hayArticulos)
        <form method="POST" action="{{ route('negocio.produccion.materiales', $p->id) }}" class="materiales-form" data-materiales-form>
            @csrf @method('PUT')
            <input type="hidden" name="_materiales" value="{{ $p->id }}">
            @if($editandoOld && $errors->any())
                <div class="aviso aviso-error" role="alert"><strong>Revisa estos datos</strong><ul>@foreach($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
            @endif
            <p class="ayuda">Cuánto se gasta de cada material para hacer una {{ $porCada === 'unidad' ? 'unidad' : $porCada }} de «{{ $p->nombre }}», en la unidad en que se cuenta en el inventario (10 varillas, 1 lámina, 0,2 kg…).</p>
            <ul class="materiales-filas" data-materiales-filas>
                @foreach($filas as $i => $f)
                    @include('negocio._material_fila', ['i' => $i, 'articuloId' => (int) ($f['articulo_id'] ?? 0), 'cantidad' => $f['cantidad'] ?? ''])
                @endforeach
            </ul>
            <button type="button" class="boton boton-claro boton-chico materiales-agregar" data-material-agregar>+ Agregar material</button>

            <fieldset class="materiales-modo">
                <legend>¿Cuándo se descuentan del inventario?</legend>
                @foreach(Materiales::MODOS as $clave => $texto)
                    <label class="articulo-tipo-opcion">
                        <input type="radio" name="materiales_al" value="{{ $clave }}" @checked($modo === $clave)>
                        <span><strong>{{ $texto }}</strong><small>{{ Materiales::MODOS_AYUDA[$clave] }}</small></span>
                    </label>
                @endforeach
            </fieldset>

            <div class="botonera">
                <button class="boton boton-oscuro boton-chico">Guardar materiales</button>
                <button type="button" class="enlace-boton" data-materiales-cancelar>Cancelar</button>
            </div>
        </form>
    @endif
</section>
