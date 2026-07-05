@extends('layouts.app')

@section('titulo', $negocio->nombre)

@section('contenido')
<a href="{{ route('explorar') }}" class="text-sm text-slate-500 hover:underline">← Volver a negocios</a>

{{-- Cabecera del negocio --}}
<div class="bg-white rounded-2xl shadow p-6 mt-3 mb-5">
    <div class="flex items-start justify-between gap-3">
        <h2 class="text-2xl font-bold">{{ $negocio->nombre }}</h2>
        <span class="text-xs font-semibold rounded-full px-2 py-1 {{ $negocio->activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700' }}">
            {{ $negocio->activo ? 'Abierto' : 'Cerrado' }}
        </span>
    </div>
    @if ($negocio->descripcion)
        <p class="text-slate-500 mt-1">{{ $negocio->descripcion }}</p>
    @endif
    <p class="text-slate-400 text-sm mt-3">
        @if ($negocio->direccion) 📍 {{ $negocio->direccion }} @endif
        @if ($negocio->telefono) · 📞 {{ $negocio->telefono }} @endif
    </p>
</div>

{{-- Catálogo agrupado por categoría --}}
@forelse ($productos as $categoria => $items)
    <div class="mb-5">
        <h3 class="font-bold text-slate-700 mb-2">{{ $categoria }}</h3>
        <div class="bg-white rounded-2xl shadow divide-y">
            @foreach ($items as $p)
                <div class="flex items-center justify-between p-4 gap-3">
                    <div class="min-w-0">
                        <p class="font-medium">{{ $p->nombre }}</p>
                        @if ($p->descripcion)
                            <p class="text-slate-500 text-sm line-clamp-1">{{ $p->descripcion }}</p>
                        @endif
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <span class="font-semibold text-slate-800">${{ number_format($p->precio, 0, ',', '.') }}</span>
                        <form method="POST" action="{{ route('carrito.agregar', $p->id) }}">
                            @csrf
                            <button
                                @disabled(! $negocio->activo)
                                class="text-sm rounded-lg px-3 py-1.5 {{ $negocio->activo ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed' }}">
                                {{ $negocio->activo ? '+ Pedir' : 'Cerrado' }}
                            </button>
                        </form>
                    </div>
                </div>
            @endforeach
        </div>
    </div>
@empty
    <div class="bg-white rounded-2xl shadow p-8 text-center">
        <div class="text-4xl mb-3">📦</div>
        <p class="text-slate-500 text-sm">Este negocio aún no tiene productos disponibles.</p>
    </div>
@endforelse
@endsection
