@extends('layouts.negocio')
@section('titulo', 'Entrar')
@section('contenido')
@php
    $pestanas = ['qr' => 'Código QR', 'whatsapp' => 'WhatsApp', 'google' => 'Google'];
    $campoInput = 'w-full border rounded px-3 py-2 text-center';
    $botonPrincipal = 'w-full bg-slate-900 text-white rounded py-2.5 font-semibold mt-3';
@endphp
<div class="bg-white rounded-lg border p-6">
    <div class="text-center">
        <x-vitrina-logo :height="40" />
        <h1 class="text-xl font-semibold mt-4">Entrar a Vitrina en la web</h1>
        <p class="text-sm text-slate-500 mt-1">Panel del negocio y panel del administrador.</p>
    </div>

    <div class="flex border-b mt-5 text-sm" role="tablist">
        @foreach($pestanas as $clave => $texto)
            <button type="button" role="tab" data-pestana="{{ $clave }}" aria-selected="{{ $pestana === $clave ? 'true' : 'false' }}"
                    class="pestana flex-1 py-2 -mb-px border-b-2 {{ $pestana === $clave ? 'border-slate-900 font-semibold' : 'border-transparent text-slate-500' }}">{{ $texto }}</button>
        @endforeach
    </div>

    {{-- ------------------------------------------------------------ QR --}}
    <section data-panel="qr" @class(['pt-5 text-center', 'hidden' => $pestana !== 'qr'])>
        <p class="text-sm text-slate-600">Abre la app Vitrina, ve a <strong>Mis negocios → Entrar a la web</strong> y escanea este código o escribe las letras.</p>
        <div id="qr" class="flex justify-center my-5" aria-hidden="true"></div>
        <p class="text-3xl font-mono tracking-widest font-bold" id="codigo">{{ $acceso->codigoVisible() }}</p>
        <p class="text-sm text-slate-500 mt-3" id="estado" role="status">El código vence en <span id="restante">{{ $segundos }}</span> segundos.</p>
        <p class="mt-3"><a href="{{ route('login') }}" class="text-teal-700 underline text-sm" id="otro" hidden>Mostrar un código nuevo</a></p>
    </section>

    {{-- ------------------------------------------------------ WhatsApp --}}
    <section data-panel="whatsapp" @class(['pt-5', 'hidden' => $pestana !== 'whatsapp'])>
        @if(! $celular)
            <form method="POST" action="{{ route('login.celular') }}" class="space-y-3">
                @csrf
                <p class="text-sm text-slate-600 text-center">Escribe tu celular y tu clave de 4 números. Te enviaremos un código por WhatsApp.</p>
                <label class="block text-sm">Celular
                    <input name="telefono" inputmode="numeric" autocomplete="tel" maxlength="20" required value="{{ old('telefono') }}" class="{{ $campoInput }}" placeholder="300 123 4567">
                </label>
                <label class="block text-sm">Clave de 4 números
                    <input name="pin" type="password" inputmode="numeric" maxlength="4" required autocomplete="current-password" class="{{ $campoInput }} tracking-widest">
                </label>
                <button class="{{ $botonPrincipal }}">Enviarme el código</button>
            </form>
        @else
            <form method="POST" action="{{ route('login.celular.codigo') }}" class="space-y-3">
                @csrf
                <p class="text-sm text-slate-600 text-center">Escribe el código de 6 números que te llegó por WhatsApp al <strong>{{ $celular['telefono'] }}</strong>.</p>
                @if(! empty($celular['codigo_prueba']))
                    <p class="text-sm text-center rounded bg-amber-50 text-amber-900 px-3 py-2">Modo de pruebas: el código es <strong class="font-mono">{{ $celular['codigo_prueba'] }}</strong></p>
                @endif
                <input name="codigo" inputmode="numeric" maxlength="6" required autofocus autocomplete="one-time-code" class="{{ $campoInput }} text-2xl tracking-widest font-mono" placeholder="000000" aria-label="Código de WhatsApp">
                <button class="{{ $botonPrincipal }}">Entrar</button>
            </form>
            <form method="POST" action="{{ route('login.cancelar') }}" class="text-center mt-2">@csrf<input type="hidden" name="pestana" value="whatsapp"><button class="text-sm text-slate-500 underline">Usar otro celular</button></form>
        @endif
    </section>

    {{-- -------------------------------------------------------- Google --}}
    <section data-panel="google" @class(['pt-5', 'hidden' => $pestana !== 'google'])>
        @if(! $google)
            <p class="text-sm text-slate-600 text-center">Entra con la cuenta de Google que conectaste en la app. Después te pedimos tu clave de 4 números.</p>
            @if($googleClientId)
                <div id="boton-google" class="flex justify-center mt-4"></div>
                <form method="POST" action="{{ route('login.google') }}" id="form-google">@csrf<input type="hidden" name="credential"></form>
            @else
                <p class="text-sm text-center text-slate-500 mt-3">Entrar con Google no está disponible en este servidor.</p>
            @endif
        @else
            <form method="POST" action="{{ route('login.google.clave') }}" class="space-y-3">
                @csrf
                <p class="text-sm text-slate-600 text-center">Hola, <strong>{{ $google['nombre'] }}</strong>{{ $google['correo'] ? ' ('.$google['correo'].')' : '' }}. Escribe tu clave de 4 números.</p>
                <input name="pin" type="password" inputmode="numeric" maxlength="4" required autofocus autocomplete="current-password" class="{{ $campoInput }} text-2xl tracking-widest" aria-label="Clave de 4 números">
                <button class="{{ $botonPrincipal }}">Entrar</button>
            </form>
            <form method="POST" action="{{ route('login.cancelar') }}" class="text-center mt-2">@csrf<input type="hidden" name="pestana" value="google"><button class="text-sm text-slate-500 underline">Usar otra cuenta de Google</button></form>
        @endif
    </section>
