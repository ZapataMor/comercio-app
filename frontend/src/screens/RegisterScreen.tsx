import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { register } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import BarrioSelect from '../components/BarrioSelect';
import FieldError from '../components/FieldError';
import { VitrinaMark } from '../components/Logo';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

// Modelo unificado: no se elige rol al registrarse. Toda cuenta nace como
// cliente y luego puede crear sus negocios (o unirse a otros) desde
// "Mis negocios". 'administrador' y 'domiciliario' los asigna un admin.

export default function RegisterScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { entrar: guardarSesion } = useAuth();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [direccion, setDireccion] = useState('');
  const [barrio, setBarrio] = useState('');
  const [telefono, setTelefono] = useState('');
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

  async function crearCuenta() {
    setError(null);
    setErrores({});

    const nuevosErrores: FieldErrors = {};
    if (!nombre.trim()) nuevosErrores.name = 'El campo nombre es obligatorio.';
    if (!email.trim()) nuevosErrores.email = 'El campo correo es obligatorio.';
    if (!password) nuevosErrores.password = 'El campo contrasena es obligatorio.';
    if (!direccion.trim()) nuevosErrores.direccion = 'El campo direccion es obligatorio.';
    if (!barrio.trim()) nuevosErrores.barrio = 'El campo barrio es obligatorio.';
    if (!telefono.trim()) nuevosErrores.telefono = 'El campo telefono es obligatorio.';
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    if (password.length < 8) {
      setErrores({ password: 'La contrasena debe tener al menos 8 caracteres.' });
      return;
    }
    if (password !== confirmar) {
      setErrores({ confirmar: 'La contrasena y su confirmacion deben ser iguales.' });
      return;
    }

    setCargando(true);
    try {
      const { token, user } = await register({
        name: nombre.trim(),
        email: email.trim(),
        password,
        direccion: direccion.trim(),
        barrio: barrio.trim(),
        telefono: telefono.trim(),
      });
      guardarSesion(token, user);
    } catch (e) {
      const campos = fieldErrorsFromError(e, { password_confirmation: 'confirmar' });
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
            onChangeText={valor => {
              setNombre(valor);
              limpiarError('name');
            }}
            placeholder="Tu nombre"
            placeholderTextColor={c.mutedSoft}
            editable={!cargando}
          />
          <FieldError mensaje={errores.name} />

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
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={c.mutedSoft}
            editable={!cargando}
          />
          <FieldError mensaje={errores.password} />

          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            value={confirmar}
            onChangeText={valor => {
              setConfirmar(valor);
              limpiarError('confirmar');
            }}
            secureTextEntry
            placeholder="Repite la contraseña"
            placeholderTextColor={c.mutedSoft}
            editable={!cargando}
          />
          <FieldError mensaje={errores.confirmar} />

          <Text style={styles.label}>Direccion</Text>
          <TextInput
            style={styles.input}
            value={direccion}
            onChangeText={valor => {
              setDireccion(valor);
              limpiarError('direccion');
            }}
            placeholder="Calle, numero, referencia"
            placeholderTextColor={c.mutedSoft}
            editable={!cargando}
          />
          <FieldError mensaje={errores.direccion} />

          <Text style={styles.label}>Barrio</Text>
          <BarrioSelect
            valor={barrio}
            onSeleccionar={nombre => {
              setBarrio(nombre);
              limpiarError('barrio');
            }}
            disabled={cargando}
          />
          <FieldError mensaje={errores.barrio} />

          <Text style={styles.label}>Telefono</Text>
          <TextInput
            style={styles.input}
            value={telefono}
            onChangeText={valor => {
              setTelefono(valor);
              limpiarError('telefono');
            }}
            keyboardType="phone-pad"
            placeholder="300 123 4567"
            placeholderTextColor={c.mutedSoft}
            editable={!cargando}
          />
          <FieldError mensaje={errores.telefono} />

          <Text style={styles.nota}>¿Tienes un negocio? Créalo después desde "Mis negocios".</Text>

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

const useStyles = makeStyles((c, shadow) => ({
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
  nota: { fontSize: 12, color: c.muted, fontFamily: font.regular, textAlign: 'center', marginBottom: 16 },
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
}));
