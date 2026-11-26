@extends('layouts.negocio')
@section('titulo', 'Trabajadores')
@section('contenido')
@php
    use App\Gestion\Horario;
    use App\Gestion\Modulos;
    use App\Http\Controllers\Web\TrabajadoresController;
    use App\Models\Pedido;
    $hoy = now();
    $diaHoy = $hoy->isoWeekday();
    $rolDe = fn ($m) => $m->pivot->rol === 'propietario' ? 'Dueño' : ($m->pivot->administrador ? 'Administrador' : 'Trabajador');
    $inicial = fn (?string $n) => mb_strtoupper(mb_substr($n ?: '?', 0, 1));
    $sedeDe = fn ($id) => $id ? $sedes->firstWhere('id', (int) $id) : null;
    $variasSedes = $sedes->count() > 1;
    $trabajanHoy = $todos->filter(fn ($m) => Horario::trabaja(Horario::leer($m->pivot->horario), $hoy))->count();
    $tonoTarea = fn ($t) => match ($t->estado) { 'hecha' => 'chip-exito', 'en_curso' => 'chip-acento', default => '' };
    // Grupo de cada tarea en la pestaña Tareas.
    $grupoTarea = function ($t) {
        if ($t->estado === 'hecha') {
            return 'Hechas';
        }
        if (! $t->fecha) {
            return 'Sin fecha';
        }

        return match (true) {
            $t->fecha->lt(today()) => 'Atrasadas',
            $t->fecha->isToday() => 'Hoy',
            $t->fecha->isTomorrow() => 'Mañana',
            default => 'Próximos días',
        };
    };
    $ordenGrupos = ['Atrasadas', 'Hoy', 'Mañana', 'Próximos días', 'Sin fecha', 'Hechas'];
    $porGrupo = $tareas->groupBy($grupoTarea)->sortBy(fn ($v, $k) => array_search($k, $ordenGrupos, true));
    $fechaCorta = fn ($f) => $f->isToday() ? 'Hoy' : ($f->isTomorrow() ? 'Mañana' : ($f->isYesterday() ? 'Ayer' : $f->copy()->locale('es')->translatedFormat('D j M')));
    $hayFiltroTareas = $estado !== 'pendientes' || $trabajadorFiltro;
@endphp

<header class="panel-encabezado panel-encabezado-fila">
    <div>
        <span class="panel-ceja">Núcleo</span>
        <h1>Trabajadores</h1>
        <p>Las personas del negocio. Se asocian con el código que cada una tiene en su app; toca a alguien para ver su sede, sus días, sus permisos y sus tareas{{ $administra ? ', o para cambiarlos' : '' }}.</p>
    </div>
    <div class="encabezado-acciones">
        @if($administra)
            <button type="button" class="boton boton-acento" data-abrir="asociar" data-solo-pestana="trabajadores" @if($pestana !== 'trabajadores') hidden @endif>+ Asociar trabajador</button>
        @endif
        @if($puedeAsignar)
            <button type="button" class="boton boton-acento" data-abrir="tarea-nueva" data-solo-pestana="tareas" @if($pestana !== 'tareas') hidden @endif>+ Asignar tarea</button>
        @endif
    </div>
</header>

<div class="indicadores trabajadores-indicadores">
    <div class="indicador"><p>Trabajadores</p><strong>{{ $totalTrabajadores }}</strong></div>
    <div class="indicador"><p>Trabajan hoy</p><strong>{{ $trabajanHoy }}</strong></div>
    <div class="indicador"><p>Tareas pendientes</p><strong>{{ $totalPendientes }}</strong></div>
    @if($invitaciones->isNotEmpty())<div class="indicador"><p>Invitaciones sin aceptar</p><strong>{{ $invitaciones->count() }}</strong></div>@endif
</div>

