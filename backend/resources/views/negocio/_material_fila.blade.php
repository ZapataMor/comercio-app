{{-- Una fila de «Materiales que gasta»: el artículo del inventario y cuánto se gasta. $i, $articuloId, $cantidad, $articulosInv. --}}
@php use App\Models\InventarioArticulo; @endphp
<li class="material-fila">
    <select name="materiales[{{ $i }}][articulo_id]" data-material-articulo aria-label="Material">
        <option value="">Elige un material</option>
        @foreach($articulosInv as $tipo => $lista)
            <optgroup label="{{ $tipo }}">
                @foreach($lista as $a)
                    <option value="{{ $a->id }}" data-unidad="{{ InventarioArticulo::UNIDADES[$a->unidad][2] ?? $a->unidad }}" @selected($articuloId === $a->id)>{{ $a->nombre }}{{ $a->rasgosTexto() ? ' · '.$a->rasgosTexto() : '' }} (hay {{ $a->cantidadTexto() }})</option>
                @endforeach
            </optgroup>
        @endforeach
    </select>
    <span class="campo-unidad"><input name="materiales[{{ $i }}][cantidad]" inputmode="decimal" autocomplete="off" value="{{ $cantidad }}" placeholder="Cantidad" aria-label="Cuánto se gasta" data-material-cantidad><span data-material-unidad>—</span></span>
    <button type="button" class="lista-item-quitar" data-material-quitar aria-label="Quitar material">✕</button>
</li>
