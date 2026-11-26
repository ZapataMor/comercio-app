@extends('layouts.negocio')
@section('titulo', 'Mi tienda')
@section('contenido')
@php
    $n = $negocioWeb;
    $portada = \App\Support\EditorProducto::urlImagen($n->imagen);
    $usarOld = old('_formulario') === 'tienda';
    $v = fn (string $campo, $valor) => $usarOld ? old($campo, $valor) : $valor;
@endphp

{{-- Portada: la imagen del negocio a lo ancho, con el nombre arriba a la izquierda. --}}
<section @class(['tienda-portada', 'sin-imagen' => ! $portada])>
    @if($portada)<img class="tienda-portada-img" src="{{ $portada }}" alt="">@endif
    <div class="tienda-portada-texto">
        <span class="panel-ceja">Mi tienda</span>
        <h1>{{ $n->nombre }}</h1>
        @if($tiposNegocio->isNotEmpty())<p>{{ $tiposNegocio->implode(' · ') }}</p>@endif
    </div>
    <div class="tienda-portada-pie">
        <span @class(['chip', 'tienda-estado', 'chip-exito' => $n->activo])>{{ \App\Support\HorarioNegocio::estadoTexto($n) }}</span>
        @if($n->resenas_total)<span class="chip tienda-estado">★ {{ $n->resenas_total }} {{ $n->resenas_total === 1 ? 'reseña' : 'reseñas' }}</span>@endif
    </div>
</section>

<section class="bloque">
    <div class="bloque-barra">
        <h2>Información del negocio</h2>
        @if($puedeEditar)<button type="button" class="boton boton-oscuro boton-chico" data-abrir="tienda-editar">Editar información</button>@endif
    </div>
    <dl class="tienda-datos">
        <div class="ancho"><dt>Descripción</dt><dd class="tienda-descripcion">{{ $n->descripcion ?: 'Sin descripción.' }}</dd></div>
        <div><dt>Dirección</dt><dd>{{ $n->direccion ?: '—' }}@if($n->barrio)<span class="apagado"> · {{ $n->barrio }}</span>@endif</dd></div>
        <div><dt>Teléfono</dt><dd>{{ $n->telefono ?: '—' }}</dd></div>
        <div><dt>Tiempo de preparación</dt><dd>{{ $n->tiempo_preparacion }} minutos</dd></div>
        <div><dt>Tipo de negocio</dt><dd>{{ $tiposNegocio->implode(', ') ?: ($n->categoria ?: '—') }}</dd></div>
    </dl>
    <p class="bloque-nota">El horario, la ubicación en el mapa y abrir o cerrar la tienda se cambian en la app.</p>
</section>

@if($puedeEditar)
    <section class="bloque">
        <div class="bloque-barra">
            <h2>Cuentas para transferencias <span class="bloque-cuenta">{{ $cuentas->count() }} de {{ \App\Models\CuentaPago::MAXIMO }}</span></h2>
            @if($cuentas->count() < \App\Models\CuentaPago::MAXIMO)
                <button type="button" class="boton boton-acento boton-chico" data-abrir="cuenta-nueva">+ Agregar cuenta</button>
            @endif
        </div>
        <p class="bloque-texto">Aquí llega el dinero cuando un cliente paga por transferencia: el cliente las ve cuando aceptas su pedido.</p>
        @if($cuentas->isEmpty())
            <div class="cuentas-vacio">
                <p>Todavía no tienes cuentas. Agrega una para que tus clientes puedan pagarte por transferencia.</p>
            </div>
        @else
            <ul class="cuentas">
                @foreach($cuentas as $c)
                    <li class="cuenta" data-tipo="{{ $c->tipo }}">
                        <div class="cuenta-cabeza">
                            <span class="cuenta-marca" aria-hidden="true">{{ mb_strtoupper(mb_substr($c->nombre(), 0, 1)) }}</span>
                            <div>
                                <p class="cuenta-nombre">{{ $c->nombre() }}</p>
                                <p class="cuenta-tipo">{{ $c->tipo_cuenta ? 'Cuenta de '.$c->tipo_cuenta : match ($c->tipo) { 'nequi', 'daviplata' => 'Billetera digital', 'llave' => 'Llave', 'qr' => 'Código QR', default => '' } }}</p>
                            </div>
                            @if($c->qr)
                                <img class="cuenta-qr" src="{{ \App\Support\EditorProducto::urlImagen($c->qr) }}" alt="Código QR de {{ $c->nombre() }}" loading="lazy">
                            @endif
                        </div>
                        <p class="cuenta-numero">{{ $c->numero ?: 'Pago con código QR' }}</p>
                        <p class="cuenta-titular"><span class="apagado">A nombre de</span> {{ $c->titular }}</p>
                        <div class="cuenta-acciones">
                            <button type="button" class="boton boton-claro boton-chico" data-abrir="cuenta-{{ $c->id }}">Editar</button>
                            <button type="button" class="boton boton-chico boton-peligro" data-abrir="eliminar-{{ $c->id }}">Eliminar</button>
                        </div>
                    </li>
                @endforeach
            </ul>
        @endif
    </section>
@endif