<section class="bloque">
    <div class="catalogo-barra">
        <div class="pestanas" role="tablist" aria-label="Trabajadores">
            <button type="button" role="tab" class="pestana" id="pestana-trabajadores" aria-controls="panel-trabajadores" data-pestana="trabajadores" aria-selected="{{ $pestana === 'trabajadores' ? 'true' : 'false' }}" @if($pestana !== 'trabajadores') tabindex="-1" @endif>
                Trabajadores <span class="bloque-cuenta">{{ $totalTrabajadores }}</span>
            </button>
            <button type="button" role="tab" class="pestana" id="pestana-tareas" aria-controls="panel-tareas" data-pestana="tareas" aria-selected="{{ $pestana === 'tareas' ? 'true' : 'false' }}" @if($pestana !== 'tareas') tabindex="-1" @endif>
                Tareas <span class="bloque-cuenta">{{ $totalPendientes }}</span>
            </button>
        </div>
        @if($variasSedes)
            <form method="GET" class="catalogo-filtros" data-solo-pestana="trabajadores" @if($pestana !== 'trabajadores') hidden @endif>
                <select name="sede" aria-label="Filtrar por sede" onchange="this.form.submit()">
                    <option value="">Todas las sedes</option>
                    @foreach($sedes as $s)<option value="{{ $s->id }}" @selected($sedeFiltro?->id === $s->id)>{{ $s->nombre }}</option>@endforeach
                </select>
                <noscript><button class="boton boton-claro boton-chico">Filtrar</button></noscript>
            </form>
        @endif
        <form method="GET" class="catalogo-filtros" data-solo-pestana="tareas" @if($pestana !== 'tareas') hidden @endif>
            <input type="hidden" name="pestana" value="tareas">
            <select name="estado" aria-label="Filtrar por estado" onchange="this.form.submit()">
                <option value="pendientes" @selected($estado === 'pendientes')>Por hacer</option>
                <option value="hechas" @selected($estado === 'hechas')>Hechas</option>
                <option value="todas" @selected($estado === 'todas')>Todas</option>
            </select>
            <select name="trabajador" aria-label="Filtrar por trabajador" onchange="this.form.submit()">
                <option value="">Todos los trabajadores</option>
                @foreach($todos as $p)<option value="{{ $p->id }}" @selected($trabajadorFiltro === $p->id)>{{ $p->name }}</option>@endforeach
            </select>
            <noscript><button class="boton boton-claro boton-chico">Filtrar</button></noscript>
            @if($hayFiltroTareas)<a class="enlace" href="{{ route('negocio.equipo', ['pestana' => 'tareas']) }}">Quitar filtros</a>@endif
        </form>
    </div>

    {{-- ----------------------------------------------------- Trabajadores --}}
    <div role="tabpanel" id="panel-trabajadores" aria-labelledby="pestana-trabajadores" @if($pestana !== 'trabajadores') hidden @endif>
        @if($miembros->isEmpty())
            <p class="apagado catalogo-vacio">Nadie trabaja en esta sede todavía.</p>
        @else
            <ul class="trabajadores">
                @foreach($miembros as $m)
                    @php
                        $h = Horario::leer($m->pivot->horario);
                        $sede = $sedeDe($m->pivot->sede_id);
                        $suyas = $tareasDe->get($m->id, collect());
                        $horasHoy = Horario::horasDelDia($h, $diaHoy);
                    @endphp
                    <li>
                        <button type="button" class="trabajador" data-abrir="trabajador-{{ $m->id }}" aria-haspopup="dialog">
                            <span class="trabajador-cabeza">
                                <span class="panel-inicial" aria-hidden="true">{{ $inicial($m->name) }}</span>
                                <span class="trabajador-quien">
                                    <span class="trabajador-nombre">{{ $m->name }} {{ $m->apellidos }}</span>
                                    @if($m->pivot->cargo)<span class="trabajador-cargo">{{ $m->pivot->cargo }}</span>@endif
                                </span>
                                <span @class(['chip', 'chip-acento' => $m->pivot->rol === 'propietario' || $m->pivot->administrador])>{{ $rolDe($m) }}</span>
                            </span>
                            <span class="trabajador-semana" aria-label="Días de trabajo: {{ Horario::resumen($h) }}">
                                @foreach(Horario::INICIALES as $d => $letra)
                                    <span @class(['semana-dia', 'si' => isset($h[$d]), 'hoy' => $d === $diaHoy]) title="{{ Horario::DIAS[$d] }}{{ isset($h[$d]) ? '' : ': descansa' }}" aria-hidden="true">{{ $letra }}</span>
                                @endforeach
                                <span class="trabajador-resumen">{{ Horario::resumen($h) }}</span>
                            </span>
                            <span class="trabajador-pie">
                                @if($h === null)
                                    <span class="chip">Sin días definidos</span>
                                @elseif(Horario::trabaja($h, $hoy))
                                    <span class="chip chip-exito">Hoy trabaja{{ $horasHoy ? ' · '.$horasHoy : '' }}</span>
                                @else
                                    <span class="chip">Hoy descansa</span>
                                @endif
                                @if($variasSedes)<span class="trabajador-sede">📍 {{ $sede?->nombre ?? 'Todas las sedes' }}</span>@endif
                                @if($suyas->isNotEmpty())<span class="chip chip-acento trabajador-tareas">{{ $suyas->count() }} {{ $suyas->count() === 1 ? 'tarea' : 'tareas' }}</span>@endif
                            </span>
                        </button>
                    </li>
                @endforeach
            </ul>
        @endif

        @if($invitaciones->isNotEmpty())
            <h2 class="trabajadores-subtitulo">Invitaciones sin aceptar <span class="bloque-cuenta">{{ $invitaciones->count() }}</span></h2>
            <ul class="trabajadores">
                @foreach($invitaciones as $i)
                    @php $h = Horario::leer($i->horario); @endphp
                    <li class="trabajador trabajador-invitado">
                        <span class="trabajador-cabeza">
                            <span class="panel-inicial" aria-hidden="true">{{ $inicial($i->invitado?->name) }}</span>
                            <span class="trabajador-quien">
                                <span class="trabajador-nombre">{{ $i->invitado?->nombre_completo ?? 'Persona' }}</span>
                                <span class="trabajador-cargo">{{ $i->cargo ?: 'Trabajador' }}{{ $variasSedes ? ' · '.($i->sede?->nombre ?? 'Todas las sedes') : '' }}</span>
                            </span>
                            <span class="chip">Pendiente</span>
                        </span>
                        <p class="trabajador-espera">Invitado el {{ $i->created_at->format('d/m/Y') }}. Queda asociado cuando acepte la invitación en su app.</p>
                        <p class="trabajador-resumen">{{ Horario::resumen($h) }}</p>
                        @if($administra)
                            <form method="POST" action="{{ route('negocio.equipo.invitacion.cancelar', $i->id) }}" class="trabajador-pie" data-confirmar="¿Cancelar la invitación de {{ $i->invitado?->name }}?">@csrf @method('DELETE')
                                <button class="boton boton-chico boton-peligro">Cancelar invitación</button>
                            </form>
                        @endif
                    </li>
                @endforeach
            </ul>
        @endif
    </div>

    {{-- ----------------------------------------------------------- Tareas --}}
    <div role="tabpanel" id="panel-tareas" aria-labelledby="pestana-tareas" @if($pestana !== 'tareas') hidden @endif>
        @if($tareas->isEmpty())
            <p class="apagado catalogo-vacio">
                @if($hayFiltroTareas) Ninguna tarea coincide con el filtro.
                @else No hay tareas por hacer.{{ $puedeAsignar ? ' Asigna una con «+ Asignar tarea»: puede ser algo por hacer o atender un pedido en curso.' : '' }}
                @endif
            </p>
        @else
            @foreach($porGrupo as $grupo => $delGrupo)
                <section class="tareas-grupo">
                    <h2 @class(['tareas-grupo-titulo', 'atrasadas' => $grupo === 'Atrasadas'])>{{ $grupo }} <span class="bloque-cuenta">{{ $delGrupo->count() }}</span></h2>
                    <ul class="tareas">
                        @foreach($delGrupo as $t)
                            @php $puedeMarcar = $puedeAsignar || $t->user_id === auth()->id(); @endphp
                            <li @class(['tarea', 'hecha' => $t->estado === 'hecha', 'urgente' => $t->urgente && $t->estado !== 'hecha'])>
                                <button type="button" class="tarea-abrir" data-abrir="tarea-{{ $t->id }}" aria-haspopup="dialog">
                                    <span class="tarea-chips">
                                        <span @class(['chip', $tonoTarea($t)])>{{ $t->estadoTexto() }}</span>
                                        @if($t->urgente && $t->estado !== 'hecha')<span class="chip chip-peligro">Urgente</span>@endif
                                        @if($t->pedido)<span class="chip tarea-pedido">🧾 {{ $t->pedido->codigo ?? '#'.$t->pedido->id }}</span>@endif
                                    </span>
                                    <span class="tarea-titulo">{{ $t->titulo }}</span>
                                    @if($t->descripcion)<span class="tarea-descripcion">{{ $t->descripcion }}</span>@endif
                                    <span class="tarea-quien">
                                        <span class="panel-inicial" aria-hidden="true">{{ $inicial($t->trabajador?->name) }}</span>
                                        <span>{{ $t->trabajador?->name ?? 'Sin trabajador' }}</span>
                                        @if($t->fecha)<span @class(['tarea-fecha', 'atrasada' => $t->atrasada()])>{{ $fechaCorta($t->fecha) }}</span>@endif
                                    </span>
                                </button>
                                @if($puedeMarcar && $t->estado !== 'hecha')
                                    <form method="POST" action="{{ route('negocio.equipo.tareas.estado', $t->id) }}" class="tarea-pie">@csrf @method('PATCH')
                                        @if($t->estado === 'pendiente')
                                            <button class="enlace-boton" name="estado" value="en_curso">Empezar</button>
                                        @endif
                                        <button class="boton boton-claro boton-chico" name="estado" value="hecha">✓ Marcar hecha</button>
                                    </form>
                                @endif
                            </li>
                        @endforeach
                    </ul>
                </section>
            @endforeach
        @endif
    </div>
