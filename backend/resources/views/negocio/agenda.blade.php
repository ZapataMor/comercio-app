@extends('layouts.negocio')
@section('titulo', 'Agenda')
@section('contenido')
<header class="panel-encabezado">
    <span class="panel-ceja">Núcleo</span>
    <h1>Agenda</h1>
</header>
<section class="bloque">
    <div class="tabla-scroll">
        <table class="tabla">
            <thead><tr><th>Fecha</th><th>Servicio</th><th>Cliente</th><th>Profesional</th><th>Estado</th></tr></thead>
            <tbody>
            @forelse($citas as $c)
                <tr>
                    <td class="fuerte">{{ $c->inicio?->format('d/m/Y H:i') }}</td>
                    <td>{{ $c->servicio_nombre }}</td>
                    <td>{{ $c->cliente_nombre }}</td>
                    <td>{{ $c->profesional?->name ?? '—' }}</td>
                    <td><span class="chip">{{ ucfirst($c->estado) }}</span></td>
                </tr>
            @empty
                <tr><td colspan="5" class="vacia">Sin citas próximas.</td></tr>
            @endforelse
            </tbody>
        </table>
    </div>
    {{ $citas->links('negocio._paginas') }}
</section>
@endsection
