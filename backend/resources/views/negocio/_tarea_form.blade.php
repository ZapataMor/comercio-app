{{-- Asignar (sin $t) o editar una tarea. Puede ser libre o «atender este pedido». --}}
@php
    $clave = $t ? 'tarea-'.$t->id : 'tarea-nueva';
    $usarOld = old('_formulario') === $clave;
    $v = fn (string $campo, $valor) => $usarOld ? old($campo, $valor) : $valor;
    $tipo = $v('tipo', $t?->pedido_id ? 'pedido' : 'tarea');
    $fechaActual = (string) $v('fecha', $t?->fecha?->format('Y-m-d'));
    $opcionesFecha = $fechas;
    if ($fechaActual !== '' && ! isset($opcionesFecha[$fechaActual])) {
        $opcionesFecha = [$fechaActual => \Illuminate\Support\Carbon::parse($fechaActual)->locale('es')->translatedFormat('l j \d\e F')] + $opcionesFecha;
    }
    $pedidos = $pedidosEnCurso;
    if ($t?->pedido && ! $pedidos->contains('id', $t->pedido_id)) {
        $pedidos = $pedidos->prepend($t->pedido);
    }
@endphp
<form method="POST" class="formulario tarea-form" action="{{ $t ? route('negocio.equipo.tareas.guardar', $t->id) : route('negocio.equipo.tareas.crear') }}" data-tarea-form>
    @csrf @if($t) @method('PUT') @endif
    <input type="hidden" name="_formulario" value="{{ $clave }}">

    <label class="campo-panel ancho">Trabajador
        <select name="user_id" required data-tarea-trabajador>
            <option value="">Elige a quién</option>
            @foreach($todos as $p)<option value="{{ $p->id }}" @selected((string) $v('user_id', $t?->user_id) === (string) $p->id)>{{ $p->name }}{{ $p->pivot->cargo ? ' · '.$p->pivot->cargo : '' }}</option>@endforeach
        </select>
    </label>

    <fieldset class="ancho">
        <legend>¿Qué le asignas?</legend>
        <div class="tarea-tipos">
            <label class="chip-casilla"><input type="radio" name="tipo" value="tarea" @checked($tipo !== 'pedido') data-tarea-tipo><span>Una tarea</span></label>
            <label class="chip-casilla"><input type="radio" name="tipo" value="pedido" @checked($tipo === 'pedido') data-tarea-tipo><span>Atender un pedido</span></label>
        </div>
    </fieldset>

    <label class="campo-panel ancho" data-solo-tipo="pedido">Pedido en curso
        @if($pedidos->isEmpty())
            <span class="apagado">No hay pedidos en curso ahora.</span>
        @else
            <select name="pedido_id">
                <option value="">Elige el pedido</option>
                @foreach($pedidos as $p)
                    <option value="{{ $p->id }}" @selected((string) $v('pedido_id', $t?->pedido_id) === (string) $p->id)>{{ $p->codigo ?? '#'.$p->id }} · {{ $p->cliente?->name ?? 'Cliente' }} · {{ \App\Models\Pedido::ESTADO_LABEL[$p->estado] ?? $p->estado }} · {{ $p->created_at->format('g:i a') }}</option>
                @endforeach
            </select>
        @endif
    </label>

    <label class="campo-panel ancho">
        <span><span data-solo-tipo="tarea">Qué tiene que hacer</span><span data-solo-tipo="pedido">Título <span class="ayuda">Opcional: si lo dejas vacío dice «Atender el pedido …»</span></span></span>
        <input name="titulo" maxlength="150" value="{{ $v('titulo', $t && ! ($t->pedido_id && str_starts_with($t->titulo, 'Atender el pedido')) ? $t->titulo : '') }}" placeholder="Soldar la reja de la casa 12" data-placeholder-tarea="Soldar la reja de la casa 12" data-placeholder-pedido="Atender el pedido" data-tarea-titulo>
    </label>
    <label class="campo-panel ancho">Detalle <span class="ayuda">Opcional</span>
        <textarea name="descripcion" rows="3" maxlength="2000" placeholder="Medidas, materiales, a quién preguntar…">{{ $v('descripcion', $t?->descripcion) }}</textarea>
    </label>
    <label class="campo-panel">Para cuándo
        <select name="fecha">
            <option value="">Sin fecha</option>
            @foreach($opcionesFecha as $valor => $texto)<option value="{{ $valor }}" @selected($fechaActual === $valor)>{{ $texto }}</option>@endforeach
        </select>
    </label>
    <div class="campo-panel casillas">
        <label class="casilla"><input type="checkbox" name="urgente" value="1" @checked($v('urgente', $t?->urgente))> <span>Es urgente</span></label>
    </div>

    <div class="ancho botonera producto-form-acciones">
        <button class="boton boton-oscuro boton-chico">{{ $t ? 'Guardar tarea' : 'Asignar' }}</button>
        <button type="button" class="enlace-boton" @if($t) data-cancelar-edicion @else data-cerrar @endif>Cancelar</button>
    </div>
</form>
