{{-- Formulario de producto del panel web (crear o editar). $p = null para uno nuevo. --}}
@php
    $clave = $p ? (string) $p->id : 'nuevo';
    $usarOld = old('_producto') === $clave;
    $v = fn (string $campo, $valor) => $usarOld ? old($campo, $valor) : $valor;
    $venta = match ($p?->unidad_medida) { 'kg' => 'kilos', 'libra' => 'libras', default => 'cantidad' };
    $marcadas = $usarOld ? array_map('intval', (array) old('categorias_marcadas', [])) : ($p ? $p->categoriasCatalogo->pluck('id')->all() : []);
    $extras = $usarOld ? array_values(array_filter((array) old('extras_lista', []), fn ($e) => is_array($e))) : ($p?->extras ?? []);
    $extras = array_pad(array_slice($extras, 0, 20), max(count($extras) + 2, 3), ['nombre' => '', 'precio' => '']);
    $tipoActual = (string) $v('tipo_producto_id', $p?->tipo_producto_id);
    $listaOld = fn (string $campo, ?array $valor) => array_values(array_filter(array_map('strval', array_filter($usarOld ? (array) old($campo, []) : ($valor ?? []), 'is_scalar')), 'strlen'));
    $atributos = $listaOld('atributos_lista', $p?->atributos);
    $fijos = $listaOld('fijos_lista', $p?->ingredientes_fijos);
    $colores = $listaOld('colores_lista', $p?->colores);
    $otrosNombres = $listaOld('otros_nombres_lista', $p?->nombres_alternos);
@endphp
<form method="POST" enctype="multipart/form-data" class="formulario producto-form"
      action="{{ $p ? route('negocio.productos.guardar', $p->id) : route('negocio.productos.crear') }}">
    @csrf @if($p) @method('PUT') @endif
    <input type="hidden" name="_producto" value="{{ $clave }}">

    <div class="ancho producto-form-foto">
        <div class="producto-form-vista" data-vista-foto>
            @if($p?->imagen)<img src="{{ \App\Support\EditorProducto::urlImagen($p->imagen) }}" alt="">@else<span>Sin imagen</span>@endif
        </div>
        <label class="campo-panel">Imagen <span class="ayuda">JPG o PNG, hasta 4 MB. {{ $p?->imagen ? 'Si eliges otra, reemplaza la actual.' : '' }}</span>
            <input type="file" name="imagen" accept="image/*" data-elegir-foto>
        </label>
    </div>

    <label class="campo-panel ancho">Nombre<input name="nombre" required maxlength="255" value="{{ $v('nombre', $p?->nombre) }}"></label>
    <label class="campo-panel ancho">Descripción<textarea name="descripcion" rows="3">{{ $v('descripcion', $p?->descripcion) }}</textarea></label>

    <label class="campo-panel">Precio (pesos)<input name="precio" required inputmode="numeric" value="{{ $v('precio', $p ? (int) $p->precio : '') }}" placeholder="3500"></label>
    <label class="campo-panel">Se vende por
        <select name="venta">
            @foreach(['cantidad' => 'Cantidad (unidad)', 'kilos' => 'Kilos', 'libras' => 'Libras'] as $valor => $texto)
                <option value="{{ $valor }}" @selected($v('venta', $venta) === $valor)>{{ $texto }}</option>
            @endforeach
        </select>
    </label>

    <label class="campo-panel">Tipo de producto
        <select name="tipo_producto_id" required data-tipo-producto>
            <option value="">Elige uno</option>
            @foreach($tipos as $t)
                <option value="{{ $t->id }}" data-slug="{{ $t->slug }}" data-etiqueta="{{ $t->atributo_label }}" @selected($tipoActual === (string) $t->id)>{{ $t->nombre }}</option>
            @endforeach
        </select>
    </label>
    <label class="campo-panel">Sección del negocio
        <select name="categoria_id">
            <option value="">Sin sección</option>
            @foreach($categorias as $c)
                <option value="{{ $c->id }}" @selected((string) $v('categoria_id', $p?->categoria_id) === (string) $c->id)>{{ $c->nombre }}</option>
            @endforeach
        </select>
    </label>

    <div class="campo-panel ancho">
        <span><span data-etiqueta-atributos>{{ $p?->tipoProducto?->atributo_label ?? 'Características' }}</span>
            <span class="ayuda" data-solo="comida">Agrega uno por uno. Marca «Obligatorio» los que el cliente no puede quitar; los demás son opcionales.</span></span>
        @include('negocio._lista_items', ['campo' => 'atributos_lista', 'items' => $atributos, 'fijos' => $fijos, 'placeholder' => 'Escribe uno y presiona Agregar'])
    </div>
    <fieldset class="ancho producto-extras" data-solo="comida">
        <legend>Extras <span class="ayuda">Se piden aparte; precio 0 = gratis.</span></legend>
        @foreach($extras as $i => $e)
            <div class="producto-extra">
                <input name="extras_lista[{{ $i }}][nombre]" maxlength="100" value="{{ $e['nombre'] ?? '' }}" placeholder="Nombre del extra" aria-label="Nombre del extra {{ $i + 1 }}">
                <input name="extras_lista[{{ $i }}][precio]" inputmode="numeric" value="{{ $e['precio'] ?? '' }}" placeholder="Precio" aria-label="Precio del extra {{ $i + 1 }}">
            </div>
        @endforeach
    </fieldset>
    <div class="campo-panel ancho" data-solo="ropa-y-calzado"><span>Colores</span>
        @include('negocio._lista_items', ['campo' => 'colores_lista', 'items' => $colores, 'placeholder' => 'Escribe un color'])
    </div>
    <div class="campo-panel ancho"><span>Otros nombres <span class="ayuda">Cómo más lo busca la gente (máximo 10).</span></span>
        @include('negocio._lista_items', ['campo' => 'otros_nombres_lista', 'items' => $otrosNombres, 'maximo' => 10, 'placeholder' => 'Escribe otro nombre'])
    </div>

    <fieldset class="ancho producto-categorias">
        <legend>Categorías de Vitrina <span class="ayuda">Hasta 8; ayudan a que te encuentren al explorar.</span></legend>
        <div>
            @foreach($categoriasCatalogo as $c)
                <label class="chip-casilla"><input type="checkbox" name="categorias_marcadas[]" value="{{ $c->id }}" @checked(in_array($c->id, $marcadas, true))><span>{{ $c->nombre }}</span></label>
            @endforeach
        </div>
    </fieldset>

    <label class="casilla ancho"><input type="hidden" name="disponible" value="0"><input type="checkbox" name="disponible" value="1" @checked((bool) $v('disponible', $p?->disponible ?? true))> Disponible para pedir</label>

    <div class="ancho botonera producto-form-acciones">
        <button class="boton boton-oscuro boton-chico">{{ $p ? 'Guardar cambios' : 'Crear producto' }}</button>
        <button type="button" class="enlace-boton" data-cancelar-edicion>{{ $p ? 'Cancelar' : 'Cerrar' }}</button>
    </div>
</form>
