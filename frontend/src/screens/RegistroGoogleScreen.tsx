import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { entrarConGoogle } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import { LogoGoogle } from '../components/BotonGoogle';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import { VitrinaMark } from '../components/Logo';
import { WEB_URL } from '../config';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RegistroGoogle'>;

// Último paso del registro con Google: la cuenta de Google ya se eligió y el
// backend dijo que es nueva. Aquí se revisa el nombre que trae Google y se
// acepta la política de privacidad (Ley 1581), igual que en el registro con
// el celular. No se pide contraseña ni celular: la contraseña se puede crear
// después en «Mi información», y el celular se pide en el primer pedido.

export default function RegistroGoogleScreen({ navigation, route }: Props) {
  const { idToken, perfil } = route.params;
  const { c } = useTheme();
  const styles = useStyles();
  const { entrar: guardarSesion } = useAuth();
  const [nombre, setNombre] = useState(perfil.name);
  const [apellidos, setApellidos] = useState(perfil.apellidos);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
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
    if (!apellidos.trim()) nuevosErrores.apellidos = 'El campo apellidos es obligatorio.';
    if (!aceptaTerminos) {
      nuevosErrores.acepta_terminos = 'Debes aceptar la política de privacidad para crear la cuenta.';
    }
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }

    setCargando(true);
    try {
      const r = await entrarConGoogle(idToken, {
        name: nombre.trim(),
        apellidos: apellidos.trim(),
        acepta_terminos: true,
      });
      if (r.nuevo) {
        setError('No se pudo crear la cuenta. Inténtalo de nuevo.');
      } else {
        guardarSesion(r.token, r.user);
      }
    } catch (e) {
      const campos = fieldErrorsFromError(e);
      if (campos.id_token) {
        // El permiso de Google vence en una hora: hay que volver a elegir la cuenta.
        setError(`${campos.id_token} Vuelve atrás y elige otra vez tu cuenta de Google.`);
      } else if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        setError(messageFromError(e));
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={c.bg} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <FadeInView style={styles.card}>
          <View style={styles.logoRow}>
            <VitrinaMark size={30} />
            <Text style={styles.logo}>Crear cuenta</Text>
          </View>
          <Text style={styles.subtitle}>Ya casi: revisa tus datos</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.cuentaGoogle}>
            <LogoGoogle size={18} />
            <View style={styles.cuentaTexto}>
              <Text style={styles.cuentaEtiqueta}>Cuenta de Google</Text>
              <Text style={styles.cuentaCorreo} numberOfLines={1}>
                {perfil.email}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} disabled={cargando} hitSlop={8}>
              <Text style={styles.enlace}>Cambiar</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Nombre(s)</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={valor => {
              setNombre(valor);
              limpiarError('name');
            }}
            placeholder="Ej: Ana María"
            placeholderTextColor={c.mutedSoft}
            autoCapitalize="words"
            textContentType="givenName"
            autoComplete="name-given"
            editable={!cargando}
            accessibilityLabel="Nombre(s)"
          />
          <FieldError mensaje={errores.name} />

          <Text style={styles.label}>Apellidos</Text>
          <TextInput
            style={styles.input}
            value={apellidos}
            onChangeText={valor => {
              setApellidos(valor);
              limpiarError('apellidos');
            }}
            placeholder="Ej: Pérez Gómez"
            placeholderTextColor={c.mutedSoft}
            autoCapitalize="words"
            textContentType="familyName"
            autoComplete="name-family"
            editable={!cargando}
            accessibilityLabel="Apellidos"
          />
          <FieldError mensaje={errores.apellidos} />

          <View style={styles.terminosRow}>
            <TouchableOpacity
              style={[styles.casilla, aceptaTerminos && styles.casillaMarcada]}
              onPress={() => {
                setAceptaTerminos(v => !v);
                limpiarError('acepta_terminos');
              }}
              disabled={cargando}
              hitSlop={8}
              accessibilityRole="checkbox"
              accessibilityLabel="Acepto la política de privacidad"
              accessibilityState={{ checked: aceptaTerminos }}>
              {aceptaTerminos && <Icon name="check" size={14} color={c.onAccent} />}
            </TouchableOpacity>
            <Text style={styles.terminosTxt}>
              Acepto la{' '}
              <Text style={styles.enlace} onPress={() => Linking.openURL(`${WEB_URL}/privacidad`)}>
                política de privacidad
              </Text>{' '}
              y autorizo el tratamiento de mis datos para gestionar mis pedidos.
            </Text>
          </View>
          <FieldError mensaje={errores.acepta_terminos} />

          <Text style={styles.nota}>
            Entrarás con Google. Si quieres, luego creas una contraseña en «Mi información».
          </Text>

          <PressableScale
            style={[styles.boton, cargando && styles.botonDisabled]}
            onPress={crearCuenta}
            disabled={cargando}
            accessibilityRole="button">
            {cargando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTexto}>Crear cuenta</Text>}
          </PressableScale>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={cargando}>
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
  card: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 24, ...shadow.card },
  logo: { fontSize: 22, fontFamily: font.display, textAlign: 'center', color: c.textStrong },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  subtitle: { textAlign: 'center', color: c.muted, fontFamily: font.medium, marginTop: 6, marginBottom: 20 },
  cuentaGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface2,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 18,
  },
  cuentaTexto: { flex: 1 },
  cuentaEtiqueta: { fontSize: 12, fontFamily: font.semibold, color: c.muted },
  cuentaCorreo: { fontSize: 15, fontFamily: font.bold, color: c.textStrong, marginTop: 2 },
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
  terminosRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: c.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  casillaMarcada: { backgroundColor: c.accent, borderColor: c.accent },
  terminosTxt: { flex: 1, fontSize: 13, color: c.text, fontFamily: font.regular, lineHeight: 19 },
  enlace: { color: c.goldText, fontFamily: font.semibold, textDecorationLine: 'underline' },
  boton: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', ...shadow.soft },
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
