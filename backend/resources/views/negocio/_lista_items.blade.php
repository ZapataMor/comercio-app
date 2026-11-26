{{--
    Lista que se llena uno por uno (ingredientes, colores, otros nombres).
    $campo: nombre de los inputs (llegan como $campo[]); $items: lo que ya tiene;
    $placeholder; $maximo; $fijos (opcional): los marcados «Obligatorio»
    (salen como fijos_lista[]; la casilla solo se ve para comida).
--}}
@php $conFijos = isset($fijos); @endphp
<div class="lista-items" data-lista data-campo="{{ $campo }}" data-maximo="{{ $maximo ?? 30 }}" @if($conFijos) data-con-fijos @endif>
    <ul class="lista-items-filas" data-lista-filas>
        @foreach($items as $item)
            <li class="lista-item">
                <span class="lista-item-texto">{{ $item }}</span>
                <input type="hidden" name="{{ $campo }}[]" value="{{ $item }}">
                @if($conFijos)
                    <label class="lista-item-obligatorio"><input type="checkbox" name="fijos_lista[]" value="{{ $item }}" @checked(in_array($item, $fijos, true))> Obligatorio</label>
                @endif
                <button type="button" class="lista-item-quitar" data-lista-quitar aria-label="Quitar {{ $item }}">✕</button>
            </li>
        @endforeach
    </ul>
    <div class="lista-items-agregar">
        <input type="text" maxlength="100" placeholder="{{ $placeholder }}" data-lista-entrada aria-label="{{ $placeholder }}">
        <button type="button" class="boton boton-claro boton-chico" data-lista-agregar>Agregar</button>
    </div>
    <p class="lista-items-vacia ayuda" data-lista-vacia @if(count($items)) hidden @endif>Todavía no hay ninguno.</p>
</div>
