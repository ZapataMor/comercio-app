/**
 * Comercio — app móvil (React Native)
 * Navegación con React Navigation + sesión persistente (AsyncStorage).
 */
import { DarkTheme, DefaultTheme, NavigationContainer, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colores, font, makeStyles, ThemeProvider, useTheme } from './src/theme';
import { AuthProvider, useAuth } from './src/AuthContext';
import { CartProvider } from './src/CartContext';
import BarraCliente from './src/components/BarraCliente';
import { FlyToCartProvider } from './src/components/FlyToCart';
import HeaderPerfil from './src/components/HeaderPerfil';
import { VitrinaHeaderLogo } from './src/components/Logo';
import SplashVitrina from './src/components/SplashVitrina';
import { NegocioProvider } from './src/NegocioContext';
import { configurarMensajesForeground } from './src/pushNotifications';
import { navigationRef, procesarNotificacionPendiente } from './src/RootNavigation';
import { ToastProvider } from './src/Toast';
import { useToast } from './src/Toast';
import { RootStackParamList } from './src/navTypes';
import HomeScreen from './src/screens/HomeScreen';
import PerfilScreen from './src/screens/PerfilScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MiTiendaScreen from './src/screens/MiTiendaScreen';
import MisNegociosScreen from './src/screens/MisNegociosScreen';
import MisProductosScreen from './src/screens/MisProductosScreen';
import EquipoScreen from './src/screens/EquipoScreen';
import ComercioPedidoDetalleScreen from './src/screens/ComercioPedidoDetalleScreen';
import ExplorarScreen from './src/screens/ExplorarScreen';
import NegocioScreen from './src/screens/NegocioScreen';
import AdminTableroScreen from './src/screens/AdminTableroScreen';
import AdminUsuariosScreen from './src/screens/AdminUsuariosScreen';
import AdminNegociosScreen from './src/screens/AdminNegociosScreen';
import AdminBarriosScreen from './src/screens/AdminBarriosScreen';
import DomiciliarioScreen from './src/screens/DomiciliarioScreen';
import CarritoScreen from './src/screens/CarritoScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import MisPedidosScreen from './src/screens/MisPedidosScreen';
import PedidoDetalleScreen from './src/screens/PedidoDetalleScreen';

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
  const [ruta, setRuta] = React.useState<string | undefined>();
  const actualizarRuta = () => setRuta(navigationRef.getCurrentRoute()?.name);

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const inicial = !auth ? 'Login' : roles.includes('usuario') ? 'Explorar' : 'Home';

  return (
    <FlyToCartProvider>
      <View style={styles.raiz}>
        <NavigationContainer
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
            {/* El cliente entra directo a Explorar (su "Home" es la lista de
                negocios). El menú Home solo existe para los demás roles. */}
            {roles.includes('usuario') && (
              <>
                <Stack.Screen
                  name="Explorar"
                  component={ExplorarScreen}
                  options={{ title: 'Vitrina', headerTitle: tituloVitrina }}
                />
                <Stack.Screen
                  name="Negocio"
                  component={NegocioScreen}
                  options={({ route }) => ({ title: route.params.nombre })}
                />
                <Stack.Screen name="Carrito" component={CarritoScreen} options={{ title: 'Carrito' }} />
                <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Confirmar pedido' }} />
                <Stack.Screen name="MisPedidos" component={MisPedidosScreen} options={{ title: 'Mis pedidos' }} />
                <Stack.Screen name="PedidoDetalle" component={PedidoDetalleScreen} options={{ title: 'Seguimiento' }} />
              </>
            )}

            {/* Home: menú de los demás roles y panel del negocio activo. El
                cliente llega aquí desde "Mis negocios" si tiene alguno. */}
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{ title: 'Vitrina', headerTitle: tituloVitrina }}
            />
            <Stack.Screen
              name="Perfil"
              component={PerfilScreen}
              options={{ title: 'Mi perfil', headerRight: () => null }}
            />

            {/* Negocios: cualquier usuario puede crear los suyos o trabajar en
                otros (el acceso lo decide la membresía, no un rol global). */}
            <Stack.Screen name="MisNegocios" component={MisNegociosScreen} options={{ title: 'Mis negocios' }} />
            <Stack.Screen name="MiTienda" component={MiTiendaScreen} options={{ title: 'Mi Tienda' }} />
            <Stack.Screen name="MisProductos" component={MisProductosScreen} options={{ title: 'Productos' }} />
            <Stack.Screen name="Equipo" component={EquipoScreen} options={{ title: 'Equipo' }} />
            <Stack.Screen
              name="ComercioPedidoDetalle"
              component={ComercioPedidoDetalleScreen}
              options={{ title: 'Pedido' }}
            />

            {roles.includes('administrador') && (
              <>
                <Stack.Screen name="AdminTablero" component={AdminTableroScreen} options={{ title: 'Administración' }} />
                <Stack.Screen name="AdminUsuarios" component={AdminUsuariosScreen} options={{ title: 'Usuarios' }} />
                <Stack.Screen name="AdminNegocios" component={AdminNegociosScreen} options={{ title: 'Negocios' }} />
                <Stack.Screen name="AdminBarrios" component={AdminBarriosScreen} options={{ title: 'Barrios sugeridos' }} />
              </>
            )}

            {roles.includes('domiciliario') && (
              <Stack.Screen name="Domiciliario" component={DomiciliarioScreen} options={{ title: 'Mis entregas' }} />
            )}
          </>
        )}
      </Stack.Navigator>
        </NavigationContainer>
        <BarraCliente ruta={ruta} />
      </View>
    </FlyToCartProvider>
  );
}

function PushBridge() {
  const { auth } = useAuth();
  const toast = useToast();

  React.useEffect(() => {
    return configurarMensajesForeground(auth?.user, message => {
      const titulo = message.notification?.title ?? 'Nueva notificacion';
      const cuerpo = message.notification?.body;
      toast.info(titulo, cuerpo);
    });
  }, [auth?.user, toast]);

  React.useEffect(() => {
    procesarNotificacionPendiente(auth?.user);
  }, [auth?.user]);

  return null;
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
              <StatusBar barStyle="light-content" backgroundColor={c.header} />
              <PushBridge />
              <View style={styles.raiz}>
                <Navegacion />
                {splashVisible && <SplashVitrina onFin={ocultarSplash} />}
              </View>
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
