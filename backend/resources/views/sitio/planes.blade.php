@extends('layouts.sitio')

@section('titulo', 'Planes para negocios')
@section('descripcion', 'Planes de membresía de Vitrina para negocios: una cuota fija, sin comisión por pedido.')

@section('contenido')
<section class="portada">
    <div class="sitio-ancho portada-sola">
        <span class="etiqueta">Planes para negocios</span>
        <h1>Paga por tu vitrina, no por tus ventas.</h1>
        <p class="portada-texto">
            Una membresía fija para tener tu negocio en Vitrina. Vendas lo que vendas, no cobramos comisión por pedido.
        </p>
    </div>
</section>

<section class="seccion">
    <div class="sitio-ancho">
        {{-- Precios aún sin definir: se muestran como «por anunciar». --}}
        <div class="planes">
            <article class="plan">
                <h3>Piloto</h3>
                <p class="plan-para">Para los primeros negocios de Maicao.</p>
                <p class="plan-precio">Gratis</p>
                <p class="plan-aviso">Mientras dure la etapa de lanzamiento.</p>
                <ul class="lista">
                    <li>Vitrina y catálogo completos</li>
                    <li>Pedidos con alarma</li>
                    <li>Domiciliarios y mapa</li>
                    <li>Acompañamiento para empezar</li>
                </ul>
                <button type="button" class="boton boton-claro boton-ancho">Quiero unirme</button>
            </article>

            <article class="plan destacado">
                <span class="plan-insignia">El más elegido</span>
                <h3>Mensual</h3>
                <p class="plan-para">Para empezar sin compromisos largos.</p>
                <p class="plan-precio pendiente">Por anunciar <small>/ mes</small></p>
                <p class="plan-aviso">Cancela cuando quieras.</p>
                <ul class="lista">
                    <li>Todo lo del plan Piloto</li>
                    <li>Equipo del negocio con sus propios accesos</li>
                    <li>Reseñas y visitas a tu tienda</li>
                    <li>Soporte por WhatsApp</li>
                </ul>
                <button type="button" class="boton boton-acento boton-ancho">Elegir plan mensual</button>
            </article>

            <article class="plan">
                <h3>Anual</h3>
                <p class="plan-para">Para negocios que ya venden con Vitrina.</p>
                <p class="plan-precio pendiente">Por anunciar <small>/ año</small></p>
                <p class="plan-aviso">Un solo pago con descuento.</p>
                <ul class="lista">
                    <li>Todo lo del plan Mensual</li>
                    <li>Precio fijo por 12 meses</li>
                    <li>Prioridad en el soporte</li>
                </ul>
                <button type="button" class="boton boton-oscuro boton-ancho">Elegir plan anual</button>
            </article>
        </div>

        <p class="planes-nota">
            ¿Ya tienes tu negocio en Vitrina? <a href="{{ route('sitio.entrar') }}">Inicia sesión para pagar tu membresía</a>.
        </p>
        <p class="planes-nota">
            Al contratar un plan aceptas las <a href="{{ route('membresia') }}">condiciones de la membresía</a>:
            5 días hábiles de retracto y sin renovación automática.
        </p>
    </div>
</section>

<section class="seccion seccion-suave">
    <div class="sitio-ancho">
        <div class="seccion-cabeza centro">
            <span class="sobre">Preguntas frecuentes</span>
            <h2>Lo que más nos preguntan los negocios.</h2>
        </div>
        <div class="preguntas">
            <details>
                <summary>¿Vitrina cobra comisión por cada pedido?</summary>
                <p>No. Solo pagas tu membresía. Todo lo que pagan tus clientes llega directo a ti, en efectivo o por transferencia.</p>
            </details>
            <details>
                <summary>¿Dónde pago la membresía?</summary>
                <p>Aquí, en la web de Vitrina. Inicias sesión con el celular de tu cuenta y tu clave de 4 números, y pagas tu plan desde el apartado de pagos.</p>
            </details>
            <details>
                <summary>¿Qué pasa si no renuevo?</summary>
                <p>Tu negocio deja de mostrarse a los clientes hasta que renueves. Tu catálogo y tu historial se conservan.</p>
            </details>
            <details>
                <summary>¿Puedo cambiar de plan?</summary>
                <p>Sí. Puedes pasar del mensual al anual cuando quieras desde el apartado de pagos.</p>
            </details>
        </div>
    </div>
</section>
@endsection
