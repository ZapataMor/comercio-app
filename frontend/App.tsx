import EstadoConexion from './src/components/EstadoConexion';
/**
 * Comercio — app móvil (React Native)
 * Navegación con React Navigation + sesión persistente (AsyncStorage).
 */
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, AppState, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAlarmaPedidos } from './src/alarmaPedidos';
import { Colores, font, makeStyles, ThemeProvider, useTheme } from './src/theme';
import { AuthProvider, useAuth } from './src/AuthContext';
import { CartProvider } from './src/CartContext';
import { PedidoPendienteProvider } from './src/PedidoPendienteContext';
import VigilarCarrito from './src/components/VigilarCarrito';
import EnvioPedidoAviso from './src/components/EnvioPedidoAviso';
import AvisoPedidoNuevo from './src/components/AvisoPedidoNuevo';
import BarraCliente from './src/components/BarraCliente';
import { ConfirmacionProvider } from './src/components/Confirmacion';
import ConfirmarCierre from './src/components/ConfirmarCierre';
import OfertaPedido from './src/components/OfertaPedido';
import { AppDesenfocable } from './src/components/Desenfoque';
import { FlyToCartProvider } from './src/components/FlyToCart';
import HeaderPerfil from './src/components/HeaderPerfil';
import HeaderCatalogo from './src/components/HeaderCatalogo';
import { CapaMenus } from './src/components/MenuDesplegable';
import { VitrinaHeaderLogo } from './src/components/Logo';
import SplashVitrina from './src/components/SplashVitrina';
import { NegocioProvider, useNegocio } from './src/NegocioContext';
import { configurarMensajesForeground } from './src/pushNotifications';
import { navigationRef, procesarNotificacionPendiente, rutaInicio } from './src/RootNavigation';
import { ToastProvider } from './src/Toast';
import { avisarCambioDesdePush, useAvisosEnVivo } from './src/usePolling';
import { actualizarCanalesEnVivo, conectarEnVivo, desconectarEnVivo } from './src/enVivo';
import { Usuario } from './src/api';
import { useToast } from './src/Toast';
import { RootStackParamList } from './src/navTypes';
import HomeScreen from './src/screens/HomeScreen';
import MiInformacionScreen from './src/screens/MiInformacionScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MiTiendaScreen from './src/screens/MiTiendaScreen';
import ResenasScreen from './src/screens/ResenasScreen';
import MisNegociosScreen from './src/screens/MisNegociosScreen';
import MisProductosScreen from './src/screens/MisProductosScreen';
import MisServiciosScreen from './src/screens/MisServiciosScreen';
import EquipoScreen from './src/screens/EquipoScreen';
import AgendarCitaScreen from './src/screens/AgendarCitaScreen';
import CitasScreen from './src/screens/CitasScreen';
import ComercioPedidoDetalleScreen from './src/screens/ComercioPedidoDetalleScreen';
import PedidosNegocioScreen from './src/screens/PedidosNegocioScreen';
import ExplorarScreen from './src/screens/ExplorarScreen';
import NegocioScreen from './src/screens/NegocioScreen';
import ProductoScreen from './src/screens/ProductoScreen';
import AdminTableroScreen from './src/screens/AdminTableroScreen';
import AdminUsuariosScreen from './src/screens/AdminUsuariosScreen';
import AdminNegociosScreen from './src/screens/AdminNegociosScreen';
import AdminPedidosScreen from './src/screens/AdminPedidosScreen';
import AdminReportesScreen from './src/screens/AdminReportesScreen';
import AdminBarriosScreen from './src/screens/AdminBarriosScreen';
import AdminReputacionScreen from './src/screens/AdminReputacionScreen';
import AdminResenasScreen from './src/screens/AdminResenasScreen';
import EntregasScreen from './src/screens/EntregasScreen';
import PedidosEntregadosScreen from './src/screens/PedidosEntregadosScreen';
import CarritoScreen from './src/screens/CarritoScreen';
import MisDireccionesScreen from './src/screens/MisDireccionesScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import MisPedidosScreen from './src/screens/MisPedidosScreen';
import PedidoDetalleScreen from './src/screens/PedidoDetalleScreen';
import MapaScreen from './src/screens/MapaScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Logo de la marca (día/noche según la hora) como título del header.
const tituloVitrina = () => <VitrinaHeaderLogo />;

/** Tema de React Navigation alineado con el modo (fondos de transición, header). */
function temaNavegacion(c: Colores, noche: boolean): Theme {
  const base = noche ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: noche,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.bg,
      card: c.header,
      text: c.onHeader,
      border: c.border,
      notification: c.accent,
    },
  };
}

