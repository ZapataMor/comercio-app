@extends('layouts.documento')

@section('titulo', 'Aviso de privacidad')
@section('descripcion', 'Versión corta de la política de tratamiento de datos personales de Vitrina.')
@section('encabezado', 'Aviso de privacidad')
@section('vigencia', 'Vigente desde el 23 de noviembre de 2026.')

@php
    $responsable = config('vitrina.responsable');
    $documento = config('vitrina.documento');
    $correo = config('vitrina.correo_contacto');
    $ciudad = config('vitrina.ciudad');
    $direccion = config('vitrina.direccion');
    $telefono = config('vitrina.telefono');
@endphp

@section('documento')
<p>
    <strong>{{ $responsable }}</strong>@if (filled($documento)) ({{ $documento }})@endif, con domicilio en {{ $ciudad }},
    es el responsable del tratamiento de los datos personales que recoge la app y el sitio <strong>Vitrina</strong>,
    según la Ley 1581 de 2012 y el Decreto 1377 de 2013.
</p>

<ul class="doc-ficha">
    @if (filled($direccion))
        <li><strong>Dirección:</strong> {{ $direccion }}</li>
    @endif
    @if (filled($telefono))
        <li><strong>Teléfono:</strong> {{ $telefono }}</li>
    @endif
    <li><strong>Correo:</strong> <a href="mailto:{{ $correo }}">{{ $correo }}</a></li>
</ul>

<h2>Qué hacemos con tus datos</h2>
<p>
    Usamos tu nombre, celular, correo, direcciones, pedidos y, si eres domiciliario, tu ubicación durante las
    entregas, para crear tu cuenta, llevar tus pedidos, avisarte de su estado, cobrar las membresías de los
    negocios, mejorar el servicio, prevenir fraudes y atender tus solicitudes. El negocio y el domiciliario de cada
    pedido ven solo lo necesario para atenderlo. No vendemos tus datos.
</p>

<h2>Tus derechos</h2>
<p>
    Puedes conocer, actualizar, rectificar y pedir que borremos tus datos, pedir prueba de tu autorización,
    revocarla y presentar quejas ante la Superintendencia de Industria y Comercio. No tienes que responder
    preguntas sobre datos sensibles o de menores de edad.
</p>

<h2>Cómo ejercerlos</h2>
<p>
    Escríbenos a <a href="mailto:{{ $correo }}">{{ $correo }}</a>, entra a <em>Mi perfil</em> en la app o usa la página de
    <a href="{{ route('sitio.contacto') }}">contacto y PQR</a>. Para borrar tu cuenta, ve a
    <a href="{{ route('eliminar-cuenta') }}">eliminar mi cuenta</a>.
</p>

<h2>Política completa</h2>
<p>
    Todos los detalles están en la <a href="{{ route('privacidad') }}">política de tratamiento de datos personales</a>.
    Si la cambiamos, te avisaremos antes de que empiece a regir.
</p>
@endsection
