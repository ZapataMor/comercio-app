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
    <header class="bg-white border-b shadow-sm">
        <div class="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="{{ route('home') }}" class="font-bold text-lg text-indigo-600">🛒 Comercio</a>
            <div class="flex items-center gap-3 text-sm">
                <span class="text-slate-500">{{ auth()->user()->name }}</span>
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
