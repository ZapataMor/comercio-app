{{-- Asociar (sin $m) o editar a un trabajador: sede, cargo, días y horas y permisos. --}}
@php
    use App\Gestion\Horario;
    use App\Http\Controllers\Web\TrabajadoresController;
    $clave = $m ? 'trabajador-'.$m->id : 'asociar';
    $usarOld = old('_formulario') === $clave;
    $esDueno = $m && $m->pivot->rol === 'propietario';
    $esYo = $m && $m->id === auth()->id();
    $conPermisos = ! $esDueno && ! $esYo;
    if ($usarOld) {
        $horario = [];
        foreach ((array) old('dias', []) as $d) {
            $horario[(int) $d] = ['entrada' => old('entrada.'.$d), 'salida' => old('salida.'.$d)];
        }
    } else {
        $horario = $m ? Horario::leer($m->pivot->horario) : null;
    }
    $vitrina = $usarOld ? (array) old('vitrina', []) : ($m ? array_keys(array_filter($m->pivot->only(\App\Models\Negocio::PERMISOS))) : ['gestionar_pedidos']);
    $modulos = $usarOld ? (array) old('modulos', []) : ($m ? (json_decode($m->pivot->permisos_gestion ?? '[]', true) ?: []) : []);
    $sedeActual = (string) ($usarOld ? old('sede_id') : $m?->pivot->sede_id);
@endphp
<form method="POST" class="formulario trabajador-form" action="{{ $m ? route('negocio.equipo.guardar', $m->id) : route('negocio.equipo.invitar') }}" data-trabajador-form>
    @csrf @if($m) @method('PUT') @endif
    <input type="hidden" name="_formulario" value="{{ $clave }}">

    @unless($m)
        <div class="ancho codigo-trabajador">
            <label class="campo-panel">Código del trabajador
                <span class="ayuda">Lo tiene en su app, en su perfil (por ejemplo #U34F4D). Le llega una invitación y queda asociado cuando la acepta.</span>
                <span class="codigo-fila">
                    <input name="codigo" required maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="#U34F4D"
                           value="{{ $usarOld ? old('codigo') : '' }}" data-codigo data-codigo-url="{{ route('negocio.equipo.codigo') }}">
                    <button type="button" class="boton boton-claro boton-chico" data-verificar-codigo>Verificar</button>
                </span>
            </label>
            <div class="codigo-resultado" data-codigo-resultado aria-live="polite" hidden></div>
        </div>
    @endunless

    <label class="campo-panel">Cargo <span class="ayuda">Opcional</span>
        <input name="cargo" maxlength="60" value="{{ $usarOld ? old('cargo') : $m?->pivot->cargo }}" placeholder="Cajero, soldador, mesero…">
    </label>
    @if($sedes->count() > 1)
        <label class="campo-panel">Sede donde trabaja
            <select name="sede_id">
                <option value="">Todas las sedes</option>
                @foreach($sedes as $s)<option value="{{ $s->id }}" @selected($sedeActual === (string) $s->id)>{{ $s->nombre }}{{ $s->principal ? ' (principal)' : '' }}</option>@endforeach
            </select>
        </label>
    @else
        <div class="campo-panel"><span>Sede</span><p class="apagado trabajador-sede-unica">{{ $sedes->first()?->nombre ?? 'Principal' }} <span class="ayuda">· el negocio tiene una sola sede</span></p></div>
    @endif

    <fieldset class="ancho">
        <legend>Días y horas de trabajo <span class="ayuda">Marca los días que viene; la hora es opcional.</span></legend>
        @include('negocio._horario', ['horario' => $horario])
    </fieldset>

    @if($conPermisos)
        <fieldset class="ancho trabajador-permisos">
            <legend>Permisos en Vitrina <span class="ayuda">Lo que puede hacer en la app y aquí.</span></legend>
            <div class="casillas-dos">
                @foreach(TrabajadoresController::PERMISOS_VITRINA as $permiso => $texto)
                    <label class="casilla"><input type="checkbox" name="vitrina[]" value="{{ $permiso }}" @checked(in_array($permiso, $vitrina, true)) @if($permiso === 'administrador') data-administrador @endif> <span>{{ $texto }}</span></label>
                @endforeach
            </div>
        </fieldset>
        @if($asignables)
            <fieldset class="ancho trabajador-permisos" data-permisos-modulos>
                <legend>Permisos de los módulos</legend>
                <div class="casillas-dos">
                    @foreach($asignables as $permiso => [$modulo, $texto])
                        <label class="casilla"><input type="checkbox" name="modulos[]" value="{{ $permiso }}" @checked(in_array($permiso, $modulos, true))> <span>{{ $texto }} <span class="apagado">· {{ \App\Gestion\Modulos::get($modulo)['nombre'] }}</span></span></label>
                    @endforeach
                </div>
            </fieldset>
        @endif
    @else
        <p class="ancho aviso aviso-info">{{ $esDueno ? 'El dueño tiene todos los permisos.' : 'Tus propios permisos no se cambian desde aquí; los cambia el dueño.' }}</p>
    @endif

    <div class="ancho botonera producto-form-acciones">
        <button class="boton boton-oscuro boton-chico">{{ $m ? 'Guardar cambios' : 'Enviar invitación' }}</button>
        <button type="button" class="enlace-boton" @if($m) data-cancelar-edicion @else data-cerrar @endif>Cancelar</button>
    </div>
</form>
