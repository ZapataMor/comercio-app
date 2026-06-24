@extends('layouts.app')

@section('titulo', $negocio->nombre)

@section('contenido')
<a href="{{ route('explorar') }}" class="text-sm text-slate-500 hover:underline">← Volver a negocios</a>

{{-- Cabecera del negocio --}}
<div class="bg-white rounded-2xl shadow p-6 mt-3 mb-5">
    <h2 class="text-2xl font-bold">{{ $negocio->nombre }}</h2>
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
                            <button class="text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1.5">
                                + Pedir
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
