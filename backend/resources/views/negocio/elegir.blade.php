@extends('layouts.negocio')
@section('titulo', 'Elegir negocio')
@section('contenido')
<div class="bloque">
    <h1 style="font-size:24px;margin-bottom:6px">¿Qué negocio vas a manejar?</h1>
    <p class="apagado">Puedes cambiar de negocio cuando quieras desde el menú.</p>
    @foreach($negocios as $n)
        <form method="POST" action="{{ route('negocio.cambiar') }}">@csrf
            <input type="hidden" name="negocio_id" value="{{ $n->id }}">
            <button class="opcion"><span>{{ $n->nombre }}</span> <span @class(['chip', 'chip-acento' => $n->pivot->rol === 'propietario'])>{{ $n->pivot->rol === 'propietario' ? 'Dueño' : 'Equipo' }}</span></button>
        </form>
    @endforeach
</div>
@endsection
