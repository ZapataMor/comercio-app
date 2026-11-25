@extends('layouts.negocio')
@section('titulo', 'Inicio')
@section('contenido')
<h1 class="text-2xl font-semibold mb-4">Inicio</h1>
<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
    @foreach(['Pedidos de hoy' => $pedidosHoy, 'Pedidos en curso' => $enCurso, 'Citas de hoy' => $citasHoy, 'Productos' => $productos] as $titulo => $valor)
        <div class="bg-white rounded-lg border p-4"><p class="text-xs text-slate-500">{{ $titulo }}</p><p class="text-2xl font-semibold">{{ $valor }}</p></div>
    @endforeach
</div>
<div class="grid md:grid-cols-2 gap-4">
    <section class="bg-white rounded-lg border p-4">
        <h2 class="font-semibold mb-2">Sedes ({{ $sedes->count() }})</h2>
        <ul class="text-sm space-y-1">
            @foreach($sedes as $s)
                <li>{{ $s->nombre }} <span class="text-slate-500">· {{ $s->tipoTexto() }}</span> @if($s->principal)<span class="text-xs bg-teal-50 text-teal-800 rounded px-1">principal</span>@endif</li>
            @endforeach
        </ul>
    </section>
    <section class="bg-white rounded-lg border p-4">
        <h2 class="font-semibold mb-2">Módulos del negocio</h2>
        @if($opcionales)
            <ul class="text-sm space-y-1">
                @foreach($opcionales as $m)
                    <li>{{ \App\Gestion\Modulos::get($m)['nombre'] }} <span class="text-slate-500">· {{ \App\Gestion\Modulos::get($m)['estado'] === 'disponible' ? 'funciona' : 'en construcción' }}</span></li>
                @endforeach
            </ul>
        @else
            <p class="text-sm text-slate-500">Solo el núcleo. Vitrina enciende los demás módulos según el plan.</p>
        @endif
        <p class="text-xs text-slate-500 mt-3">Equipo activo: {{ $equipo }} personas.</p>
    </section>
</div>
@endsection
