{{--
    Una fila de la etapa 1 (Por hacer): el material, lo normal del modelo y
    − cantidad + para decir si se usó más o menos. $i, $a (artículo), $cantidad,
    $normal (null si se añadió aparte), $porUnidad (lo normal de una unidad),
    $editable. La plantilla de filas nuevas se arma en panel-produccion.js.
--}}
@php
    use App\Models\InventarioArticulo;
    $plural = InventarioArticulo::UNIDADES[$a->unidad][2] ?? $a->unidad;
    $corto = $cantidad > $a->cantidad + 0.0005;
@endphp
<li @class(['etapa-material', 'corto' => $corto, 'etapa-material-extra' => $normal === null])
    data-etapa-material data-hay="{{ $a->cantidad }}" data-normal="{{ $normal ?? '' }}" data-por="{{ $porUnidad ?? '' }}"
    data-nombre="{{ $a->nombre }}" data-uno="{{ InventarioArticulo::nombreUnidad($a->unidad, 1) }}" data-varios="{{ InventarioArticulo::nombreUnidad($a->unidad, 2) }}">
    <input type="hidden" name="materiales[{{ $i }}][articulo_id]" value="{{ $a->id }}" data-etapa-articulo>
    <span class="material-nombre">
        <strong>{{ $a->nombre }}</strong>
        <small>
            @if($a->rasgosTexto()){{ $a->rasgosTexto() }} · @endif
            <span data-etapa-diferencia>{{ $normal === null ? 'Añadido aparte' : 'Lo normal: '.$a->cantidadTexto($normal) }}</span>
        </small>
    </span>
    @if($editable)
        <span class="etapa-ajuste">
            <button type="button" class="etapa-boton" data-etapa-menos aria-label="Usar menos {{ $a->nombre }}">−</button>
            <input name="materiales[{{ $i }}][cantidad]" value="{{ InventarioArticulo::numero($cantidad) }}" inputmode="decimal" autocomplete="off" data-etapa-cantidad aria-label="Cuánto {{ $a->nombre }} se usa">
            <button type="button" class="etapa-boton" data-etapa-mas aria-label="Usar más {{ $a->nombre }}">+</button>
            <span class="etapa-unidad">{{ $plural }}</span>
        </span>
    @else
        <span class="material-gasta">{{ $a->cantidadTexto($cantidad) }}</span>
    @endif
    <span @class(['material-hay', 'chip', 'chip-peligro' => $corto, 'chip-aviso' => ! $corto && $a->estado() === 'bajo']) data-etapa-hay>Hay {{ $a->cantidadTexto() }}</span>
    @if($editable)
        <button type="button" class="lista-item-quitar" data-etapa-quitar aria-label="Quitar {{ $a->nombre }}">✕</button>
    @endif
</li>
