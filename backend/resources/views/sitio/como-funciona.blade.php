@extends('layouts.sitio')

@section('titulo', 'Cómo funciona')
@section('descripcion', 'Cómo se usa Vitrina si eres cliente, negocio o domiciliario, y cómo se paga cada pedido.')

@section('contenido')
<section class="portada">
    <div class="sitio-ancho portada-sola">
        <span class="etiqueta">Cómo funciona</span>
        <h1>Así se mueve un pedido en Vitrina.</h1>
        <p class="portada-texto">
            Tres personas, una sola app: el cliente que pide, el negocio que prepara y el domiciliario que entrega.
            Aquí te contamos qué hace cada uno.
        </p>
    </div>
</section>

<section class="seccion">
    <div class="sitio-ancho">
        <div class="rol">
            <div>
                <span class="sobre">Si vas a comprar</span>
                <h2>Clientes</h2>
                <p class="rol-intro">Entras con tu celular o tu cuenta de Google y una clave de 4 números.</p>
            </div>
            <ol>
                <li><div><b>Encuentra lo que buscas</b><span>Explora los negocios por categoría, búscalos por nombre o míralos en el mapa de la ciudad.</span></div></li>
                <li><div><b>Arma tu pedido</b><span>Elige productos del catálogo, ajústalos a tu gusto y agrega tu dirección de entrega.</span></div></li>
                <li><div><b>Escoge cómo pagar</b><span>En efectivo al recibir o por transferencia a la cuenta del negocio. Vitrina no toca tu dinero.</span></div></li>
                <li><div><b>Síguelo en vivo</b><span>Te avisamos cada cambio de estado y ves al domiciliario en el mapa mientras va hacia ti.</span></div></li>
                <li><div><b>Califica</b><span>Deja una reseña del negocio y de los productos para ayudar a otros clientes.</span></div></li>
            </ol>
        </div>

        <div class="rol">
            <div>
                <span class="sobre">Si tienes un negocio</span>
                <h2>Negocios</h2>
                <p class="rol-intro">Tu vitrina en la app, con un plan mensual y sin comisión por venta.</p>
            </div>
            <ol>
                <li><div><b>Crea tu vitrina</b><span>Sube tu logo, tus fotos, tu horario y tu ubicación en el mapa.</span></div></li>
                <li><div><b>Publica tu catálogo</b><span>Organiza tus productos por secciones, con fotos, precios y opciones.</span></div></li>
                <li><div><b>Recibe pedidos</b><span>Suena una alarma con cada pedido nuevo, aunque tengas el celular en el bolsillo.</span></div></li>
                <li><div><b>Despacha</b><span>Usa tus propios domiciliarios o los de Vitrina, y lleva la cuenta de lo que te deben.</span></div></li>
                <li><div><b>Mide cómo te va</b><span>Mira tus pedidos, reseñas y cuántas personas entran a tu tienda.</span></div></li>
            </ol>
        </div>

        <div class="rol">
            <div>
                <span class="sobre">Si vas a entregar</span>
                <h2>Domiciliarios</h2>
                <p class="rol-intro">Trabajas cuando quieres: activa tu turno y toma las entregas que te sirvan.</p>
            </div>
            <ol>
                <li><div><b>Activa tu turno</b><span>Mientras estás en turno, los negocios te ven disponible.</span></div></li>
                <li><div><b>Toma una entrega</b><span>Ves la dirección del negocio y la del cliente antes de aceptar.</span></div></li>
                <li><div><b>Entrega y cobra</b><span>Sigue la ruta en el mapa y cobra en efectivo o confirma la transferencia.</span></div></li>
                <li><div><b>Cuentas claras</b><span>La app te muestra cuánto le debes a cada negocio por lo que cobraste.</span></div></li>
            </ol>
        </div>
    </div>
</section>

<section class="seccion seccion-suave">
    <div class="sitio-ancho rejilla-2">
        <article class="tarjeta">
            <div class="icono"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg></div>
            <h3>¿Cómo se paga un pedido?</h3>
            <p>
                Siempre directo entre el cliente y el negocio: en efectivo al domiciliario o por transferencia a la
                cuenta del negocio. Vitrina no cobra comisión por pedido ni guarda tu dinero.
            </p>
        </article>
        <article class="tarjeta">
            <div class="icono"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg></div>
            <h3>¿Y si cancelo?</h3>
            <p>
                Puedes cancelar tu pedido mientras el domiciliario no haya salido hacia tu dirección. Si ya transferiste,
                el negocio te devuelve el dinero. <a href="{{ route('cancelaciones') }}">Lee las reglas completas</a>.
            </p>
        </article>
    </div>
</section>

<section class="seccion">
    <div class="sitio-ancho">
        <div class="franja">
            <div>
                <h2>¿Listo para probar Vitrina?</h2>
                <p>Descarga la app y entra con tu celular. Si tienes un negocio, mira los planes de membresía.</p>
            </div>
            <div class="acciones sin-margen">
                <button type="button" class="boton boton-acento">Descargar la app</button>
                <a href="{{ route('sitio.planes') }}" class="boton boton-fantasma">Ver planes</a>
            </div>
        </div>
    </div>
</section>
@endsection