function Navegacion() {
  const { c, modo } = useTheme();
  const styles = useStyles();
  const { auth, cargando } = useAuth();
  const roles = auth?.user.roles ?? [];
  // Ruta actual: la barra flotante del cliente decide con ella qué mostrar.
  const [ruta, setRuta] = React.useState<ReturnType<typeof navigationRef.getCurrentRoute>>();
  const actualizarRuta = () => setRuta(navigationRef.getCurrentRoute());

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const inicial = !auth ? 'Login' : rutaInicio(auth.user);

  return (
    <FlyToCartProvider>
      {/* Los menús de la topbar ("Mi perfil", "Mis negocios") se pintan
          encima, nítidos; la app se pone borrosa detrás. */}
      <CapaMenus>
      <AppDesenfocable style={styles.raiz}>
        {/* La key la rearma al entrar o salir de la cuenta: el navegador solo
            lee initialRouteName al montarse, y sin esto, tras iniciar sesión
            abriría la primera pantalla de la lista en vez de rutaInicio. */}
        <NavigationContainer
          key={auth ? `usuario-${auth.user.id}` : 'sin-sesion'}
          ref={navigationRef}
          theme={temaNavegacion(c, modo === 'noche')}
          onReady={() => {
            actualizarRuta();
            procesarNotificacionPendiente(auth?.user);
          }}
          onStateChange={actualizarRuta}>
      <Stack.Navigator
        initialRouteName={inicial}
        screenOptions={{
          headerStyle: { backgroundColor: c.header },
          headerTintColor: c.onHeader,
          headerTitleStyle: { fontWeight: '700', fontFamily: font.display, color: c.onHeader },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
          // "Mi perfil" (la persona, no el negocio) visible en todos los roles.
          headerRight: auth ? () => <HeaderPerfil /> : undefined,
        }}>
        {!auth ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            {/* Pantallas del cliente: toda cuenta nueva lo es, y el
                domiciliario también. Arranca en Explorar (la lista de
                negocios), salvo el domiciliario, que arranca en Entregas, y
                el comerciante, en Home (ver rutaInicio). */}
            {roles.includes('usuario') && (
              <>
                <Stack.Screen
                  name="Explorar"
                  component={ExplorarScreen}
                  options={({ route, navigation }) => ({
                    title: 'Vitrina', headerTitle: tituloVitrina,
                    headerRight: () => <HeaderCatalogo seccion={route.params?.seccion ?? 'productos'} onCambiar={() => navigation.setParams({ seccion: route.params?.seccion === 'servicios' ? 'productos' : 'servicios' })} />,
                  })}
                />
                <Stack.Screen
                  name="Negocio"
                  component={NegocioScreen}
                  options={({ route }) => ({ title: route.params.nombre })}
                />
                <Stack.Screen
                  name="Producto"
                  component={ProductoScreen}
                  options={({ route }) => ({ title: route.params.negocioNombre })}
                />
                <Stack.Screen name="Carrito" component={CarritoScreen} options={{ title: 'Carrito' }} />
                <Stack.Screen name="MisDirecciones" component={MisDireccionesScreen} options={{ title: 'Mis direcciones' }} />
                <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Confirmar pedido' }} />
                <Stack.Screen name="MisPedidos" component={MisPedidosScreen} options={{ title: 'Mis pedidos' }} />
                <Stack.Screen name="PedidoDetalle" component={PedidoDetalleScreen} options={{ title: 'Seguimiento' }} />
              </>
            )}

            {/* Home: menú de los demás roles y panel del negocio activo. El
                cliente llega aquí desde "Mis negocios" (menú del ícono de
                usuario); el comerciante arranca aquí. */}
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Vitrina', headerTitle: tituloVitrina }}
            />
            {/* "Mis entregas" del domiciliario. Va sin condición de rol porque
                "Ser domiciliario" navega aquí en cuanto activa el rol, antes
                de que esta lista se vuelva a pintar. */}
            <Stack.Screen
              name="Entregas"
              component={EntregasScreen}
              options={{ title: 'Mis entregas', headerTitle: tituloVitrina }}
            />
            {/* Mi información, Mis negocios y Privacidad se abren desde el menú
                del ícono de usuario (HeaderPerfil), sin pantalla intermedia. */}
            <Stack.Screen
              name="MiInformacion"
              component={MiInformacionScreen}
              options={{ title: 'Mi información', headerRight: () => null }}
            />

            {/* Mapa de negocios (cliente) y de domiciliarios en vivo (admin). */}
            {(roles.includes('usuario') || roles.includes('administrador')) && (
              <Stack.Screen name="Mapa" component={MapaScreen} options={{ title: 'Mapa' }} />
            )}

            {/* Negocios: cualquier usuario puede crear los suyos o trabajar en
                otros (el acceso lo decide la membresía, no un rol global). */}
            <Stack.Screen name="MisNegocios" component={MisNegociosScreen} options={{ title: 'Mis negocios' }} />
            <Stack.Screen name="MiTienda" component={MiTiendaScreen} options={{ title: 'Mi Tienda' }} />
            {/* Las lee el cliente y también el dueño, desde Mi Tienda. */}
            <Stack.Screen name="Resenas" component={ResenasScreen} options={{ title: 'Reseñas' }} />
            <Stack.Screen name="MisProductos" component={MisProductosScreen} options={{ title: 'Mis productos' }} />
            <Stack.Screen name="MisServicios" component={MisServiciosScreen} options={{ title: 'Mis servicios' }} />
            <Stack.Screen name="Equipo" component={EquipoScreen} options={{ title: 'Equipo' }} />
            <Stack.Screen name="AgendarCita" component={AgendarCitaScreen} options={{ title: 'Agendar cita' }} />
            <Stack.Screen name="MisCitas" component={CitasScreen} options={{ title: 'Mis citas' }} />
            <Stack.Screen name="AgendaNegocio" component={CitasScreen} options={{ title: 'Agenda de citas' }} />
            <Stack.Screen
              name="ComercioPedidoDetalle"
              component={ComercioPedidoDetalleScreen}
              options={{ title: 'Pedido' }}
            />
            <Stack.Screen name="PedidosNegocio" component={PedidosNegocioScreen} options={{ title: 'Pedidos' }} />

            {roles.includes('administrador') && (
              <>
                <Stack.Screen name="AdminTablero" component={AdminTableroScreen} options={{ title: 'Administración' }} />
                <Stack.Screen name="AdminUsuarios" component={AdminUsuariosScreen} options={{ title: 'Usuarios' }} />
                <Stack.Screen name="AdminNegocios" component={AdminNegociosScreen} options={{ title: 'Negocios' }} />
                <Stack.Screen name="AdminPedidos" component={AdminPedidosScreen} options={{ title: 'Pedidos en curso' }} />
            <Stack.Screen name="AdminReportes" component={AdminReportesScreen} options={{ title: 'Reportes' }} />
                <Stack.Screen name="AdminBarrios"component={AdminBarriosScreen} options={{ title: 'Barrios sugeridos' }} />
                <Stack.Screen
                  name="AdminReputacion"
                  component={AdminReputacionScreen}
                  options={{ title: 'Confiabilidad' }}
                />
                <Stack.Screen name="AdminResenas" component={AdminResenasScreen} options={{ title: 'Reseñas' }} />
              </>
            )}

            {/* Historial de las entregas que el domiciliario ya completó. */}
            {roles.includes('domiciliario') && (
              <Stack.Screen
                name="PedidosEntregados"
                component={PedidosEntregadosScreen}
                options={{ title: 'Pedidos entregados' }}
              />
            )}
          </>
        )}
      </Stack.Navigator>
        </NavigationContainer>
        <BarraCliente ruta={ruta?.name} seccion={ruta?.name === 'Negocio' ? ruta.params.seccion : undefined} />
      </AppDesenfocable>
      </CapaMenus>
    </FlyToCartProvider>
  );
}