</section>

{{-- ------------------------------------------- Modal de cada trabajador --}}
@foreach($miembros as $m)
    @php
        $h = Horario::leer($m->pivot->horario);
        $sede = $sedeDe($m->pivot->sede_id);
        $todosLosPermisos = $m->pivot->rol === 'propietario' || $m->pivot->administrador;
        $suyos = json_decode($m->pivot->permisos_gestion ?? '[]', true) ?: [];
        $suyas = $tareasDe->get($m->id, collect());
    @endphp
    <dialog class="modal modal-mediano" id="trabajador-{{ $m->id }}" aria-labelledby="trabajador-{{ $m->id }}-titulo">
        <div class="modal-cabeza">
            <div class="pedido-modal-titulo">
                <h2 id="trabajador-{{ $m->id }}-titulo">{{ $m->name }} {{ $m->apellidos }}</h2>
                <span @class(['chip', 'chip-acento' => $todosLosPermisos])>{{ $rolDe($m) }}</span>
            </div>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>

        <div class="modal-detalle pedido-detalle">
            <div class="trabajador-ficha">
                <span class="panel-inicial" aria-hidden="true">{{ $inicial($m->name) }}</span>
                <div>
                    <p class="trabajador-ficha-cargo">{{ $m->pivot->cargo ?: 'Sin cargo' }}</p>
                    <p class="apagado">Código <strong class="trabajador-codigo">#{{ $m->codigo_publico }}</strong>@if($m->pivot->created_at) · en el negocio desde el {{ $m->pivot->created_at->format('d/m/Y') }}@endif</p>
                    @if($m->telefono)<p><a class="enlace" href="tel:{{ $m->telefono }}">{{ $m->telefono }}</a></p>@endif
                </div>
            </div>

            <div class="pedido-columnas trabajador-columnas">
                <section class="pedido-caja">
                    <h3>Días de trabajo</h3>
                    <p class="trabajador-resumen-grande">{{ Horario::resumen($h) }}</p>
                    <ul class="trabajador-dias">
                        @foreach(Horario::DIAS as $d => $nombre)
                            <li @class(['si' => isset($h[$d]), 'hoy' => $d === $diaHoy])>
                                <span>{{ $nombre }}@if($d === $diaHoy) <small>hoy</small>@endif</span>
                                <strong>{{ isset($h[$d]) ? (Horario::horasDelDia($h, $d) ?? 'Sin hora fija') : 'Descansa' }}</strong>
                            </li>
                        @endforeach
                    </ul>
                    <p class="trabajador-sede-linea">📍 {{ $variasSedes ? ($sede?->nombre ?? 'Todas las sedes') : ($sedes->first()?->nombre ?? 'Sede principal') }}</p>
                </section>

                <section class="pedido-caja">
                    <h3>Permisos</h3>
                    @if($todosLosPermisos)
                        <p>{{ $m->pivot->rol === 'propietario' ? 'Es el dueño: tiene todos los permisos.' : 'Es administrador del negocio: tiene todos los permisos.' }}</p>
                    @else
                        <ul class="trabajador-permisos-lista">
                            @foreach(array_slice(TrabajadoresController::PERMISOS_VITRINA, 0, 3, true) as $permiso => $texto)
                                @php $tiene = (bool) $m->pivot->$permiso; @endphp
                                <li class="permiso"><span @class(['permiso-marca', 'si' => $tiene])>{{ $tiene ? '✓' : '·' }}</span> {{ $texto }}</li>
                            @endforeach
                        </ul>
                        @php $deModulos = array_intersect_key($asignables, array_flip($suyos)); @endphp
                        @if($asignables)
                            <p class="trabajador-modulos-titulo">De los módulos</p>
                            @if($deModulos)
                                <ul class="trabajador-permisos-lista">
                                    @foreach($deModulos as $permiso => [$modulo, $texto])
                                        <li class="permiso"><span class="permiso-marca si">✓</span> <span>{{ $texto }} <span class="apagado">· {{ Modulos::get($modulo)['nombre'] }}</span></span></li>
                                    @endforeach
                                </ul>
                            @else
                                <p class="apagado">Ninguno todavía.</p>
                            @endif
                        @endif
                    @endif
                </section>
            </div>

            <section class="pedido-caja">
                <div class="caja-barra">
                    <h3>Tareas por hacer <span class="bloque-cuenta">{{ $suyas->count() }}</span></h3>
                    @if($puedeAsignar)<button type="button" class="boton boton-claro boton-chico" data-abrir="tarea-nueva" data-para="{{ $m->id }}">+ Asignarle una tarea</button>@endif
                </div>
                @if($suyas->isEmpty())
                    <p class="apagado">No tiene tareas por hacer.</p>
                @else
                    <ul class="trabajador-tareas-lista">
                        @foreach($suyas as $t)
                            <li>
                                <button type="button" class="trabajador-tarea" data-abrir="tarea-{{ $t->id }}">
                                    <span @class(['chip', $tonoTarea($t)])>{{ $t->estadoTexto() }}</span>
                                    <span class="trabajador-tarea-titulo">{{ $t->titulo }}</span>
                                    @if($t->urgente)<span class="chip chip-peligro">Urgente</span>@endif
                                    @if($t->fecha)<span @class(['tarea-fecha', 'atrasada' => $t->atrasada()])>{{ $fechaCorta($t->fecha) }}</span>@endif
                                </button>
                            </li>
                        @endforeach
                    </ul>
                @endif
            </section>

            @if($administra)
                <div class="detalle-acciones">
                    <button type="button" class="boton boton-oscuro boton-chico" data-editar>Editar sede, días y permisos</button>
                    @if($m->pivot->rol !== 'propietario' && $m->id !== auth()->id())
                        <form method="POST" action="{{ route('negocio.equipo.quitar', $m->id) }}" data-confirmar="¿Quitar a {{ $m->name }} del negocio? Deja de ver los pedidos y sus tareas por hacer se borran.">@csrf @method('DELETE')
                            <button class="boton boton-chico boton-peligro">Quitar del negocio</button>
                        </form>
                    @endif
                </div>
            @endif
        </div>

        @if($administra)
            <div class="modal-edicion">
                <h2>Editar a {{ $m->name }}</h2>
                @include('negocio._trabajador_form', ['m' => $m])
            </div>
        @endif
    </dialog>
