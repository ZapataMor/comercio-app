@extends('layouts.documento')

@section('titulo', 'Contacto y PQR')
@section('descripcion', 'Escríbele a Vitrina: peticiones, quejas, reclamos, datos personales y reportes de seguridad.')
@section('etiqueta', 'Ayuda')
@section('encabezado', 'Contacto, peticiones, quejas y reclamos')

@php
    $responsable = config('vitrina.responsable');
    $documento = config('vitrina.documento');
    $correo = config('vitrina.correo_contacto');
    $ciudad = config('vitrina.ciudad');
    $direccion = config('vitrina.direccion');
    $telefono = config('vitrina.telefono');
    $indice = [
        'canales' => 'Canales',
        'responsable' => 'Quién responde',
        'pqr' => 'Cómo enviar una PQR',
        'plazos' => 'Plazos de respuesta',
        'pedidos' => 'Problemas con un pedido',
        'seguridad' => 'Reportar una falla de seguridad',
        'sic' => 'Si no quedas satisfecho',
    ];
@endphp

@section('documento')
<p>Estamos en {{ $ciudad }} y te respondemos en español, por escrito, a cada solicitud.</p>

<div class="canales" id="canales">
    <div class="tarjeta">
        <h3>Correo</h3>
        <p><a href="mailto:{{ $correo }}">{{ $correo }}</a></p>
    </div>
    @if (filled($telefono))
        <div class="tarjeta">
            <h3>Teléfono</h3>
            <p><a href="tel:+57{{ preg_replace('/\D/', '', $telefono) }}">{{ $telefono }}</a></p>
        </div>
    @endif
    <div class="tarjeta">
        <h3>Desde la app</h3>
        <p>Abre el pedido y toca <em>Reportar</em>.</p>
    </div>
</div>

<h2 id="responsable">Quién responde</h2>
<ul class="doc-ficha">
    <li><strong>Responsable:</strong> {{ $responsable }}</li>
    @if (filled($documento))
        <li><strong>Identificación:</strong> {{ $documento }}</li>
    @endif
    @if (filled($direccion))
        <li><strong>Dirección para notificaciones:</strong> {{ $direccion }}</li>
    @endif
    <li><strong>Domicilio:</strong> {{ $ciudad }}</li>
    <li><strong>Correo:</strong> <a href="mailto:{{ $correo }}">{{ $correo }}</a></li>
</ul>

<h2 id="pqr">Cómo enviar una petición, queja o reclamo</h2>
<p>Escríbenos al correo con:</p>
<ol>
    <li>Tu nombre y el celular o correo de tu cuenta.</li>
    <li>Qué tipo de solicitud es: petición, queja, reclamo, consulta o reclamo sobre tus datos personales, retracto de una membresía o sugerencia.</li>
    <li>Qué pasó y qué quieres que hagamos. Si es sobre un pedido, el número del pedido.</li>
    <li>Los documentos o capturas que quieras aportar.</li>
</ol>
<p>Te confirmamos por el mismo medio que la recibimos.</p>

<h2 id="plazos">Plazos de respuesta</h2>
<table class="doc-tabla">
    <thead><tr><th>Solicitud</th><th>Respondemos en</th></tr></thead>
    <tbody>
        <tr><td>Peticiones, quejas y reclamos</td><td>Máximo 15 días hábiles</td></tr>
        <tr><td>Consultas sobre tus datos personales</td><td>Máximo 10 días hábiles</td></tr>
        <tr><td>Reclamos sobre tus datos personales (corregir, borrar, revocar)</td><td>Máximo 15 días hábiles</td></tr>
        <tr><td>Retracto de una membresía</td><td>Te devolvemos el dinero en máximo 30 días calendario</td></tr>
    </tbody>
</table>
<p>Los detalles de cada trámite están en la <a href="{{ route('privacidad') }}#procedimiento">política de privacidad</a> y en las <a href="{{ route('membresia') }}#retracto">condiciones de la membresía</a>.</p>

<h2 id="pedidos">Problemas con un pedido</h2>
<p>
    Quien te vende es el negocio. Si faltó algo, llegó en mal estado o te cobraron de más, repórtalo desde el pedido
    en la app: el negocio y el equipo de Vitrina lo ven y quedan anotados todos los pasos. Lee también las reglas de
    <a href="{{ route('cancelaciones') }}">cancelaciones y devoluciones</a>.
</p>

<h2 id="seguridad">Reportar una falla de seguridad</h2>
<p>
    Si encuentras una vulnerabilidad en la app o en este sitio, escríbenos a <a href="mailto:{{ $correo }}">{{ $correo }}</a>
    con los pasos para reproducirla. Te pedimos no acceder a datos de otras personas, no afectar el servicio y darnos
    tiempo para corregirla antes de contarla. Agradecemos cada reporte hecho de buena fe.
</p>

<h2 id="sic">Si no quedas satisfecho</h2>
<p>
    Puedes acudir a la <a href="https://www.sic.gov.co" target="_blank" rel="noopener">Superintendencia de Industria y Comercio</a>,
    que protege a los consumidores y los datos personales en Colombia.
</p>
@endsection