function PushBridge() {
  const { auth } = useAuth();
  const toast = useToast();

  React.useEffect(() => {
    return configurarMensajesForeground(auth?.user, message => {
      // Los avisos de datos traen su texto aparte, y los silenciosos no traen.
      const titulo = message.notification?.title ?? message.data?.titulo;
      const cuerpo = message.notification?.body ?? message.data?.cuerpo;
      if (typeof titulo === 'string' && message.data?.tipo !== 'confirmar_cierre') {
        toast.info(titulo, typeof cuerpo === 'string' ? cuerpo : undefined);
      }
      // Algo cambió: las pantallas en vivo se refrescan ya, sin esperar.
      avisarCambioDesdePush();
    });
  }, [auth?.user, toast]);

  // Con la app en segundo plano, tocar una notificación solo la deja pendiente.
  React.useEffect(() => {
    procesarNotificacionPendiente(auth?.user);
    const sub = AppState.addEventListener('change', estado => {
      if (estado === 'active') procesarNotificacionPendiente(auth?.user);
    });
    return () => sub.remove();
  }, [auth?.user]);

  return null;
}

/** Lo que de la sesión cambia en vivo (roles, datos, turno, negocios). */
function huellaUsuario(u: Usuario): string {
  return JSON.stringify([
    u.name, u.apellidos ?? null, u.email, [...u.roles].sort(), u.direccion ?? null, u.barrio ?? null,
    u.telefono ?? null, u.codigo_publico ?? null, !!u.en_turno,
    (u.negocios ?? []).map(n => [n.id, n.nombre, n.rol]).sort((a, b) => Number(a[0]) - Number(b[0])),
  ]);
}

