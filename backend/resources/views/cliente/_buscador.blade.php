{{-- Barra de búsqueda del cliente. Reutilizable en varias vistas. --}}
<form method="GET" action="{{ route('buscar') }}" class="mb-5">
    <div class="flex gap-2">
        <input type="search" name="q" value="{{ $q ?? '' }}" autofocus
               placeholder="Busca productos, categorías o negocios… (ej: empanada, bebidas)"
               class="flex-1 rounded-xl border border-slate-300 px-4 py-3 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        <button class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl px-5">
            🔍 Buscar
        </button>
    </div>
</form>
