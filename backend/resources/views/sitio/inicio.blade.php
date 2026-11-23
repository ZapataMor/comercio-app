@extends('layouts.sitio')

@section('titulo', 'Los negocios de Maicao en tu bolsillo')

@section('contenido')
<section class="portada">
    <div class="sitio-ancho portada-fila">
        <div>
            <span class="etiqueta">Hecho en Maicao, para Maicao</span>
            <h1>La vitrina comercial de Colombia, ahora en tu bolsillo.</h1>
            <p class="portada-texto">
                Vitrina reúne los negocios de la ciudad en una sola app. Mira sus catálogos, pide a domicilio
                y paga directo al negocio, en efectivo o por transferencia. Sin intermediarios.
            </p>
            <div class="acciones">
                <button type="button" class="boton boton-acento">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.6 2.2 13.8 12 3.6 21.8c-.4-.2-.6-.6-.6-1.1V3.3c0-.5.2-.9.6-1.1Zm11.6 8.4 2.6-2.6 3.1 1.8c.9.5.9 1.9 0 2.4l-3.1 1.8-2.6-2.6-.7-.7.7-.1ZM5 1.6l11.4 6.6-2 2L5 1.6Zm0 20.8 9.4-8.6 2 2L5 22.4Z"/></svg>
                    Descargar en Google Play
                </button>
                <a href="{{ route('sitio.como-funciona') }}" class="boton boton-fantasma">Ver cómo funciona</a>
            </div>
            <p class="nota-portada">¿Tienes un negocio? <a href="{{ route('sitio.planes') }}">Conoce los planes</a>.</p>
        </div>

        <div class="telefono" aria-hidden="true">
            <div class="telefono-pantalla">
                <div class="tp-saludo">Hola, ¿qué se te antoja?</div>
                <div class="tp-sub">Entregas en Maicao</div>
                <div class="tp-buscar">Buscar negocios o productos</div>
                <div class="tp-chips"><span>Todo</span><span>Comida</span><span>Tiendas</span><span>Servicios</span></div>
                <div class="tp-tienda"><div class="tp-foto f1"></div><div><b>Panadería del Centro</b><small>Pan, tortas y café</small></div><span class="tp-abierto">Abierto</span></div>
                <div class="tp-tienda"><div class="tp-foto f2"></div><div><b>Variedades La 14</b><small>Hogar y miscelánea</small></div><span class="tp-abierto">Abierto</span></div>
                <div class="tp-tienda"><div class="tp-foto f3"></div><div><b>Frutería El Mercado</b><small>Frutas y jugos</small></div><span class="tp-abierto">Abierto</span></div>
                <div class="tp-pedido"><span>Tu pedido va en camino</span><b>Ver mapa</b></div>
            </div>
        </div>
    </div>
</section>

<section class="seccion">
    <div class="sitio-ancho">
        <div class="seccion-cabeza">
            <span class="sobre">Una app, tres formas de usarla</span>
            <h2>Para quien compra, para quien vende y para quien entrega.</h2>
            <p>Cada persona entra con su celular y ve lo que necesita según su papel en Vitrina.</p>
        </div>
        <div class="rejilla-3">
            <article class="tarjeta">
                <div class="icono"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg></div>
                <h3>Clientes</h3>
                <p>Encuentra negocios en el mapa o por categoría, arma tu pedido y síguelo en vivo hasta tu puerta.</p>
            </article>
            <article class="tarjeta">
                <div class="icono"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9h18l-1.5-5h-15L3 9Z"/><path d="M5 9v11h14V9"/><path d="M10 20v-6h4v6"/></svg></div>
                <h3>Negocios</h3>
                <p>Publica tu catálogo, recibe pedidos con alarma, organiza tu equipo y mira cuántas personas visitan tu tienda.</p>
            </article>
            <article class="tarjeta">
                <div class="icono"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17h4l3-7h4l1 7"/><path d="M13 10 11 6H8"/></svg></div>
                <h3>Domiciliarios</h3>
                <p>Toma entregas cerca de ti, ve la ruta en el mapa y lleva la cuenta de lo que cobraste para cada negocio.</p>
            </article>
        </div>
    </div>
</section>

<section class="seccion seccion-suave">
    <div class="sitio-ancho">
        <div class="seccion-cabeza centro">
            <span class="sobre">Así de simple</span>
            <h2>De la vitrina a tu puerta en cuatro pasos.</h2>
        </div>
        <div class="pasos">
            <div class="paso"><h3>Explora</h3><p>Busca por nombre, categoría o en el mapa de la ciudad.</p></div>
            <div class="paso"><h3>Pide</h3><p>Elige productos, ajusta tu pedido y escoge cómo vas a pagar.</p></div>
            <div class="paso"><h3>El negocio prepara</h3><p>Recibe tu pedido al instante y lo confirma.</p></div>
            <div class="paso"><h3>Llega a tu puerta</h3><p>Un domiciliario lo lleva y tú lo sigues en el mapa.</p></div>
        </div>
    </div>
</section>

<section class="seccion">
    <div class="sitio-ancho">
        <div class="franja">
            <div>
                <h2>Tu dinero va directo al negocio.</h2>
                <p>
                    Vitrina no cobra comisión por pedido ni recibe tus pagos. Pagas en efectivo al recibir
                    o por transferencia a la cuenta del negocio, como siempre lo has hecho.
                </p>
            </div>
            <div class="cifras">
                <div><strong>0%</strong><span>comisión por pedido</span></div>
                <div><strong>100%</strong><span>del pago al negocio</span></div>
            </div>
        </div>
    </div>
</section>

<section class="seccion seccion-suave">
    <div class="sitio-ancho rejilla-2 centrado-v">
        <div class="seccion-cabeza sin-margen">
            <span class="sobre">Para negocios</span>
            <h2>Una membresía fija. Sin sorpresas.</h2>
            <p>
                Los negocios pagan un plan por su vitrina en la app, no por cada venta. Desde esta página
                puedes ver los planes y pagar tu membresía con tu cuenta de Vitrina.
            </p>
            <div class="acciones">
                <a href="{{ route('sitio.planes') }}" class="boton boton-oscuro">Ver planes</a>
                <a href="{{ route('sitio.entrar') }}" class="boton boton-claro">Pagar mi membresía</a>
            </div>
        </div>
        <ul class="lista tarjeta">
            <li>Catálogo con fotos, secciones y precios</li>
            <li>Pedidos en tiempo real con alarma</li>
            <li>Equipo del negocio con sus propios accesos</li>
            <li>Domiciliarios y entregas en el mapa</li>
            <li>Reseñas y visitas a tu tienda</li>
        </ul>
    </div>
</section>
@endsection
