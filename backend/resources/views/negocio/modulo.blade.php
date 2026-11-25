@extends('layouts.negocio')
@section('titulo', $modulo['nombre'])
@section('contenido')
<h1 class="text-2xl font-semibold mb-1">{{ $modulo['nombre'] }}</h1>
<p class="text-sm text-slate-600 mb-4">{{ $modulo['descripcion'] }}</p>
<div class="rounded bg-amber-50 text-amber-900 px-4 py-3 text-sm mb-4">Este módulo está en construcción. Así va a estar constituido:</div>
<div class="grid md:grid-cols-2 gap-4">
    <section class="bg-white rounded-lg border p-4">
        <h2 class="font-semibold mb-2">Secciones en la web</h2>
        <ul class="text-sm list-disc ml-5 space-y-1">@foreach($modulo['secciones'] as $s)<li>{{ $s }}</li>@endforeach</ul>
    </section>
    <section class="bg-white rounded-lg border p-4">
        <h2 class="font-semibold mb-2">En la app</h2>
        @if($modulo['en_app'])
            <ul class="text-sm list-disc ml-5 space-y-1">@foreach($modulo['en_app'] as $s)<li>{{ $s }}</li>@endforeach</ul>
        @else
            <p class="text-sm text-slate-500">Solo en la web.</p>
        @endif
    </section>
    <section class="bg-white rounded-lg border p-4">
        <h2 class="font-semibold mb-2">Permisos del módulo</h2>
        <ul class="text-sm space-y-1">
            @foreach($modulo['permisos'] as $clave => $texto)
                <li>{{ in_array($clave, $permisos, true) ? '✓' : '·' }} {{ $texto }}</li>
            @endforeach
        </ul>
        <p class="text-xs text-slate-500 mt-2">✓ = lo tienes tú.</p>
    </section>
    <section class="bg-white rounded-lg border p-4">
        <h2 class="font-semibold mb-2">Necesita</h2>
        <p class="text-sm">{{ collect($modulo['depende_de'])->map(fn ($d) => \App\Gestion\Modulos::get($d)['nombre'])->join(', ') ?: 'Nada más.' }}</p>
    </section>
</div>
@endsection
