@extends('layouts.app')
@section('titulo', $negocio->nombre)
@section('contenido')
@include('admin._nav')
<p><a href="{{ route('admin.negocios') }}">← Todos los negocios</a></p>
<header class="negocio-ficha-header">
    @include('admin._foto', ['rutaFoto'=>$negocio->imagen, 'textoFoto'=>'Imagen de '.$negocio->nombre, 'claseFoto'=>'negocio-portada'])
    <div><span class="muted">NEGOCIO #{{ $negocio->id }}</span><h1>{{ $negocio->nombre }}</h1>
        <p>{{ \App\Support\HorarioNegocio::estadoTexto($negocio) }} · {{ $negocio->barrio ?: 'Sin barrio' }}</p>
        <p>{{ $negocio->tiposNegocio->pluck('nombre')->join(' · ') ?: $negocio->categoria }}</p>
        @if($negocio->archivado_at)<span class="badge">Archivado</span>@endif
        @if($negocio->desactivado_at)<span class="badge">Desactivado</span>@endif
        @if($negocio->vetado_at)<span class="badge">Vetado</span>@endif
    </div>
</header>
<div class="negocio-tabs" role="navigation" aria-label="Secciones del negocio">
    @foreach(['informacion'=>'Información','productos'=>'Productos ('.$negocio->productos_count.')','servicios'=>'Servicios ('.$negocio->servicios_count.')','pedidos'=>'Pedidos e historial ('.$negocio->pedidos_count.')','resenas'=>'Reseñas','reputacion'=>'Reputación','equipo'=>'Equipo'] as $clave=>$label)
        <a href="{{ route('admin.negocio', [$negocio, 'seccion'=>$clave]) }}" @class(['selected'=>$seccion===$clave]) @if($seccion===$clave) aria-current="page" @endif>{{ $label }}</a>
    @endforeach
</div>

@if($seccion === 'informacion')
    <div class="negocio-info-grid">
        <section class="card"><h2>Información del negocio</h2><p>{{ $negocio->descripcion ?: 'Sin descripción registrada.' }}</p>
            <dl><dt>Dirección</dt><dd>{{ $negocio->direccion ?: 'Sin dirección' }} · {{ $negocio->barrio }}</dd>
                <dt>Teléfono</dt><dd>{{ $negocio->telefono ?: 'Sin teléfono' }}</dd>
                <dt>Propietario</dt><dd>@if($negocio->user)<a href="{{ route('admin.usuario',$negocio->user) }}">{{ $negocio->user->nombre_completo }}</a>@else Sin propietario @endif</dd>
                <dt>Preparación estimada</dt><dd>{{ $negocio->tiempo_preparacion }} minutos</dd>
                <dt>Registrado</dt><dd>{{ $negocio->created_at?->format('d/m/Y H:i') }}</dd>
                <dt>Ubicación</dt><dd>@if($negocio->tieneUbicacion()){{ $negocio->lat }}, {{ $negocio->lng }} · <a href="https://www.openstreetmap.org/?mlat={{ $negocio->lat }}&mlon={{ $negocio->lng }}#map=17/{{ $negocio->lat }}/{{ $negocio->lng }}" target="_blank" rel="noopener noreferrer">Ver ubicación</a>@else Sin ubicación registrada @endif</dd>
            </dl>
        </section>
        <section class="card"><h2>Horario</h2>
            @forelse(array_replace(array_fill_keys(['lun','mar','mie','jue','vie','sab','dom','fes'], null), $negocio->horario ?? []) as $dia=>$horas)
                <div class="negocio-horario"><strong>{{ ['lun'=>'Lunes','mar'=>'Martes','mie'=>'Miércoles','jue'=>'Jueves','vie'=>'Viernes','sab'=>'Sábado','dom'=>'Domingo','fes'=>'Festivos'][$dia] ?? $dia }}</strong>
                    <span>@if($horas){{ $horas['abre'] }} – {{ $horas['cierra'] }}@if(!empty($horas['almuerzo']))<small>Descanso: {{ $horas['almuerzo']['inicio'] }} – {{ $horas['almuerzo']['fin'] }}</small>@endif @else Cerrado @endif</span>
                </div>
            @empty<p>Sin horario configurado.</p>@endforelse
        </section>
    </div>
    <section class="card"><h2>Imagen del negocio</h2><p class="muted">Fotografía registrada en la ficha del negocio.</p>
        @include('admin._foto', ['rutaFoto'=>$negocio->imagen, 'textoFoto'=>$negocio->nombre, 'claseFoto'=>'negocio-foto-grande'])
    </section>
