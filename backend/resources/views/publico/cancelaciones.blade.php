@extends('layouts.documento')

@section('titulo', 'Cancelaciones y devoluciones')
@section('descripcion', 'Cómo cancelar un pedido en Vitrina y cómo te devuelve el negocio una transferencia.')
@section('etiqueta', 'Ayuda')
@section('encabezado', 'Cancelaciones y devoluciones')
@section('vigencia', 'Vigente desde el 22 de noviembre de 2026.')

@php
    $correo = config('vitrina.correo_contacto');
    $indice = [
        'cancelar' => '1. Cancelar tu pedido',
        'negocio-cancela' => '2. Si el negocio cancela',
        'agotado' => '3. Si algo se agotó',
        'devolucion' => '4. Cómo te devuelven',
        'ausente' => '5. Si no estás',
        'problemas' => '6. Problemas',
        'cambios' => '7. Cambios',
    ];
@endphp

@section('documento')
<p>
    En Vitrina le compras directamente a cada negocio de Maicao y un domiciliario te lleva el pedido.
    <strong>Vitrina no recibe tu dinero ni cobra comisiones:</strong> pagas en efectivo al domiciliario o por
    transferencia a las cuentas del negocio. Por eso, cuando hay que devolver dinero, lo devuelve el negocio.
    La app deja anotado cada paso para que nadie quede sin respuesta.
</p>

<h2 id="cancelar">1. Cancelar tu pedido</h2>
<ul>
    <li>Puedes cancelarlo desde <em>Mis pedidos</em> mientras <strong>no haya salido en camino</strong>. Cuando el domiciliario sale hacia tu dirección, ya no se puede cancelar.</li>
    <li><strong>Si ibas a pagar en efectivo:</strong> no pagas nada.</li>
    <li><strong>Si ya transferiste:</strong> el negocio te devuelve el dinero (ver punto 4).</li>
</ul>

<h2 id="negocio-cancela">2. Si el negocio cancela</h2>
<p>
    Si el negocio rechaza tu pedido, lo cancela o no lo acepta a tiempo, te avisamos.
    No pagas nada y, si ya habías transferido, te devuelve <strong>todo</strong> lo que pagaste.
</p>

<h2 id="agotado">3. Si algo se agotó</h2>
<p>
    Si al negocio le falta un producto o ingrediente, te avisa antes de preparar. Tú decides si lo cambias
    o cancelas el pedido, sin costo. Si cambia el total, te pedimos que lo confirmes antes de seguir.
</p>

<h2 id="devolucion">4. Cómo te devuelven una transferencia</h2>
<ol>
    <li><strong>La pides:</strong> en el pedido cancelado escribes a qué cuenta te la devuelven (Nequi, Daviplata, banco o llave). Si el negocio ya había confirmado tu pago, la solicitud se abre sola.</li>
    <li><strong>El negocio devuelve:</strong> te transfiere y anota el monto. Puede adjuntar el comprobante.</li>
    <li><strong>Tú confirmas:</strong> marcas <em>Recibido</em> y se cierra. Si no te llegó, marcas <em>No me llegó</em> y el negocio lo vuelve a revisar.</li>
</ol>
<p>
    Pedir la devolución no significa que ya te devolvieron el dinero: solo está devuelta cuando tú la confirmas.
    Si el negocio había confirmado tu pago, no puede negarte la devolución. Si nunca lo confirmó y dice que el
    dinero no le llegó, debe explicar el motivo, y tú puedes reportarlo a Vitrina desde el pedido.
</p>

<h2 id="ausente">5. Si no estás cuando llega el domiciliario</h2>
<ul>
    <li>El domiciliario registra su llegada, te llama o te escribe y espera <strong>al menos 5 minutos</strong>. Si no apareces, el pedido vuelve al negocio y te avisamos.</li>
    <li><strong>Si pagaste por transferencia:</strong> te devuelven <strong>la mitad del valor de los productos</strong>. El domicilio no se devuelve, porque el domiciliario sí hizo el viaje. Por ejemplo, si pagaste $40.000 de productos y $5.000 de domicilio, te devuelven $20.000.</li>
    <li>Esta regla no aplica si el pedido no llegó por culpa del negocio o del domiciliario. En ese caso, repórtalo desde el pedido.</li>
</ul>

<h2 id="problemas">6. Problemas con tu pedido</h2>
<p>
    Si te cobraron más de lo que mostraba la app, faltó algo o tuviste otro problema, repórtalo desde el
    pedido. El equipo de Vitrina revisa cada reporte. También puedes escribirnos a
    <a href="mailto:{{ $correo }}">{{ $correo }}</a>.
</p>

<h2 id="cambios">7. Cambios a estas reglas</h2>
<p>Si las cambiamos te avisaremos en la app antes de que empiecen a regir. Tus pedidos ya hechos siguen con las reglas de cuando los hiciste.</p>
@endsection
