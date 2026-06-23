@extends('layouts.app')

@section('titulo', 'Explorar')

@section('contenido')
@include('cliente._buscador')

<div class="mb-5">
    <h2 class="text-xl font-bold">Negocios disponibles</h2>
    <p class="text-slate-500 text-sm">Explora los comercios abiertos en Maicao.</p>
</div>

<div class="grid gap-4 sm:grid-cols-2">
    @forelse ($negocios as $negocio)
        <a href="{{ route('explorar.negocio', $negocio->id) }}"
           class="block bg-white rounded-2xl shadow p-5 hover:shadow-md hover:-translate-y-0.5 transition">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <h3 class="font-bold truncate">{{ $negocio->nombre }}</h3>
                    @if ($negocio->descripcion)
                        <p class="text-slate-500 text-sm mt-1 line-clamp-2">{{ $negocio->descripcion }}</p>
                    @endif
                    @if ($negocio->direccion)
                        <p class="text-slate-400 text-xs mt-2">📍 {{ $negocio->direccion }}</p>
                    @endif
                </div>
                <span class="shrink-0 text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">Abierto</span>
            </div>
            <p class="text-indigo-600 text-sm font-medium mt-3">
                {{ $negocio->productos_count }} {{ Str::plural('producto', $negocio->productos_count) }} →
            </p>
        </a>
    @empty
        <div class="bg-white rounded-2xl shadow p-8 text-center sm:col-span-2">
            <div class="text-4xl mb-3">🏪</div>
            <p class="text-slate-500 text-sm">Todavía no hay negocios abiertos.</p>
        </div>
    @endforelse
</div>
@endsection
