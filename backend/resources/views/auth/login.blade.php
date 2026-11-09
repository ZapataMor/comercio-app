@extends('layouts.app')

@section('titulo', 'Entrar')
@section('marca', 'Vitrina')

@section('contenido')
<div class="max-w-sm mx-auto mt-10">
    <div class="bg-white rounded-2xl shadow p-6">
        <h1 class="vitrina-login-brand"><x-vitrina-logo :height="72" name="Vitrina" /></h1>
        <p class="text-center text-slate-500 text-sm mb-6">Panel del administrador</p>

        @if ($errors->any())
            <div class="mb-4 rounded-lg bg-red-100 text-red-800 px-4 py-2 text-sm">
                {{ $errors->first() }}
            </div>
        @endif

        <form method="POST" action="{{ route('login') }}" class="space-y-4">
            @csrf
            <div>
                <label for="login-username" class="block text-sm font-medium mb-1">Usuario</label>
                <input id="login-username" type="text" name="username" value="{{ old('username', old('email')) }}" required autofocus autocomplete="username"
                       class="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                       placeholder="Tu usuario o correo anterior">
            </div>
            <div>
                <label class="block text-sm font-medium mb-1">Contraseña</label>
                <input type="password" name="password" required
                       class="w-full rounded-lg border-slate-300 border px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                       placeholder="••••••••">
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="remember" class="rounded"> Recordarme
            </label>
            <button class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg py-2.5 transition">
                Entrar
            </button>
        </form>

        @if (app()->environment('local', 'staging'))
        <p class="text-center text-xs text-slate-400 mt-4">
            Demo: admin@demo.co / password123
        </p>
        @endif
    </div>
</div>
@endsection
