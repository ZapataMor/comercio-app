@extends('layouts.documento')

@section('titulo', 'Política de privacidad')
@section('descripcion', 'Cómo Vitrina recoge, usa y protege tus datos personales, según la Ley 1581 de 2012.')
@section('encabezado', 'Política de tratamiento de datos personales')
@section('vigencia', 'Vigente desde el 6 de noviembre de 2026 · Última actualización: 23 de noviembre de 2026.')

@php
    $responsable = config('vitrina.responsable');
    $documento = config('vitrina.documento');
    $correo = config('vitrina.correo_contacto');
    $ciudad = config('vitrina.ciudad');
    $direccion = config('vitrina.direccion');
    $telefono = config('vitrina.telefono');
    $indice = [
        'responsable' => 'Responsable',
        'datos' => '1. Qué datos recogemos',
        'finalidades' => '2. Para qué los usamos',
        'compartir' => '3. Con quién los compartimos',
        'derechos' => '4. Tus derechos',
        'procedimiento' => '5. Consultas y reclamos',
        'eliminar' => '6. Eliminar tu cuenta',
        'conservacion' => '7. Cuánto tiempo los guardamos',
        'seguridad' => '8. Seguridad y menores',
        'cambios' => '9. Cambios',
    ];
@endphp

@section('documento')
<p id="responsable">
    Esta política explica cómo <strong>{{ $responsable }}</strong> ({{ $ciudad }}), responsable de la app y del sitio
    <strong>Vitrina</strong>, recoge, usa y protege tus datos personales, de acuerdo con la Ley 1581 de 2012,
    el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás normas colombianas de protección de datos.
</p>

<ul class="doc-ficha">
    <li><strong>Responsable:</strong> {{ $responsable }}</li>
    @if (filled($documento))
        <li><strong>Identificación:</strong> {{ $documento }}</li>
    @endif
    <li><strong>Domicilio:</strong> {{ $ciudad }}</li>
    @if (filled($direccion))
        <li><strong>Dirección:</strong> {{ $direccion }}</li>
    @endif
    @if (filled($telefono))
        <li><strong>Teléfono:</strong> {{ $telefono }}</li>
    @endif
    <li><strong>Correo:</strong> <a href="mailto:{{ $correo }}">{{ $correo }}</a></li>
</ul>

<p>
    Al crear tu cuenta aceptas esta política y autorizas el tratamiento de tus datos para las finalidades descritas
    aquí. Hay una versión corta en el <a href="{{ route('aviso-privacidad') }}">aviso de privacidad</a>.
</p>

<h2 id="datos">1. Qué datos recogemos</h2>
<ul>
    <li><strong>De tu cuenta:</strong> nombre, apellidos, celular, correo electrónico (si lo agregas), dirección y barrio.</li>
    <li><strong>Si entras con Google:</strong> Google nos entrega tu nombre, tu correo y un identificador de tu cuenta de Google, solo cuando tú lo eliges. Nunca recibimos tu contraseña de Google.</li>
    <li><strong>De tus pedidos:</strong> lo que pides, el negocio, la dirección de entrega, las fotos de referencia de la dirección si las agregas, el teléfono de contacto, la forma de pago y los estados del pedido.</li>
    <li><strong>De las devoluciones:</strong> la cuenta (Nequi, Daviplata, banco o llave) que escribes para que el negocio te devuelva una transferencia, y el comprobante que adjunte el negocio.</li>
    <li><strong>Si tienes un negocio:</strong> los datos del negocio y de su catálogo, sus cuentas para recibir transferencias, su ubicación en el mapa y quiénes forman su equipo. Si pagas una membresía, los datos del plan y de cada pago (no los de tu tarjeta).</li>
    <li><strong>Si eres domiciliario:</strong> las entregas que tomas y sus tiempos, el dinero que cobras por cuenta de cada negocio, y tu ubicación GPS mientras estás en turno, llevas una entrega o le debes dinero a un negocio, incluso con la pantalla apagada (la app muestra una notificación fija mientras la comparte).</li>
    <li><strong>De tu teléfono:</strong> un identificador para enviarte notificaciones (Firebase Cloud Messaging).</li>
    <li><strong>Si la app falla:</strong> un informe técnico del error, con el modelo del teléfono, la versión de Android y de la app, y lo que la app estaba haciendo. No incluye tu nombre, tu correo ni tu teléfono.</li>
    <li><strong>Si visitas este sitio:</strong> las cookies necesarias para que funcione (ver la <a href="{{ route('cookies') }}">política de cookies</a>) y los registros técnicos del servidor (dirección IP, fecha y página pedida), que guardamos por seguridad.</li>
