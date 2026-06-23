@extends('layouts.app')

@section('titulo', 'Panel')

@section('contenido')

@unless ($negocio)
    {{-- ───── Aún no tiene negocio: formulario para crearlo ───── --}}
    <div class="bg-white rounded-2xl shadow p-6">
        <h2 class="text-lg font-bold mb-1">Crea tu negocio</h2>
        <p class="text-slate-500 text-sm mb-4">Aún no tienes una tienda. Empieza aquí.</p>

        <form method="POST" action="{{ route('panel.negocio.store') }}" class="space-y-3">
            @csrf
            <input name="nombre" required placeholder="Nombre del negocio"
                   class="w-full rounded-lg border border-slate-300 px-3 py-2">
            <input name="direccion" placeholder="Dirección (opcional)"
                   class="w-full rounded-lg border border-slate-300 px-3 py-2">
            <input name="telefono" placeholder="Teléfono (opcional)"
                   class="w-full rounded-lg border border-slate-300 px-3 py-2">
            <textarea name="descripcion" placeholder="Descripción (opcional)"
                      class="w-full rounded-lg border border-slate-300 px-3 py-2"></textarea>
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-2">
                Crear negocio
            </button>
        </form>
    </div>
@else

    {{-- ───── Datos del negocio ───── --}}
    <div class="bg-white rounded-2xl shadow p-6 mb-5">
        <div class="flex items-start justify-between">
            <div>
                <h2 class="text-xl font-bold">{{ $negocio->nombre }}</h2>
                @if ($negocio->descripcion)
                    <p class="text-slate-500 text-sm mt-1">{{ $negocio->descripcion }}</p>
                @endif
                <p class="text-slate-400 text-xs mt-2">
                    {{ $negocio->direccion ?: 'Sin dirección' }} · {{ $negocio->telefono ?: 'Sin teléfono' }}
                </p>
            </div>
            <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full
                {{ $negocio->activo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500' }}">
                {{ $negocio->activo ? 'Abierto' : 'Cerrado' }}
            </span>
        </div>

        <details class="mt-4">
            <summary class="cursor-pointer text-sm text-indigo-600">Editar datos</summary>
            <form method="POST" action="{{ route('panel.negocio.update') }}" class="space-y-3 mt-3">
                @csrf
                @method('PUT')
                <input name="nombre" value="{{ $negocio->nombre }}" required
                       class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <input name="direccion" value="{{ $negocio->direccion }}" placeholder="Dirección"
                       class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <input name="telefono" value="{{ $negocio->telefono }}" placeholder="Teléfono"
                       class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <textarea name="descripcion" placeholder="Descripción"
                          class="w-full rounded-lg border border-slate-300 px-3 py-2">{{ $negocio->descripcion }}</textarea>
                <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="activo" value="1" @checked($negocio->activo)> Negocio abierto
                </label>
                <button class="bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-lg px-4 py-2">
                    Guardar cambios
                </button>
            </form>
        </details>
    </div>

    {{-- ───── Categorías ───── --}}
    <div class="bg-white rounded-2xl shadow p-6 mb-5">
        <h3 class="font-bold mb-3">Categorías</h3>

        <div class="flex flex-wrap gap-2 mb-4">
            @forelse ($categorias as $cat)
                <span class="inline-flex items-center gap-2 bg-slate-100 rounded-full pl-3 pr-1 py-1 text-sm">
                    {{ $cat->nombre }}
                    <form method="POST" action="{{ route('panel.categorias.destroy', $cat->id) }}">
                        @csrf @method('DELETE')
                        <button class="text-slate-400 hover:text-red-600 w-5 h-5 rounded-full" title="Borrar">&times;</button>
                    </form>
                </span>
            @empty
                <p class="text-slate-400 text-sm">Aún no hay categorías.</p>
            @endforelse
        </div>

        <form method="POST" action="{{ route('panel.categorias.store') }}" class="flex gap-2">
            @csrf
            <input name="nombre" required placeholder="Nueva categoría (ej: Bebidas)"
                   class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4">
                Añadir
            </button>
        </form>
        @error('nombre') <p class="text-red-600 text-xs mt-1">{{ $message }}</p> @enderror
    </div>

    {{-- ───── Productos ───── --}}
    <div class="bg-white rounded-2xl shadow p-6">
        <h3 class="font-bold mb-3">Productos ({{ $productos->count() }})</h3>

        {{-- Form: nuevo producto --}}
        <details class="mb-5">
            <summary class="cursor-pointer text-sm text-indigo-600">+ Nuevo producto</summary>
            <form method="POST" action="{{ route('panel.productos.store') }}" class="space-y-3 mt-3">
                @csrf
                <input name="nombre" required placeholder="Nombre del producto"
                       class="w-full rounded-lg border border-slate-300 px-3 py-2">
                <div class="flex gap-2">
                    <input name="precio" type="number" step="0.01" min="0" required placeholder="Precio"
                           class="w-1/2 rounded-lg border border-slate-300 px-3 py-2">
                    <select name="categoria_id" class="w-1/2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                        <option value="">Sin categoría</option>
                        @foreach ($categorias as $cat)
                            <option value="{{ $cat->id }}">{{ $cat->nombre }}</option>
                        @endforeach
                    </select>
                </div>
                <textarea name="descripcion" placeholder="Descripción (opcional)"
                          class="w-full rounded-lg border border-slate-300 px-3 py-2"></textarea>
                <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-2">
                    Guardar producto
                </button>
            </form>
        </details>

        {{-- Lista de productos --}}
        <div class="divide-y">
            @forelse ($productos as $p)
                <div class="flex items-center justify-between py-3 gap-3">
                    <div class="min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="font-medium truncate">{{ $p->nombre }}</span>
                            @if ($p->categoria)
                                <span class="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{{ $p->categoria->nombre }}</span>
                            @endif
                        </div>
                        <span class="text-sm text-slate-500">${{ number_format($p->precio, 0, ',', '.') }}</span>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full
                            {{ $p->disponible ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500' }}">
                            {{ $p->disponible ? 'Disponible' : 'Oculto' }}
                        </span>
                        <a href="{{ route('panel.productos.edit', $p->id) }}" class="text-xs text-slate-600 hover:underline">Editar</a>
                        <form method="POST" action="{{ route('panel.productos.toggle', $p->id) }}">
                            @csrf @method('PUT')
                            <button class="text-xs text-indigo-600 hover:underline">
                                {{ $p->disponible ? 'Ocultar' : 'Mostrar' }}
                            </button>
                        </form>
                        <form method="POST" action="{{ route('panel.productos.destroy', $p->id) }}"
                              onsubmit="return confirm('¿Borrar este producto?')">
                            @csrf @method('DELETE')
                            <button class="text-xs text-red-600 hover:underline">Borrar</button>
                        </form>
                    </div>
                </div>
            @empty
                <p class="text-slate-400 text-sm py-3">Aún no tienes productos. Crea el primero arriba. ☝️</p>
            @endforelse
        </div>
    </div>
@endunless

@endsection
