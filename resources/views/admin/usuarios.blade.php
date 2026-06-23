@extends('layouts.app')

@section('titulo', 'Usuarios')

@section('contenido')
@include('admin._nav')

<h2 class="text-xl font-bold mb-4">Usuarios ({{ $usuarios->count() }})</h2>

<div class="bg-white rounded-2xl shadow divide-y">
    @foreach ($usuarios as $u)
        <div class="flex items-center justify-between p-4 gap-3">
            <div class="min-w-0">
                <p class="font-medium truncate">{{ $u->name }}</p>
                <p class="text-slate-500 text-sm truncate">{{ $u->email }}</p>
            </div>
            <form method="POST" action="{{ route('admin.usuarios.rol', $u->id) }}" class="flex items-center gap-2 shrink-0">
                @csrf
                @method('PUT')
                <select name="rol" class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                    @foreach ($roles as $rol)
                        <option value="{{ $rol }}" @selected($u->hasRole($rol))>{{ ucfirst($rol) }}</option>
                    @endforeach
                </select>
                <button class="text-sm bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-3 py-1.5">Guardar</button>
            </form>
        </div>
    @endforeach
</div>

<p class="text-slate-400 text-xs mt-3">
    Nota: por seguridad, no puedes quitarte a ti mismo el rol de administrador.
</p>
@endsection
