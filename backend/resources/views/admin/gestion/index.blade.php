@extends('layouts.app')
@section('titulo', 'Vitrina Gestión')
@section('contenido')
@include('admin._nav')
<h1>Vitrina Gestión</h1>
<p class="muted">Panel web para manejar todo el negocio (ADR-005). Aquí decides a qué negocios se les enciende, con qué plantilla y qué módulos.</p>

<section class="card">
    <h2>Negocios</h2>
    <form method="GET" class="action-form" style="flex-direction:row;flex-wrap:wrap;gap:8px;align-items:end">
        <label>Buscar<input name="q" value="{{ $buscar }}" maxlength="80" placeholder="Nombre del negocio"></label>
        <label>Mostrar
            <select name="filtro">
                <option value="">Todos</option>
                <option value="con-panel" @selected(request('filtro') === 'con-panel')>Solo con panel web</option>
            </select>
        </label>
        <button>Filtrar</button>
    </form>
    <div class="table-wrap"><table>
        <thead><tr><th>Negocio</th><th>Panel web</th><th>Plantilla</th><th>Módulos opcionales</th><th>Sedes</th></tr></thead>
        <tbody>
        @forelse($negocios as $n)
            <tr>
                <td><a href="{{ route('admin.gestion.negocio', $n) }}">{{ $n->nombre }}</a><br><span class="muted">{{ $n->user?->nombre_completo }}</span></td>
                <td>@if($n->gestion_activa)<span class="badge">Encendido</span>@else <span class="muted">Apagado</span>@endif</td>
                <td>{{ $n->plantillaGestion?->nombre ?? '—' }}</td>
                <td>{{ $n->modulos_activos }}</td>
                <td>{{ $n->sedes_activas }}</td>
            </tr>
        @empty
            <tr><td colspan="5">No hay negocios con ese filtro.</td></tr>
        @endforelse
        </tbody>
    </table></div>
    {{ $negocios->links() }}
</section>

<section class="card">
    <h2>Plantillas por tipo de negocio</h2>
    <p class="muted">Una plantilla enciende módulos y define la ficha técnica de los productos.</p>
    <p><a href="{{ route('admin.gestion.plantilla-nueva') }}">+ Nueva plantilla</a></p>
    <div class="table-wrap"><table>
        <thead><tr><th>Plantilla</th><th>Módulos</th><th>Campos de producto</th><th>Negocios</th><th>Estado</th></tr></thead>
        <tbody>
        @forelse($plantillas as $p)
            <tr>
                <td><a href="{{ route('admin.gestion.plantilla', $p) }}">{{ $p->nombre }}</a></td>
                <td>{{ collect($p->modulos)->map(fn ($m) => \App\Gestion\Modulos::get($m)['nombre'] ?? $m)->join(', ') ?: '—' }}</td>
                <td>{{ count($p->campos_producto ?? []) }}</td>
                <td>{{ $p->negocios_count }}</td>
                <td>{{ $p->activa ? 'Activa' : 'Inactiva' }}</td>
            </tr>
        @empty
            <tr><td colspan="5">Sin plantillas.</td></tr>
        @endforelse
        </tbody>
    </table></div>
</section>

<section class="card">
    <h2>Catálogo de módulos</h2>
    <p class="muted">Viven en el código (<code>App\Gestion\Modulos</code>). El núcleo viene con el panel; los demás se encienden por negocio.</p>
    @foreach($grupos as $grupo => $modulos)
        <h3 style="margin-top:16px">{{ \App\Gestion\Modulos::GRUPOS[$grupo] }}</h3>
        <div class="table-wrap"><table>
            <thead><tr><th>Módulo</th><th>Qué trae</th><th>Necesita</th><th>Permisos</th><th>En la app</th><th>Estado</th></tr></thead>
            <tbody>
            @foreach($modulos as $clave => $m)
                <tr>
                    <td><strong>{{ $m['nombre'] }}</strong><br><code>{{ $clave }}</code></td>
                    <td>{{ $m['descripcion'] }}<br><span class="muted">{{ implode(' · ', $m['secciones']) }}</span></td>
                    <td>{{ collect($m['depende_de'])->map(fn ($d) => \App\Gestion\Modulos::get($d)['nombre'])->join(', ') ?: '—' }}</td>
                    <td>{{ implode(' · ', $m['permisos']) ?: '—' }}</td>
                    <td>{{ implode(' · ', $m['en_app']) ?: 'Solo web' }}</td>
                    <td>{{ $m['estado'] === 'disponible' ? 'Funciona' : 'En construcción' }}</td>
                </tr>
            @endforeach
            </tbody>
        </table></div>
    @endforeach
</section>
@endsection
