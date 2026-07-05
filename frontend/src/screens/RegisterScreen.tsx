import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { register, RolPublico } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon, { IconName } from '../components/Icon';
import { VitrinaMark } from '../components/Logo';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

// Solo se permiten estos dos roles al registrarse desde la app.
// 'administrador' y 'domiciliario' NO se ofrecen (los crea un admin).
const OPCIONES: { rol: RolPublico; titulo: string; sub: string; icon: IconName }[] = [
  { rol: 'usuario', titulo: 'Cliente', sub: 'Quiero comprar y pedir domicilios', icon: 'bolsa' },
  { rol: 'comerciante', titulo: 'Comerciante', sub: 'Quiero vender en mi negocio', icon: 'tienda' },
];

export default function RegisterScreen({ navigation }: Props) {
  const { entrar: guardarSesion } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [direccion, setDireccion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [rol, setRol] = useState<RolPublico>('usuario');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function crearCuenta() {
    setError(null);

    if (!nombre.trim() || !email.trim() || !password) {
      setError('Completa nombre, correo y contraseña.');
      return;
    }
    if (rol === 'usuario' && (!direccion.trim() || !barrio.trim())) {
      setError('Completa direccion y barrio para tus pedidos.');
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
        direccion: rol === 'usuario' ? direccion.trim() : undefined,
        barrio: rol === 'usuario' ? barrio.trim() : undefined,
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
      <StatusBar barStyle="dark-content" backgroundColor={c.bg} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <FadeInView style={styles.card}>
          <View style={styles.logoRow}>
            <VitrinaMark size={30} />
            <Text style={styles.logo}>Crear cuenta</Text>
          </View>
          <Text style={styles.subtitle}>Únete a Vitrina</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Tu nombre"
            placeholderTextColor={c.mutedSoft}
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
            placeholderTextColor={c.mutedSoft}
            editable={!cargando}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={c.mutedSoft}
            editable={!cargando}
          />

          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            value={confirmar}
            onChangeText={setConfirmar}
            secureTextEntry
            placeholder="Repite la contraseña"
            placeholderTextColor={c.mutedSoft}
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
                <Icon
                  name={o.icon}
                  size={24}
                  color={rol === o.rol ? c.onAccent : c.muted}
                  style={styles.opcionEmoji}
                />
                <Text style={[styles.opcionTitulo, rol === o.rol && styles.opcionTituloOn]}>
                  {o.titulo}
                </Text>
                <Text style={[styles.opcionSub, rol === o.rol && styles.opcionSubOn]}>
                  {o.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {rol === 'usuario' ? (
            <>
              <Text style={styles.label}>Direccion</Text>
              <TextInput
                style={styles.input}
                value={direccion}
                onChangeText={setDireccion}
                placeholder="Calle, numero, referencia"
                placeholderTextColor={c.mutedSoft}
                editable={!cargando}
              />

              <Text style={styles.label}>Barrio</Text>
              <TextInput
                style={styles.input}
                value={barrio}
                onChangeText={setBarrio}
                placeholder="Barrio"
                placeholderTextColor={c.mutedSoft}
                editable={!cargando}
              />
            </>
          ) : null}

          <PressableScale
            style={[styles.boton, cargando && styles.botonDisabled]}
            onPress={crearCuenta}
            disabled={cargando}>
            {cargando ? (
              <ActivityIndicator color={c.onBrand} />
            ) : (
              <Text style={styles.botonTexto}>Crear cuenta</Text>
            )}
          </PressableScale>

          <TouchableOpacity onPress={() => navigation.goBack()} disabled={cargando}>
            <Text style={styles.hint}>¿Ya tienes cuenta? Inicia sesión</Text>
          </TouchableOpacity>
        </FadeInView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    padding: 24,
    ...shadow.card,
  },
  logo: { fontSize: 22, fontFamily: font.display, textAlign: 'center', color: c.textStrong },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  subtitle: { textAlign: 'center', color: c.muted, fontFamily: font.medium, marginTop: 6, marginBottom: 20 },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: font.regular,
    marginBottom: 16,
    color: c.textStrong,
  },
  opciones: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  opcion: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radius.md,
    padding: 14,
    backgroundColor: c.surface2,
  },
  opcionOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
  opcionEmoji: { fontSize: 24 },
  opcionTitulo: { fontSize: 15, fontFamily: font.bold, color: c.text, marginTop: 6 },
  opcionTituloOn: { color: c.onAccent },
  opcionSub: { fontSize: 12, color: c.muted, marginTop: 2, fontFamily: font.regular },
  opcionSubOn: { color: c.onAccent },
  boton: {
    backgroundColor: c.brand,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    ...shadow.soft,
  },
  botonDisabled: { opacity: 0.7 },
  botonTexto: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
  error: {
    backgroundColor: c.dangerSoft,
    color: c.danger,
    fontFamily: font.medium,
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: 16,
    fontSize: 13,
  },
  hint: { textAlign: 'center', color: c.goldText, fontSize: 14, marginTop: 18, fontFamily: font.semibold },
});
