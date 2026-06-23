@extends('layouts.app')

@section('titulo', 'Editar producto')

@section('contenido')
<div class="bg-white rounded-2xl shadow p-6">
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-bold">Editar producto</h2>
        <a href="{{ route('panel') }}" class="text-sm text-slate-500 hover:underline">← Volver</a>
    </div>

    <form method="POST" action="{{ route('panel.productos.update', $producto->id) }}" class="space-y-4">
        @csrf
        @method('PUT')

        <div>
            <label class="block text-sm font-medium mb-1">Nombre</label>
            <input name="nombre" value="{{ old('nombre', $producto->nombre) }}" required
                   class="w-full rounded-lg border border-slate-300 px-3 py-2">
            @error('nombre') <p class="text-red-600 text-xs mt-1">{{ $message }}</p> @enderror
        </div>

        <div class="flex gap-2">
            <div class="w-1/2">
                <label class="block text-sm font-medium mb-1">Precio</label>
                <input name="precio" type="number" step="0.01" min="0" value="{{ old('precio', $producto->precio) }}" required
                       class="w-full rounded-lg border border-slate-300 px-3 py-2">
                @error('precio') <p class="text-red-600 text-xs mt-1">{{ $message }}</p> @enderror
            </div>
            <div class="w-1/2">
                <label class="block text-sm font-medium mb-1">Categoría</label>
                <select name="categoria_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Sin categoría</option>
                    @foreach ($categorias as $cat)
                        <option value="{{ $cat->id }}" @selected(old('categoria_id', $producto->categoria_id) == $cat->id)>
                            {{ $cat->nombre }}
                        </option>
                    @endforeach
                </select>
            </div>
        </div>

        <div>
            <label class="block text-sm font-medium mb-1">Descripción</label>
            <textarea name="descripcion" class="w-full rounded-lg border border-slate-300 px-3 py-2">{{ old('descripcion', $producto->descripcion) }}</textarea>
        </div>

        <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" name="disponible" value="1" @checked(old('disponible', $producto->disponible))>
            Disponible (visible para los clientes)
        </label>

        <div class="flex gap-2 pt-2">
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-2">
                Guardar cambios
            </button>
            <a href="{{ route('panel') }}" class="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50">
                Cancelar
            </a>
        </div>
    </form>
</div>
@endsection
