@extends('layouts.negocio')
@section('titulo', 'Elegir negocio')
@section('contenido')
<div class="bg-white rounded-lg border p-6">
    <h1 class="text-xl font-semibold mb-4">¿Qué negocio vas a manejar?</h1>
    @foreach($negocios as $n)
        <form method="POST" action="{{ route('negocio.cambiar') }}" class="mb-2">@csrf
            <input type="hidden" name="negocio_id" value="{{ $n->id }}">
            <button class="w-full text-left border rounded px-4 py-3 hover:bg-slate-50">{{ $n->nombre }} <span class="text-xs text-slate-500">· {{ $n->pivot->rol === 'propietario' ? 'Dueño' : 'Equipo' }}</span></button>
        </form>
    @endforeach
</div>
@endsection
