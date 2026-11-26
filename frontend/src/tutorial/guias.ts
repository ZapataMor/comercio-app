/**
 * Contenido de los tutoriales (qué se señala en cada pantalla y qué se dice) y
 * de las acciones de «¿No sabes cómo hacer algo?».
 *
 * Los `objetivo` son los `id` de los <Objetivo> / useObjetivo de cada pantalla.
 * Textos breves: una idea por paso, en segunda persona, sin tecnicismos.
 */
import { Usuario } from '../api';
import { abrirEntregas, esComerciante, navigationRef } from '../RootNavigation';
import { Guia, Tutorial } from './tipos';

const esCliente = (u: Usuario) => u.roles.includes('usuario');
const esDomiciliario = (u: Usuario) => u.roles.includes('domiciliario');
const tieneNegocio = (u: Usuario) => (u.negocios?.length ?? 0) > 0;
const seccion = (params?: Record<string, unknown>) => (params?.seccion as string | undefined) ?? 'productos';

export const TUTORIALES: Tutorial[] = [
  // ---------------------------------------------------------------- Cliente
  {
    id: 'bienvenida',
    pantalla: 'Explorar',
    cuando: ({ user, params }) => esCliente(user) && seccion(params) === 'productos',
    pasos: [
      {
        titulo: '¡Bienvenido a Vitrina!',
        texto: 'Te mostramos en pocos pasos cómo comprar en los negocios de tu ciudad. Puedes saltar la guía cuando quieras.',
      },
      {
        objetivo: 'explorar.buscador',
        titulo: 'Busca lo que necesites',
        texto: 'Escribe un producto o el nombre de un negocio y verás los resultados al instante.',
      },
      {
        objetivo: 'explorar.mapa',
        titulo: 'Negocios en el mapa',
        texto: 'Toca aquí para ver en el mapa los negocios que tienes cerca.',
      },
      {
        objetivo: 'explorar.tipos',
        titulo: 'Filtra por tipo',
        texto: 'Elige una categoría para ver solo restaurantes, panaderías, tiendas…',
      },
      {
        objetivo: 'explorar.negocio',
        titulo: 'Entra a un negocio',
        texto: 'Toca una tienda para ver su catálogo, su horario y sus reseñas.',
      },
      {
        objetivo: 'catalogo.selector',
        titulo: 'Productos, servicios y propiedades',
        texto: 'En esta barra de abajo cambias de catálogo: servicios para pedir citas, o casas en venta y alquiler.',
      },
      {
        objetivo: 'barra.carrito',
        titulo: 'Tu carrito',
        texto: 'Lo que eliges se guarda aquí hasta que confirmas el pedido.',
      },
      {
        objetivo: 'barra.pedidos',
        titulo: 'Mis pedidos',
        texto: 'Sigue tus pedidos: cuándo los acepta el negocio, cuándo salen y cuándo llegan.',
      },
      {
        objetivo: 'perfil.menu',
        titulo: 'Tu perfil',
        texto: 'Tus datos, tus direcciones, tus negocios y la opción de ser domiciliario. En «¿Cómo se usa?» repites estas guías.',
      },
    ],
  },
  {
    id: 'servicios',
    pantalla: 'Explorar',
    cuando: ({ user, params }) => esCliente(user) && seccion(params) === 'servicios',
    pasos: [
      {
        objetivo: 'explorar.buscador',
        titulo: 'Servicios y citas',
        texto: 'Aquí están peluquerías, talleres y más. Busca el servicio que necesitas.',
      },
      {
        objetivo: 'explorar.negocio',
        titulo: 'Elige dónde',
        texto: 'Toca un negocio, escoge el servicio y pide tu cita en el día y la hora que te sirvan.',
      },
      {
        objetivo: 'perfil.menu',
        titulo: 'Tus citas',
        texto: 'Las citas que pidas las encuentras en tu perfil, en «Mis citas».',
      },
    ],
  },
  {
    id: 'pedido-explorar',
    pantalla: 'Explorar',
    auto: false,
    cuando: ({ user }) => esCliente(user),
    pasos: [
      {
        objetivo: 'explorar.buscador',
        titulo: 'Paso 1: encuentra el negocio',
        texto: 'Busca lo que quieres pedir o baja por la lista de negocios.',
      },
      {
        objetivo: 'explorar.negocio',
        titulo: 'Entra a la tienda',
        texto: 'Toca un negocio para ver lo que vende. Ahí seguimos con el siguiente paso.',
      },
    ],
  },
  {
    id: 'buscar',
    pantalla: 'Explorar',
    auto: false,
    cuando: ({ user }) => esCliente(user),
    pasos: [
      {
        objetivo: 'explorar.buscador',
        titulo: 'Escribe lo que buscas',
        texto: 'Un producto («arepa»), un servicio («corte») o el nombre de un negocio. Los resultados salen mientras escribes.',
      },
      {
        objetivo: 'explorar.tipos',
        titulo: 'O filtra por tipo',
        texto: 'Toca una categoría para ver solo esa clase de negocios. «Todos» los vuelve a mostrar.',
      },
      {
        objetivo: 'explorar.negocio',
        titulo: 'Abre el que te guste',
        texto: 'Toca el negocio para ver su catálogo, su horario y sus reseñas.',
      },
    ],
  },
  {
    id: 'mapa-entrar',
    pantalla: 'Explorar',
    auto: false,
    cuando: ({ user }) => esCliente(user),
    pasos: [
      {
        objetivo: 'explorar.mapa',
        titulo: 'Abre el mapa',
        texto: 'Toca este botón para ver los negocios en el mapa de tu ciudad.',
      },
    ],
  },
  {
    id: 'pedidos-entrar',
    pantalla: 'Explorar',
    auto: false,
    cuando: ({ user }) => esCliente(user),
    pasos: [
      {
        objetivo: 'barra.pedidos',
        titulo: 'Abre tus pedidos',
        texto: 'Toca este botón redondo para ver los pedidos que tienes en camino y los anteriores.',
      },
    ],
  },
  {
    id: 'ser-domiciliario',
    pantalla: 'Explorar',
    auto: false,
    cuando: ({ user }) => esCliente(user) && !esDomiciliario(user),
    pasos: [
      {
        objetivo: 'perfil.menu',
        titulo: 'Abre tu perfil',
        texto: 'Toca tu perfil, en la barra de abajo, y elige «Ser domiciliario». Sigues siendo cliente: puedes comprar como siempre.',
      },
    ],
  },
  {
    id: 'negocio',
    pantalla: 'Negocio',
    cuando: ({ user, params }) => esCliente(user) && seccion(params) === 'productos',
    pasos: [
      {
        objetivo: 'negocio.estado',
        titulo: '¿Está abierto?',
        texto: 'Aquí ves si el negocio recibe pedidos ahora y cuánto tarda en prepararlos.',
      },
      {
        objetivo: 'negocio.resenas',
        titulo: 'Reseñas',
        texto: 'Mira lo que opinan otros clientes antes de pedir.',
      },
      {
        objetivo: 'negocio.producto',
        titulo: 'Elige tus productos',
        texto: 'Toca «Agregar» para ponerlo en el carrito, o toca la foto para ver sus detalles.',
      },
      {
        objetivo: 'barra.carrito',
        titulo: 'Cuando termines',
        texto: 'Abre el carrito para revisar tu pedido y confirmarlo.',
      },
    ],
  },
  {
    id: 'negocio-servicios',
    pantalla: 'Negocio',
    cuando: ({ user, params }) => esCliente(user) && seccion(params) === 'servicios',
    pasos: [
      {
        objetivo: 'negocio.estado',
        titulo: 'Horario del negocio',
        texto: 'Aquí ves si está abierto hoy.',
      },
      {
        objetivo: 'negocio.producto',
        titulo: 'Pide una cita',
        texto: 'Toca un servicio para ver su precio y su duración, y luego «Solicitar cita».',
      },
    ],
  },
  {
    id: 'carrito',
    pantalla: 'Carrito',
    pasos: [
      {
        objetivo: 'carrito.linea',
        titulo: 'Revisa tu pedido',
        texto: 'Cambia la cantidad, personaliza o quita productos antes de seguir.',
      },
      {
        objetivo: 'carrito.total',
        titulo: 'Lo que vas a pagar',
        texto: 'El valor de los productos, el domicilio y el total.',
      },
      {
        objetivo: 'carrito.continuar',
        titulo: 'Revisa y pide',
        texto: 'Toca aquí para elegir dónde te lo llevamos y cómo vas a pagar.',
      },
    ],
  },
  {
    id: 'checkout',
    pantalla: 'Checkout',
    pasos: [
      {
        objetivo: 'checkout.resumen',
        titulo: 'Resumen del pedido',
        texto: 'Revisa los productos, el costo del domicilio y el total a pagar.',
      },
      {
        objetivo: 'checkout.direccion',
        titulo: '¿A dónde lo llevamos?',
        texto: 'Elige una de tus direcciones o agrega una nueva. Toca «Editar» para cambiar una.',
      },
      {
        objetivo: 'checkout.telefono',
        titulo: 'Teléfono de contacto',
        texto: 'El domiciliario te llamará a este número si no encuentra la dirección.',
      },
      {
        objetivo: 'checkout.pago',
        titulo: '¿Cómo vas a pagar?',
        texto: 'En efectivo al recibir (dinos con qué billete pagas) o por transferencia al negocio.',
      },
      {
        objetivo: 'checkout.confirmar',
        titulo: 'Confirma',
        texto: 'Toca aquí para enviar tu pedido al negocio. Te avisaremos cuando lo acepte.',
      },
    ],
  },
  {
    id: 'mis-pedidos',
    pantalla: 'MisPedidos',
    pasos: [
      {
        objetivo: 'mispedidos.pedido',
        titulo: 'Tus pedidos',
        texto: 'Toca un pedido para ver en qué va: aceptado, en preparación, en camino o entregado.',
      },
    ],
  },
  {
    id: 'seguimiento',
    pantalla: 'PedidoDetalle',
    pasos: [
      {
        objetivo: 'pedido.estado',
        titulo: 'Así va tu pedido',
        texto: 'Arriba ves qué pasa ahora; esta lista avanza sola cuando la tienda lo acepta, cuando sale y cuando llega.',
      },
      {
        objetivo: 'pedido.contacto',
        titulo: '¿Necesitas hablar?',
        texto: 'Llama o escribe por WhatsApp al negocio o al domiciliario desde aquí.',
      },
      {
        titulo: 'Al recibirlo',
        texto: 'Cuando llegue, califica al domiciliario y a la tienda. Tu opinión ayuda a otros clientes.',
      },
    ],
  },
  {
    id: 'mapa',
    pantalla: 'Mapa',
    cuando: ({ user, params }) => esCliente(user) && !params?.admin,
    pasos: [
      {
        titulo: 'El mapa de tu ciudad',
        texto: 'Cada pin es un negocio. Tócalo para ver su nombre, si está abierto y entrar a su tienda.',
      },
      {
        objetivo: 'mapa.tipos',
        titulo: 'Filtra por tipo',
        texto: 'Muestra solo los tipos de negocio que te interesan.',
      },
      {
        objetivo: 'mapa.estado',
        titulo: 'Abiertos o cerrados',
        texto: 'Elige si quieres ver solo los negocios abiertos ahora.',
      },
      {
        objetivo: 'mapa.miUbicacion',
        titulo: 'Tu ubicación',
        texto: 'Centra el mapa donde estás para ver lo que tienes cerca.',
      },
    ],
  },
  {
    id: 'direcciones',
    pantalla: 'MisDirecciones',
    pasos: [
      {
        objetivo: 'direcciones.lista',
        titulo: 'Tus direcciones',
        texto: 'Aquí guardas los lugares donde recibes pedidos. La principal se elige sola al pedir.',
      },
      {
        objetivo: 'direcciones.agregar',
        titulo: 'Agrega una dirección',
        texto: 'Toca aquí para escribir la dirección, elegir el barrio y marcar tu casa en el mapa.',
      },
    ],
  },
  {
    id: 'editar-direccion',
    pantalla: 'EditarDireccion',
    enModal: true,
    pasos: [
      {
        objetivo: 'direccion.nombre',
        titulo: 'Ponle un nombre',
        texto: 'Por ejemplo «Mi casa» o «Trabajo». Es opcional y solo lo ves tú.',
      },
      {
        objetivo: 'direccion.campos',
        titulo: 'La dirección',
        texto: 'Escríbela por partes, como aparece en la placa: calle o carrera, número y casa.',
      },
      {
        objetivo: 'direccion.barrio',
        titulo: 'El barrio',
        texto: 'Búscalo en la lista. Si no aparece, puedes sugerirlo.',
      },
      {
        objetivo: 'direccion.mapa',
        titulo: 'Marca el punto en el mapa',
        texto: 'Toca «Marcar en el mapa» y deja el pin sobre tu casa. Así el domiciliario llega sin perderse.',
      },
      {
        objetivo: 'direccion.fotos',
        titulo: 'Fotos de la fachada',
        texto: 'Opcionales: ayudan al domiciliario a reconocer el lugar.',
      },
      {
        objetivo: 'direccion.guardar',
        titulo: 'Guarda',
        texto: 'Toca aquí cuando termines. Puedes cambiarla después.',
      },
    ],
  },
  {
    id: 'mi-informacion',
    pantalla: 'MiInformacion',
    pasos: [
      {
        objetivo: 'info.datos',
        titulo: 'Tus datos',
        texto: 'Tu nombre y apellidos son los que ven los negocios y los domiciliarios en tus pedidos.',
      },
      {
        objetivo: 'info.telefono',
        titulo: 'Tu celular',
        texto: 'Es el contacto de tus pedidos: el negocio y el domiciliario te llaman a este número.',
      },
      {
        objetivo: 'info.editar',
        titulo: 'Cambia tus datos',
        texto: 'Toca aquí, corrige lo que necesites y guarda los cambios.',
      },
    ],
  },

  // ------------------------------------------------------------ Comerciante
  {
    id: 'crear-negocio',
    pantalla: 'MiTienda',
    cuando: ({ params }) => !!params?.nuevo,
    pasos: [
      {
        titulo: 'Registra tu negocio',
        texto: 'En tres pasos dejas tu negocio listo para recibir pedidos. Puedes cambiar todo después.',
      },
      {
        objetivo: 'tienda.paso',
        titulo: 'Vas por aquí',
        texto: 'Este aviso te dice en qué paso estás y qué te falta.',
      },
      {
        objetivo: 'tienda.seccion',
        titulo: 'Llena los datos',
        texto: 'Nombre, tipo de negocio y una foto. Lo que lleva asterisco es obligatorio.',
      },
      {
        objetivo: 'tienda.siguiente',
        titulo: 'Sigue al próximo paso',
        texto: 'Luego vienen la ubicación y el horario. Al final, tu negocio queda creado.',
      },
    ],
  },
  {
    id: 'panel-negocio',
    pantalla: 'Home',
    cuando: ({ user }) => tieneNegocio(user),
    pasos: [
      {
        titulo: 'El panel de tu negocio',
        texto: 'Desde aquí atiendes pedidos, cambias tu catálogo y manejas tu equipo.',
      },
      {
        objetivo: 'home.estado',
        titulo: 'Abierto o cerrado',
        texto: 'Mantén presionado para abrir o cerrar tu negocio. Cerrado, no recibe pedidos nuevos.',
      },
      {
        objetivo: 'home.accesos',
        titulo: 'Accesos rápidos',
        texto: 'Productos, pedidos, equipo, datos de la tienda y más. En «Mis negocios» cambias de negocio o creas otro.',
      },
      {
        objetivo: 'home.pedidos',
        titulo: 'Pedidos por atender',
        texto: 'Los pedidos nuevos llegan aquí y suena una alarma. Acéptalos antes de que venzan.',
      },
    ],
  },
  {
    id: 'productos-entrar',
    pantalla: 'Home',
    auto: false,
    cuando: ({ user }) => tieneNegocio(user),
    pasos: [
      {
        objetivo: 'home.accesos',
        titulo: 'Abre tus productos',
        texto: 'Toca «Productos» para ver tu catálogo y agregar uno nuevo.',
      },
    ],
  },
  {
    id: 'mis-productos',
    pantalla: 'MisProductos',
    pasos: [
      {
        objetivo: 'productos.agregar',
        titulo: 'Agrega un producto',
        texto: 'Ponle nombre, precio y una foto. Los clientes lo verán en tu tienda al instante.',
      },
      {
        objetivo: 'productos.lista',
        titulo: 'Tu catálogo',
        texto: 'Toca un producto para editarlo o marcarlo como agotado cuando se acabe.',
      },
    ],
  },
  {
    id: 'pedidos-negocio',
    pantalla: 'Home',
    auto: false,
    cuando: ({ user }) => tieneNegocio(user),
    pasos: [
      {
        objetivo: 'home.pedidos',
        titulo: 'Pedidos nuevos',
        texto: 'Cuando llega uno suena una alarma. Revisa el detalle y toca «Aceptar pedido».',
      },
      {
        titulo: 'Prepáralo y entrégalo',
        texto: 'Al aceptarlo pasa a «En preparación». Cuando esté listo, entrégalo al domiciliario con su código.',
      },
      {
        objetivo: 'home.estado',
        titulo: 'Sin pedidos por ahora',
        texto: 'Si necesitas una pausa, cierra el negocio aquí y no te llegarán pedidos.',
      },
    ],
  },

  // ----------------------------------------------------------- Domiciliario
  {
    id: 'entregas',
    pantalla: 'Entregas',
    cuando: ({ user }) => esDomiciliario(user),
    pasos: [
      {
        titulo: 'Ya eres domiciliario',
        texto: 'Te mostramos cómo recibir y entregar pedidos.',
      },
      {
        objetivo: 'turno.boton',
        titulo: 'Entra en turno',
        texto: 'Mantén presionada la moto para empezar a recibir pedidos. Hazlo de nuevo para salir del turno.',
      },
      {
        objetivo: 'entregas.panel',
        titulo: 'Pedidos disponibles',
        texto: 'Aquí aparecen los pedidos listos para llevar y los que tienes en curso. Toma uno y sigue los pasos.',
      },
      {
        objetivo: 'confiabilidad',
        titulo: 'Tu confiabilidad',
        texto: 'Sube cuando entregas a tiempo y baja si sueltas pedidos o llegas tarde.',
      },
    ],
  },
];

