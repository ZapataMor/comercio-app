@extends('layouts.documento')

@section('titulo', 'Términos y condiciones')
@section('descripcion', 'Las reglas para usar Vitrina como cliente, negocio o domiciliario.')
@section('encabezado', 'Términos y condiciones de uso')
@section('vigencia', 'Vigentes desde el 23 de noviembre de 2026.')

@php
    $responsable = config('vitrina.responsable');
    $documento = config('vitrina.documento');
    $correo = config('vitrina.correo_contacto');
    $ciudad = config('vitrina.ciudad');
    $indice = [
        'que-es' => '1. Qué es Vitrina',
        'cuenta' => '2. Tu cuenta',
        'pedidos' => '3. Pedidos y pagos',
        'clientes' => '4. Si eres cliente',
        'negocios' => '5. Si tienes un negocio',
        'domiciliarios' => '6. Si eres domiciliario',
        'prohibido' => '7. Lo que no está permitido',
        'resenas' => '8. Reseñas y contenido',
        'suspension' => '9. Suspensión de cuentas',
        'responsabilidad' => '10. Responsabilidad',
        'propiedad' => '11. Propiedad intelectual',
        'cambios' => '12. Cambios y ley aplicable',
    ];
@endphp

@section('documento')
<p>
    Estos términos regulan el uso de la app y del sitio <strong>Vitrina</strong>, de
    <strong>{{ $responsable }}</strong>@if (filled($documento)) ({{ $documento }})@endif, con domicilio en {{ $ciudad }}.
    Al crear una cuenta o usar Vitrina los aceptas, junto con la
    <a href="{{ route('privacidad') }}">política de privacidad</a> y las reglas de
    <a href="{{ route('cancelaciones') }}">cancelaciones y devoluciones</a>, que forman parte de ellos.
    Si tienes un negocio con plan pago, también aplican las
    <a href="{{ route('membresia') }}">condiciones de la membresía</a>.
</p>

<p class="doc-nota">
    En pocas palabras: Vitrina es la vitrina donde los negocios de {{ $ciudad }} muestran lo que venden. Tú le
    compras <strong>directamente al negocio</strong>, le pagas a él en efectivo o por transferencia, y un
    domiciliario independiente te lleva el pedido. Vitrina no cobra comisión por pedido ni recibe tu dinero.
</p>

<h2 id="que-es">1. Qué es Vitrina</h2>
<p>
    Vitrina es una plataforma tecnológica que pone en contacto a tres tipos de usuarios: <strong>clientes</strong>,
    que piden; <strong>negocios</strong>, que publican su catálogo y venden; y <strong>domiciliarios</strong>, que
    llevan los pedidos. Vitrina no vende los productos, no los fabrica, no los prepara ni los transporta, y no es
    parte de la compraventa: el contrato de compra es entre el cliente y el negocio, y el de transporte, entre el
    domiciliario y quien lo contrata.
</p>
<p>Usar Vitrina como cliente o domiciliario es gratis. Los negocios pagan una membresía, según los <a href="{{ route('sitio.planes') }}">planes</a> vigentes.</p>

<h2 id="cuenta">2. Tu cuenta</h2>
<ul>
    <li>Te registras con tu celular, que verificamos con un código por WhatsApp, o con tu cuenta de Google, y eliges una clave de 4 números.</li>
    <li>Tus datos deben ser reales y estar al día. Una cuenta es de una sola persona: no la prestes ni la vendas.</li>
    <li>Cuida tu clave. Lo que se haga con tu cuenta se entiende hecho por ti, salvo que nos avises que alguien más entró.</li>
    <li>Debes tener al menos 14 años. Si eres menor de 18, necesitas la autorización de tus padres o representante legal. Para tener un negocio o ser domiciliario debes ser mayor de edad.</li>
    <li>Puedes eliminar tu cuenta cuando quieras desde la app o en <a href="{{ route('eliminar-cuenta') }}">esta página</a>.</li>
</ul>

<h2 id="pedidos">3. Pedidos y pagos</h2>
<ul>
    <li><strong>Precios:</strong> los fija cada negocio. Antes de confirmar ves el total con el valor del domicilio. Si algo se agota o el total cambia, te pedimos que lo confirmes antes de seguir.</li>
    <li><strong>Pago:</strong> en efectivo al domiciliario o por transferencia a las cuentas del negocio que la app te muestra cuando el negocio acepta tu pedido. Vitrina nunca te pedirá que le transfieras a Vitrina ni tus contraseñas bancarias.</li>
    <li><strong>Factura:</strong> si la necesitas, la expide el negocio, que es quien te vende.</li>
    <li><strong>Cancelaciones, devoluciones y ausencias:</strong> se rigen por las reglas de <a href="{{ route('cancelaciones') }}">cancelaciones y devoluciones</a>.</li>
    <li><strong>Garantía:</strong> la calidad, idoneidad y seguridad de los productos, y la garantía legal de la Ley 1480 de 2011, corren por cuenta del negocio. Vitrina te ayuda a reclamar: repórtalo desde el pedido.</li>
</ul>

<h2 id="clientes">4. Si eres cliente</h2>
<ul>
    <li>Da una dirección y un teléfono correctos, y está pendiente cuando llegue el domiciliario.</li>
    <li>Paga el total acordado. Si pagas por transferencia, avisa en la app con <em>Ya pagué</em> solo cuando de verdad lo hayas hecho.</li>
    <li>No hagas pedidos que no piensas recibir ni pedidos a nombre de otra persona sin su permiso.</li>
    <li>Trata con respeto al negocio y al domiciliario.</li>
</ul>

