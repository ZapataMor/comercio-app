@extends('layouts.documento')

@section('titulo', 'Condiciones de la membresía')
@section('descripcion', 'Cómo se pagan, renuevan y cancelan los planes de Vitrina para negocios.')
@section('etiqueta', 'Para negocios')
@section('encabezado', 'Condiciones de la membresía')
@section('vigencia', 'Vigentes desde el 23 de noviembre de 2026.')

@php
    $responsable = config('vitrina.responsable');
    $documento = config('vitrina.documento');
    $correo = config('vitrina.correo_contacto');
    $indice = [
        'planes' => '1. Planes y precios',
        'pago' => '2. Cómo se paga',
        'vigencia' => '3. Vigencia y renovación',
        'retracto' => '4. Derecho de retracto',
        'cancelar' => '5. Cancelar el plan',
        'reembolsos' => '6. Reembolsos y reversión',
        'cambios-precio' => '7. Cambios de precio',
        'obligaciones' => '8. Lo que esperamos de tu negocio',
    ];
@endphp

@section('documento')
<p>
    Estas condiciones aplican a los negocios que contratan un plan de Vitrina con <strong>{{ $responsable }}</strong>@if (filled($documento)) ({{ $documento }})@endif.
    Completan los <a href="{{ route('terminos') }}">términos y condiciones</a>, que también debes cumplir.
</p>

<p class="doc-nota">
    Vitrina gana con la membresía, <strong>nunca con tus ventas</strong>: no cobramos comisión por pedido y el
    dinero de tus clientes llega directo a ti.
</p>

<h2 id="planes">1. Planes y precios</h2>
<p>
    Los planes vigentes, lo que incluye cada uno y su precio están en la página de
    <a href="{{ route('sitio.planes') }}">planes</a>. El precio publicado es el valor total que pagas, con los
    impuestos que apliquen. Mientras dure la etapa de lanzamiento, el plan <strong>Piloto</strong> es gratis para los
    primeros negocios; te avisaremos con al menos 30 días de anticipación antes de que termine.
</p>

<h2 id="pago">2. Cómo se paga</h2>
<ul>
    <li>Se paga en este sitio, en el apartado de pagos, entrando con la misma cuenta del negocio en la app. La app de Vitrina no cobra planes.</li>
    <li>El cobro lo hace una pasarela de pagos autorizada en Colombia. Vitrina no ve ni guarda los datos de tu tarjeta o cuenta bancaria.</li>
    <li>Al aprobarse el pago recibes un comprobante. Si nos lo pides y la ley lo exige, te enviamos la factura electrónica.</li>
</ul>

<h2 id="vigencia">3. Vigencia y renovación</h2>
<ul>
    <li>El plan <strong>Mensual</strong> dura un mes y el <strong>Anual</strong>, doce meses, contados desde el día en que se aprueba el pago.</li>
    <li>La renovación no es automática: antes del vencimiento te recordamos que debes pagar el siguiente periodo. Si algún día ofrecemos renovación automática, solo se activará si tú la eliges.</li>
    <li>Si no renuevas, tu negocio deja de mostrarse a los clientes hasta que pagues. Tu catálogo, tu equipo y tu historial se conservan.</li>
    <li>Puedes pasar del plan mensual al anual cuando quieras; el nuevo periodo empieza cuando termina el que ya pagaste.</li>
</ul>

<h2 id="retracto">4. Derecho de retracto</h2>
<p>
    Como la membresía se compra por internet, tienes <strong>5 días hábiles</strong> desde el pago para retractarte
    sin dar explicaciones (artículo 47 de la Ley 1480 de 2011). Escríbenos a
    <a href="mailto:{{ $correo }}">{{ $correo }}</a> con el celular de tu cuenta y te devolvemos todo lo que pagaste,
    sin descuentos, en máximo 30 días calendario.
</p>

<h2 id="cancelar">5. Cancelar el plan</h2>
<p>
    Puedes cancelar cuando quieras: escríbenos o simplemente no renueves. Tu negocio sigue visible hasta el último
    día del periodo que pagaste.
</p>

<h2 id="reembolsos">6. Reembolsos y reversión del pago</h2>
<ul>
    <li>Fuera del retracto, no devolvemos la parte no usada de un periodo que cancelas, salvo en los casos de este punto.</li>
    <li>Si te cobramos dos veces, un valor distinto al publicado o algo que no autorizaste, te devolvemos la diferencia apenas lo confirmemos.</li>
    <li>Si Vitrina deja de prestar el servicio por causas propias, te devolvemos la parte proporcional del periodo que no pudiste usar.</li>
    <li>Si pagaste con tarjeta u otro medio electrónico y fuiste víctima de fraude, la operación no fue solicitada o el servicio no se prestó, puedes pedir la reversión del pago (artículo 51 de la Ley 1480 de 2011): escríbenos y avisa a tu banco dentro de los 5 días hábiles siguientes a cuando lo notaste.</li>
</ul>

<h2 id="cambios-precio">7. Cambios de precio y de planes</h2>
<p>
    Podemos cambiar los precios o lo que incluye cada plan. Te avisaremos con al menos 30 días de anticipación y el
    cambio no afecta el periodo que ya pagaste.
</p>

<h2 id="obligaciones">8. Lo que esperamos de tu negocio</h2>
<p>
    Mantener la información del negocio al día y cumplir los <a href="{{ route('terminos') }}#negocios">términos para negocios</a>.
    Si un negocio incumple de forma grave (por ejemplo, vende productos prohibidos o engaña a los clientes), podemos
    pausarlo o retirarlo sin devolver el periodo pagado, después de explicarle el motivo y escuchar su versión.
</p>
@endsection
