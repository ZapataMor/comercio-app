@extends('layouts.negocio')
@section('titulo', 'Catálogo')
@section('contenido')
<h1 class="text-2xl font-semibold mb-1">Catálogo</h1>
<p class="text-sm text-slate-500 mb-4">Lo que se muestra en Vitrina. La carga en cantidad, la ficha técnica y la importación de Excel llegan en la fase 0.</p>
<section class="bg-white rounded-lg border p-4 mb-4">
    <h2 class="font-semibold mb-2">Ficha técnica {{ $negocioWeb->plantillaGestion ? 'de la plantilla «'.$negocioWeb->plantillaGestion->nombre.'»' : '' }}</h2>
    @if($campos)
        <ul class="text-sm grid md:grid-cols-2 gap-1">
            @foreach($campos as $c)
                <li><strong>{{ $c['etiqueta'] }}</strong>
                    <span class="text-slate-500">· {{ \App\Models\PlantillaGestion::TIPOS_CAMPO[$c['tipo']] ?? $c['tipo'] }}{{ isset($c['unidad']) ? ' ('.$c['unidad'].')' : '' }}{{ isset($c['opciones']) ? ': '.implode(', ', $c['opciones']) : '' }}{{ ! empty($c['requerido']) ? ' · obligatorio' : '' }}</span></li>
            @endforeach
        </ul>
    @else
        <p class="text-sm text-slate-500">Este negocio no tiene ficha técnica (no tiene una plantilla con campos).</p>
    @endif
</section>
<section class="bg-white rounded-lg border p-4 mb-4">
    <h2 class="font-semibold mb-2">Productos ({{ $productos->total() }})</h2>
    <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-500"><th class="py-1">Producto</th><th>Categoría</th><th>Precio</th><th>Disponible</th></tr></thead>
        <tbody>
        @forelse($productos as $p)
            <tr class="border-t"><td class="py-1">{{ $p->nombre }}</td><td>{{ $p->categoria?->nombre ?? '—' }}</td><td>$ {{ number_format((float) $p->precio, 0, ',', '.') }}</td><td>{{ $p->disponible ? 'Sí' : 'Agotado' }}</td></tr>
        @empty
            <tr><td colspan="4" class="text-slate-500 py-2">Sin productos.</td></tr>
        @endforelse
        </tbody>
    </table>
    <div class="mt-2">{{ $productos->links() }}</div>
</section>
<section class="bg-white rounded-lg border p-4">
    <h2 class="font-semibold mb-2">Servicios ({{ $servicios->count() }})</h2>
    <ul class="text-sm space-y-1">
        @forelse($servicios as $s)
            <li>{{ $s->nombre }} · {{ $s->duracion_minutos }} min{{ $s->precio ? ' · $ '.number_format($s->precio, 0, ',', '.') : '' }}</li>
        @empty
            <li class="text-slate-500">Sin servicios.</li>
        @endforelse
    </ul>
</section>
@endsection
