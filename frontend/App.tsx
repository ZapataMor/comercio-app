/**
 * Comercio — app móvil (React Native)
 * Navegación con React Navigation + sesión persistente (AsyncStorage).
 */
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/AuthContext';
import { CartProvider } from './src/CartContext';
import { NegocioProvider } from './src/NegocioContext';
import { configurarMensajesForeground } from './src/pushNotifications';
import { navigationRef, procesarNotificacionPendiente } from './src/RootNavigation';
import { ToastProvider } from './src/Toast';
import { useToast } from './src/Toast';
import { RootStackParamList } from './src/navTypes';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MiTiendaScreen from './src/screens/MiTiendaScreen';
import MisCategoriasScreen from './src/screens/MisCategoriasScreen';
import CategoriaProductosScreen from './src/screens/CategoriaProductosScreen';
import ComercioPedidoDetalleScreen from './src/screens/ComercioPedidoDetalleScreen';
import ExplorarScreen from './src/screens/ExplorarScreen';
import NegocioScreen from './src/screens/NegocioScreen';
import AdminTableroScreen from './src/screens/AdminTableroScreen';
import AdminUsuariosScreen from './src/screens/AdminUsuariosScreen';
import AdminNegociosScreen from './src/screens/AdminNegociosScreen';
import DomiciliarioScreen from './src/screens/DomiciliarioScreen';
import CarritoScreen from './src/screens/CarritoScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import MisPedidosScreen from './src/screens/MisPedidosScreen';
import PedidoDetalleScreen from './src/screens/PedidoDetalleScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

function Navegacion() {
  const { auth, cargando } = useAuth();
  const roles = auth?.user.roles ?? [];

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  const inicial = !auth ? 'Login' : roles.includes('usuario') ? 'Explorar' : 'Home';

  return (
    <NavigationContainer ref={navigationRef} onReady={() => procesarNotificacionPendiente(auth?.user)}>
      <Stack.Navigator
        initialRouteName={inicial}
        screenOptions={{
          headerStyle: { backgroundColor: '#4f46e5' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}>
        {!auth ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Comercio' }} />

            {roles.includes('comerciante') && (
              <>
                <Stack.Screen name="MiTienda" component={MiTiendaScreen} options={{ title: 'Mi Tienda' }} />
                <Stack.Screen name="MisCategorias" component={MisCategoriasScreen} options={{ title: 'Categorías' }} />
                <Stack.Screen
                  name="CategoriaProductos"
                  component={CategoriaProductosScreen}
                  options={({ route }) => ({ title: route.params.nombre })}
                />
                <Stack.Screen
                  name="ComercioPedidoDetalle"
                  component={ComercioPedidoDetalleScreen}
                  options={{ title: 'Pedido' }}
                />
              </>
            )}

            {roles.includes('usuario') && (
              <>
                <Stack.Screen name="Explorar" component={ExplorarScreen} options={{ title: 'Negocios abiertos' }} />
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

            {roles.includes('administrador') && (
              <>
                <Stack.Screen name="AdminTablero" component={AdminTableroScreen} options={{ title: 'Administración' }} />
                <Stack.Screen name="AdminUsuarios" component={AdminUsuariosScreen} options={{ title: 'Usuarios' }} />
                <Stack.Screen name="AdminNegocios" component={AdminNegociosScreen} options={{ title: 'Negocios' }} />
              </>
            )}

            {roles.includes('domiciliario') && (
              <Stack.Screen name="Domiciliario" component={DomiciliarioScreen} options={{ title: 'Mis entregas' }} />
            )}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
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
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <AuthProvider>
      <NegocioProvider>
        <CartProvider>
          <SafeAreaProvider>
            <ToastProvider>
              <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
              <PushBridge />
              <Navegacion />
            </ToastProvider>
          </SafeAreaProvider>
        </CartProvider>
      </NegocioProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
});

export default App;
