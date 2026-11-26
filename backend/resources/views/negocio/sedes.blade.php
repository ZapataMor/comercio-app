@extends('layouts.negocio')
@section('titulo', 'Sedes')
@section('contenido')
<header class="panel-encabezado">
    <span class="panel-ceja">Negocio</span>
    <h1>Sedes</h1>
    <p>
        Puntos de venta, fábricas y bodegas. El inventario y las ventas se llevarán por sede.
        @unless($variasSedes) Este negocio tiene una sola sede; para más, se necesita el módulo «Varias sedes». @endunless
    </p>
</header>
<section class="bloque">
    <div class="tabla-scroll">
        <table class="tabla">
            <thead><tr><th>Sede</th><th>Tipo</th><th>Dirección</th><th>Factura</th><th>Estado</th><th></th></tr></thead>
            <tbody>
            @foreach($sedes as $s)
                <tr>
                    <td class="fuerte">{{ $s->nombre }} @if($s->principal)<span class="chip chip-acento">principal</span>@endif</td>
                    <td>{{ $s->tipoTexto() }}</td>
                    <td>{{ $s->direccion ?: '—' }}{{ $s->barrio ? ' · '.$s->barrio : '' }}</td>
                    <td>{{ $s->factura ? 'Sí' : 'No' }}</td>
                    <td><span @class(['chip', 'chip-exito' => $s->activa])>{{ $s->activa ? 'Activa' : 'Inactiva' }}</span></td>
                    <td class="numero">@if($puedeEditar)<a class="enlace" href="{{ route('negocio.sedes', ['editar' => $s->id]) }}">Editar</a>@endif</td>
                </tr>
            @endforeach
            </tbody>
        </table>
    </div>
</section>

@if($puedeEditar && ($editar || $variasSedes))
    @php $s = $editar; @endphp
    <section class="bloque">
        <h2>{{ $s ? 'Editar «'.$s->nombre.'»' : 'Nueva sede' }}</h2>
        <form method="POST" action="{{ $s ? route('negocio.sedes.guardar', $s) : route('negocio.sedes.crear') }}" class="formulario">
            @csrf @if($s) @method('PUT') @endif
            <label class="campo-panel">Nombre<input name="nombre" required maxlength="80" value="{{ old('nombre', $s?->nombre) }}"></label>
            <label class="campo-panel">Tipo
                <select name="tipo">@foreach(\App\Models\Sede::TIPOS as $valor => $texto)<option value="{{ $valor }}" @selected(old('tipo', $s?->tipo ?? 'punto_venta') === $valor)>{{ $texto }}</option>@endforeach</select>
            </label>
            <label class="campo-panel">Dirección<input name="direccion" maxlength="255" value="{{ old('direccion', $s?->direccion) }}"></label>
            <label class="campo-panel">Barrio<input name="barrio" maxlength="120" value="{{ old('barrio', $s?->barrio) }}"></label>
            <label class="campo-panel">Teléfono<input name="telefono" maxlength="20" value="{{ old('telefono', $s?->telefono) }}"></label>
            <div class="casillas">
                <label class="casilla"><input type="hidden" name="factura" value="0"><input type="checkbox" name="factura" value="1" @checked(old('factura', $s?->factura ?? true))> Factura en esta sede</label>
                <label class="casilla"><input type="hidden" name="principal" value="0"><input type="checkbox" name="principal" value="1" @checked(old('principal', $s?->principal))> Sede principal</label>
                @if($s)<label class="casilla"><input type="hidden" name="activa" value="0"><input type="checkbox" name="activa" value="1" @checked(old('activa', $s->activa))> Activa</label>@endif
            </div>
            <div class="ancho botonera">
                <button class="boton boton-oscuro boton-chico">Guardar sede</button>
                @if($s)<a href="{{ route('negocio.sedes') }}" class="enlace">Cancelar</a>@endif
            </div>
        </form>
    </section>
@endif
@endsection
