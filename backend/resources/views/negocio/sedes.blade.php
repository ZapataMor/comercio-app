@extends('layouts.negocio')
@section('titulo', 'Sedes')
@section('contenido')
<h1 class="text-2xl font-semibold mb-1">Sedes</h1>
<p class="text-sm text-slate-500 mb-4">
    Puntos de venta, fábricas y bodegas. El inventario y las ventas se llevarán por sede.
    @unless($variasSedes) Este negocio tiene una sola sede; para más, se necesita el módulo «Varias sedes». @endunless
</p>
<section class="bg-white rounded-lg border p-4 mb-4">
    <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-500"><th class="py-1">Sede</th><th>Tipo</th><th>Dirección</th><th>Factura</th><th>Estado</th><th></th></tr></thead>
        <tbody>
        @foreach($sedes as $s)
            <tr class="border-t">
                <td class="py-1">{{ $s->nombre }} @if($s->principal)<span class="text-xs bg-teal-50 text-teal-800 rounded px-1">principal</span>@endif</td>
                <td>{{ $s->tipoTexto() }}</td>
                <td>{{ $s->direccion ?: '—' }}{{ $s->barrio ? ' · '.$s->barrio : '' }}</td>
                <td>{{ $s->factura ? 'Sí' : 'No' }}</td>
                <td>{{ $s->activa ? 'Activa' : 'Inactiva' }}</td>
                <td>@if($puedeEditar)<a class="text-teal-700 underline" href="{{ route('negocio.sedes', ['editar' => $s->id]) }}">Editar</a>@endif</td>
            </tr>
        @endforeach
        </tbody>
    </table>
</section>

@if($puedeEditar && ($editar || $variasSedes))
    @php $s = $editar; @endphp
    <section class="bg-white rounded-lg border p-4">
        <h2 class="font-semibold mb-3">{{ $s ? 'Editar «'.$s->nombre.'»' : 'Nueva sede' }}</h2>
        <form method="POST" action="{{ $s ? route('negocio.sedes.guardar', $s) : route('negocio.sedes.crear') }}" class="grid md:grid-cols-2 gap-3 text-sm">
            @csrf @if($s) @method('PUT') @endif
            <label class="flex flex-col">Nombre<input name="nombre" required maxlength="80" value="{{ old('nombre', $s?->nombre) }}" class="border rounded px-2 py-1"></label>
            <label class="flex flex-col">Tipo
                <select name="tipo" class="border rounded px-2 py-1">@foreach(\App\Models\Sede::TIPOS as $valor => $texto)<option value="{{ $valor }}" @selected(old('tipo', $s?->tipo ?? 'punto_venta') === $valor)>{{ $texto }}</option>@endforeach</select>
            </label>
            <label class="flex flex-col">Dirección<input name="direccion" maxlength="255" value="{{ old('direccion', $s?->direccion) }}" class="border rounded px-2 py-1"></label>
            <label class="flex flex-col">Barrio<input name="barrio" maxlength="120" value="{{ old('barrio', $s?->barrio) }}" class="border rounded px-2 py-1"></label>
            <label class="flex flex-col">Teléfono<input name="telefono" maxlength="20" value="{{ old('telefono', $s?->telefono) }}" class="border rounded px-2 py-1"></label>
            <div class="flex flex-col gap-1 justify-end">
                <label><input type="hidden" name="factura" value="0"><input type="checkbox" name="factura" value="1" @checked(old('factura', $s?->factura ?? true))> Factura en esta sede</label>
                <label><input type="hidden" name="principal" value="0"><input type="checkbox" name="principal" value="1" @checked(old('principal', $s?->principal))> Sede principal</label>
                @if($s)<label><input type="hidden" name="activa" value="0"><input type="checkbox" name="activa" value="1" @checked(old('activa', $s->activa))> Activa</label>@endif
            </div>
            <div class="md:col-span-2 flex gap-3 items-center">
                <button class="bg-teal-700 text-white rounded px-3 py-1">Guardar sede</button>
                @if($s)<a href="{{ route('negocio.sedes') }}" class="text-slate-500 underline">Cancelar</a>@endif
            </div>
        </form>
    </section>
@endif
@endsection
