{{-- Navegación del panel de administrador --}}
@php $r = request()->route()->getName(); @endphp
<nav class="flex gap-2 mb-5 text-sm">
    <a href="{{ route('admin.panel') }}"
       class="px-3 py-1.5 rounded-lg {{ $r === 'admin.panel' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50' }}">Tablero</a>
    <a href="{{ route('admin.usuarios') }}"
       class="px-3 py-1.5 rounded-lg {{ $r === 'admin.usuarios' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50' }}">Usuarios</a>
    <a href="{{ route('admin.negocios') }}"
       class="px-3 py-1.5 rounded-lg {{ $r === 'admin.negocios' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50' }}">Negocios</a>
</nav>
