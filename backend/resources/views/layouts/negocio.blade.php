<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('titulo', 'Panel') - {{ isset($negocioWeb) ? $negocioWeb->nombre : 'Vitrina' }}</title>
    <link rel="icon" type="image/svg+xml" href="{{ asset('images/vitrina-mark.svg') }}">
    <script src="https://cdn.tailwindcss.com"></script>
    @stack('cabeza')
</head>
<body class="bg-slate-100 text-slate-800 min-h-screen">
@isset($negocioWeb)
<div class="md:flex min-h-screen">
    <aside class="bg-white border-r md:w-64 shrink-0 p-4">
        <a href="{{ route('negocio.inicio') }}" class="flex items-center gap-2 mb-1"><x-vitrina-logo :height="30" /></a>
        <p class="font-semibold">{{ $negocioWeb->nombre }}</p>
        <p class="text-xs text-slate-500 mb-3">{{ auth()->user()->name }}</p>
        @if($negociosWeb->count() > 1)<a href="{{ route('negocio.elegir') }}" class="text-xs text-teal-700 underline">Cambiar de negocio</a>@endif
        <nav class="mt-4 space-y-4 text-sm" aria-label="Módulos">
            @foreach($menuWeb as $grupo => $modulos)
                <div>
                    <p class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{{ \App\Gestion\Modulos::GRUPOS[$grupo] }}</p>
                    @foreach($modulos as $clave => $m)
                        @php
                            $ruta = $clave === 'inicio' ? 'negocio.inicio' : (\App\Gestion\Modulos::esNucleo($clave) || $clave === 'sedes' ? 'negocio.'.$clave : null);
                            $url = $ruta ? route($ruta) : route('negocio.modulo', $clave);
                            $activo = $ruta ? request()->routeIs($ruta.'*') : (request()->routeIs('negocio.modulo') && request()->route('modulo') === $clave);
                        @endphp
                        <a href="{{ $url }}" @class(['block rounded px-2 py-1', 'bg-teal-50 text-teal-800 font-semibold' => $activo, 'hover:bg-slate-100' => ! $activo]) @if($activo) aria-current="page" @endif>
                            {{ $m['nombre'] }} @if($m['estado'] !== 'disponible')<span class="text-[10px] text-slate-400">· pronto</span>@endif
                        </a>
                    @endforeach
                </div>
            @endforeach
        </nav>
        <form method="POST" action="{{ route('negocio.salir') }}" class="mt-6">@csrf<button class="text-sm text-red-600 hover:underline">Salir</button></form>
    </aside>
    <main class="flex-1 p-4 md:p-8 max-w-5xl">
@else
    <main class="max-w-xl mx-auto p-4 md:p-8">
@endisset
        @if (session('ok'))<div class="mb-4 rounded bg-green-100 text-green-800 px-4 py-3 text-sm">{{ session('ok') }}</div>@endif
        @if (session('error'))<div class="mb-4 rounded bg-red-100 text-red-800 px-4 py-3 text-sm">{{ session('error') }}</div>@endif
        @if ($errors->any())<div role="alert" class="mb-4 rounded bg-red-100 text-red-800 px-4 py-3 text-sm"><strong>Revisa estos datos</strong><ul class="list-disc ml-5">@foreach($errors->all() as $error)<li>{{ $error }}</li>@endforeach</ul></div>@endif
        @yield('contenido')
    </main>
@isset($negocioWeb)
</div>
@endisset
@stack('pie')
</body>
</html>