export const GUIAS: Guia[] = [
  {
    id: 'pedido',
    titulo: 'Hacer un pedido',
    detalle: 'Elegir productos, pagar y recibirlos',
    icono: 'bolsa',
    para: esCliente,
    ir: () => navigationRef.navigate('Explorar', { seccion: 'productos' }),
    tutoriales: ['pedido-explorar', 'negocio', 'carrito', 'checkout'],
  },
  {
    id: 'buscar',
    titulo: 'Buscar negocios o productos',
    detalle: 'Encontrar lo que necesitas',
    icono: 'lupa',
    para: esCliente,
    ir: () => navigationRef.navigate('Explorar', { seccion: 'productos' }),
    tutoriales: ['buscar'],
  },
  {
    id: 'mapa',
    titulo: 'Ver negocios en el mapa',
    detalle: 'Los que tienes cerca',
    icono: 'mapa',
    para: esCliente,
    ir: () => navigationRef.navigate('Explorar', { seccion: 'productos' }),
    tutoriales: ['mapa-entrar', 'mapa'],
  },
  {
    id: 'seguir',
    titulo: 'Seguir mi pedido',
    detalle: 'Saber en qué va y hablar con el domiciliario',
    icono: 'moto',
    para: esCliente,
    ir: () => navigationRef.navigate('MisPedidos'),
    tutoriales: ['mis-pedidos', 'seguimiento'],
  },
  {
    id: 'direccion',
    titulo: 'Registrar mi dirección',
    detalle: 'Dirección, barrio y ubicación en el mapa',
    icono: 'ubicacion',
    para: esCliente,
    ir: () => navigationRef.navigate('MisDirecciones'),
    tutoriales: ['direcciones', 'editar-direccion'],
  },
  {
    id: 'datos',
    titulo: 'Completar mis datos',
    detalle: 'Nombre, celular y correo',
    icono: 'usuario',
    para: () => true,
    ir: () => navigationRef.navigate('MiInformacion'),
    tutoriales: ['mi-informacion'],
  },
  {
    id: 'cita',
    titulo: 'Pedir una cita',
    detalle: 'Peluquerías, talleres y otros servicios',
    icono: 'calendario',
    para: esCliente,
    ir: () => navigationRef.navigate('Explorar', { seccion: 'servicios' }),
    tutoriales: ['servicios', 'negocio-servicios'],
  },
  {
    id: 'registrar-negocio',
    titulo: 'Registrar mi negocio',
    detalle: 'Vender por Vitrina',
    icono: 'tienda',
    para: u => !esComerciante(u),
    ir: () => navigationRef.navigate('MiTienda', { nuevo: true }),
    tutoriales: ['crear-negocio', 'panel-negocio'],
  },
  {
    id: 'productos',
    titulo: 'Agregar productos a mi negocio',
    detalle: 'Armar y actualizar el catálogo',
    icono: 'etiqueta',
    para: tieneNegocio,
    ir: () => navigationRef.navigate('Home'),
    tutoriales: ['productos-entrar', 'mis-productos'],
  },
  {
    id: 'atender',
    titulo: 'Atender los pedidos de mi negocio',
    detalle: 'Aceptar, preparar y entregar',
    icono: 'lista',
    para: tieneNegocio,
    ir: () => navigationRef.navigate('Home'),
    tutoriales: ['pedidos-negocio'],
  },
  {
    id: 'ser-domiciliario',
    titulo: 'Ser domiciliario',
    detalle: 'Ganar llevando pedidos',
    icono: 'moto',
    para: u => esCliente(u) && !esDomiciliario(u),
    ir: () => navigationRef.navigate('Explorar', { seccion: 'productos' }),
    tutoriales: ['ser-domiciliario', 'entregas'],
  },
  {
    id: 'entregar',
    titulo: 'Tomar y entregar pedidos',
    detalle: 'Turno, recogida y entrega',
    icono: 'moto',
    para: esDomiciliario,
    ir: () => abrirEntregas(),
    tutoriales: ['entregas'],
  },
];
