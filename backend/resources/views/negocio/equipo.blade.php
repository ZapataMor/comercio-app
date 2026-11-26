@extends('layouts.negocio')
@section('titulo', 'Equipo')
@section('contenido')
<header class="panel-encabezado">
    <span class="panel-ceja">Negocio</span>
    <h1>Equipo</h1>
    <p>Los permisos de Vitrina (pedidos, catálogo, estado) se cambian en la app. Aquí se dan los permisos de los módulos de gestión que tiene encendidos el negocio.</p>
</header>
@foreach($miembros as $m)
    @php
        $rol = $m->pivot->rol === 'propietario' ? 'Dueño' : ($m->pivot->administrador ? 'Administrador del negocio' : 'Trabajador');
        $todos = $m->pivot->rol === 'propietario' || $m->pivot->administrador;
        $suyos = json_decode($m->pivot->permisos_gestion ?? '[]', true) ?: [];
    @endphp
    <section class="bloque">
        <div class="miembro-cabeza">
            <span class="panel-inicial" aria-hidden="true">{{ mb_strtoupper(mb_substr($m->name, 0, 1)) }}</span>
            <div>
                <h2>{{ $m->name }} <span @class(['chip', 'chip-acento' => $todos])>{{ $rol }}</span></h2>
                <p class="miembro-vitrina">Vitrina: {{ collect(['modificar_inventario' => 'catálogo', 'gestionar_pedidos' => 'pedidos', 'cambiar_estado' => 'abrir y cerrar'])->filter(fn ($t, $p) => $todos || $m->pivot->$p)->join(', ') ?: 'sin permisos' }}</p>
            </div>
        </div>
        @if($todos)
            <p>Tiene todos los permisos de los módulos.</p>
        @elseif(! $asignables)
            <p class="apagado">El negocio no tiene módulos opcionales encendidos.</p>
        @else
            <form method="POST" action="{{ route('negocio.permisos', $m) }}">@csrf @method('PUT')
                <div class="casillas-dos">
                    @foreach($asignables as $permiso => [$modulo, $texto])
                        <label class="casilla"><input type="checkbox" name="permisos[]" value="{{ $permiso }}" @checked(in_array($permiso, $suyos, true)) @disabled(! $puedeEditar)> <span>{{ $texto }} <span class="apagado">· {{ \App\Gestion\Modulos::get($modulo)['nombre'] }}</span></span></label>
                    @endforeach
                </div>
                @if($puedeEditar)<div class="botonera" style="margin-top:18px"><button class="boton boton-oscuro boton-chico">Guardar permisos</button></div>@endif
            </form>
        @endif
    </section>
@endforeach
@endsection
