@extends('layouts.negocio')
@section('titulo', 'Reseñas')
@section('contenido')
<h1 class="text-2xl font-semibold mb-4">Reseñas</h1>
<section class="bg-white rounded-lg border p-4">
    <ul class="text-sm divide-y">
        @forelse($resenas as $r)
            <li class="py-2"><strong>{{ str_repeat('★', (int) $r->estrellas) }}</strong> <span class="text-slate-500">{{ $r->created_at?->format('d/m/Y') }}</span><br>{{ $r->comentario ?: 'Sin comentario.' }}</li>
        @empty
            <li class="text-slate-500 py-2">Sin reseñas.</li>
        @endforelse
    </ul>
    <div class="mt-2">{{ $resenas->links() }}</div>
</section>
@endsection
