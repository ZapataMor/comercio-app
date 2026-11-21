/**
 * «¿Olvidaste tu clave?» (desde el login, sin sesión). También desbloquea la
 * clave tras 5 intentos fallidos.
 *
 * Dos caminos:
 *  - Celular: escribe su número → llega un código de 6 números por WhatsApp
 *    → lo escribe → crea la clave nueva.
 *  - Google: elige su cuenta de Google conectada → crea la clave nueva. Si
 *    ya se eligió (p. ej., al entrar con Google), llega en `googleIdToken`.
 *
 * Al guardar la clave nueva se entra directamente (`onListo` recibe la
 * sesión): el código o Google demostraron quién es.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LoginResponse, pedirCodigoClave, restablecerClave, restablecerClaveConGoogle } from '../api';
import { erroresClaveNueva } from '../clave';
import { errorTelefono, telefonoValido } from '../direccion';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { elegirCuentaGoogle, googleDisponible } from '../google';
import { font, makeStyles, radius, useTheme } from '../theme';
import BotonGoogle from './BotonGoogle';
import CampoPin from './CampoPin';
import FieldError from './FieldError';
import { EspacioTecladoModal } from './EspacioTeclado';
import Icon from './Icon';

type Props = {
  visible: boolean;
  /** El celular que la persona ya escribió en el login. */
  telefonoInicial: string;
  /** Token de Google ya elegido: va directo a crear la clave nueva. */
  googleIdToken?: string | null;
  onCerrar: () => void;
  /** Clave nueva guardada: la sesión para entrar. */
  onListo: (sesion: LoginResponse & { message: string }) => void;
};

type Paso = 'telefono' | 'codigo' | 'clave';

