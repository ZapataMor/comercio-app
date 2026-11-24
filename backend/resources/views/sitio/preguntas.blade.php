@extends('layouts.sitio')

@section('titulo', 'Preguntas frecuentes')
@section('descripcion', 'Respuestas para clientes, negocios y domiciliarios de Vitrina: pagos, cancelaciones, cuenta y más.')

@php
    $grupos = [
        'Clientes' => [
            ['¿Cuánto cuesta usar Vitrina?', 'Nada. Descargar la app y pedir es gratis. Solo pagas lo que pides y el domicilio, directo al negocio.'],
            ['¿Cómo pago mi pedido?', 'En efectivo al domiciliario o por transferencia a las cuentas del negocio, que la app te muestra cuando el negocio acepta tu pedido. Al transferir, toca «Ya pagué» y el negocio confirma que le llegó.'],
            ['¿Vitrina me va a pedir datos de mi banco o tarjeta?', 'Nunca. Vitrina no recibe tu dinero. Si alguien te pide claves o que transfieras a una cuenta que no es la del negocio, no lo hagas y avísanos.'],
            ['¿Puedo cancelar un pedido?', 'Sí, desde «Mis pedidos», mientras no haya salido en camino. Si ya transferiste, el negocio te devuelve el dinero. Todo está explicado en las reglas de cancelaciones y devoluciones.'],
            ['¿Qué pasa si no estoy cuando llega el domiciliario?', 'Te llama o te escribe y espera al menos 5 minutos. Si no apareces, el pedido vuelve al negocio. Si pagaste por transferencia, te devuelven la mitad del valor de los productos; el domicilio no se devuelve.'],
            ['Mi pedido llegó incompleto o en mal estado, ¿qué hago?', 'Ábrelo en la app y toca «Reportar». El negocio y el equipo de Vitrina lo revisan.'],
            ['¿Puedo seguir al domiciliario en el mapa?', 'Sí, mientras te lleva tu pedido.'],
        ],
        'Negocios' => [
            ['¿Cómo pongo mi negocio en Vitrina?', 'Crea tu cuenta en la app y toca «Crear mi negocio» para subir tu catálogo, horarios y cuentas para recibir transferencias. Mira los planes en esta web.'],
            ['¿Vitrina cobra comisión por pedido?', 'No, nunca. Pagas una membresía fija y todo lo que pagan tus clientes llega directo a ti.'],
            ['¿Dónde pago la membresía?', 'En esta web, en «Iniciar sesión», con la misma cuenta del negocio en la app. La app no cobra planes.'],
            ['¿Puedo tener un equipo?', 'Sí. Invita a tus empleados desde la app; cada uno entra con su propia cuenta.'],
            ['¿Quién devuelve el dinero si un pedido se cancela?', 'Tu negocio, porque es quien recibió la transferencia. La app te guía paso a paso y el cliente confirma cuando le llega.'],
        ],
        'Domiciliarios' => [
            ['¿Cómo me vuelvo domiciliario?', 'Desde tu perfil en la app, toca «Ser domiciliario». Activas tu turno cuando quieras y tomas las entregas que te sirvan.'],
            ['¿Vitrina me cobra algo?', 'No. Lo que cobras por el domicilio es tuyo; el valor de los productos en efectivo se lo entregas al negocio, y la app te muestra cuánto le debes a cada uno.'],
            ['¿Cuándo se comparte mi ubicación?', 'Mientras estás en turno, llevas una entrega o le debes dinero a un negocio. La app muestra una notificación fija mientras la comparte.'],
            ['¿Trabajo para Vitrina?', 'No. Eres independiente: decides cuándo y cuánto trabajas.'],
        ],
        'Cuenta y datos' => [
            ['¿Cómo entro a la app?', 'Con tu celular, que verificamos con un código por WhatsApp, o con tu cuenta de Google, y una clave de 4 números.'],
            ['Olvidé mi clave, ¿qué hago?', 'En la pantalla de entrada toca «¿Olvidaste tu clave?» y sigue los pasos para crear una nueva.'],
            ['¿Cómo elimino mi cuenta?', 'Desde la app en Mi perfil → Eliminar mi cuenta, o en la página «Eliminar mi cuenta» de esta web.'],
            ['¿Qué hacen con mis datos?', 'Solo los usamos para que Vitrina funcione y nunca los vendemos. Lee la política de privacidad para los detalles.'],
        ],
    ];
@endphp

@section('contenido')
<section class="portada">
    <div class="sitio-ancho portada-sola">
        <span class="etiqueta">Ayuda</span>
        <h1>Preguntas frecuentes</h1>
        <p class="portada-texto">Lo que más nos preguntan clientes, negocios y domiciliarios.</p>
    </div>
</section>

@foreach ($grupos as $grupo => $preguntas)
    <section @class(['seccion', 'seccion-suave' => $loop->even])>
        <div class="sitio-ancho">
            <div class="seccion-cabeza centro">
                <h2>{{ $grupo }}</h2>
            </div>
            <div class="preguntas">
                @foreach ($preguntas as [$pregunta, $respuesta])
                    <details>
                        <summary>{{ $pregunta }}</summary>
                        <p>{{ $respuesta }}</p>
                    </details>
                @endforeach
            </div>
        </div>
    </section>
@endforeach

<section class="seccion">
    <div class="sitio-ancho">
        <div class="seccion-cabeza centro sin-margen">
            <h2>¿No encontraste tu respuesta?</h2>
            <p>Escríbenos y te ayudamos, o lee las reglas completas.</p>
            <div class="acciones" style="justify-content:center">
                <a href="{{ route('sitio.contacto') }}" class="boton boton-oscuro">Contacto y PQR</a>
                <a href="{{ route('cancelaciones') }}" class="boton boton-claro">Cancelaciones y devoluciones</a>
                <a href="{{ route('terminos') }}" class="boton boton-claro">Términos y condiciones</a>
            </div>
        </div>
    </div>
</section>
@endsection
