@extends('layouts.app')

@section('titulo', 'Buscar')

@section('contenido')

@include('cliente._buscador')

@if ($q === '')
    <div class="bg-white rounded-2xl shadow p-8 text-center">
        <div class="text-4xl mb-3">🔍</div>
        <p class="text-slate-500 text-sm">Escribe algo para buscar en todos los negocios abiertos.</p>
    </div>
@else
    <p class="text-slate-500 text-sm mb-3">
        {{ $resultados->count() }} {{ Str::plural('resultado', $resultados->count()) }} para
        <span class="font-semibold text-slate-700">"{{ $q }}"</span>
    </p>

    @forelse ($resultados as $p)
        <a href="{{ route('explorar.negocio', $p->negocio->id) }}"
           class="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 mb-2 hover:shadow-md transition gap-3">
            <div class="min-w-0">
                <div class="flex items-center gap-2">
                    <span class="font-medium truncate">{{ $p->nombre }}</span>
                    @if ($p->categoria)
                        <span class="text-xs bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{{ $p->categoria->nombre }}</span>
                    @endif
                </div>
                @if ($p->descripcion)
                    <p class="text-slate-500 text-sm line-clamp-1">{{ $p->descripcion }}</p>
                @endif
                <p class="text-slate-400 text-xs mt-1">🏪 {{ $p->negocio->nombre }}</p>
            </div>
            <span class="font-semibold text-slate-800 shrink-0">${{ number_format($p->precio, 0, ',', '.') }}</span>
        </a>
    @empty
        <div class="bg-white rounded-2xl shadow p-8 text-center">
            <div class="text-4xl mb-3">🤔</div>
            <p class="text-slate-600 font-medium">No encontramos nada para "{{ $q }}"</p>
            <p class="text-slate-400 text-sm mt-1">Prueba con otra palabra o revisa la ortografía.</p>
        </div>
    @endforelse
@endif

@endsection