<h2 id="negocios">5. Si tienes un negocio</h2>
<ul>
    <li>Eres el vendedor: respondes por tus productos, precios, información, garantía, facturación y devoluciones ante el cliente, según el Estatuto del Consumidor (Ley 1480 de 2011).</li>
    <li>Publica información cierta: fotos, descripciones, precios finales (con impuestos), horarios y disponibilidad.</li>
    <li>Ten al día los permisos que exige tu actividad (registro mercantil, sanitarios, de manipulación de alimentos y los demás que apliquen).</li>
    <li>Atiende los pedidos que aceptas, avisa a tiempo los faltantes y confirma solo los pagos que de verdad recibiste.</li>
    <li>Las cuentas de transferencia que publicas deben ser tuyas o de tu negocio. Devuelve el dinero en los casos que señalan las reglas de cancelaciones.</li>
    <li>Respondes por las personas de tu equipo a las que das acceso al negocio.</li>
    <li>Usa los datos de los clientes solo para atender sus pedidos: no los guardes para otros fines ni les envíes publicidad sin su autorización.</li>
</ul>

<h2 id="domiciliarios">6. Si eres domiciliario</h2>
<ul>
    <li>Eres independiente: decides cuándo activas tu turno y qué entregas tomas. Usar Vitrina no crea una relación laboral con Vitrina ni con los negocios.</li>
    <li>Cumple las normas de tránsito y ten al día tu licencia, el SOAT y la revisión de tu vehículo si los necesitas. Responde por tu seguridad social como independiente.</li>
    <li>Cuida los pedidos y entrégalos completos y en buen estado en la dirección indicada.</li>
    <li>El dinero en efectivo que cobras es del negocio: entrégaselo según lo que muestra la app.</li>
    <li>Mientras estás en turno, llevas una entrega o le debes dinero a un negocio, la app comparte tu ubicación, como explica la <a href="{{ route('privacidad') }}">política de privacidad</a>.</li>
    <li>Usa los datos del cliente solo para esa entrega.</li>
</ul>

<h2 id="prohibido">7. Lo que no está permitido</h2>
<ul>
    <li>Vender productos ilegales, de contrabando, falsificados, robados o sin los registros que exige la ley; armas, municiones, explosivos o sustancias prohibidas; medicamentos que requieren fórmula médica; animales silvestres.</li>
    <li>Vender bebidas alcohólicas, cigarrillos o productos de tabaco y vapeo a menores de 18 años (Ley 124 de 1994 y Ley 1335 de 2009). El domiciliario puede pedir la cédula y no entregar si la persona es menor.</li>
    <li>Suplantar a otra persona o negocio, crear cuentas falsas o usar datos de terceros sin permiso.</li>
    <li>Hacer pedidos falsos, marcar pagos que no hiciste o confirmar pagos que no recibiste.</li>
    <li>Acosar, amenazar o discriminar a otras personas.</li>
    <li>Intentar entrar a cuentas ajenas, a los sistemas de Vitrina o a datos que no te corresponden; copiar el catálogo o los datos de la app de forma automatizada; o alterar, descompilar o sobrecargar la app.</li>
    <li>Usar Vitrina para cualquier actividad contraria a la ley.</li>
</ul>

<h2 id="resenas">8. Reseñas y contenido</h2>
<ul>
    <li>Las reseñas deben contar tu experiencia real con un pedido. No publiques insultos, amenazas, datos personales de otros, publicidad ni contenido sexual o violento.</li>
    <li>Puedes reportar una reseña desde la app. El equipo de Vitrina revisa los reportes y puede ocultar lo que incumpla estas reglas.</li>
    <li>Los negocios conservan los derechos sobre sus fotos, logos y textos, y autorizan a Vitrina a mostrarlos en la app y en el sitio mientras tengan su negocio publicado. Declaran que tienen permiso para usar lo que suben.</li>
</ul>

<h2 id="suspension">9. Suspensión de cuentas</h2>
<p>
    Si incumples estos términos, Vitrina puede advertirte, ocultar tu contenido, pausar tu negocio o suspender tu
    cuenta, según la gravedad. Te diremos el motivo y podrás explicarnos tu caso escribiendo a
    <a href="mailto:{{ $correo }}">{{ $correo }}</a>. Si hay indicios de un delito, podemos informarlo a las autoridades.
</p>

<h2 id="responsabilidad">10. Responsabilidad</h2>
<ul>
    <li>Trabajamos para que Vitrina funcione siempre, pero puede haber interrupciones por mantenimiento, fallas de internet, del teléfono o de proveedores. Cuando podamos, avisaremos de los mantenimientos.</li>
    <li>Como Vitrina no es parte de la compraventa ni del transporte, el negocio responde por los productos y el domiciliario por la entrega, cada uno en lo suyo. Vitrina responde por el funcionamiento de la plataforma y por el tratamiento de tus datos.</li>
    <li>Nada en estos términos limita los derechos que te da la ley como consumidor.</li>
</ul>

<h2 id="propiedad">11. Propiedad intelectual</h2>
<p>
    El nombre y el logo de Vitrina, el diseño de la app y del sitio y su código son de {{ $responsable }}.
    Te damos permiso para usar la app en tu teléfono para lo que fue hecha; no la copies, modifiques ni
    distribuyas sin autorización.
</p>

<h2 id="cambios">12. Cambios y ley aplicable</h2>
<p>
    Si cambiamos estos términos te avisaremos en la app y en este sitio antes de que empiecen a regir. Si no estás de
    acuerdo, puedes dejar de usar Vitrina y eliminar tu cuenta. Estos términos se rigen por las leyes de Colombia.
    Si tienes una diferencia con nosotros, escríbenos primero a <a href="mailto:{{ $correo }}">{{ $correo }}</a>
    para buscar un arreglo directo; si no lo logramos, puedes acudir a la Superintendencia de Industria y Comercio
    o a los jueces competentes.
</p>
@endsection
