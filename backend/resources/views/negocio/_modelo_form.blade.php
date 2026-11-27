{{--
    Formulario de un modelo (crear o editar). $m = null para uno nuevo.
    Usa $articulosInv (materiales por categoría) y $productosCatalogo.
--}}
@php
    use App\Models\InventarioArticulo;
    $clave = $m ? (string) $m->id : 'nuevo';
    $usarOld = old('_modelo') === $clave;
    $filas = $usarOld
        ? array_values(array_filter((array) old('materiales', []), 'is_array'))
        : ($m ? $m->materiales->map(fn ($a) => ['articulo_id' => $a->id, 'cantidad' => InventarioArticulo::numero((float) $a->pivot->cantidad)])->all() : [['articulo_id' => 0, 'cantidad' => '']]);
    $ligados = array_map('intval', $usarOld ? (array) old('productos', []) : ($m ? $m->productos->pluck('id')->all() : []));
    $alPedido = $usarOld ? (bool) old('al_pedido') : (bool) $m?->al_pedido;
@endphp
<form method="POST" class="formulario materiales-form-modelo" data-materiales-form
      action="{{ $m ? route('negocio.inventario.modelos.guardar', $m->id) : route('negocio.inventario.modelos.crear') }}">
    @csrf @if($m) @method('PUT') @endif
    <input type="hidden" name="_modelo" value="{{ $clave }}">
    @if($usarOld && $errors->any())
        <div class="aviso aviso-error ancho" role="alert"><strong>Revisa estos datos</strong><ul>@foreach($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
    @endif

    <label class="campo-panel ancho">Nombre del modelo<input name="nombre" required maxlength="150" value="{{ $usarOld ? old('nombre') : $m?->nombre }}" placeholder="Reja de ventana, portón corredizo, puerta de lámina…"></label>
    <label class="campo-panel ancho"><span>Descripción <span class="ayuda">opcional</span></span>
        <textarea name="descripcion" rows="2" maxlength="2000" placeholder="Medida de siempre, acabado…">{{ $usarOld ? old('descripcion') : $m?->descripcion }}</textarea>
    </label>

    <div class="campo-panel ancho">
        <span>Materiales predeterminados <span class="ayuda">Lo que gasta UNA unidad, en la unidad en que se cuenta cada material: 6 varillas, 1 galón, 0,5 láminas…</span></span>
        <ul class="materiales-filas" data-materiales-filas>
            @foreach($filas as $i => $f)
                @include('negocio._material_fila', ['i' => $i, 'articuloId' => (int) ($f['articulo_id'] ?? 0), 'cantidad' => $f['cantidad'] ?? ''])
            @endforeach
        </ul>
        <button type="button" class="boton boton-claro boton-chico materiales-agregar" data-material-agregar>+ Agregar material</button>
    </div>

    <fieldset class="ancho materiales-modo">
        <legend>¿Cómo se descuentan?</legend>
        <label class="articulo-tipo-opcion">
            <input type="radio" name="al_pedido" value="0" @checked(! $alPedido)>
            <span><strong>Al terminar cada producción</strong><small>Para lo que se fabrica: rejas, portones, muebles, panes del día… Se ajustan con − y + en la etapa «Por hacer».</small></span>
        </label>
        <label class="articulo-tipo-opcion">
            <input type="radio" name="al_pedido" value="1" @checked($alPedido)>
            <span><strong>Con cada pedido de Vitrina</strong><small>Para lo que se prepara al pedirlo: platos, jugos, arreglos… Se descuenta cuando un pedido de sus productos queda listo.</small></span>
        </label>
    </fieldset>

    @if($productosCatalogo->isNotEmpty())
        <div class="campo-panel ancho">
            <span>Productos del catálogo con este modelo <span class="ayuda">Lo que se publica desde Producción queda ligado solo. Con «cada pedido», marca aquí los productos que lo usan.</span></span>
            <input type="search" class="modelo-productos-buscar" placeholder="Buscar producto" aria-label="Buscar producto" data-filtrar-productos>
            <ul class="modelo-productos" data-productos-lista>
                @foreach($productosCatalogo as $pc)
                    <li><label class="casilla"><input type="checkbox" name="productos[]" value="{{ $pc->id }}" @checked(in_array($pc->id, $ligados, true))> {{ $pc->nombre }}@if($pc->modelo_id && $pc->modelo_id !== $m?->id)<small class="apagado"> · tiene otro modelo</small>@endif</label></li>
                @endforeach
            </ul>
        </div>
    @endif

    <div class="ancho botonera">
        <button class="boton boton-oscuro boton-chico">{{ $m ? 'Guardar cambios' : 'Crear modelo' }}</button>
        <button type="button" class="enlace-boton" data-cerrar>Cancelar</button>
    </div>
</form>
