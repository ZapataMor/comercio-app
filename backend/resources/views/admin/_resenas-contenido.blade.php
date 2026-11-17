<form class="filters">@if(isset($contextoNegocio))<input type="hidden" name="seccion" value="resenas">@endif<label>Mostrar<select name="filtro">@foreach(['reportadas'=>'Reportadas','ocultas'=>'Ocultas','todas'=>'Todas'] as $v=>$l)<option value="{{ $v }}" @selected($filtro===$v)>{{ $l }}</option>@endforeach</select></label><button>Filtrar</button></form>
@forelse($resenas as $r)<article class="card"><h2>{{ $r['autor'] }} · {{ $r['estrellas'] }} / 5</h2><p>{{ $r['negocio'] }} · {{ $r['producto'] }} · {{ $r['fecha'] }} · {{ $r['oculta']?'Oculta':'Visible' }}</p><p>{{ $r['comentario'] }}</p>@if($r['respuesta'])<p>Respuesta: {{ $r['respuesta'] }}</p>@endif
@foreach($r['reportes'] as $reporte)<p>{{ $reporte['motivo'] }} ({{ $reporte['cantidad'] }})</p>@endforeach
@include('admin._accion',['accion'=>$r['oculta']?'restaurar':'ocultar','id'=>$r['id'],'label'=>$r['oculta']?'Restaurar':'Ocultar','motivo'=>true])
@if(count($r['reportes']))@include('admin._accion',['accion'=>'descartar-reportes','id'=>$r['id'],'label'=>'Descartar reportes','motivo'=>false])@endif
<details><summary>Historial de moderación</summary>@forelse($r['historial'] as $h)<p>{{ $h['fecha'] }} · {{ $h['admin'] }} · {{ $h['accion'] }} · {{ $h['motivo'] }}</p>@empty<p>Sin acciones previas.</p>@endforelse</details></article>@empty<p class="card">Sin reseñas en esta lista.</p>@endforelse
@include('admin._paginas')
