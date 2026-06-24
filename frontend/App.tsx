/**
 * Comercio — app móvil (React Native)
 * Por ahora: Login contra la API y pantalla de bienvenida.
 */
import React, { useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Usuario } from './src/api';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

type Sesion = { token: string; user: Usuario };

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [sesion, setSesion] = useState<Sesion | null>(null);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        {sesion ? (
          <HomeScreen user={sesion.user} onLogout={() => setSesion(null)} />
        ) : (
          <LoginScreen onLogin={(token, user) => setSesion({ token, user })} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

export default App;
