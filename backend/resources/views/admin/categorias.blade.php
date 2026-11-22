@extends('layouts.app')
@section('titulo', 'Categorías')
@section('contenido')
@include('admin._nav')
<h1>Categorías del catálogo</h1>
<p class="text-sm text-slate-500 mb-4">El comerciante marca, si quiere, una o varias para cada producto, y el cliente filtra la búsqueda por ellas. Los <strong>otros nombres</strong> también se buscan: «Barbería» encuentra «Belleza y aseo». Si un tipo de negocio se llama como la categoría o como uno de sus otros nombres, ese negocio también sale al filtrar.</p>

<div class="card mb-5">
<h2 class="font-semibold mb-3">Nueva categoría</h2>
<form method="POST" action="{{ route('admin.accion', ['crear-categoria', 0]) }}" class="grid sm:grid-cols-3 gap-3 items-end">
@csrf
<label class="text-sm">Nombre<input name="nombre" required maxlength="80" value="{{ old('nombre') }}" placeholder="Ej: Comidas rápidas" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"></label>
<label class="text-sm sm:col-span-2">Otros nombres <span class="text-slate-400">(separados por comas)</span><input name="otros_nombres" maxlength="700" value="{{ old('otros_nombres') }}" placeholder="Ej: Comida rápida, Hamburguesas, Perros calientes" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"></label>
<div class="sm:col-span-3"><button class="rounded-lg bg-indigo-600 text-white px-4 py-2 font-semibold">Crear categoría</button></div>
</form>
</div>

<div class="table-wrap">
<table>
<thead><tr><th>Categoría</th><th>Productos</th><th>Acciones</th></tr></thead>
<tbody>
@forelse($categorias as $c)
<tr @class(['opacity-60' => ! $c['activa']])>
<td>
<form method="POST" action="{{ route('admin.accion', ['editar-categoria', $c['id']]) }}" class="grid sm:grid-cols-6 gap-2 items-end" id="categoria-{{ $c['id'] }}">
@csrf
<label class="text-xs sm:col-span-2">Nombre<input name="nombre" required maxlength="80" value="{{ $c['nombre'] }}" class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"></label>
<label class="text-xs sm:col-span-3">Otros nombres<input name="otros_nombres" maxlength="700" value="{{ implode(', ', $c['nombres_alternos']) }}" class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"></label>
<label class="text-xs">Orden<input name="orden" type="number" min="0" max="9999" value="{{ $c['orden'] }}" class="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"></label>
<label class="text-xs sm:col-span-6 flex items-center gap-2"><input type="hidden" name="activa" value="0"><input type="checkbox" name="activa" value="1" @checked($c['activa'])> Visible en la app</label>
</form>
</td>
<td>{{ $c['productos'] }}</td>
<td><div class="inline-actions">
<button form="categoria-{{ $c['id'] }}">Guardar</button>
@include('admin._accion', ['accion' => 'eliminar-categoria', 'id' => $c['id'], 'label' => 'Eliminar', 'confirmar' => $c['productos'] ? "¿Eliminar «{$c['nombre']}»? {$c['productos']} productos la perderán (los productos no se borran)." : "¿Eliminar «{$c['nombre']}»?"])
</div></td>
</tr>
@empty
<tr><td colspan="3">Aún no hay categorías.</td></tr>
@endforelse
</tbody>
</table>
</div>
@endsection
