@extends('layouts.app')
@section('titulo', $plantilla->exists ? 'Plantilla · '.$plantilla->nombre : 'Nueva plantilla')
@section('contenido')
@include('admin._nav')
<p><a href="{{ route('admin.gestion') }}">← Vitrina Gestión</a></p>
<h1>{{ $plantilla->exists ? $plantilla->nombre : 'Nueva plantilla' }}</h1>

@php
    $campos = old('campos', collect($plantilla->campos_producto ?? [])->map(fn ($c) => [
        'etiqueta' => $c['etiqueta'], 'tipo' => $c['tipo'], 'unidad' => $c['unidad'] ?? '',
        'opciones' => implode(', ', $c['opciones'] ?? []), 'requerido' => $c['requerido'] ?? false,
    ])->all());
    $campos = array_values($campos);
    for ($i = 0; $i < 3; $i++) { $campos[] = ['etiqueta' => '', 'tipo' => 'texto', 'unidad' => '', 'opciones' => '', 'requerido' => false]; }
    $modulosElegidos = old('modulos', $plantilla->modulos ?? []);
    $tiposElegidos = array_map('intval', old('tipos_negocio', $plantilla->tipos_negocio ?? []));
@endphp

<form method="POST" action="{{ $plantilla->exists ? route('admin.gestion.plantilla-guardar', $plantilla) : route('admin.gestion.plantilla-crear') }}" class="action-form">
    @csrf
    @if($plantilla->exists) @method('PUT') @endif

    <section class="card">
        <h2>Datos</h2>
        <label>Nombre<input name="nombre" required maxlength="80" value="{{ old('nombre', $plantilla->nombre) }}"></label>
        <label>Descripción<textarea name="descripcion" maxlength="500" rows="2">{{ old('descripcion', $plantilla->descripcion) }}</textarea></label>
        <label style="display:flex;gap:8px;align-items:center"><input type="hidden" name="activa" value="0"><input type="checkbox" name="activa" value="1" style="width:auto" @checked(old('activa', $plantilla->exists ? $plantilla->activa : true))> Activa (se puede aplicar a negocios)</label>
    </section>

    <section class="card">
        <h2>Módulos que enciende</h2>
        @foreach($grupos as $grupo => $modulos)
            <p style="margin:8px 0 2px"><strong>{{ \App\Gestion\Modulos::GRUPOS[$grupo] }}</strong></p>
            @foreach($modulos as $clave => $m)
                <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="modulos[]" value="{{ $clave }}" style="width:auto" @checked(in_array($clave, $modulosElegidos, true))> {{ $m['nombre'] }} <span class="muted">{{ $m['depende_de'] ? '(necesita '.collect($m['depende_de'])->map(fn ($d) => \App\Gestion\Modulos::get($d)['nombre'])->join(', ').')' : '' }}</span></label>
            @endforeach
        @endforeach
    </section>

    <section class="card">
        <h2>Tipos de negocio a los que se le sugiere</h2>
        <div style="display:flex;flex-wrap:wrap;gap:4px 16px">
            @foreach($tipos as $t)
                <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" name="tipos_negocio[]" value="{{ $t->id }}" style="width:auto" @checked(in_array($t->id, $tiposElegidos, true))> {{ $t->nombre }}</label>
            @endforeach
        </div>
    </section>

    <section class="card">
        <h2>Ficha técnica de los productos</h2>
        <p class="muted">Campos que el negocio llena en cada producto. Deja la etiqueta vacía para quitar un campo. Las opciones van separadas por comas; la unidad solo aplica a números.</p>
        <div class="table-wrap"><table>
            <thead><tr><th>Etiqueta</th><th>Tipo</th><th>Unidad</th><th>Opciones</th><th>Obligatorio</th></tr></thead>
            <tbody>
            @foreach($campos as $i => $c)
                <tr>
                    <td><input name="campos[{{ $i }}][etiqueta]" value="{{ $c['etiqueta'] }}" maxlength="60"></td>
                    <td><select name="campos[{{ $i }}][tipo]">@foreach($tiposCampo as $valor => $texto)<option value="{{ $valor }}" @selected(($c['tipo'] ?? 'texto') === $valor)>{{ $texto }}</option>@endforeach</select></td>
                    <td><input name="campos[{{ $i }}][unidad]" value="{{ $c['unidad'] ?? '' }}" maxlength="15" style="max-width:80px"></td>
                    <td><input name="campos[{{ $i }}][opciones]" value="{{ $c['opciones'] ?? '' }}" maxlength="500"></td>
                    <td><input type="hidden" name="campos[{{ $i }}][requerido]" value="0"><input type="checkbox" name="campos[{{ $i }}][requerido]" value="1" style="width:auto" @checked($c['requerido'] ?? false)></td>
                </tr>
            @endforeach
            </tbody>
        </table></div>
        <p class="muted">Para más campos, guarda y aparecerán tres filas vacías nuevas.</p>
    </section>

    <button>Guardar plantilla</button>
</form>
@endsection
