// Rutas de navegación de la app (React Navigation - native stack).
export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  // Comerciante
  MiTienda: undefined;
  MisProductos: undefined;
  ComercioPedidos: undefined;
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
