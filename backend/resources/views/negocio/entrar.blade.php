@extends('layouts.sitio')

@section('titulo', 'Iniciar sesión')
@section('descripcion', 'Entra a Vitrina en la web con el código QR de la app, con WhatsApp o con Google.')

@section('contenido')
@php
    $pestanas = ['qr' => 'Código QR', 'whatsapp' => 'WhatsApp', 'google' => 'Google'];
@endphp
<section class="acceso">
    <div class="acceso-lado">
        <span class="etiqueta">Vitrina en la web</span>
        <h1>Maneja tu negocio desde el computador.</h1>
        <p>Usa la misma cuenta con la que entras a la app de Vitrina.</p>
        <ul class="lista">
            <li>Panel de tu negocio: catálogo, sedes, equipo y módulos de gestión</li>
            <li>Sin contraseñas: entra con el código QR desde la app</li>
            <li>Cierra tus sesiones web cuando quieras desde la app</li>
        </ul>
    </div>

    <div class="acceso-form">
        <div class="caja">
            <h2>Iniciar sesión</h2>
            <p>Elige cómo quieres entrar.</p>

            @if (session('ok'))<p class="acceso-mensaje acceso-ok" role="status">{{ session('ok') }}</p>@endif
            @if (session('error'))<p class="acceso-mensaje acceso-error" role="alert">{{ session('error') }}</p>@endif
            @if ($errors->any())<p class="acceso-mensaje acceso-error" role="alert">{{ $errors->first() }}</p>@endif

            <div class="acceso-pestanas" role="tablist">
                @foreach($pestanas as $clave => $texto)
                    <button type="button" role="tab" data-pestana="{{ $clave }}" aria-selected="{{ $pestana === $clave ? 'true' : 'false' }}" @class(['activa' => $pestana === $clave])>{{ $texto }}</button>
                @endforeach
            </div>

            {{-- ---------------------------------------------------------- QR --}}
            <div data-panel="qr" @class(['acceso-panel', 'oculto' => $pestana !== 'qr'])>
                <p class="acceso-ayuda">Abre la app Vitrina, ve a <strong>Mis negocios → Entrar a la web</strong> y escanea este código o escribe las letras.</p>
                <div id="qr" class="acceso-qr" aria-hidden="true"></div>
                <p class="acceso-codigo" id="codigo">{{ $acceso->codigoVisible() }}</p>
                <p class="acceso-ayuda centro" id="estado" role="status">El código vence en <span id="restante">{{ $segundos }}</span> segundos.</p>
                <p class="centro"><a href="{{ route('login') }}" id="otro" hidden>Mostrar un código nuevo</a></p>
            </div>

            {{-- ---------------------------------------------------- WhatsApp --}}
            <div data-panel="whatsapp" @class(['acceso-panel', 'oculto' => $pestana !== 'whatsapp'])>
                @if(! $celular)
                    <form method="POST" action="{{ route('login.celular') }}">
                        @csrf
                        <p class="acceso-ayuda">Con tu celular y tu clave de 4 números. Te enviaremos un código por WhatsApp.</p>
                        <label class="campo">
                            <span>Celular</span>
                            <div class="campo-tel">
                                <span class="prefijo">+57</span>
                                <input name="telefono" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="20" required value="{{ old('telefono') }}" placeholder="300 000 0000">
                            </div>
                        </label>
                        <label class="campo">
                            <span>Clave</span>
                            <input class="clave" name="pin" type="password" inputmode="numeric" maxlength="4" required autocomplete="current-password" placeholder="••••">
                        </label>
                        <button class="boton boton-oscuro boton-ancho">Enviarme el código</button>
                    </form>
                @else
                    <form method="POST" action="{{ route('login.celular.codigo') }}">
                        @csrf
                        <p class="acceso-ayuda">Escribe el código de 6 números que te llegó por WhatsApp al <strong>{{ $celular['telefono'] }}</strong>.</p>
                        @if(! empty($celular['codigo_prueba']))
                            <p class="aviso">Modo de pruebas: el código es <strong>{{ $celular['codigo_prueba'] }}</strong></p>
                        @endif
                        <label class="campo">
                            <span>Código</span>
                            <input class="clave" name="codigo" inputmode="numeric" maxlength="6" required autofocus autocomplete="one-time-code" placeholder="••••••">
                        </label>
                        <button class="boton boton-oscuro boton-ancho">Entrar</button>
                    </form>
                    <form method="POST" action="{{ route('login.cancelar') }}" class="caja-enlaces">@csrf<input type="hidden" name="pestana" value="whatsapp"><button>Usar otro celular</button></form>
                @endif
            </div>

            {{-- ------------------------------------------------------ Google --}}
            <div data-panel="google" @class(['acceso-panel', 'oculto' => $pestana !== 'google'])>
                @if(! $google)
                    <p class="acceso-ayuda">Con la cuenta de Google que conectaste en la app. Después te pedimos tu clave de 4 números.</p>
                    @if($googleClientId)
                        <div id="boton-google" class="acceso-google"></div>
                        <form method="POST" action="{{ route('login.google') }}" id="form-google">@csrf<input type="hidden" name="credential"></form>
                    @else
                        <p class="aviso">Entrar con Google no está disponible en este servidor.</p>
                    @endif
                @else
                    <form method="POST" action="{{ route('login.google.clave') }}">
                        @csrf
                        <p class="acceso-ayuda">Hola, <strong>{{ $google['nombre'] }}</strong>{{ $google['correo'] ? ' ('.$google['correo'].')' : '' }}. Escribe tu clave de 4 números.</p>
                        <label class="campo">
                            <span>Clave</span>
                            <input class="clave" name="pin" type="password" inputmode="numeric" maxlength="4" required autofocus autocomplete="current-password" placeholder="••••">
                        </label>
                        <button class="boton boton-oscuro boton-ancho">Entrar</button>
                    </form>
                    <form method="POST" action="{{ route('login.cancelar') }}" class="caja-enlaces">@csrf<input type="hidden" name="pestana" value="google"><button>Usar otra cuenta de Google</button></form>
                @endif
            </div>

            <details class="acceso-admin" @if($errors->has('username')) open @endif>
                <summary>Administrador de Vitrina con usuario y contraseña</summary>
                <form method="POST" action="{{ route('login') }}">
                    @csrf
                    <label class="campo"><span>Usuario o correo</span><input name="username" value="{{ old('username') }}" required autocomplete="username"></label>
                    <label class="campo"><span>Contraseña</span><input type="password" name="password" required autocomplete="current-password"></label>
                    <button class="boton boton-claro boton-ancho">Entrar al panel del administrador</button>
                </form>
            </details>

            <p class="caja-legal">
                Al entrar aceptas los <a href="{{ route('terminos') }}">términos</a>, las
                <a href="{{ route('membresia') }}">condiciones de la membresía</a> y la
                <a href="{{ route('privacidad') }}">política de privacidad</a>.
            </p>
        </div>
    </div>
