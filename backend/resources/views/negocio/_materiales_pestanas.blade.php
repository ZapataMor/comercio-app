{{--
    Pestañas de «Materiales y producción»: Materiales, Herramientas, Producción
    y Modelos. $seccion = material | herramienta | produccion | modelos;
    $cuentas viene de InventarioController::cuentas().
--}}
@php
    $pestanas = [
        'material' => ['Materiales', route('negocio.inventario')],
        'herramienta' => ['Herramientas', route('negocio.inventario', ['tipo' => 'herramienta'])],
        'produccion' => ['Producción', route('negocio.inventario.produccion')],
        'modelos' => ['Modelos', route('negocio.inventario.modelos')],
    ];
@endphp
<nav class="pestanas modulo-pestanas" aria-label="Materiales y producción">
    @foreach($pestanas as $clave => [$texto, $url])
        <a href="{{ $url }}" class="pestana" aria-selected="{{ $seccion === $clave ? 'true' : 'false' }}" @if($seccion === $clave) aria-current="page" @endif>
            {{ $texto }} <span @class(['bloque-cuenta', 'cuenta-aviso' => $clave === 'produccion' && $cuentas['produccion'] > 0])>{{ $cuentas[$clave] }}</span>
        </a>
    @endforeach
</nav>
