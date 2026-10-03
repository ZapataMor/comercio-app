// Rutas de navegación de la app (React Navigation - native stack).
import { ComercioPedido } from './api';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  // Perfil PERSONAL del usuario logueado (cualquier rol).
  Perfil: undefined;
  // Negocios (cualquier usuario puede tener o trabajar en varios).
  // Lista de mis negocios + invitaciones recibidas + crear otro.
  MisNegocios: undefined;
  // Datos del negocio activo; `nuevo` abre directo el formulario de creación.
  MiTienda: { nuevo?: boolean } | undefined;
  // Catálogo del negocio activo: lista de productos + "Añadir producto".
  MisProductos: undefined;
  // Miembros e invitaciones del negocio activo.
  Equipo: undefined;
  // `negocioId`: desde un push, el pedido puede ser de otro negocio que no es el activo.
  ComercioPedidoDetalle: { pedido?: ComercioPedido; pedidoId?: number; negocioId?: number };
  // Cliente
  Explorar: undefined;
  // `productoId` opcional: al entrar desde una búsqueda de producto, el catálogo
  // resalta y hace scroll hasta ese producto.
  Negocio: { id: number; nombre: string; productoId?: number };
  Carrito: undefined;
  Checkout: undefined;
  MisPedidos: undefined;
  PedidoDetalle: { id: number };
  // Admin
  AdminTablero: undefined;
  AdminUsuarios: undefined;
  AdminNegocios: undefined;
  // Barrios sugeridos por clientes, pendientes de aprobación.
  AdminBarrios: undefined;
  // Domiciliario
  Domiciliario: undefined;
};
