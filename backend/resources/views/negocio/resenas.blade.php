@extends('layouts.negocio')
@section('titulo', 'Reseñas')
@section('contenido')
<header class="panel-encabezado">
    <span class="panel-ceja">Núcleo</span>
    <h1>Reseñas</h1>
</header>
<section class="bloque">
    <ul class="filas">
        @forelse($resenas as $r)
            <li class="resena"><span class="estrellas" aria-label="{{ (int) $r->estrellas }} de 5 estrellas">{{ str_repeat('★', (int) $r->estrellas) }}</span> <span class="apagado">{{ $r->created_at?->format('d/m/Y') }}</span><p>{{ $r->comentario ?: 'Sin comentario.' }}</p></li>
        @empty
            <li class="apagado">Sin reseñas.</li>
        @endforelse
    </ul>
    {{ $resenas->links('negocio._paginas') }}
</section>
@endsection