</div>

<details class="mt-4 text-sm text-slate-600" @if($errors->has('username')) open @endif>
    <summary class="cursor-pointer text-center">Administrador de Vitrina con usuario y contraseña</summary>
    <form method="POST" action="{{ route('login') }}" class="bg-white rounded-lg border p-4 mt-2 space-y-3">
        @csrf
        <label class="block">Usuario o correo<input name="username" value="{{ old('username') }}" required autocomplete="username" class="w-full border rounded px-3 py-2"></label>
        <label class="block">Contraseña<input type="password" name="password" required autocomplete="current-password" class="w-full border rounded px-3 py-2"></label>
        <button class="w-full border rounded py-2 font-semibold">Entrar al panel del administrador</button>
    </form>
</details>
<p class="text-xs text-slate-500 mt-4 text-center">Cada entrada queda como una sesión web que puedes cerrar desde la app, en Entrar a la web.</p>
@endsection

@push('pie')
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
@if($googleClientId && ! $google)
<script src="https://accounts.google.com/gsi/client" async defer onload="iniciarGoogle()"></script>
@endif
<script>
(function () {
    // Pestañas
    document.querySelectorAll('.pestana').forEach(function (b) {
        b.addEventListener('click', function () {
            document.querySelectorAll('.pestana').forEach(function (o) {
                var activa = o === b;
                o.setAttribute('aria-selected', activa ? 'true' : 'false');
                o.classList.toggle('border-slate-900', activa); o.classList.toggle('font-semibold', activa);
                o.classList.toggle('border-transparent', !activa); o.classList.toggle('text-slate-500', !activa);
            });
            document.querySelectorAll('[data-panel]').forEach(function (p) { p.classList.toggle('hidden', p.dataset.panel !== b.dataset.pestana); });
        });
    });

    // QR: se muestra y se pregunta cada 2 segundos si ya lo aprobaron en la app.
    try { new QRCode(document.getElementById('qr'), { text: 'vitrina-web:{{ $acceso->codigo }}', width: 180, height: 180 }); } catch (e) {}
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
    google.accounts.id.renderButton(document.getElementById('boton-google'), { theme: 'outline', size: 'large', text: 'signin_with', locale: 'es' });
}
</script>
@endpush
