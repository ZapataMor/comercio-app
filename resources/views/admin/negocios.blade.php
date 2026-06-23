@extends('layouts.app')

@section('titulo', 'Negocios')

@section('contenido')
@include('admin._nav')

<h2 class="text-xl font-bold mb-4">Todos los negocios ({{ $negocios->count() }})</h2>

<div class="bg-white rounded-2xl shadow divide-y">
    @forelse ($negocios as $n)
        <div class="flex items-center justify-between p-4 gap-3">
            <div class="min-w-0">
                <p class="font-medium truncate">{{ $n->nombre }}</p>
                <p class="text-slate-500 text-sm truncate">
                    Dueño: {{ $n->user?->name ?? '—' }} · {{ $n->productos_count }} {{ Str::plural('producto', $n->productos_count) }}
                </p>
            </div>
            <span class="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full
                {{ $n->activo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500' }}">
                {{ $n->activo ? 'Abierto' : 'Cerrado' }}
            </span>
        </div>
    @empty
        <p class="text-slate-400 text-sm p-4">Aún no hay negocios.</p>
    @endforelse
</div>
@endsection
