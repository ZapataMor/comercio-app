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
import { RootStackParamList } from './src/navTypes';
import HomeScreen from './src/screens/HomeScreen';
import LoginScreen from './src/screens/LoginScreen';
import MiTiendaScreen from './src/screens/MiTiendaScreen';
import MisProductosScreen from './src/screens/MisProductosScreen';
import ComercioPedidosScreen from './src/screens/ComercioPedidosScreen';
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
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={inicial}
        screenOptions={{
          headerStyle: { backgroundColor: '#4f46e5' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}>
        {!auth ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Comercio' }} />

            {roles.includes('comerciante') && (
              <>
                <Stack.Screen name="MiTienda" component={MiTiendaScreen} options={{ title: 'Mi Tienda' }} />
                <Stack.Screen name="MisProductos" component={MisProductosScreen} options={{ title: 'Mis Productos' }} />
                <Stack.Screen name="ComercioPedidos" component={ComercioPedidosScreen} options={{ title: 'Pedidos recibidos' }} />
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

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <AuthProvider>
      <CartProvider>
        <SafeAreaProvider>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <Navegacion />
        </SafeAreaProvider>
      </CartProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
});

export default App;