</section>

<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
@if($googleClientId && ! $google)
<script src="https://accounts.google.com/gsi/client" async defer onload="iniciarGoogle()"></script>
@endif
<script>
(function () {
    // Pestañas
    document.querySelectorAll('[data-pestana]').forEach(function (b) {
        b.addEventListener('click', function () {
            document.querySelectorAll('[data-pestana]').forEach(function (o) {
                o.classList.toggle('activa', o === b);
                o.setAttribute('aria-selected', o === b ? 'true' : 'false');
            });
            document.querySelectorAll('[data-panel]').forEach(function (p) { p.classList.toggle('oculto', p.dataset.panel !== b.dataset.pestana); });
        });
    });

    // QR: se muestra y se pregunta cada 2 segundos si ya lo aprobaron en la app.
    try { new QRCode(document.getElementById('qr'), { text: 'vitrina-web:{{ $acceso->codigo }}', width: 184, height: 184, colorDark: '#1F1B16', colorLight: '#FFFFFF' }); } catch (e) {}
    var restante = {{ $segundos }}, estado = document.getElementById('estado'), otro = document.getElementById('otro'), fin = false;
    function terminar(texto) { fin = true; estado.textContent = texto; otro.hidden = false; }
    var reloj = setInterval(function () {
        if (fin) return clearInterval(reloj);
        restante--; var r = document.getElementById('restante'); if (r) r.textContent = Math.max(restante, 0);
        if (restante <= 0) { clearInterval(reloj); terminar('El código venció.'); }
    }, 1000);
    function preguntar() {
        if (fin) return;
        fetch('{{ route('login.estado') }}', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d.estado === 'listo') { fin = true; estado.textContent = 'Listo, entrando…'; window.location = d.url; return; }
                if (d.estado === 'vencido') return terminar('El código venció.');
                if (d.estado === 'rechazado') return terminar(d.mensaje || 'No se pudo entrar.');
                if (d.estado === 'sin_codigo') return terminar('Se perdió el código.');
                setTimeout(preguntar, 2000);
            })
            .catch(function () { setTimeout(preguntar, 4000); });
    }
    setTimeout(preguntar, 2000);
})();

// Google: el botón oficial entrega el token y se envía al servidor con nuestro formulario.
function iniciarGoogle() {
    if (!window.google || !document.getElementById('boton-google')) return;
    google.accounts.id.initialize({
        client_id: @json($googleClientId),
        callback: function (r) { var f = document.getElementById('form-google'); f.credential.value = r.credential; f.submit(); },
    });
    google.accounts.id.renderButton(document.getElementById('boton-google'), { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill', width: 320, locale: 'es' });
}
</script>
@endsection
