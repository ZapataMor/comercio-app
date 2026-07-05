import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { login } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import FieldError from '../components/FieldError';
import { VitrinaLogo } from '../components/Logo';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { entrar: guardarSesion } = useAuth();
  // Prellenado con el usuario demo para probar rápido.
  const [email, setEmail] = useState('comerciante@demo.co');
  const [password, setPassword] = useState('password123');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<FieldErrors>({});

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  async function entrar() {
    setError(null);
    setErrores({});
    const nuevosErrores: FieldErrors = {};
    if (!email.trim()) nuevosErrores.email = 'El campo correo es obligatorio.';
    if (!password) nuevosErrores.password = 'El campo contrasena es obligatorio.';
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    setCargando(true);
    try {
      const { token, user } = await login(email.trim(), password);
      guardarSesion(token, user);
    } catch (e) {
      const campos = fieldErrorsFromError(e);
      if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        setError(messageFromError(e));
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={c.bg} />
      <FadeInView style={styles.card}>
        <View style={styles.brandRow}>
          <VitrinaLogo height={52} />
        </View>
        <Text style={styles.subtitle}>Tu barrio, en tu bolsillo</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.label}>Correo</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={valor => {
            setEmail(valor);
            limpiarError('email');
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="correo@ejemplo.co"
          placeholderTextColor={c.mutedSoft}
          editable={!cargando}
        />
        <FieldError mensaje={errores.email} />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={valor => {
            setPassword(valor);
            limpiarError('password');
          }}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={c.mutedSoft}
          editable={!cargando}
        />
        <FieldError mensaje={errores.password} />

        <PressableScale
          style={[styles.boton, cargando && styles.botonDisabled]}
          onPress={entrar}
          disabled={cargando}>
          {cargando ? (
            <ActivityIndicator color={c.onBrand} />
          ) : (
            <Text style={styles.botonTexto}>Entrar</Text>
          )}
        </PressableScale>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} disabled={cargando}>
          <Text style={styles.registro}>¿No tienes cuenta? Regístrate</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>Demo: comerciante@demo.co / password123</Text>
      </FadeInView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.xl,
    padding: 26,
    ...shadow.card,
  },
  brandRow: { alignItems: 'center', justifyContent: 'center' },
  subtitle: {
    textAlign: 'center',
    color: c.muted,
    fontFamily: font.medium,
    marginTop: 8,
    marginBottom: 22,
  },
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
    backgroundColor: c.surface,
  },
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
  registro: {
    textAlign: 'center',
    color: c.goldText,
    fontSize: 14,
    marginTop: 18,
    fontFamily: font.semibold,
  },
  hint: { textAlign: 'center', color: c.mutedSoft, fontSize: 12, marginTop: 12, fontFamily: font.regular },
});
