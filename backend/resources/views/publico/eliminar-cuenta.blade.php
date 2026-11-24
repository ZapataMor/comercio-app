@extends('layouts.documento')

@section('titulo', 'Eliminar mi cuenta')
@section('descripcion', 'Elimina tu cuenta de Vitrina y tus datos personales, aunque ya no tengas la app.')
@section('etiqueta', 'Ayuda')
@section('encabezado', 'Eliminar mi cuenta de Vitrina')

@section('documento')
<p>
    La forma más rápida es desde la app: <strong>Mi perfil → Eliminar mi cuenta</strong>.
    Si ya no tienes la app instalada, puedes hacerlo aquí con tu celular (o correo) y tu clave.
</p>
<p>
    Se borran tu nombre, correo, teléfono, direcciones y sesiones. Los pedidos ya hechos se conservan sin tus
    datos de contacto. Si eres el único dueño de un negocio, el negocio se cierra y deja de aparecer en la app.
    <strong>Esto no se puede deshacer.</strong> Más detalles en la
    <a href="{{ route('privacidad') }}">política de privacidad</a>.
</p>

<div class="caja-doc">
    @if ($errors->any())
        <div class="alerta alerta-error" role="alert">{{ $errors->first() }}</div>
    @endif
    @if (session('ok'))
        <div class="alerta alerta-ok" role="status">{{ session('ok') }}</div>
    @endif

    @unless (session('ok'))
        <form method="POST" action="{{ route('eliminar-cuenta') }}"
              onsubmit="return confirm('¿Seguro? Tu cuenta se eliminará y no se puede deshacer.');">
            @csrf
            <label class="campo">
                <span>Celular o correo</span>
                <input type="text" name="usuario" value="{{ old('usuario') }}" required autocomplete="username">
            </label>
            <label class="campo">
                <span>Clave de 4 números</span>
                <input class="clave" type="password" name="clave" required inputmode="numeric" maxlength="4" autocomplete="current-password">
            </label>
            <button class="boton boton-peligro boton-ancho">Eliminar mi cuenta</button>
        </form>
    @endunless
</div>

<p>¿Olvidaste tu clave o tienes problemas? Escríbenos a <a href="mailto:{{ config('vitrina.correo_contacto') }}">{{ config('vitrina.correo_contacto') }}</a> desde el correo de tu cuenta o con tu celular, y la eliminamos por ti.</p>
@endsection
