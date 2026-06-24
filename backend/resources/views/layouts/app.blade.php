<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('titulo', 'Comercio') — Panel</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 text-slate-800 min-h-screen">

    @auth
    @php $u = auth()->user(); @endphp
    <header class="bg-white border-b shadow-sm">
        <div class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <a href="{{ route('home') }}" class="font-bold text-lg text-indigo-600 shrink-0">🛒 Comercio</a>

            <nav class="flex items-center gap-3 text-sm text-slate-600">
                @if ($u->hasRole('usuario'))
                    <a href="{{ route('explorar') }}" class="hover:text-indigo-600">Explorar</a>
                    <a href="{{ route('pedidos') }}" class="hover:text-indigo-600">Mis pedidos</a>
                    @php $nCarrito = $u->carritoItems()->sum('cantidad'); @endphp
                    <a href="{{ route('carrito') }}" class="relative hover:text-indigo-600">
                        🛒
                        @if ($nCarrito > 0)
                            <span class="absolute -top-2 -right-3 bg-indigo-600 text-white text-[10px] rounded-full px-1.5">{{ $nCarrito }}</span>
                        @endif
                    </a>
                @elseif ($u->hasRole('comerciante'))
                    <a href="{{ route('panel') }}" class="hover:text-indigo-600">Mi negocio</a>
                    <a href="{{ route('panel.pedidos') }}" class="hover:text-indigo-600">Pedidos</a>
                @elseif ($u->hasRole('domiciliario'))
                    <a href="{{ route('domiciliario.panel') }}" class="hover:text-indigo-600">Entregas</a>
                @elseif ($u->hasRole('administrador'))
                    <a href="{{ route('admin.panel') }}" class="hover:text-indigo-600">Admin</a>
                @endif
            </nav>

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
