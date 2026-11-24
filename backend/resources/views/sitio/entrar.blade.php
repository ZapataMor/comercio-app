@extends('layouts.sitio')

@section('titulo', 'Iniciar sesión')
@section('descripcion', 'Entra con tu cuenta de Vitrina para pagar la membresía de tu negocio.')

@section('contenido')
<section class="acceso">
    <div class="acceso-lado">
        <span class="etiqueta">Pagos de membresía</span>
        <h1>Entra para pagar la membresía de tu negocio.</h1>
        <p>Usa la misma cuenta con la que entras a la app de Vitrina.</p>
        <ul class="lista">
            <li>Mira el estado de tu plan y su fecha de vencimiento</li>
            <li>Paga o renueva tu membresía</li>
            <li>Descarga tus comprobantes</li>
        </ul>
    </div>

    <div class="acceso-form">
        {{-- Por ahora solo es la maqueta: los botones no envían nada. --}}
        <form class="caja" onsubmit="return false" novalidate>
            <h2>Iniciar sesión</h2>
            <p>Con tu celular y tu clave de 4 números.</p>

            <label class="campo">
                <span>Celular</span>
                <div class="campo-tel">
                    <span class="prefijo">+57</span>
                    <input type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="300 000 0000">
                </div>
            </label>

            <label class="campo">
                <span>Clave</span>
                <input class="clave" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="••••">
            </label>

            <button type="button" class="boton boton-oscuro boton-ancho">Entrar</button>

            <div class="separador">o</div>

            <button type="button" class="boton boton-google boton-ancho">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9Z"/></svg>
                Continuar con Google
            </button>

            <div class="caja-enlaces">
                <button type="button">Olvidé mi clave</button>
                <a href="{{ route('sitio.planes') }}">Ver planes</a>
            </div>

            <p class="aviso">Los pagos de membresía estarán disponibles muy pronto.</p>
            <p class="caja-legal">
                Al entrar aceptas los <a href="{{ route('terminos') }}">términos</a>, las
                <a href="{{ route('membresia') }}">condiciones de la membresía</a> y la
                <a href="{{ route('privacidad') }}">política de privacidad</a>.
            </p>
        </form>
    </div>
</section>
@endsection
