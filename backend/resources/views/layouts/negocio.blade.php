<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('titulo', 'Panel') - {{ isset($negocioWeb) ? $negocioWeb->nombre : 'Vitrina' }}</title>
    <link rel="icon" type="image/svg+xml" href="{{ asset('images/vitrina-mark.svg') }}">
    <link rel="stylesheet" href="{{ asset('brand.css') }}">
    <link rel="stylesheet" href="{{ asset('sitio.css') }}?v={{ filemtime(public_path('sitio.css')) }}">
    <link rel="stylesheet" href="{{ asset('panel.css') }}?v={{ filemtime(public_path('panel.css')) }}">
    {{-- Día de 5:00 a 17:59 y noche el resto, como la app. --}}
    <script src="{{ asset('web-theme.js') }}"></script>
    @stack('cabeza')
</head>
<body class="sitio panel">
<a class="saltar" href="#contenido">Ir al contenido</a>
@isset($negocioWeb)
<div class="panel-marco">
    <aside class="panel-lateral" id="panel-lateral">
        <div class="panel-lateral-cabeza">
            <a href="{{ route('negocio.inicio') }}" aria-label="Inicio del panel"><x-vitrina-logo :height="30" /></a>
            <button type="button" class="panel-menu-boton" aria-controls="panel-nav" aria-expanded="false"
                    onclick="const l = document.getElementById('panel-lateral'); this.setAttribute('aria-expanded', l.classList.toggle('abierto'))">Menú</button>
        </div>
        <div class="panel-negocio">
            <span class="panel-inicial" aria-hidden="true">{{ mb_strtoupper(mb_substr($negocioWeb->nombre, 0, 1)) }}</span>
            <div>
                <p class="panel-negocio-nombre">{{ $negocioWeb->nombre }}</p>
                <p class="panel-negocio-usuario">{{ auth()->user()->name }}</p>
                @if($negociosWeb->count() > 1)<a href="{{ route('negocio.elegir') }}" class="panel-negocio-cambiar">Cambiar de negocio</a>@endif
            </div>
        </div>
        <nav class="panel-nav" id="panel-nav" aria-label="Módulos">
            @foreach($menuWeb as $grupo => $modulos)
                <div class="panel-nav-grupo">
                    <p>{{ \App\Gestion\Modulos::GRUPOS[$grupo] }}</p>
                    @foreach($modulos as $clave => $m)
                        @php
                            $ruta = $clave === 'inicio' ? 'negocio.inicio' : (\App\Gestion\Modulos::esNucleo($clave) || $clave === 'sedes' ? 'negocio.'.$clave : null);
                            $url = $ruta ? route($ruta) : route('negocio.modulo', $clave);
                            $activo = $ruta ? request()->routeIs($ruta.'*') : (request()->routeIs('negocio.modulo') && request()->route('modulo') === $clave);
                        @endphp
                        <a href="{{ $url }}" @class(['activo' => $activo]) @if($activo) aria-current="page" @endif>
                            <span>{{ $m['nombre'] }}</span>
                            @if($m['estado'] !== 'disponible')<span class="panel-pronto">pronto</span>@endif
                        </a>
                    @endforeach
                </div>
            @endforeach
        </nav>
        <form method="POST" action="{{ route('negocio.salir') }}">@csrf<button class="panel-salir">Salir</button></form>
    </aside>
    <main class="panel-contenido" id="contenido">
@else
    <main class="panel-solo" id="contenido">
        <x-vitrina-logo :height="34" />
@endisset
        @if (session('ok'))<div class="aviso aviso-ok" role="status">{{ session('ok') }}</div>@endif
        @if (session('error'))<div class="aviso aviso-error" role="alert">{{ session('error') }}</div>@endif
        @if ($errors->any())<div role="alert" class="aviso aviso-error"><strong>Revisa estos datos</strong><ul>@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div>@endif
        @yield('contenido')
    </main>
@isset($negocioWeb)
</div>
@endisset
@stack('pie')
</body>
</html>
