@extends('layouts.negocio')
@section('titulo', 'Entrar')
@section('contenido')
<div class="bg-white rounded-lg border p-6 text-center">
    <x-vitrina-logo :height="40" />
    <h1 class="text-xl font-semibold mt-4">Panel web del negocio</h1>
    <p class="text-sm text-slate-600 mt-2">Abre la app Vitrina en tu teléfono, ve a <strong>Mis negocios → Entrar a la web</strong> y escanea este código o escribe las letras.</p>
    <div id="qr" class="flex justify-center my-5" aria-hidden="true"></div>
    <p class="text-3xl font-mono tracking-widest font-bold" id="codigo">{{ $acceso->codigoVisible() }}</p>
    <p class="text-sm text-slate-500 mt-3" id="estado" role="status">El código vence en <span id="restante">{{ $segundos }}</span> segundos.</p>
    <p class="mt-4"><a href="{{ route('negocio.entrar') }}" class="text-teal-700 underline text-sm" id="otro" hidden>Mostrar un código nuevo</a></p>
</div>
<p class="text-xs text-slate-500 mt-4 text-center">No hay contraseña: solo entra quien aprueba el código desde su teléfono de confianza. ¿Eres el administrador de Vitrina? <a class="underline" href="{{ route('login') }}">Entra aquí</a>.</p>
@endsection
@push('pie')
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<script>
(function () {
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
        fetch('{{ route('negocio.entrar.estado') }}', { headers: { 'Accept': 'application/json' }, credentials: 'same-origin' })
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
</script>
@endpush