@if($puedeEditar)
    {{-- Editar la información y la portada. --}}
    <dialog class="modal modal-solo-edicion modal-mediano" id="tienda-editar" aria-labelledby="tienda-editar-titulo">
        <div class="modal-cabeza">
            <h2 id="tienda-editar-titulo">Editar información</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">
            <form method="POST" enctype="multipart/form-data" class="formulario" action="{{ route('negocio.tienda.guardar') }}">
                @csrf @method('PUT')
                <input type="hidden" name="_formulario" value="tienda">

                <div class="ancho tienda-form-portada">
                    <div class="tienda-form-vista" data-vista-foto>
                        @if($portada)<img src="{{ $portada }}" alt="">@else<span>Sin imagen de portada</span>@endif
                    </div>
                    <label class="campo-panel">Imagen de portada <span class="ayuda">Se ve grande detrás del nombre. Mejor horizontal; JPG o PNG hasta 4 MB.</span>
                        <input type="file" name="imagen" accept="image/*" data-elegir-foto>
                    </label>
                </div>

                <label class="campo-panel ancho">Nombre del negocio<input name="nombre" required maxlength="255" value="{{ $v('nombre', $n->nombre) }}"></label>
                <label class="campo-panel ancho">Descripción<textarea name="descripcion" rows="4" maxlength="2000">{{ $v('descripcion', $n->descripcion) }}</textarea></label>
                <label class="campo-panel">Dirección<input name="direccion" required maxlength="255" value="{{ $v('direccion', $n->direccion) }}" placeholder="Calle 10 # 5-20"></label>
                <label class="campo-panel">Barrio<input name="barrio" required maxlength="100" value="{{ $v('barrio', $n->barrio) }}"></label>
                <label class="campo-panel">Teléfono<input name="telefono" inputmode="tel" value="{{ $v('telefono', $n->telefono) }}" placeholder="3001234567"></label>
                <label class="campo-panel">Tiempo de preparación (minutos)<input name="tiempo_preparacion" type="number" min="5" max="180" required value="{{ $v('tiempo_preparacion', $n->tiempo_preparacion) }}"></label>

                <div class="ancho botonera producto-form-acciones">
                    <button class="boton boton-acento">Guardar cambios</button>
                    <button type="button" class="enlace-boton" data-cerrar>Cancelar</button>
                </div>
            </form>
        </div>
    </dialog>

    <dialog class="modal modal-solo-edicion modal-mediano" id="cuenta-nueva" aria-labelledby="cuenta-nueva-titulo">
        <div class="modal-cabeza">
            <h2 id="cuenta-nueva-titulo">Nueva cuenta</h2>
            <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-edicion">@include('negocio._cuenta_form', ['c' => null])</div>
    </dialog>

    @foreach($cuentas as $c)
        <dialog class="modal modal-solo-edicion modal-mediano" id="cuenta-{{ $c->id }}" aria-labelledby="cuenta-{{ $c->id }}-titulo">
            <div class="modal-cabeza">
                <h2 id="cuenta-{{ $c->id }}-titulo">Editar {{ $c->nombre() }}</h2>
                <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
            </div>
            <div class="modal-edicion">@include('negocio._cuenta_form', ['c' => $c])</div>
        </dialog>

        <dialog class="modal modal-solo-edicion modal-chico" id="eliminar-{{ $c->id }}" aria-labelledby="eliminar-{{ $c->id }}-titulo">
            <div class="modal-cabeza">
                <h2 id="eliminar-{{ $c->id }}-titulo">Eliminar cuenta</h2>
                <button type="button" class="modal-cerrar" data-cerrar aria-label="Cerrar">✕</button>
            </div>
            <div class="modal-edicion">
                <form method="POST" action="{{ route('negocio.cuentas.eliminar', $c->id) }}" class="formulario">
                    @csrf @method('DELETE')
                    <input type="hidden" name="_formulario" value="eliminar-{{ $c->id }}">
                    <p class="ancho">¿Eliminar la cuenta de <strong>{{ $c->nombre() }}</strong>{{ $c->numero ? ' ('.$c->numero.')' : '' }}? Los clientes dejarán de verla; los pedidos ya pagados conservan su copia.</p>
                    <label class="campo-panel ancho">Tu clave de 4 números
                        <input type="password" name="pin" inputmode="numeric" pattern="\d{4}" maxlength="4" required autocomplete="off" placeholder="••••">
                    </label>
                    <div class="ancho botonera">
                        <button class="boton boton-peligro">Eliminar</button>
                        <button type="button" class="enlace-boton" data-cerrar>Cancelar</button>
                    </div>
                </form>
            </div>
        </dialog>
    @endforeach
@endif
@endsection

@push('pie')
<script src="{{ asset('panel-catalogo.js') }}?v={{ filemtime(public_path('panel-catalogo.js')) }}"></script>
<script src="{{ asset('panel-tienda.js') }}?v={{ filemtime(public_path('panel-tienda.js')) }}"></script>
@if($errors->any() || session('error'))
    @php $formulario = preg_replace('/[^0-9a-z-]/', '', (string) old('_formulario')); @endphp
    @if($formulario)
        {{-- Volvió con errores: reabrir ese formulario. --}}
        <script>window.panelCatalogo && window.panelCatalogo.abrir('{{ $formulario === 'tienda' ? 'tienda-editar' : $formulario }}', true);</script>
    @endif
@endif
@endpush