@elseif($seccion === 'productos')
    <h2>Productos e imágenes</h2>
    <div class="negocios-cards">
        @forelse($productos as $producto)
            <article class="negocio-card producto-card">
                @include('admin._foto', ['rutaFoto'=>$producto->imagen, 'textoFoto'=>$producto->nombre, 'claseFoto'=>'producto-foto'])
                <h3>{{ $producto->nombre }}</h3><p>{{ $producto->descripcion }}</p>
                <p><strong>$ {{ number_format($producto->precio,0,',','.') }} COP</strong> / {{ $producto->unidad_medida }}</p>
                <p>{{ $producto->disponible ? 'Disponible' : 'No disponible' }} · {{ $producto->categoria?->nombre ?? 'Sin categoría' }}</p>
                @foreach(['atributos'=>'Opciones','colores'=>'Colores','ingredientes_fijos'=>'Ingredientes fijos'] as $campo=>$label)
                    @if($producto->$campo)<p><strong>{{ $label }}:</strong> {{ implode(' · ', $producto->$campo) }}</p>@endif
                @endforeach
                @if($producto->extras)<details><summary>Extras</summary>@foreach($producto->extras as $extra)<p>{{ $extra['nombre'] }} · $ {{ number_format($extra['precio'] ?? 0,0,',','.') }}</p>@endforeach</details>@endif
            </article>
        @empty<p class="card">Este negocio todavía no tiene productos.</p>@endforelse
    </div>{{ $productos->links() }}
@elseif($seccion === 'servicios')
    <h2>Servicios e imágenes</h2><div class="negocios-cards">
        @forelse($servicios as $servicio)<article class="negocio-card"><h3>{{ $servicio->nombre }}</h3><p>{{ $servicio->descripcion }}</p><p>{{ $servicio->precio === null ? 'Precio a consultar' : '$ '.number_format($servicio->precio,0,',','.').' COP' }} · {{ $servicio->duracion_minutos }} minutos</p><p>{{ $servicio->disponible ? 'Disponible':'No disponible' }} · {{ $servicio->permite_citas ? 'Permite citas':'Sin citas' }}</p>
            <div class="servicio-galeria">@forelse($servicio->galeria ?? [] as $foto)@include('admin._foto', ['rutaFoto'=>$foto,'textoFoto'=>$servicio->nombre,'claseFoto'=>'producto-foto'])@empty<p>Sin imágenes registradas.</p>@endforelse</div>
        </article>@empty<p class="card">Sin servicios registrados.</p>@endforelse
    </div>{{ $servicios->links() }}
@elseif($seccion === 'pedidos')
    <h2>Pedidos e historial de {{ $negocio->nombre }}</h2>
    @include('admin._pedidos-contenido')
@elseif($seccion === 'resenas')
    <h2>Reseñas del negocio y sus productos</h2>
    @include('admin._resenas-contenido')
@elseif($seccion === 'reputacion')
    <h2>Reputación de {{ $negocio->nombre }}</h2>
    @include('admin._reputacion-detalle-contenido')
@elseif($seccion === 'equipo')
    <h2>Equipo del negocio</h2><div class="negocios-cards">
    @forelse($negocio->miembros as $miembro)<article class="card"><h3><a href="{{ route('admin.usuario',$miembro) }}">{{ $miembro->nombre_completo }}</a></h3><p>{{ ucfirst($miembro->pivot->rol) }} · {{ $miembro->pivot->activo ? 'Activo':'Inactivo' }}</p><p>{{ $miembro->telefono }}<br>{{ $miembro->email }}</p><p class="muted">Permisos: {{ collect($negocio->permisosPara($miembro))->filter()->keys()->map(fn($p)=>ucfirst(str_replace('_',' ',$p)))->join(' · ') ?: 'Sin permisos activos' }}</p></article>@empty<p>Sin miembros registrados.</p>@endforelse
    </div>
@endif
@endsection
