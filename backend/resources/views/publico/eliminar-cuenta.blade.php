@extends('layouts.app')

@section('titulo', 'Eliminar mi cuenta')

@section('contenido')
<div class="max-w-md mx-auto bg-white rounded-2xl shadow p-6 space-y-4 text-sm">
    <h1 class="text-xl font-bold">Eliminar mi cuenta de Vitrina</h1>

    <p>
        La forma más rápida es desde la app: <strong>Mi perfil → Eliminar mi cuenta</strong>.
        Si ya no tienes la app instalada, puedes hacerlo aquí con tu celular (o correo) y tu clave.
    </p>
    <p class="text-slate-600">
        Se borran tu nombre, correo, teléfono, direcciones y sesiones. Los pedidos ya hechos se conservan sin tus
        datos de contacto. Si eres el único dueño de un negocio, el negocio se cierra y deja de aparecer en la app.
        Esto no se puede deshacer. Más detalles en la
        <a class="text-indigo-600 underline" href="{{ route('privacidad') }}">política de privacidad</a>.
    </p>

    @if ($errors->any())
        <div class="rounded-lg bg-red-100 text-red-800 px-4 py-2">{{ $errors->first() }}</div>
    @endif

    @unless (session('ok'))
        <form method="POST" action="{{ route('eliminar-cuenta') }}" class="space-y-3"
              onsubmit="return confirm('¿Seguro? Tu cuenta se eliminará y no se puede deshacer.');">
            @csrf
            <div>
                <label class="block font-medium mb-1">Celular o correo</label>
                <input type="text" name="usuario" value="{{ old('usuario') }}" required autocomplete="username"
                       class="w-full rounded-lg border-slate-300 border px-3 py-2">
            </div>
            <div>
                <label class="block font-medium mb-1">Clave de 4 números</label>
                <input type="password" name="clave" required autocomplete="current-password"
                       class="w-full rounded-lg border-slate-300 border px-3 py-2">
                <p class="text-slate-500 text-xs mt-1">Si tu cuenta es de antes y no tiene clave, escribe tu contraseña.</p>
            </div>
            <button class="w-full bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg py-2.5">
                Eliminar mi cuenta
            </button>
        </form>
    @endunless

    <p class="text-slate-500">
        ¿Problemas? Escríbenos a {{ config('vitrina.correo_contacto') }}.
    </p>
</div>
@endsection
