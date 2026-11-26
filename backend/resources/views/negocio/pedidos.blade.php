@extends('layouts.negocio')
@section('titulo', 'Pedidos')
@section('contenido')
<header class="panel-encabezado">
    <span class="panel-ceja">Núcleo</span>
    <h1>Pedidos</h1>
    <p>Los pedidos se atienden en la app (con la alarma); aquí se consultan.</p>
</header>
<section class="bloque">
    <div class="tabla-scroll">
        <table class="tabla">
            <thead><tr><th>Código</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th class="numero">Total</th></tr></thead>
            <tbody>
            @forelse($pedidos as $p)
                <tr>
                    <td class="fuerte">{{ $p->codigo ?? '#'.$p->id }}</td>
                    <td>{{ $p->created_at?->format('d/m/Y H:i') }}</td>
                    <td>{{ $p->cliente?->name ?? '—' }}</td>
                    <td><span @class(['chip', 'chip-exito' => $p->estado === 'entregado'])>{{ \App\Models\Pedido::ESTADO_LABEL[$p->estado] ?? $p->estado }}</span></td>
                    <td class="numero fuerte">$ {{ number_format((float) $p->total, 0, ',', '.') }}</td>
                </tr>
            @empty
                <tr><td colspan="5" class="vacia">Sin pedidos.</td></tr>
            @endforelse
            </tbody>
        </table>
    </div>
    {{ $pedidos->links('negocio._paginas') }}
</section>
@endsection
