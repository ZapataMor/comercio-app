@extends('layouts.app')

@section('titulo', 'Admin')

@section('contenido')
@include('admin._nav')

<h2 class="text-xl font-bold mb-4">Tablero de administración</h2>

<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
    <div class="bg-white rounded-2xl shadow p-5">
        <p class="text-3xl font-bold text-indigo-600">{{ $stats['usuarios'] }}</p>
        <p class="text-slate-500 text-sm mt-1">Usuarios</p>
    </div>
    <div class="bg-white rounded-2xl shadow p-5">
        <p class="text-3xl font-bold text-indigo-600">{{ $stats['negocios'] }}</p>
        <p class="text-slate-500 text-sm mt-1">Negocios</p>
    </div>
    <div class="bg-white rounded-2xl shadow p-5">
        <p class="text-3xl font-bold text-green-600">{{ $stats['negocios_activos'] }}</p>
        <p class="text-slate-500 text-sm mt-1">Abiertos</p>
    </div>
    <div class="bg-white rounded-2xl shadow p-5">
        <p class="text-3xl font-bold text-indigo-600">{{ $stats['productos'] }}</p>
        <p class="text-slate-500 text-sm mt-1">Productos</p>
    </div>
</div>

<div class="bg-white rounded-2xl shadow p-6 mt-5">
    <h3 class="font-bold mb-2">Accesos rápidos</h3>
    <div class="flex flex-wrap gap-2 text-sm">
        <a href="{{ route('admin.usuarios') }}" class="text-indigo-600 hover:underline">Gestionar usuarios y roles →</a>
        <span class="text-slate-300">·</span>
        <a href="{{ route('admin.negocios') }}" class="text-indigo-600 hover:underline">Ver todos los negocios →</a>
    </div>
</div>
@endsection
