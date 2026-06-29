// Rutas de navegación de la app (React Navigation - native stack).
import { ComercioPedido } from './api';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  // Comerciante
  MiTienda: undefined;
  MisCategorias: undefined;
  CategoriaProductos: { categoriaId: number | null; nombre: string };
  ComercioPedidoDetalle: { pedido: ComercioPedido };
  // Cliente
  Explorar: undefined;
  Negocio: { id: number; nombre: string };
  Carrito: undefined;
  Checkout: undefined;
  MisPedidos: undefined;
  PedidoDetalle: { id: number };
  // Admin
  AdminTablero: undefined;
  AdminUsuarios: undefined;
  AdminNegocios: undefined;
  // Domiciliario
  Domiciliario: undefined;
};
