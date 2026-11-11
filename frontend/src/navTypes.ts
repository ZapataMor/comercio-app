// Rutas de navegación de la app (React Navigation - native stack).
import { ComercioPedido, Producto, Servicio } from './api';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  // Datos personales de la cuenta: ver y modificar, y eliminar la cuenta (se
  // abre desde el menú del ícono de usuario de la topbar).
  MiInformacion: undefined;
  // Negocios (cualquier usuario puede tener o trabajar en varios).
  // Lista de mis negocios + invitaciones recibidas + crear otro.
  MisNegocios: undefined;
  // Datos del negocio activo; `nuevo` abre directo el formulario de creación.
  MiTienda: { nuevo?: boolean } | undefined;
  // Catálogo del negocio activo: lista de productos + "Añadir producto".
  MisProductos: undefined;
  MisServicios: undefined;
  // Miembros e invitaciones del negocio activo.
  Equipo: undefined;
  AgendarCita: {
    negocioId: number;
    negocioNombre: string;
    servicio: Pick<Servicio, 'id' | 'nombre' | 'duracion_minutos' | 'precio'>;
    presencial?: boolean;
    // Desde Mis citas: mueve esa cita en vez de pedir una nueva.
    reprogramar?: { citaId: number; fecha: string; profesionalId: number | null };
  };
  MisCitas: undefined;
  AgendaNegocio: { negocioId?: number } | undefined;
  // `negocioId`: desde un push, el pedido puede ser de otro negocio que no es el activo.
  ComercioPedidoDetalle: { pedido?: ComercioPedido; pedidoId?: number; negocioId?: number };
  // Historial de pedidos del negocio activo (pestañas) y ventas de hoy.
  PedidosNegocio: undefined;
  // Cliente
  Explorar: { seccion?: 'productos' | 'servicios' } | undefined;
  // Mapa de negocios; `admin` suma a los domiciliarios en vivo.
  Mapa: { admin?: boolean } | undefined;
  // `productoId` opcional: al entrar desde una búsqueda de producto, el catálogo
  // resalta y hace scroll hasta ese producto.
  Negocio: { id: number; nombre: string; productoId?: number; seccion?: 'productos' | 'servicios' };
  // Detalle de un producto del catálogo; `abierto`: si el negocio recibe pedidos.
  Producto: { negocioId: number; negocioNombre: string; abierto: boolean; producto: Producto };
  // Reseñas de una tienda o, con `productoId`, de uno de sus productos.
  Resenas: { negocioId: number; titulo: string; productoId?: number };
  Carrito: undefined;
  Checkout: undefined;
  MisDirecciones: undefined;
  MisPedidos: undefined;
  PedidoDetalle: { id: number };
  // Admin
  AdminTablero: undefined;
  AdminUsuarios: undefined;
  AdminNegocios: undefined;
  // Pedidos en curso y cierre manual de los que se atascan.
  AdminPedidos: undefined;
  AdminReportes: undefined;
  // Barrios sugeridos por clientes, pendientes de aprobación.
  AdminBarrios: undefined;
  // Confiabilidad de domiciliarios y negocios (vetados, en riesgo, eventos).
  AdminReputacion: undefined;
  AdminResenas: undefined;
  // Domiciliario: "Mis entregas", con las disponibles y las que lleva en curso.
  Entregas: undefined;
  // Domiciliario: entregas que ya completé (paginadas).
  PedidosEntregados: undefined;
};
