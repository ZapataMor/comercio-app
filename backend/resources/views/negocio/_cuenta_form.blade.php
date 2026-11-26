{{-- Formulario de una cuenta para transferencias (crear o editar). $c = null para una nueva. --}}
@php
    $clave = $c ? 'cuenta-'.$c->id : 'cuenta-nueva';
    $usarOld = old('_formulario') === $clave;
    $v = fn (string $campo, $valor) => $usarOld ? old($campo, $valor) : $valor;
    $tipo = (string) $v('tipo', $c?->tipo ?? 'nequi');
@endphp
<form method="POST" enctype="multipart/form-data" class="formulario cuenta-form" data-cuenta-form
      action="{{ $c ? route('negocio.cuentas.guardar', $c->id) : route('negocio.cuentas.crear') }}">
    @csrf @if($c) @method('PUT') @endif
    <input type="hidden" name="_formulario" value="{{ $clave }}">

    <label class="campo-panel">Tipo de cuenta
        <select name="tipo" required data-tipo-cuenta>
            @foreach(\App\Models\CuentaPago::NOMBRES as $valor => $texto)
                <option value="{{ $valor }}" @selected($tipo === $valor)>{{ $texto === 'Banco' ? 'Otro banco' : $texto }}</option>
            @endforeach
        </select>
    </label>
    <label class="campo-panel" data-cuenta-solo="banco">Nombre del banco
        <input name="banco" maxlength="60" value="{{ $v('banco', $c?->banco) }}" placeholder="Banco de Bogotá">
    </label>
    <label class="campo-panel" data-cuenta-solo="bancolombia banco">Ahorros o corriente
        <select name="tipo_cuenta">
            <option value="">Elige una</option>
            @foreach(\App\Models\CuentaPago::TIPOS_CUENTA as $tc)
                <option value="{{ $tc }}" @selected($v('tipo_cuenta', $c?->tipo_cuenta) === $tc)>{{ ucfirst($tc) }}</option>
            @endforeach
        </select>
    </label>
    <label class="campo-panel ancho">
        <span data-etiqueta-numero>Número</span>
        <input name="numero" maxlength="60" value="{{ $v('numero', $c?->numero) }}" autocomplete="off">
        <span class="ayuda" data-ayuda-qr hidden>Opcional si subes el código QR.</span>
    </label>
    <label class="campo-panel ancho">A nombre de
        <input name="titular" required minlength="3" maxlength="100" value="{{ $v('titular', $c?->titular) }}" placeholder="Nombre completo del titular">
    </label>

    <div class="ancho producto-form-foto" data-cuenta-qr>
        <div class="producto-form-vista cuenta-form-qr" data-vista-foto>
            @if($c?->qr)<img src="{{ \App\Support\EditorProducto::urlImagen($c->qr) }}" alt="">@else<span>Sin QR</span>@endif
        </div>
        <div class="cuenta-form-qr-campos">
            <label class="campo-panel">Código QR <span class="ayuda">Imagen del QR para pagar. Opcional, salvo si el tipo es «Código QR».</span>
                <input type="file" name="qr" accept="image/*" data-elegir-foto>
            </label>
            @if($c?->qr)
                <label class="casilla"><input type="checkbox" name="quitar_qr" value="1" @checked($usarOld && old('quitar_qr'))> Quitar el código QR actual</label>
            @endif
        </div>
    </div>

    <label class="campo-panel ancho cuenta-clave">Tu clave de 4 números
        <input type="password" name="pin" inputmode="numeric" pattern="\d{4}" maxlength="4" required autocomplete="off" placeholder="••••">
        <span class="ayuda">La pedimos para que nadie cambie a dónde llegan tus pagos.</span>
    </label>

    <div class="ancho botonera producto-form-acciones">
        <button class="boton boton-acento">{{ $c ? 'Guardar cambios' : 'Agregar cuenta' }}</button>
        <button type="button" class="enlace-boton" data-cerrar>Cancelar</button>
    </div>
</form>