</ul>
<p>Si usas el botón de tu ubicación en el mapa, se usa en tu teléfono para mostrarte dónde estás y no se guarda en tu cuenta. Puedes negar el permiso de ubicación; si eres domiciliario, sin él no podrás compartir tu posición durante las entregas.</p>
<p>No recogemos datos de tarjetas: los pedidos se pagan en efectivo o por transferencia por fuera de la app, y las membresías las cobra una pasarela de pagos que trata los datos de tu tarjeta o cuenta bajo su propia política.</p>
<p>No pedimos datos sensibles (salud, origen étnico, creencias, datos biométricos). Si alguno aparece en lo que escribes, como una nota de un pedido, no estás obligado a darlo.</p>

<h2 id="finalidades">2. Para qué los usamos</h2>
<ul>
    <li>Crear y proteger tu cuenta, y verificar tu celular con un código por WhatsApp.</li>
    <li>Llevar tu pedido: el negocio lo prepara y un domiciliario lo entrega en tu dirección.</li>
    <li>Recomendarte en cada tienda los platos que ya pediste varias veces con los mismos ajustes.</li>
    <li>Avisarte del estado de tus pedidos, invitaciones y novedades de tu negocio.</li>
    <li>Medir la calidad del servicio (tiempos, calificaciones) y prevenir abusos o fraudes.</li>
    <li>Publicar las reseñas que escribes de tiendas y productos, con tu nombre y la inicial de tu apellido. Si eliminas tu cuenta, se borra lo que escribiste. Si reportas una reseña, el equipo de Vitrina recibe el reporte, que no se muestra en público; ese equipo puede ocultar reseñas.</li>
    <li>Mostrar en el mapa al domiciliario mientras lleva un pedido.</li>
    <li>Cobrar y llevar el registro de las membresías de los negocios, y emitir sus comprobantes.</li>
    <li>Encontrar y corregir fallas de la app y del sitio.</li>
    <li>Atender tus consultas, peticiones, quejas y reclamos.</li>
    <li>Cumplir obligaciones legales, contables y tributarias.</li>
</ul>
<p>No usamos tus datos para publicidad de terceros ni para crear perfiles que se vendan.</p>

<h2 id="compartir">3. Con quién los compartimos</h2>
<ul>
    <li><strong>El negocio</strong> al que le pides y <strong>el domiciliario</strong> que toma tu pedido ven tu nombre, dirección de entrega y teléfono, solo para atender ese pedido.</li>
    <li><strong>La ubicación del domiciliario</strong> la ve el cliente mientras le lleva su pedido, y el negocio mientras lo lleva o mientras le deba dinero de ese pedido.</li>
    <li><strong>Proveedores técnicos</strong> que nos prestan el servidor, el envío de notificaciones (Google Firebase), los códigos por WhatsApp (Meta), el acceso con tu cuenta de Google, los mapas (OpenFreeMap, con datos de OpenStreetMap: al ver el mapa, tu teléfono les pide las imágenes de la zona y ellos ven tu dirección IP), el cobro de las membresías (la pasarela de pagos) y el reporte de errores (Sentry). Cada uno trata los datos bajo sus propias obligaciones de seguridad.</li>
    <li><strong>Autoridades</strong>, solo cuando la ley lo exija o un juez lo ordene.</li>
