/**
 * "¿Olvidaste tu contraseña?" (desde el Login, sin sesión).
 *
 * Paso 1: escribe su correo o su celular → el backend envía un código de 6
 * dígitos al correo o, si es un celular verificado, por WhatsApp.
 * Paso 2: escribe el código y la contraseña nueva → vuelve al Login con el
 * correo o celular listo para entrar.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { identidadDe, pedirCodigoClave, restablecerClave } from '../api';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { font, makeStyles, radius, useTheme } from '../theme';
import FieldError from './FieldError';

type Props = {
  visible: boolean;
  /** Lo que la persona ya escribió en el Login (correo, celular o usuario). */
  identificadorInicial: string;
  onCerrar: () => void;
  /** Contraseña cambiada: el Login se queda con este correo o celular. */
  onListo: (identificador: string, mensaje: string) => void;
};

export default function RecuperarClaveModal({ visible, identificadorInicial, onCerrar, onListo }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const [paso, setPaso] = useState<'correo' | 'codigo'>('correo');
  const [email, setEmail] = useState(identificadorInicial);
  const [codigoPrueba, setCodigoPrueba] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [clave, setClave] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [errores, setErrores] = useState<FieldErrors>({});
  const [cargando, setCargando] = useState(false);

  // Cada vez que se abre empieza desde el paso 1.
  useEffect(() => {
    if (visible) {
      setPaso('correo');
      setEmail(identificadorInicial);
      setCodigoPrueba(null);
      setCodigo('');
      setClave('');
      setConfirmar('');
      setAviso(null);
      setErrores({});
    }
  }, [visible, identificadorInicial]);

  function limpiar(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  async function enviarCodigo() {
    const identidad = identidadDe(email);
    if (!email.trim() || ('email' in identidad && !identidad.email.includes('@'))) {
      setErrores({ email: 'Escribe el correo o el celular de tu cuenta.' });
      return;
    }
    setCargando(true);
    setErrores({});
    try {
      const r = await pedirCodigoClave(identidad);
      setAviso(r.message);
      setCodigoPrueba(r.codigo_prueba ?? null);
      setPaso('codigo');
    } catch (e) {
      const campos = fieldErrorsFromError(e);
      const mensaje = campos.email ?? campos.telefono ?? messageFromError(e);
      setErrores(paso === 'codigo' ? { codigo: mensaje } : { email: mensaje });
    } finally {
      setCargando(false);
    }
  }

  async function cambiarClave() {
    const nuevos: FieldErrors = {};
    if (!/^\d{6}$/.test(codigo)) nuevos.codigo = 'El código tiene 6 números.';
    if (clave.length < 5) nuevos.password = 'La contraseña debe tener al menos 5 caracteres.';
    else if (clave !== confirmar) nuevos.confirmar = 'Las contraseñas no coinciden.';
    if (Object.keys(nuevos).length) {
      setErrores(nuevos);
      return;
    }
    setCargando(true);
    setErrores({});
    try {
      const mensaje = await restablecerClave(identidadDe(email), codigo, clave);
      onListo(email.trim(), mensaje);
    } catch (e) {
      const campos = fieldErrorsFromError(e, { password_confirmation: 'confirmar' });
      setErrores(Object.keys(campos).length ? campos : { codigo: messageFromError(e) });
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={styles.fondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.caja}>
            <Text style={styles.titulo}>Recuperar contraseña</Text>

            {paso === 'correo' ? (
              <>
                <Text style={styles.texto}>
                  Escribe el correo o el celular de tu cuenta. Te enviaremos un código de 6 números: al correo, o por
                  WhatsApp si es tu celular.
                </Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={v => {
                    setEmail(v);
                    limpiar('email');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="correo@ejemplo.co o 3001234567"
                  accessibilityLabel="Correo o celular"
                  placeholderTextColor={c.mutedSoft}
                  editable={!cargando}
                />
                <FieldError mensaje={errores.email} />
                <TouchableOpacity style={styles.boton} onPress={enviarCodigo} disabled={cargando}>
                  {cargando ? (
                    <ActivityIndicator color={c.onBrand} />
                  ) : (
                    <Text style={styles.botonTxt}>Enviar código</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {!!aviso && <Text style={styles.texto}>{aviso}</Text>}
                {!!codigoPrueba && (
                  <Text style={styles.prueba}>
                    Modo prueba (WhatsApp sin configurar): tu código es {codigoPrueba}
                  </Text>
                )}
                <TextInput
                  style={[styles.input, styles.inputCodigo]}
                  value={codigo}
                  onChangeText={v => {
                    setCodigo(v.replace(/\D/g, '').slice(0, 6));
                    limpiar('codigo');
                  }}
                  keyboardType="number-pad"
                  placeholder="000000"
                  placeholderTextColor={c.mutedSoft}
                  editable={!cargando}
                  maxLength={6}
                />
                <FieldError mensaje={errores.codigo} />
                <TextInput
                  style={styles.input}
                  value={clave}
                  onChangeText={v => {
                    setClave(v);
                    limpiar('password');
                  }}
                  secureTextEntry
                  placeholder="Contraseña nueva (mínimo 5)"
                  placeholderTextColor={c.mutedSoft}
                  editable={!cargando}
                />
                <FieldError mensaje={errores.password} />
                <TextInput
                  style={styles.input}
                  value={confirmar}
                  onChangeText={v => {
                    setConfirmar(v);
                    limpiar('confirmar');
                  }}
                  secureTextEntry
                  placeholder="Repite la contraseña nueva"
                  placeholderTextColor={c.mutedSoft}
                  editable={!cargando}
                />
                <FieldError mensaje={errores.confirmar} />
                <TouchableOpacity style={styles.boton} onPress={cambiarClave} disabled={cargando}>
                  {cargando ? (
                    <ActivityIndicator color={c.onBrand} />
                  ) : (
                    <Text style={styles.botonTxt}>Cambiar contraseña</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={enviarCodigo} disabled={cargando}>
                  <Text style={styles.enlace}>No me llegó: enviar otro código</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={onCerrar} disabled={cargando}>
              <Text style={styles.cancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  caja: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 22, ...shadow.card },
  titulo: { fontSize: 19, fontFamily: font.display, color: c.textStrong, marginBottom: 8 },
  texto: { fontSize: 13, fontFamily: font.regular, color: c.text, lineHeight: 19, marginBottom: 14 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 16, fontFamily: font.regular, color: c.textStrong, marginBottom: 6,
  },
  prueba: {
    fontSize: 12.5, fontFamily: font.semibold, color: c.text, backgroundColor: c.accentSoft,
    borderRadius: radius.sm, padding: 10, marginBottom: 12,
  },
  inputCodigo: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontFamily: font.bold },
  boton: {
    backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
    marginTop: 10, ...shadow.soft,
  },
  botonTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
  enlace: { textAlign: 'center', color: c.goldText, fontFamily: font.semibold, fontSize: 13, marginTop: 14 },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
}));