@endforeach

{{-- ---------------------------------------------- Modal de cada tarea --}}
@php $conModal = $tareas->concat($tareasDe->flatten())->unique('id'); @endphp
@foreach($conModal as $t)
    @php $puedeMarcar = $puedeAsignar || $t->user_id === auth()->id(); @endphp
    <dialog class="modal modal-mediano" id="tarea-{{ $t->id }}" aria-labelledby="tarea-{{ $t->id }}-titulo">
        <div class="modal-cabeza">
            <div class="pedido-modal-titulo">
                <span @class(['chip', $tonoTarea($t)])>{{ $t->estadoTexto() }}</span>
                @if($t->urgente && $t->estado !== 'hecha')<span class="chip chip-peligro">Urgente</span>@endif
                @if($t->atrasada())<span class="chip chip-peligro">Atrasada</span>@endif
            </div>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-detalle pedido-detalle">
            <h2 id="tarea-{{ $t->id }}-titulo" class="tarea-modal-titulo">{{ $t->titulo }}</h2>
            @if($t->descripcion)<p class="detalle-descripcion">{{ $t->descripcion }}</p>@endif

            @if($puedeMarcar)
                <form method="POST" action="{{ route('negocio.equipo.tareas.estado', $t->id) }}" class="tarea-estados" role="group" aria-label="Estado de la tarea">@csrf @method('PATCH')
                    @foreach(\App\Models\TareaTrabajo::ESTADOS as $valor => $texto)
                        <button name="estado" value="{{ $valor }}" @class(['tarea-estado', 'activo' => $t->estado === $valor]) @if($t->estado === $valor) aria-pressed="true" disabled @else aria-pressed="false" @endif>{{ $valor === 'hecha' ? '✓ ' : '' }}{{ $texto }}</button>
                    @endforeach
                </form>
            @endif

            <dl class="detalle-datos tarea-datos">
                <dt>Trabajador</dt><dd>{{ $t->trabajador?->name ?? '—' }}{{ $t->trabajador ? ' '.$t->trabajador->apellidos : '' }}</dd>
                <dt>Para cuándo</dt><dd>{{ $t->fecha ? ucfirst($t->fecha->copy()->locale('es')->translatedFormat('l j \d\e F')) : 'Sin fecha' }}</dd>
                @if($variasSedes)<dt>Sede</dt><dd>{{ $t->sede?->nombre ?? 'Todas las sedes' }}</dd>@endif
                @if($t->pedido)
                    <dt>Pedido</dt>
                    <dd>
                        <strong class="pedido-codigo">{{ $t->pedido->codigo ?? '#'.$t->pedido->id }}</strong>
                        <span class="chip">{{ Pedido::ESTADO_LABEL[$t->pedido->estado] ?? $t->pedido->estado }}</span>
                        <span>{{ $t->pedido->cliente?->name ?? 'Cliente' }} · $ {{ number_format((float) $t->pedido->total, 0, ',', '.') }}</span>
                        <a class="enlace" href="{{ route('negocio.pedidos', ['buscar' => $t->pedido->codigo]) }}">Ver el pedido</a>
                    </dd>
                @endif
                <dt>Asignada por</dt><dd>{{ $t->creador?->name ?? '—' }} · {{ $t->created_at->format('d/m/Y g:i a') }}</dd>
                @if($t->hecha_at)<dt>Hecha</dt><dd>{{ $t->hecha_at->format('d/m/Y g:i a') }}</dd>@endif
            </dl>

            @if($puedeAsignar)
                <div class="detalle-acciones">
                    <button type="button" class="boton boton-oscuro boton-chico" data-editar>Editar</button>
                    <form method="POST" action="{{ route('negocio.equipo.tareas.eliminar', $t->id) }}" data-confirmar="¿Eliminar la tarea «{{ $t->titulo }}»?">@csrf @method('DELETE')
                        <button class="boton boton-chico boton-peligro">Eliminar</button>
                    </form>
                </div>
            @endif
        </div>
        @if($puedeAsignar)
            <div class="modal-edicion">
                <h2>Editar la tarea</h2>
                @include('negocio._tarea_form', ['t' => $t])
            </div>
        @endif
    </dialog>
