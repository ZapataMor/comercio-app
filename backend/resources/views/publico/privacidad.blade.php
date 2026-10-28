@extends('layouts.app')

@section('titulo', 'Política de privacidad')

@section('contenido')
@php
    $responsable = config('vitrina.responsable');
    $correo = config('vitrina.correo_contacto');
    $ciudad = config('vitrina.ciudad');
@endphp
<article class="bg-white rounded-2xl shadow p-6 space-y-4 text-sm leading-relaxed">
    <h1 class="text-xl font-bold">Política de tratamiento de datos personales de Vitrina</h1>
    <p class="text-slate-500">Vigente desde el 28 de octubre de 2026.</p>

    <p>
        Esta política explica cómo <strong>{{ $responsable }}</strong> ({{ $ciudad }}), responsable de la app
        <strong>Vitrina</strong>, recoge, usa y protege tus datos personales, de acuerdo con la Ley 1581 de 2012,
        el Decreto 1377 de 2013 y demás normas colombianas de protección de datos.
    </p>

    <h2 class="font-semibold text-base">1. Qué datos recogemos</h2>
    <ul class="list-disc pl-5 space-y-1">
        <li><strong>De tu cuenta:</strong> nombre, apellidos, correo electrónico, teléfono, dirección y barrio.</li>
        <li><strong>De tus pedidos:</strong> lo que pides, el negocio, la dirección de entrega, el teléfono de contacto, la forma de pago y los estados del pedido.</li>
        <li><strong>Si tienes un negocio:</strong> los datos del negocio y de su catálogo, y quiénes forman su equipo.</li>
        <li><strong>Si eres domiciliario:</strong> las entregas que tomas y sus tiempos.</li>
        <li><strong>De tu teléfono:</strong> un identificador para enviarte notificaciones (Firebase Cloud Messaging).</li>
    </ul>
    <p>No recogemos datos de tarjetas ni de cuentas bancarias: los pagos se hacen en efectivo o por transferencia por fuera de la app.</p>

    <h2 class="font-semibold text-base">2. Para qué los usamos</h2>
    <ul class="list-disc pl-5 space-y-1">
        <li>Crear y proteger tu cuenta.</li>
        <li>Llevar tu pedido: el negocio lo prepara y un domiciliario lo entrega en tu dirección.</li>
        <li>Avisarte del estado de tus pedidos, invitaciones y novedades de tu negocio.</li>
        <li>Medir la calidad del servicio (tiempos, calificaciones) y prevenir abusos o fraudes.</li>
        <li>Atender tus consultas y reclamos.</li>
    </ul>

    <h2 class="font-semibold text-base">3. Con quién los compartimos</h2>
    <ul class="list-disc pl-5 space-y-1">
        <li><strong>El negocio</strong> al que le pides y <strong>el domiciliario</strong> que toma tu pedido ven tu nombre, dirección de entrega y teléfono, solo para atender ese pedido.</li>
        <li><strong>Proveedores técnicos</strong> que nos prestan el servidor y el envío de notificaciones (Google Firebase), bajo sus propias obligaciones de seguridad.</li>
        <li><strong>Autoridades</strong>, solo cuando la ley lo exija.</li>
    </ul>
    <p>No vendemos ni alquilamos tus datos.</p>

    <h2 class="font-semibold text-base">4. Tus derechos</h2>
    <p>Como titular puedes, en cualquier momento y sin costo:</p>
    <ul class="list-disc pl-5 space-y-1">
        <li>Conocer, actualizar y rectificar tus datos (desde <em>Mi perfil</em> en la app o escribiéndonos).</li>
        <li>Pedir prueba de la autorización que nos diste.</li>
        <li>Saber qué uso le hemos dado a tus datos.</li>
        <li>Revocar la autorización y pedir que borremos tus datos, eliminando tu cuenta.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
    </ul>
    <p>
        Escríbenos a <a class="text-indigo-600 underline" href="mailto:{{ $correo }}">{{ $correo }}</a>.
        Respondemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles.
    </p>

    <h2 class="font-semibold text-base">5. Eliminar tu cuenta</h2>
    <p>
        Puedes eliminarla desde la app (<em>Mi perfil → Eliminar mi cuenta</em>) o en
        <a class="text-indigo-600 underline" href="{{ route('eliminar-cuenta') }}">esta página</a>.
        Al hacerlo borramos tu nombre, correo, teléfono, direcciones y sesiones. Conservamos, sin tus datos de
        contacto, el registro de los pedidos ya hechos, porque forma parte de la contabilidad de los negocios.
    </p>

    <h2 class="font-semibold text-base">6. Seguridad y menores de edad</h2>
    <p>
        Tus contraseñas se guardan cifradas y la app se comunica con el servidor por conexión segura (HTTPS).
        Vitrina no está dirigida a menores de 14 años.
    </p>

    <h2 class="font-semibold text-base">7. Cambios a esta política</h2>
    <p>Si cambiamos esta política te avisaremos en la app antes de que empiece a regir.</p>
</article>
@endsection
