// Rutas de navegación de la app (React Navigation - native stack).
import { ComercioPedido } from './api';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  // Perfil PERSONAL del usuario logueado (cualquier rol).
  Perfil: undefined;
  // Comerciante
  MiTienda: undefined;
  MisCategorias: undefined;
  CategoriaProductos: { categoriaId: number | null; nombre: string };
  ComercioPedidoDetalle: { pedido?: ComercioPedido; pedidoId?: number };
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
