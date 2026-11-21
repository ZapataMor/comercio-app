@extends('layouts.app')

@section('titulo', 'Usuarios')

@section('contenido')
@include('admin._nav')

<div class="flex items-center justify-between mb-4">
    <h2 class="text-xl font-bold">Usuarios</h2>
</div>

<form class="filters" method="GET"><input type="hidden" name="rol" value="{{ $rolActual }}"><label>Buscar usuario<input name="buscar" value="{{ request('buscar') }}" placeholder="Nombre, usuario, correo o teléfono"></label><button>Buscar</button></form>
{{-- Crear nuevo usuario --}}
<div class="bg-white rounded-2xl shadow p-5 mb-5">
    <details @if ($errors->any()) open @endif>
        <summary class="cursor-pointer font-semibold text-indigo-600">+ Crear usuario</summary>

        @if ($errors->any())
            <div class="mt-3 rounded-lg bg-red-100 text-red-800 px-4 py-2 text-sm">{{ $errors->first() }}</div>
        @endif

        <form method="POST" action="{{ route('admin.usuarios.store') }}" class="space-y-3 mt-3"
              onchange="var adm=this.rol.value==='administrador';this.querySelectorAll('[data-app]').forEach(function(e){e.style.display=adm?'none':'contents';e.querySelectorAll('input').forEach(function(i){i.disabled=adm})});this.querySelectorAll('[data-panel]').forEach(function(e){e.style.display=adm?'contents':'none';e.querySelectorAll('input').forEach(function(i){i.disabled=!adm})});">
            @csrf
            @php($esAdmin = old('rol', 'usuario') === 'administrador')
            <div class="grid sm:grid-cols-2 gap-3">
                <select name="rol" class="rounded-lg border border-slate-300 px-3 py-2" aria-label="Tipo de cuenta">
                    @foreach ($roles as $rol)
                        <option value="{{ $rol }}" @selected(old('rol', 'usuario') === $rol)>{{ $tipos[$rol] }}</option>
                    @endforeach
                </select>
                {{-- Cliente o domiciliario: entra a la app con su celular y una clave de 4 números. --}}
                <div data-app style="display: {{ $esAdmin ? 'none' : 'contents' }}">
                    <input name="name" value="{{ old('name') }}" required placeholder="Nombre" aria-label="Nombre" maxlength="255" @disabled($esAdmin)
                           class="rounded-lg border border-slate-300 px-3 py-2">
                    <input name="telefono" value="{{ old('telefono') }}" required placeholder="Celular (3001234567)" aria-label="Celular" inputmode="numeric" maxlength="13" @disabled($esAdmin)
                           class="rounded-lg border border-slate-300 px-3 py-2">
                    <input name="pin" required placeholder="Clave de 4 números" aria-label="Clave de 4 números" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" @disabled($esAdmin)
                           class="rounded-lg border border-slate-300 px-3 py-2">
                </div>
                {{-- Administrador: entra a este panel con usuario y contraseña. --}}
                <div data-panel style="display: {{ $esAdmin ? 'contents' : 'none' }}">
                    <input name="username" value="{{ old('username') }}" required placeholder="Usuario" aria-label="Usuario" autocomplete="off" minlength="3" maxlength="50" pattern="[A-Za-z0-9][A-Za-z0-9_.-]*" @disabled(! $esAdmin)
                           class="rounded-lg border border-slate-300 px-3 py-2">
                    <input name="password" type="password" required placeholder="Contraseña (mín. 5)" aria-label="Contraseña" autocomplete="new-password" minlength="5" @disabled(! $esAdmin)
                           class="rounded-lg border border-slate-300 px-3 py-2">
                </div>
            </div>
            <p class="text-xs text-slate-500">Clientes y domiciliarios entran a la app con su celular y la clave de 4 números (pueden cambiarla). Los administradores entran a este panel.</p>
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
            {{ $tipos[$rol] }}
            <span class="ml-1 text-xs {{ $rol === $rolActual ? 'text-indigo-100' : 'text-slate-400' }}">{{ $conteos[$rol] }}</span>
        </a>
    @endforeach
</div>

{{-- Lista del tipo seleccionado --}}
<div class="bg-white rounded-2xl shadow divide-y">
    @forelse ($usuarios as $u)
        <div class="flex items-center justify-between p-4 gap-3">
            <div class="min-w-0">
                <p class="font-medium truncate"><a href="{{ route('admin.usuario', $u) }}">{{ $u->nombre_completo }}</a> @if($u->suspendido_at)<span class="badge">Suspendido</span>@endif</p>
                <p class="text-slate-500 text-sm truncate">{{ $u->username ?? $u->email }}</p>
            </div>
            <form method="POST" action="{{ route('admin.usuarios.rol', $u->id) }}" class="flex flex-wrap items-center gap-2" data-confirm="¿Confirmas el cambio de rol de esta cuenta?">
                @csrf
                @method('PUT')
                <select name="rol" class="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                    @foreach ($roles as $rol)
                        <option value="{{ $rol }}" @selected($u->tipoCuenta() === $rol)>{{ $tipos[$rol] }}</option>
                    @endforeach
                </select>
                <input name="motivo" aria-label="Motivo del cambio de rol" placeholder="Motivo del cambio" required maxlength="255"><button class="text-sm bg-slate-800 hover:bg-slate-900 text-white rounded-lg px-3 py-1.5">Guardar</button>
            </form>
        </div>
    @empty
        <p class="text-slate-400 text-sm p-4">No hay usuarios de tipo «{{ $tipos[$rolActual] }}».</p>
    @endforelse
</div>

<p class="text-slate-400 text-xs mt-3">
    Nota: por seguridad, no puedes quitarte a ti mismo el rol de administrador.
</p>
{{ $usuarios->links() }}
@endsection
