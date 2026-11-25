<nav class="admin-nav" aria-label="Administración">
<div class="nav-label">OPERACIÓN</div>
@foreach(['panel'=>'Resumen','usuarios'=>'Usuarios','negocios'=>'Negocios','mapa'=>'Domiciliarios','reportes'=>'Reportes','categorias'=>'Categorías','configuracion'=>'Configuración','gestion'=>'Vitrina Gestión','auditoria'=>'Registro de acciones'] as $ruta=>$label)
@php $activa = request()->routeIs('admin.'.$ruta) || ($ruta==='negocios' && request()->routeIs('admin.negocio*')) || ($ruta==='gestion' && request()->routeIs('admin.gestion*')); @endphp
<a href="{{ route('admin.'.$ruta) }}" @class(['selected'=>$activa]) @if($activa) aria-current="page" @endif>{{ $label }}</a>
@endforeach
</nav>