export default function RecuperarClaveModal({ visible, telefonoInicial, googleIdToken, onCerrar, onListo }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const [paso, setPaso] = useState<Paso>('telefono');
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [codigoPrueba, setCodigoPrueba] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [clave, setClave] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errores, setErrores] = useState<FieldErrors>({});
  const [cargando, setCargando] = useState(false);

  // Cada vez que se abre empieza desde el principio (o desde la clave, con Google).
  useEffect(() => {
    if (visible) {
      setPaso(googleIdToken ? 'clave' : 'telefono');
      setIdToken(googleIdToken ?? null);
      setTelefono(telefonoInicial.replace(/\D/g, '').replace(/^57(?=3\d{9}$)/, ''));
      setCodigoPrueba(null);
      setAviso(null);
      setCodigo('');
      setClave('');
      setConfirmar('');
      setErrores({});
    }
  }, [visible, telefonoInicial, googleIdToken]);

  // La flecha (y el «atrás» de Android): al paso anterior; desde el primero, se cierra.
  function atras() {
    if (cargando) return;
    setErrores({});
    if (paso === 'codigo') setPaso('telefono');
    else if (paso === 'clave' && idToken && !googleIdToken) {
      setIdToken(null);
      setPaso('telefono');
    } else if (paso === 'clave' && !idToken) setPaso('codigo');
    else onCerrar();
  }

  async function enviarCodigo() {
    if (!telefonoValido(telefono)) {
      setErrores({ telefono: errorTelefono });
      return;
    }
    setCargando(true);
    setErrores({});
    try {
      const r = await pedirCodigoClave(telefono);
      setAviso(r.message);
      setCodigoPrueba(r.codigo_prueba ?? null);
      setPaso('codigo');
    } catch (e) {
      const mensaje = fieldErrorsFromError(e).telefono ?? messageFromError(e);
      setErrores(paso === 'codigo' ? { codigo: mensaje } : { telefono: mensaje });
    } finally {
      setCargando(false);
    }
  }

  function seguirConCodigo() {
    if (!/^\d{6}$/.test(codigo)) {
      setErrores({ codigo: 'El código tiene 6 números.' });
      return;
    }
    setErrores({});
    setPaso('clave');
  }

  async function conGoogle() {
    setErrores({});
    try {
      const token = await elegirCuentaGoogle();
      if (!token) return;
      setIdToken(token);
      setPaso('clave');
    } catch (e) {
      setErrores({ telefono: messageFromError(e) });
    }
  }

  async function guardar() {
    const nuevos = erroresClaveNueva(clave, confirmar);
    if (nuevos.pin || nuevos.confirmar) {
      setErrores(nuevos);
      if (nuevos.pin) setConfirmar('');
      return;
    }
    setCargando(true);
    setErrores({});
    try {
      const sesion = idToken ? await restablecerClaveConGoogle(idToken, clave) : await restablecerClave(telefono, codigo, clave);
      onListo(sesion);
    } catch (e) {
      const campos = fieldErrorsFromError(e, { pin_confirmation: 'confirmar' });
      if (campos.codigo) {
        // El código no sirvió: volver a escribirlo (o pedir otro).
        setPaso('codigo');
        setCodigo('');
        setErrores({ codigo: campos.codigo });
      } else if (campos.id_token) {
        setErrores({ pin: campos.id_token });
      } else {
        setErrores(Object.keys(campos).length ? campos : { pin: messageFromError(e) });
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={atras}>
      <EspacioTecladoModal style={styles.fondo}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.caja}>
            <View style={styles.cabecera}>
              <TouchableOpacity
                style={styles.atras}
                onPress={atras}
                disabled={cargando}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={paso === 'telefono' || (paso === 'clave' && !!googleIdToken) ? 'Cerrar' : 'Volver al paso anterior'}>
                <Icon name="atras" size={20} color={c.textStrong} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={styles.titulo}>{paso === 'clave' ? 'Crea tu clave nueva' : '¿Olvidaste tu clave?'}</Text>
            </View>

            {paso === 'telefono' ? (
              <>
                <Text style={styles.texto}>
                  Escribe el celular de tu cuenta. Te enviaremos un código de 6 números por WhatsApp para crear una clave
                  nueva. Si tu clave quedó bloqueada, así también se desbloquea.
                </Text>
                <View style={styles.fila}>
                  <Text style={styles.prefijo}>+57</Text>
                  <TextInput
                    style={[styles.input, styles.inputTelefono]}
                    value={telefono}
                    onChangeText={v => {
                      setTelefono(v.replace(/\D/g, '').slice(0, 10));
                      setErrores({});
                    }}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="3001234567"
                    placeholderTextColor={c.mutedSoft}
                    accessibilityLabel="Celular de tu cuenta"
                    editable={!cargando}
                  />
                </View>
                <FieldError mensaje={errores.telefono} />
                <TouchableOpacity style={styles.boton} onPress={enviarCodigo} disabled={cargando}>
                  {cargando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTxt}>Enviar código por WhatsApp</Text>}
                </TouchableOpacity>
                {googleDisponible() ? (
                  <>
                    <Text style={styles.o}>o, si conectaste Google</Text>
                    <BotonGoogle texto="Crear clave nueva con Google" onPress={conGoogle} disabled={cargando} />
                  </>
                ) : null}
              </>
            ) : paso === 'codigo' ? (
              <>
                {!!aviso && <Text style={styles.texto}>{aviso}</Text>}
                {!!codigoPrueba && (
                  <Text style={styles.prueba}>Modo prueba (WhatsApp sin configurar): tu código es {codigoPrueba}</Text>
                )}
                <TextInput
                  style={[styles.input, styles.inputCodigo]}
                  value={codigo}
                  onChangeText={v => {
                    setCodigo(v.replace(/\D/g, '').slice(0, 6));
                    setErrores({});
                  }}
                  keyboardType="number-pad"
                  placeholder="000000"
                  placeholderTextColor={c.mutedSoft}
                  editable={!cargando}
                  maxLength={6}
                  autoFocus
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  accessibilityLabel="Código de 6 números"
                />
                <FieldError mensaje={errores.codigo} />
                <TouchableOpacity style={styles.boton} onPress={seguirConCodigo} disabled={cargando}>
                  <Text style={styles.botonTxt}>Continuar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={enviarCodigo} disabled={cargando}>
                  <Text style={styles.enlace}>No me llegó: enviar otro código</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.texto}>
                  4 números que no sean fáciles de adivinar: ni repetidos (0000) ni seguidos (1234). Con ella y tu celular
                  entras a Vitrina.
                </Text>
                <Text style={styles.label}>Clave nueva</Text>
                <CampoPin
                  value={clave}
                  onChangeText={v => {
                    setClave(v);
                    setErrores({});
                  }}
                  autoFocus
                  editable={!cargando}
                  conError={!!errores.pin}
                  accessibilityLabel="Clave nueva de 4 números"
                />
                <FieldError mensaje={errores.pin} />
                <Text style={styles.label}>Escríbela otra vez</Text>
                <CampoPin
                  value={confirmar}
                  onChangeText={v => {
                    setConfirmar(v);
                    setErrores({});
                  }}
                  editable={!cargando}
                  conError={!!errores.confirmar}
                  accessibilityLabel="Confirma la clave nueva"
                />
                <FieldError mensaje={errores.confirmar} />
                <TouchableOpacity style={styles.boton} onPress={guardar} disabled={cargando}>
                  {cargando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTxt}>Guardar clave y entrar</Text>}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={onCerrar} disabled={cargando}>
              <Text style={styles.cancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </EspacioTecladoModal>
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  caja: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 22, ...shadow.card },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  atras: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  titulo: { flex: 1, fontSize: 19, fontFamily: font.display, color: c.textStrong },
  texto: { fontSize: 13, fontFamily: font.regular, color: c.text, lineHeight: 19, marginBottom: 14 },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginTop: 6, marginBottom: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  prefijo: {
    fontSize: 16, fontFamily: font.semibold, color: c.text, paddingHorizontal: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, backgroundColor: c.bg,
  },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 16, fontFamily: font.regular, color: c.textStrong, marginBottom: 6,
  },
  inputTelefono: { flex: 1, marginBottom: 0 },
  prueba: {
    fontSize: 12.5, fontFamily: font.semibold, color: c.text, backgroundColor: c.accentSoft,
    borderRadius: radius.sm, padding: 10, marginBottom: 12,
  },
  inputCodigo: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontFamily: font.bold },
  boton: {
    backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
    marginTop: 14, ...shadow.soft,
  },
  botonTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
  o: { textAlign: 'center', color: c.muted, fontFamily: font.medium, fontSize: 12.5, marginTop: 16, marginBottom: 10 },
  enlace: { textAlign: 'center', color: c.goldText, fontFamily: font.semibold, fontSize: 13, marginTop: 14 },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
}));
