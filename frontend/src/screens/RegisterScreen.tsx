import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { register, RolPublico } from '../api';
import { useAuth } from '../AuthContext';
import { RootStackParamList } from '../navTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

// Solo se permiten estos dos roles al registrarse desde la app.
// 'administrador' y 'domiciliario' NO se ofrecen (los crea un admin).
const OPCIONES: { rol: RolPublico; titulo: string; sub: string; emoji: string }[] = [
  { rol: 'usuario', titulo: 'Cliente', sub: 'Quiero comprar y pedir domicilios', emoji: '🛍️' },
  { rol: 'comerciante', titulo: 'Comerciante', sub: 'Quiero vender en mi negocio', emoji: '🏪' },
];

export default function RegisterScreen({ navigation }: Props) {
  const { entrar: guardarSesion } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [rol, setRol] = useState<RolPublico>('usuario');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crearCuenta() {
    setError(null);

    if (!nombre.trim() || !email.trim() || !password) {
      setError('Completa nombre, correo y contraseña.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    try {
      const { token, user } = await register({
        name: nombre.trim(),
        email: email.trim(),
        password,
        role: rol,
      });
      guardarSesion(token, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.logo}>🛒 Crear cuenta</Text>
          <Text style={styles.subtitle}>Únete a Comercio</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Tu nombre"
            editable={!cargando}
          />

          <Text style={styles.label}>Correo</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="correo@ejemplo.co"
            editable={!cargando}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Mínimo 8 caracteres"
            editable={!cargando}
          />

          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            value={confirmar}
            onChangeText={setConfirmar}
            secureTextEntry
            placeholder="Repite la contraseña"
            editable={!cargando}
          />

          <Text style={styles.label}>¿Cómo quieres usar la app?</Text>
          <View style={styles.opciones}>
            {OPCIONES.map(o => (
              <TouchableOpacity
                key={o.rol}
                style={[styles.opcion, rol === o.rol && styles.opcionOn]}
                onPress={() => setRol(o.rol)}
                disabled={cargando}>
                <Text style={styles.opcionEmoji}>{o.emoji}</Text>
                <Text style={[styles.opcionTitulo, rol === o.rol && styles.opcionTituloOn]}>
                  {o.titulo}
                </Text>
                <Text style={[styles.opcionSub, rol === o.rol && styles.opcionSubOn]}>
                  {o.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.boton, cargando && styles.botonDisabled]}
            onPress={crearCuenta}
            disabled={cargando}>
            {cargando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.botonTexto}>Crear cuenta</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} disabled={cargando}>
            <Text style={styles.hint}>¿Ya tienes cuenta? Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  logo: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', color: '#4f46e5' },
  subtitle: { textAlign: 'center', color: '#64748b', marginTop: 4, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
    color: '#0f172a',
  },
  opciones: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  opcion: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#f8fafc',
  },
  opcionOn: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  opcionEmoji: { fontSize: 24 },
  opcionTitulo: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 6 },
  opcionTituloOn: { color: '#4338ca' },
  opcionSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  opcionSubOn: { color: '#6366f1' },
  boton: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  botonDisabled: { opacity: 0.7 },
  botonTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  error: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 13,
  },
  hint: { textAlign: 'center', color: '#4f46e5', fontSize: 14, marginTop: 18, fontWeight: '600' },
});