@endforeach

@if($administra)
    <dialog class="modal modal-solo-edicion modal-mediano" id="asociar" aria-labelledby="asociar-titulo">
        <div class="modal-cabeza">
            <h2 id="asociar-titulo">Asociar un trabajador</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">@include('negocio._trabajador_form', ['m' => null])</div>
    </dialog>
@endif

@if($puedeAsignar)
    <dialog class="modal modal-solo-edicion modal-mediano" id="tarea-nueva" aria-labelledby="tarea-nueva-titulo">
        <div class="modal-cabeza">
            <h2 id="tarea-nueva-titulo">Asignar una tarea</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">@include('negocio._tarea_form', ['t' => null])</div>
    </dialog>
@endif
@endsection

@push('pie')
<script src="{{ asset('panel-catalogo.js') }}?v={{ filemtime(public_path('panel-catalogo.js')) }}"></script>
<script src="{{ asset('panel-trabajadores.js') }}?v={{ filemtime(public_path('panel-trabajadores.js')) }}"></script>
@php $formulario = preg_replace('/[^0-9a-z-]/', '', (string) old('_formulario')); @endphp
@if(($errors->any() || session('error')) && $formulario)
    <script>window.panelCatalogo && window.panelCatalogo.abrir('{{ $formulario }}', true);</script>
@endif
@endpush
