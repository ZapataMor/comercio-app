// Rutas de navegación de la app (React Navigation - native stack).
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  // Comerciante
  MiTienda: undefined;
  MisProductos: undefined;
  MisCategorias: undefined;
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