/**
 * Conexión de cambios en vivo (src/enVivo.ts) mientras hay sesión. Si el admin
 * me cambia el rol, si entro a un equipo o edito mi perfil en otro teléfono,
 * la sesión se pone al día sola (y con ella el menú y las pantallas). Si me
 * suspenden, la API responde 401 y la app vuelve al login.
 */
function EnVivoBridge() {
  const { auth, actualizarUsuario } = useAuth();
  const token = auth?.token ?? null;
  const usuarioRef = React.useRef(auth?.user);
  usuarioRef.current = auth?.user;

  const aplicar = React.useCallback(
    (nuevo: Usuario | null) => {
      const actual = usuarioRef.current;
      if (nuevo && actual && nuevo.id === actual.id && huellaUsuario(nuevo) !== huellaUsuario(actual)) {
        actualizarUsuario({ ...actual, ...nuevo });
      }
    },
    [actualizarUsuario],
  );

  React.useEffect(() => {
    if (!token) {
      desconectarEnVivo();
      return;
    }
    conectarEnVivo(token).then(aplicar).catch(() => {});
    return () => desconectarEnVivo();
  }, [token, aplicar]);

  useAvisosEnVivo(token ? ['perfil', 'negocios', '*'] : null, () => {
    actualizarCanalesEnVivo().then(aplicar).catch(() => {});
  });

  return null;
}

/**
 * La alarma de pedidos y su aviso siguen vivos en toda la app, no solo en el
 * Inicio. `mostrarAviso`: el aviso espera a que termine el splash.
 */
function AlarmaBridge({ mostrarAviso }: { mostrarAviso: boolean }) {
  const { auth } = useAuth();
  const { negocios } = useNegocio();
  const enEspera = useAlarmaPedidos(auth?.token ?? null, negocios.length > 0);
  return mostrarAviso ? <AvisoPedidoNuevo pedidos={enEspera} /> : null;
}

/** Antes del cierre automático se le pregunta al dueño, en cualquier pantalla. */
function CierreBridge() {
  const { auth } = useAuth();
  const { negocios } = useNegocio();
  return auth && negocios.length > 0 ? <ConfirmarCierre key={auth.user.id} /> : null;
}

/** Al domiciliario los pedidos se le ofrecen en cualquier pantalla. */
function OfertaBridge() {
  const { auth } = useAuth();
  return auth?.user.roles.includes('domiciliario') ? <OfertaPedido key={auth.user.id} /> : null;
}

function App() {
  // Toda la app toma los colores del modo vigente (día/noche según la hora).
  return (
    <ThemeProvider>
      <AppContenido />
    </ThemeProvider>
  );
}

function AppContenido() {
  // Splash animado de la marca (toldo → V → foco → destello → nombre) al
  // abrir la app; tapa la carga inicial y luego se desvanece.
  const { c } = useTheme();
  const styles = useStyles();
  const [splashVisible, setSplashVisible] = React.useState(true);
  const ocultarSplash = React.useCallback(() => setSplashVisible(false), []);

  return (
    <AuthProvider>
      <NegocioProvider>
        <CartProvider>
          <SafeAreaProvider>
            <ToastProvider>
              <EstadoConexion />
              {/* Diálogos de confirmación con el estilo de la app (useConfirmar). */}
              <ConfirmacionProvider>
                <PedidoPendienteProvider>
                <StatusBar barStyle="light-content" backgroundColor={c.header} />
                <PushBridge />
                <EnVivoBridge />
                <AlarmaBridge mostrarAviso={!splashVisible} />
                {!splashVisible && <OfertaBridge />}
                {!splashVisible && <CierreBridge />}
                <View style={styles.raiz}>
                  <Navegacion />
                  {!splashVisible && <EnvioPedidoAviso />}
                  {!splashVisible && <VigilarCarrito />}
                  {splashVisible && <SplashVitrina onFin={ocultarSplash} />}
                </View>
                </PedidoPendienteProvider>
              </ConfirmacionProvider>
            </ToastProvider>
          </SafeAreaProvider>
        </CartProvider>
      </NegocioProvider>
    </AuthProvider>
  );
}

const useStyles = makeStyles(c => ({
  raiz: { flex: 1 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
}));

export default App;
