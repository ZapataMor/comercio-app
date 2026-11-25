@extends('layouts.app')
@section('titulo', 'Gestión · '.$negocio->nombre)
@section('contenido')
@include('admin._nav')
<p><a href="{{ route('admin.gestion') }}">← Vitrina Gestión</a> · <a href="{{ route('admin.negocio', $negocio) }}">Ficha del negocio</a></p>
<h1>{{ $negocio->nombre }}</h1>
<p class="muted">Propietario: {{ $negocio->user?->nombre_completo ?? 'sin propietario' }} · {{ $negocio->barrio ?: 'sin barrio' }}</p>

<section class="card">
    <h2>Panel web</h2>
    @if($negocio->gestion_activa)
        <p><span class="badge">Encendido</span> desde {{ $negocio->gestion_activada_at?->format('d/m/Y') }}. Los miembros entran en <code>{{ route('login') }}</code> con el QR desde la app, con WhatsApp o con Google.</p>
    @else
        <p>Apagado. Al encenderlo se crea la sede principal con la dirección del negocio.</p>
    @endif
    <form method="POST" action="{{ route('admin.gestion.panel', $negocio) }}" class="action-form" data-confirm="{{ $negocio->gestion_activa ? '¿Apagar el panel web? Los datos se conservan.' : '¿Encender el panel web para este negocio?' }}">
        @csrf
        <input type="hidden" name="activa" value="{{ $negocio->gestion_activa ? 0 : 1 }}">
        <label>Motivo<input name="motivo" required maxlength="255" placeholder="Ej.: contrató Vitrina Gestión"></label>
        <button>{{ $negocio->gestion_activa ? 'Apagar panel web' : 'Encender panel web' }}</button>
    </form>
</section>

<section class="card">
    <h2>Plantilla</h2>
    <p>Actual: <strong>{{ $negocio->plantillaGestion?->nombre ?? 'ninguna' }}</strong>. Aplicar una plantilla suma sus módulos a los que ya tiene y define la ficha técnica de sus productos.</p>
    <form method="POST" action="{{ route('admin.gestion.aplicar-plantilla', $negocio) }}" class="action-form">
        @csrf
        <label>Plantilla
            <select name="plantilla_gestion_id" required>
                @foreach($plantillas as $p)
                    <option value="{{ $p->id }}" @selected($negocio->plantilla_gestion_id === $p->id)>{{ $p->nombre }}</option>
                @endforeach
            </select>
        </label>
        <button>Aplicar plantilla</button>
    </form>
</section>

<section class="card">
    <h2>Módulos</h2>
    <p class="muted">El núcleo (Inicio, Mi tienda, Catálogo, Pedidos, Equipo, Agenda y Reseñas) siempre viene con el panel. Si marcas un módulo que necesita otro, el otro se enciende solo. Apagar un módulo lo esconde, no borra sus datos.</p>
    <form method="POST" action="{{ route('admin.gestion.modulos', $negocio) }}" class="action-form">
        @csrf
        @foreach($grupos as $grupo => $modulos)
            <fieldset style="border:1px solid #e0e6ed;border-radius:10px;padding:10px 14px;margin-bottom:10px">
                <legend><strong>{{ \App\Gestion\Modulos::GRUPOS[$grupo] }}</strong></legend>
                @foreach($modulos as $clave => $m)
                    <label style="display:flex;gap:8px;align-items:flex-start;margin:6px 0">
                        <input type="checkbox" name="modulos[]" value="{{ $clave }}" @checked(in_array($clave, $encendidos, true)) style="width:auto;margin-top:3px">
                        <span><strong>{{ $m['nombre'] }}</strong>
                            @if($m['estado'] !== 'disponible')<span class="muted">(en construcción)</span>@endif
                            <br><span class="muted">{{ $m['descripcion'] }}@if($m['depende_de']) Necesita: {{ collect($m['depende_de'])->map(fn ($d) => \App\Gestion\Modulos::get($d)['nombre'])->join(', ') }}.@endif</span>
                        </span>
                    </label>
                @endforeach
            </fieldset>
        @endforeach
        <button>Guardar módulos</button>
    </form>
</section>

<section class="card">
    <h2>Sedes</h2>
    <div class="table-wrap"><table>
        <thead><tr><th>Sede</th><th>Tipo</th><th>Dirección</th><th>Factura</th><th>Estado</th></tr></thead>
        <tbody>
        @forelse($negocio->sedes as $s)
            <tr><td>{{ $s->nombre }} @if($s->principal)<span class="badge">Principal</span>@endif</td><td>{{ $s->tipoTexto() }}</td><td>{{ $s->direccion }} {{ $s->barrio ? '· '.$s->barrio : '' }}</td><td>{{ $s->factura ? 'Sí' : 'No' }}</td><td>{{ $s->activa ? 'Activa' : 'Inactiva' }}</td></tr>
        @empty
            <tr><td colspan="5">Sin sedes (se crea la principal al encender el panel).</td></tr>
        @endforelse
        </tbody>
    </table></div>
</section>

<section class="card">
    <h2>Sesiones web abiertas</h2>
    <div class="table-wrap"><table>
        <thead><tr><th>Persona</th><th>Navegador</th><th>Desde</th><th></th></tr></thead>
        <tbody>
        @forelse($accesos as $a)
            <tr>
                <td>{{ $a->user?->nombre_completo }}</td>
                <td>{{ \App\Gestion\AccesosWeb::describirNavegador($a->navegador) }} · {{ $a->ip }}</td>
                <td>{{ $a->usado_at?->format('d/m/Y H:i') }}</td>
                <td><form method="POST" action="{{ route('admin.gestion.cerrar-acceso', [$negocio, $a]) }}" data-confirm="¿Cerrar esta sesión web?">@csrf<button>Cerrar</button></form></td>
            </tr>
        @empty
            <tr><td colspan="4">Nadie tiene la web abierta.</td></tr>
        @endforelse
        </tbody>
    </table></div>
</section>
@endsection
