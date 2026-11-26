{{-- Formulario de un artículo del inventario (crear o editar). $a = null para uno nuevo. --}}
@php
    use App\Models\InventarioArticulo;
    $clave = $a ? (string) $a->id : 'nuevo';
    $usarOld = old('_articulo') === $clave;
    $v = fn (string $campo, $valor) => $usarOld ? old($campo, $valor) : $valor;
    $num = fn (?float $n) => $n === null ? '' : InventarioArticulo::numero($n);
    $filas = $usarOld
        ? array_values(array_filter((array) old('caracteristicas', []), 'is_array'))
        : ($a ? $a->listaCaracteristicas() : []);
    // Uno nuevo arranca con dos filas vacías para que se vea cómo se usa.
    if (! $a && ! $usarOld && ! $filas) {
        $filas = [['nombre' => '', 'valor' => ''], ['nombre' => '', 'valor' => '']];
    }
    $tipoActual = (string) $v('tipo', $a?->tipo ?? 'materia_prima');
    $unidadActual = (string) $v('unidad', $a?->unidad ?? 'unidad');
    $rapidas = array_slice($sugerencias['nombres'], 0, 8);
@endphp
<form method="POST" enctype="multipart/form-data" class="formulario producto-form articulo-form" data-articulo-form
      action="{{ $a ? route('negocio.inventario.guardar', $a->id) : route('negocio.inventario.crear') }}">
    @csrf @if($a) @method('PUT') @endif
    <input type="hidden" name="_articulo" value="{{ $clave }}">
    @if($usarOld && $errors->any())
        {{-- El aviso de la página queda detrás del modal: se repite aquí. --}}
        <div class="aviso aviso-error ancho" role="alert"><strong>Revisa estos datos</strong><ul>@foreach($errors->all() as $e)<li>{{ $e }}</li>@endforeach</ul></div>
    @endif

    <fieldset class="ancho">
        <legend>¿Qué es?</legend>
        <div class="articulo-tipos">
            @foreach(InventarioArticulo::TIPOS as $t => $texto)
                <label class="articulo-tipo-opcion">
                    <input type="radio" name="tipo" value="{{ $t }}" @checked($tipoActual === $t) required>
                    <span><strong>{{ $texto }}</strong><small>{{ InventarioArticulo::TIPOS_AYUDA[$t] }}</small></span>
                </label>
            @endforeach
        </div>
    </fieldset>

    <label class="campo-panel ancho">Nombre<input name="nombre" required maxlength="150" value="{{ $v('nombre', $a?->nombre) }}" placeholder="Tubo cuadrado, lámina galvanizada, pintura anticorrosiva…"></label>

    <label class="campo-panel"><span>Categoría <span class="ayuda">Para agruparlos: Tubos, Láminas, Pinturas…</span></span>
        <input name="categoria" maxlength="80" list="inv-categorias" value="{{ $v('categoria', $a?->categoria) }}" placeholder="Tubos">
    </label>
    <label class="campo-panel"><span>Referencia o código <span class="ayuda">opcional</span></span>
        <input name="referencia" maxlength="60" value="{{ $v('referencia', $a?->referencia) }}" placeholder="TC-118">
    </label>

    <div class="campo-panel ancho">
        <span>Características <span class="ayuda">Lo que lo distingue: material, color, medida, calibre, peso… Escribe las que quieras; las que ya usaste salen como sugerencia.</span></span>
        <div class="caracteristicas" data-caracteristicas>
            <ul class="caracteristicas-filas" data-car-filas>
                @foreach($filas as $i => $f)
                    <li class="caracteristica-fila">
                        <input name="caracteristicas[{{ $i }}][nombre]" data-car-nombre list="inv-nombres" maxlength="40" value="{{ $f['nombre'] ?? '' }}" placeholder="Ej.: Calibre" aria-label="Característica {{ $i + 1 }}">
                        <input name="caracteristicas[{{ $i }}][valor]" data-car-valor maxlength="80" value="{{ $f['valor'] ?? '' }}" placeholder="Ej.: 18" aria-label="Valor de la característica {{ $i + 1 }}">
                        <button type="button" class="lista-item-quitar" data-car-quitar aria-label="Quitar característica">✕</button>
                    </li>
                @endforeach
            </ul>
            <div class="caracteristicas-rapidas">
                <button type="button" class="boton boton-claro boton-chico" data-car-agregar="">+ Agregar característica</button>
                <span class="ayuda">Rápido:</span>
                @foreach($rapidas as $r)<button type="button" class="chip-boton" data-car-agregar="{{ $r }}">{{ $r }}</button>@endforeach
            </div>
        </div>
    </div>

    <label class="campo-panel">Se cuenta en
        <select name="unidad" data-unidad>
            @foreach(InventarioArticulo::UNIDADES as $u => $textos)
                <option value="{{ $u }}" data-plural="{{ $textos[2] }}" @selected($unidadActual === $u)>{{ $textos[0] }}</option>
            @endforeach
        </select>
    </label>
    @if($a)
        <div class="campo-panel">Existencia
            <p class="articulo-existencia-fija">{{ $a->cantidadTexto() }} <span class="ayuda">Cambia con entradas, salidas o un conteo.</span></p>
        </div>
    @else
        <label class="campo-panel">¿Cuánto hay ahora?
            <span class="campo-unidad"><input name="cantidad" inputmode="decimal" required autocomplete="off" value="{{ $v('cantidad', '') }}" placeholder="0"><span data-unidad-texto>unidades</span></span>
        </label>
    @endif

    <label class="campo-panel"><span>Avisar cuando queden <span class="ayuda">opcional</span></span>
        <span class="campo-unidad"><input name="minimo" inputmode="decimal" autocomplete="off" value="{{ $v('minimo', $num($a?->minimo)) }}" placeholder="Sin aviso"><span data-unidad-texto>unidades</span></span>
    </label>
    <label class="campo-panel"><span>Costo por unidad (pesos) <span class="ayuda">opcional</span></span>
        <input name="costo" inputmode="numeric" autocomplete="off" value="{{ $v('costo', $a?->costo) }}" placeholder="45000">
    </label>
    <label class="campo-panel"><span>Proveedor <span class="ayuda">opcional</span></span>
        <input name="proveedor" maxlength="120" list="inv-proveedores" value="{{ $v('proveedor', $a?->proveedor) }}" placeholder="Ferretería El Tornillo">
    </label>
    @if($sedes->count() > 1)
        <label class="campo-panel">Sede donde está
            <select name="sede_id">
                <option value="">Sin sede</option>
                @foreach($sedes as $s)<option value="{{ $s->id }}" @selected((string) $v('sede_id', $a?->sede_id ?? $sedes->first()->id) === (string) $s->id)>{{ $s->nombre }}</option>@endforeach
            </select>
        </label>
    @endif

    <div class="ancho producto-form-foto">
        <div class="producto-form-vista" data-vista-foto>
            @if($a?->imagen)<img src="{{ \App\Support\EditorProducto::urlImagen($a->imagen) }}" alt="">@else<span>Sin foto</span>@endif
        </div>
        <div class="campo-panel"><span>Foto <span class="ayuda">opcional · JPG o PNG, hasta 4 MB.</span></span>
            <input type="file" name="imagen" accept="image/*" data-elegir-foto aria-label="Foto">
            @if($a?->imagen)<label class="casilla"><input type="checkbox" name="quitar_imagen" value="1"> Quitar la foto</label>@endif
        </div>
    </div>

    <label class="campo-panel ancho"><span>Notas <span class="ayuda">opcional</span></span><textarea name="descripcion" rows="2" maxlength="3000" placeholder="Dónde se guarda, para qué se usa…">{{ $v('descripcion', $a?->descripcion) }}</textarea></label>

    <div class="ancho botonera producto-form-acciones">
        <button class="boton boton-oscuro boton-chico">{{ $a ? 'Guardar cambios' : 'Añadir al inventario' }}</button>
        <button type="button" class="enlace-boton" data-cancelar-edicion>{{ $a ? 'Cancelar' : 'Cerrar' }}</button>
    </div>
</form>
