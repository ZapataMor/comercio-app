<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('titulo', 'Vitrina') - @yield('marca', 'Vitrina')</title>
    <link rel="icon" type="image/svg+xml" href="{{ asset('images/vitrina-mark.svg') }}">
    <link rel="stylesheet" href="{{ asset('brand.css') }}">
    <link rel="stylesheet" href="{{ asset('web-app.css') }}?v={{ filemtime(public_path('web-app.css')) }}">
    <script src="{{ asset('web-theme.js') }}" defer></script>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="web-legacy bg-slate-100 text-slate-800 min-h-screen">

    @auth
    @php $u = auth()->user(); @endphp
    <header class="bg-white border-b shadow-sm">
        <div class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <a href="{{ $u->hasRole('administrador') ? route('admin.panel') : url('/') }}" class="vitrina-header-brand">
                <x-vitrina-logo :height="38" />
                @if ($u->hasRole('administrador'))
                    <span class="vitrina-header-label">Administración</span>
                @endif
            </a>

            <div class="flex items-center gap-3 text-sm shrink-0">
                <span class="text-slate-400 hidden sm:inline">{{ $u->name }}</span>
                <form method="POST" action="{{ route('logout') }}">
                    @csrf
                    <button class="text-red-600 hover:underline">Salir</button>
                </form>
            </div>
        </div>
    </header>
    @endauth

    @guest
        @unless (request()->routeIs('login'))
        <header class="bg-white border-b shadow-sm">
            <div class="max-w-3xl mx-auto px-4 py-3">
                <a href="{{ url('/') }}" class="vitrina-header-brand"><x-vitrina-logo :height="38" /></a>
            </div>
        </header>
        @endunless
    @endguest

    <main class="max-w-3xl mx-auto px-4 py-6">

        {{-- Mensajes flash --}}
        @if (session('ok'))
            <div class="mb-4 rounded-lg bg-green-100 text-green-800 px-4 py-3 text-sm">{{ session('ok') }}</div>
        @endif
        @if (session('error'))
            <div class="mb-4 rounded-lg bg-red-100 text-red-800 px-4 py-3 text-sm">{{ session('error') }}</div>
        @endif

        @yield('contenido')
    </main>

</body>
</html>
