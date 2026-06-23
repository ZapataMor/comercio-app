@extends('layouts.app')

@section('titulo', 'Próximamente')

@section('contenido')
<div class="bg-white rounded-2xl shadow p-8 text-center">
    <div class="text-4xl mb-3">🚧</div>
    <h2 class="text-lg font-bold">Vista en construcción</h2>
    <p class="text-slate-500 text-sm mt-2">
        El panel para el rol <span class="font-semibold">{{ $rol }}</span> aún no está listo.
        Lo construiremos pronto.
    </p>
</div>
@endsection
