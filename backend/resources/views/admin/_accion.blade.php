<form method="POST" action="{{ route('admin.accion', [$accion, $id ?? 0]) }}" class="action-form" data-confirm="{{ $confirmar ?? '¿Confirmas esta acción?' }}">
@csrf
@if(isset($tipo))<input type="hidden" name="tipo" value="{{ $tipo }}">@endif
@if($motivo ?? false)<label>Motivo<input name="motivo" required maxlength="200" value="{{ old('motivo') }}"></label>@endif
<button>{{ $label }}</button></form>