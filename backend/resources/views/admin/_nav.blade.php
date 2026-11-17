<nav class="admin-nav" aria-label="Administración">
<div class="nav-label">OPERACIÓN</div>
@foreach(['panel'=>'Resumen','usuarios'=>'Usuarios','negocios'=>'Negocios','mapa'=>'Domiciliarios','reportes'=>'Reportes','configuracion'=>'Configuración','auditoria'=>'Registro de acciones'] as $ruta=>$label)
<a href="{{ route('admin.'.$ruta) }}" @class(['selected'=>(request()->routeIs('admin.'.$ruta) || ($ruta==='negocios' && request()->routeIs('admin.negocio*')))]) @if((request()->routeIs('admin.'.$ruta) || ($ruta==='negocios' && request()->routeIs('admin.negocio*')))) aria-current="page" @endif>{{ $label }}</a>
@endforeach
</nav>