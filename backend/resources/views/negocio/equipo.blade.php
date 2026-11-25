@extends('layouts.negocio')
@section('titulo', 'Equipo')
@section('contenido')
<h1 class="text-2xl font-semibold mb-1">Equipo</h1>
<p class="text-sm text-slate-500 mb-4">Los permisos de Vitrina (pedidos, catálogo, estado) se cambian en la app. Aquí se dan los permisos de los módulos de gestión que tiene encendidos el negocio.</p>
@foreach($miembros as $m)
    @php
        $rol = $m->pivot->rol === 'propietario' ? 'Dueño' : ($m->pivot->administrador ? 'Administrador del negocio' : 'Trabajador');
        $todos = $m->pivot->rol === 'propietario' || $m->pivot->administrador;
        $suyos = json_decode($m->pivot->permisos_gestion ?? '[]', true) ?: [];
    @endphp
    <section class="bg-white rounded-lg border p-4 mb-3">
        <h2 class="font-semibold">{{ $m->name }} <span class="text-sm font-normal text-slate-500">· {{ $rol }}</span></h2>
        <p class="text-xs text-slate-500 mb-2">Vitrina: {{ collect(['modificar_inventario' => 'catálogo', 'gestionar_pedidos' => 'pedidos', 'cambiar_estado' => 'abrir y cerrar'])->filter(fn ($t, $p) => $todos || $m->pivot->$p)->join(', ') ?: 'sin permisos' }}</p>
        @if($todos)
            <p class="text-sm">Tiene todos los permisos de los módulos.</p>
        @elseif(! $asignables)
            <p class="text-sm text-slate-500">El negocio no tiene módulos opcionales encendidos.</p>
        @else
            <form method="POST" action="{{ route('negocio.permisos', $m) }}">@csrf @method('PUT')
                <div class="grid md:grid-cols-2 gap-1 text-sm">
                    @foreach($asignables as $permiso => [$modulo, $texto])
                        <label class="flex gap-2 items-start"><input type="checkbox" name="permisos[]" value="{{ $permiso }}" @checked(in_array($permiso, $suyos, true)) @disabled(! $puedeEditar) class="mt-1"> <span>{{ $texto }} <span class="text-slate-400">· {{ \App\Gestion\Modulos::get($modulo)['nombre'] }}</span></span></label>
                    @endforeach
                </div>
                @if($puedeEditar)<button class="mt-3 bg-teal-700 text-white rounded px-3 py-1 text-sm">Guardar permisos</button>@endif
            </form>
        @endif
    </section>
@endforeach
@endsection