</ul>
<p>
    Algunos de esos proveedores (Google, Meta, Sentry) guardan datos en servidores fuera de Colombia, en países
    con niveles adecuados de protección o bajo contratos que la exigen, como permite el artículo 26 de la Ley 1581.
    Al aceptar esta política autorizas esa transferencia.
</p>
<p><strong>No vendemos ni alquilamos tus datos.</strong></p>

<h2 id="derechos">4. Tus derechos</h2>
<p>Como titular puedes, en cualquier momento y sin costo:</p>
<ul>
    <li>Conocer, actualizar y rectificar tus datos (desde <em>Mi perfil</em> en la app o escribiéndonos).</li>
    <li>Pedir prueba de la autorización que nos diste.</li>
    <li>Saber qué uso le hemos dado a tus datos.</li>
    <li>Revocar la autorización y pedir que borremos tus datos, eliminando tu cuenta, salvo cuando la ley nos obligue a conservarlos.</li>
    <li>Presentar quejas ante la Superintendencia de Industria y Comercio, después de haber agotado el trámite con nosotros.</li>
</ul>

<h2 id="procedimiento">5. Consultas y reclamos</h2>
<p>
    Escríbenos a <a href="mailto:{{ $correo }}">{{ $correo }}</a>@if (filled($telefono)) o llámanos al {{ $telefono }}@endif.
    Para atenderte necesitamos tu nombre, el celular o correo de tu cuenta, qué pides y, si es un reclamo, los
    hechos y los documentos que quieras aportar.
</p>
<ul>
    <li><strong>Consultas</strong> (qué datos tenemos y cómo los usamos): respondemos en máximo 10 días hábiles. Si no alcanzamos, te avisamos el motivo y respondemos en máximo 5 días hábiles más.</li>
    <li><strong>Reclamos</strong> (corregir, actualizar, borrar o revocar): respondemos en máximo 15 días hábiles. Si no alcanzamos, te avisamos el motivo y respondemos en máximo 8 días hábiles más. Si falta información, te la pedimos en los 5 días siguientes; si no la envías en 2 meses, entendemos que desististe.</li>
</ul>
<p>Puede hacerlo el titular, sus causahabientes, su representante o apoderado. También puedes usar la página de <a href="{{ route('sitio.contacto') }}">contacto y PQR</a>.</p>

<h2 id="eliminar">6. Eliminar tu cuenta</h2>
<p>
    Puedes eliminarla desde la app (<em>Mi perfil → Eliminar mi cuenta</em>) o en
    <a href="{{ route('eliminar-cuenta') }}">esta página</a>.
    Al hacerlo borramos tu nombre, correo, teléfono, direcciones, reseñas y sesiones. Conservamos, sin tus datos de
    contacto, el registro de los pedidos ya hechos, porque forma parte de la contabilidad de los negocios.
</p>

<h2 id="conservacion">7. Cuánto tiempo los guardamos</h2>
<p>
    Mientras tengas tu cuenta y la necesitemos para las finalidades de esta política. Al eliminarla borramos tus
    datos de contacto; los registros de pedidos y de pagos de membresías se conservan sin ellos durante el tiempo
    que exigen las normas contables y tributarias (hasta 10 años). Los informes de errores y los registros del
    servidor se borran periódicamente.
</p>

<h2 id="seguridad">8. Seguridad y menores de edad</h2>
<p>
    Tu clave de 4 números se guarda cifrada, la app y el sitio se comunican con el servidor por conexión segura
    (HTTPS) y solo el personal autorizado de Vitrina entra al panel de administración, que deja registro de lo que
    hace. Ningún sistema es infalible: si detectamos un incidente que afecte tus datos, te avisaremos y lo
    informaremos a la Superintendencia de Industria y Comercio.
</p>
<p>
    Vitrina no está dirigida a menores de 14 años. Si eres menor de 18, necesitas la autorización de tus padres o
    representante legal para usarla.
</p>

<h2 id="cambios">9. Cambios a esta política</h2>
<p>Si cambiamos esta política te avisaremos en la app y en este sitio antes de que empiece a regir. Si el cambio es sobre las finalidades, te pediremos una nueva autorización.</p>
@endsection
