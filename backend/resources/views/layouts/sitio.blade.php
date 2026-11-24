<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('titulo', 'Vitrina') · Vitrina</title>
    <meta name="description" content="@yield('descripcion', 'Vitrina reúne los negocios de Maicao en una app: pide a domicilio y paga directo al negocio, en efectivo o por transferencia.')">
    <link rel="canonical" href="{{ url()->current() }}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Vitrina">
    <meta property="og:locale" content="es_CO">
    <meta property="og:title" content="@yield('titulo', 'Vitrina') · Vitrina">
    <meta property="og:description" content="@yield('descripcion', 'Vitrina reúne los negocios de Maicao en una app: pide a domicilio y paga directo al negocio, en efectivo o por transferencia.')">
    <meta property="og:url" content="{{ url()->current() }}">
    <link rel="icon" type="image/svg+xml" href="{{ asset('images/vitrina-mark.svg') }}">
    <link rel="stylesheet" href="{{ asset('brand.css') }}">
    <link rel="stylesheet" href="{{ asset('sitio.css') }}?v={{ filemtime(public_path('sitio.css')) }}">
    {{-- Día de 5:00 a 17:59 y noche el resto, como la app. --}}
    <script src="{{ asset('web-theme.js') }}"></script>
</head>
<body class="sitio">
    <a class="saltar" href="#contenido">Ir al contenido</a>

    <header class="sitio-barra">
        <div class="sitio-ancho sitio-barra-fila">
            <a href="{{ route('sitio.inicio') }}" class="sitio-marca" aria-label="Vitrina, inicio">
                <x-vitrina-logo :height="34" />
            </a>
            <nav class="sitio-menu" aria-label="Secciones">
                <a href="{{ route('sitio.inicio') }}" @class(['activo' => request()->routeIs('sitio.inicio')])>Inicio</a>
                <a href="{{ route('sitio.como-funciona') }}" @class(['activo' => request()->routeIs('sitio.como-funciona')])>Cómo funciona</a>
                <a href="{{ route('sitio.planes') }}" @class(['activo' => request()->routeIs('sitio.planes')])>Planes</a>
                <a href="{{ route('sitio.preguntas') }}" @class(['activo' => request()->routeIs('sitio.preguntas', 'sitio.contacto')])>Ayuda</a>
            </nav>
            <a href="{{ route('sitio.entrar') }}" class="boton boton-claro boton-chico">Iniciar sesión</a>
        </div>
    </header>

    <main id="contenido">
        @yield('contenido')
    </main>

    @php
        $pieTelefono = config('vitrina.telefono');
        $pieDocumento = config('vitrina.documento');
    @endphp
    <footer class="sitio-pie">
        <div class="sitio-ancho sitio-pie-rejilla">
            <div>
                <x-vitrina-logo :height="30" />
                <p>Los negocios de {{ config('vitrina.ciudad') }} en tu bolsillo.</p>
            </div>
            <nav aria-label="Vitrina">
                <h2>Vitrina</h2>
                <a href="{{ route('sitio.como-funciona') }}">Cómo funciona</a>
                <a href="{{ route('sitio.planes') }}">Planes para negocios</a>
                <a href="{{ route('sitio.entrar') }}">Pagar mi membresía</a>
            </nav>
            <nav aria-label="Ayuda">
                <h2>Ayuda</h2>
                <a href="{{ route('sitio.preguntas') }}">Preguntas frecuentes</a>
                <a href="{{ route('sitio.contacto') }}">Contacto y PQR</a>
                <a href="{{ route('cancelaciones') }}">Cancelaciones y devoluciones</a>
                <a href="{{ route('eliminar-cuenta') }}">Eliminar mi cuenta</a>
            </nav>
            <nav aria-label="Legal">
                <h2>Legal</h2>
                <a href="{{ route('terminos') }}">Términos y condiciones</a>
                <a href="{{ route('membresia') }}">Condiciones de la membresía</a>
                <a href="{{ route('privacidad') }}">Política de privacidad</a>
                <a href="{{ route('aviso-privacidad') }}">Aviso de privacidad</a>
                <a href="{{ route('cookies') }}">Política de cookies</a>
            </nav>
            <div>
                <h2>Contacto</h2>
                <a href="mailto:{{ config('vitrina.correo_contacto') }}">{{ config('vitrina.correo_contacto') }}</a>
                @if (filled($pieTelefono))
                    <a href="tel:+57{{ preg_replace('/\D/', '', $pieTelefono) }}">{{ $pieTelefono }}</a>
                @endif
                <span>{{ config('vitrina.ciudad') }}</span>
            </div>
        </div>
        <p class="sitio-ancho sitio-pie-final">
            © {{ date('Y') }} Vitrina · {{ config('vitrina.responsable') }}@if (filled($pieDocumento)) · {{ $pieDocumento }}@endif
            · Protección al consumidor y de datos: <a class="sitio-pie-sic" href="https://www.sic.gov.co" target="_blank" rel="noopener">Superintendencia de Industria y Comercio</a>
        </p>
    </footer>
</body>
</html>
