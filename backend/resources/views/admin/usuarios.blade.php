@extends('layouts.app')

@section('titulo', 'Usuarios')

@section('contenido')
@include('admin._nav')

<div class="flex items-center justify-between mb-4">
    <h2 class="text-xl font-bold">Usuarios</h2>
</div>

{{-- Crear nuevo usuario --}}
<div class="bg-white rounded-2xl shadow p-5 mb-5">
    <details @if ($errors->any()) open @endif>
        <summary class="cursor-pointer font-semibold text-indigo-600">+ Crear usuario</summary>

        @if ($errors->any())
            <div class="mt-3 rounded-lg bg-red-100 text-red-800 px-4 py-2 text-sm">{{ $errors->first() }}</div>
        @endif

        <form method="POST" action="{{ route('admin.usuarios.store') }}" class="space-y-3 mt-3">
            @csrf
            <div class="grid sm:grid-cols-2 gap-3">
                <input name="name" value="{{ old('name') }}" required placeholder="Nombre"
                       class="rounded-lg border border-slate-300 px-3 py-2">
                <input name="email" type="email" value="{{ old('email') }}" required placeholder="Correo"
                       class="rounded-lg border border-slate-300 px-3 py-2">
                <input name="password" type="text" required placeholder="Contraseña (mín. 8)"
                       class="rounded-lg border border-slate-300 px-3 py-2">
                <select name="rol" class="rounded-lg border border-slate-300 px-3 py-2">
                    @foreach ($roles as $rol)
                        <option value="{{ $rol }}" @selected(old('rol', $rolActual) === $rol)>{{ ucfirst($rol) }}</option>
                    @endforeach
                </select>
            </div>
            <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg px-4 py-2">
                Crear usuario
            </button>
        </form>
    </details>
</div>

{{-- Pestañas por TIPO de usuario --}}
<div class="flex flex-wrap gap-2 mb-4">
    @foreach ($roles as $rol)
        <a href="{{ route('admin.usuarios', ['rol' => $rol]) }}"
           class="px-3 py-1.5 rounded-lg text-sm {{ $rol === $rolActual ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50' }}">
            {{ ucfirst($rol) }}
            <span class="ml-1 text-xs {{ $rol === $rolActual ? 'text-indigo-100' : 'text-slate-400' }}">{{ $conteos[$rol] }}</span>
        </a>
    @endforeach
</div>

{{-- Lista del tipo seleccionado --}}
<div class="bg-white rounded-2xl shadow divide-y">
    @forelse ($usuarios as $u)
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
    @empty
        <p class="text-slate-400 text-sm p-4">No hay usuarios de tipo «{{ ucfirst($rolActual) }}».</p>
    @endforelse
</div>

<p class="text-slate-400 text-xs mt-3">
    Nota: por seguridad, no puedes quitarte a ti mismo el rol de administrador.
</p>
@endsection
