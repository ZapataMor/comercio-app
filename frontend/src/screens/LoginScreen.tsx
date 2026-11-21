import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  ApiError,
  CodigoAcceso,
  claveBloqueada,
  confirmarCodigoAcceso,
  entrarConClave,
  entrarEnDispositivo,
  limpiarCelular,
  login,
  LoginResponse,
  Usuario,
} from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import BotonGoogle, { LogoGoogle, useEntrarConGoogle } from '../components/BotonGoogle';
import CampoPin from '../components/CampoPin';
import { useConfirmar } from '../components/Confirmacion';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import CampoAcceso from '../components/login/CampoAcceso';
import EscenaAcceso from '../components/login/EscenaAcceso';
import { LogoAcceso, SeparadorAcceso, useEstilosAcceso } from '../components/login/estilosAcceso';
import { usePedirClave } from '../components/PedirClave';
import RecuperarClaveModal from '../components/RecuperarClaveModal';
import { formatoCelular } from '../components/VerificarTelefono';
import { errorTelefono, telefonoValido } from '../direccion';
import { googleDisponible } from '../google';
import { useToast } from '../Toast';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// ─────────────────────────────────────────────────────────────
// Login — fotos de Maicao con filtro de cine y una tarjeta de vidrio
// (EscenaAcceso, la misma del registro y del registro con Google).
//
// Se entra con el celular y la clave de 4 números (como Nequi). En un
// teléfono de confianza basta con eso; en uno nuevo, el backend envía además
// un código por WhatsApp (una sola vez por teléfono). O con «Continuar con
// Google», que también pide la clave.
//
// Con cuentas guardadas en el teléfono (ver AuthContext), arriba de los
// campos sale «Continuar como»: las de sesión abierta entran con un toque;
// las de sesión cerrada piden la clave (o, sin teléfono de confianza, eligen
// otra vez la cuenta de Google). Con un toque largo se quitan del teléfono.
//
// Las cuentas de antes, sin clave, entran con su contraseña («¿Tu cuenta es
// de antes?») y la app les pide crear la clave.
// Si se llegó desde «Agregar cuenta», «atrás» vuelve a la cuenta anterior.
// ─────────────────────────────────────────────────────────────

/** Primer nombre, para la píldora de una cuenta guardada. */
function primerNombre(user: Usuario): string {
  return user.name.trim().split(/\s+/)[0] || user.email || user.telefono || 'Cuenta';
}

function nombreCompleto(user: Usuario): string {
  return [user.name, user.apellidos].filter(Boolean).join(' ');
}

export default function LoginScreen({ navigation }: Props) {
  const {
    entrar: guardarSesion,
    cuentas,
    recordadas,
    olvidarRecordada,
    olvidarDispositivo,
    dispositivos,
    agregando,
    cambiarCuenta,
  } = useAuth();
  const { login: l } = useTheme();
  const e = useEstilosAcceso();
  const styles = useStyles();
  const confirmar = useConfirmar();
  const toast = useToast();
  const clave = usePedirClave();
  // 'clave': celular + clave de 4 números. 'contrasena': cuentas de antes.
  const [modo, setModo] = useState<'clave' | 'contrasena'>('clave');
  const [telefono, setTelefono] = useState('');
  const [pin, setPin] = useState('');
  // Teléfono nuevo: el backend envió un código por WhatsApp.
  const [codigoAcceso, setCodigoAcceso] = useState<CodigoAcceso | null>(null);
  const [codigo, setCodigo] = useState('');
  const [espera, setEspera] = useState(0);
  // Cuentas de antes: correo, celular o usuario, y contraseña.
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<FieldErrors>({});
  // «¿Olvidaste tu clave?» abierto (con el token de Google, si viene de ahí).
  const [recuperando, setRecuperando] = useState<{ telefono: string; googleIdToken?: string } | null>(null);
  const campoPin = useRef<TextInput>(null);
  // «Continuar con Google»: si la cuenta es nueva, faltan los últimos pasos del registro.
  const google = useEntrarConGoogle(
    (idToken, perfil) => navigation.navigate('RegistroGoogle', { idToken, perfil }),
    idToken => setRecuperando({ telefono: '', googleIdToken: idToken }),
  );
  const ocupado = cargando || google.cargando;
  const conGoogle = googleDisponible();
  // Cuentas recordadas (sesión cerrada) que no tienen ya la sesión abierta.
  const cerradas = recordadas.filter(
    r => !cuentas.some(c => c.user.id === r.user.id) && (!!dispositivos[r.user.id] || (conGoogle && r.user.google)),
  );

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  // Desde «Agregar cuenta», «atrás» vuelve a la cuenta de la que venía (la
  // más reciente). Solo en esta pantalla: en el registro, «atrás» regresa aquí.
  useEffect(() => {
    const anterior = agregando ? cuentas[0] : undefined;
    if (!anterior) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigation.isFocused()) return false;
      cambiarCuenta(anterior.user.id);
      return true;
    });
    return () => sub.remove();
  }, [agregando, cuentas, cambiarCuenta, navigation]);

  // Cuenta regresiva para pedir otro código.
  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  function abrirSesion(r: LoginResponse) {
    guardarSesion(r.token, r.user, { dispositivo: r.dispositivo });
  }

  /** Clave bloqueada: se ofrece desbloquearla con «¿Olvidaste tu clave?». */
  function avisarBloqueo(mensaje: string, celular: string) {
    confirmar({
      icono: 'candado',
      titulo: 'Tu clave está bloqueada',
      texto: mensaje,
      textoBoton: 'Desbloquear',
      textoCancelar: 'Ahora no',
      accion: () => setRecuperando({ telefono: celular }),
    });
  }

  function mostrarError(err: unknown) {
    const campos = fieldErrorsFromError(err);
    if (Object.keys(campos).length > 0) {
      setErrores(campos);
    } else {
      setError(messageFromError(err));
    }
  }

  /** Token de confianza de la cuenta guardada con ese celular, si la hay. */
  function dispositivoDelCelular(celular: string): string | undefined {
    const cuenta = [...cuentas, ...recordadas].find(c => c.user.telefono === celular && c.user.telefono_verificado !== false);
    return cuenta ? dispositivos[cuenta.user.id] : undefined;
  }

  async function entrarConCelular(clavePin = pin) {
    setError(null);
    google.setError(null);
    setErrores({});
    const celular = limpiarCelular(telefono);
    const nuevos: FieldErrors = {};
    if (!telefonoValido(celular)) nuevos.telefono = celular ? errorTelefono : 'Escribe tu número de celular.';
    if (clavePin.length !== 4) nuevos.pin = 'Escribe tu clave de 4 números.';
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos);
      return;
    }
    setCargando(true);
    try {
      const r = await entrarConClave(celular, clavePin, dispositivoDelCelular(celular));
      if ('requiere_codigo' in r) {
        setCodigoAcceso(r);
        setCodigo('');
        setEspera(r.espera ?? 60);
      } else {
        abrirSesion(r);
      }
    } catch (err) {
      setPin('');
      if (claveBloqueada(err)) {
        avisarBloqueo(messageFromError(err), celular);
      } else {
        mostrarError(err);
      }
    } finally {
      setCargando(false);
    }
  }

  async function confirmarCodigo() {
    if (!codigoAcceso) return;
    if (!/^\d{6}$/.test(codigo)) {
      setErrores({ codigo: 'El código tiene 6 números.' });
      return;
    }
    setCargando(true);
    setErrores({});
    try {
      abrirSesion(await confirmarCodigoAcceso(codigoAcceso.telefono, pin, codigo));
    } catch (err) {
      if (claveBloqueada(err)) {
        setCodigoAcceso(null);
        setPin('');
        avisarBloqueo(messageFromError(err), codigoAcceso.telefono);
      } else {
        const campos = fieldErrorsFromError(err);
        setErrores({ codigo: campos.codigo ?? campos.pin ?? messageFromError(err) });
      }
    } finally {
      setCargando(false);
    }
  }

  async function reenviarCodigo() {
    if (!codigoAcceso) return;
    setCargando(true);
    setErrores({});
    try {
      const r = await entrarConClave(codigoAcceso.telefono, pin);
      if ('requiere_codigo' in r) {
        setCodigoAcceso(r);
        setEspera(r.espera ?? 60);
      } else {
        abrirSesion(r);
      }
    } catch (err) {
      setErrores({ codigo: messageFromError(err) });
    } finally {
      setCargando(false);
    }
  }

  async function entrarConContrasena() {
    setError(null);
    google.setError(null);
    setErrores({});
    const nuevos: FieldErrors = {};
    if (!usuario.trim()) nuevos.usuario = 'Escribe tu correo, celular o usuario.';
    if (!password) nuevos.password = 'El campo contraseña es obligatorio.';
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos);
      return;
    }
    setCargando(true);
    try {
      abrirSesion(await login(usuario.trim(), password));
    } catch (err) {
      mostrarError(err);
    } finally {
      setCargando(false);
    }
  }

  function entrarConGoogle(rapido: boolean) {
    setError(null);
    setErrores({});
    google.iniciar(rapido);
  }

  /** Una cuenta con la sesión cerrada en «Continuar como». */
  function continuarCon(user: Usuario) {
    setError(null);
    const dispositivo = dispositivos[user.id];
    if (!dispositivo) {
      entrarConGoogle(true);
      return;
    }
    clave.pedir({
      titulo: `Hola, ${primerNombre(user)}`,
      texto: 'Escribe tu clave de 4 números para entrar.',
      textoBoton: 'Entrar',
      accion: async clavePin => {
        try {
          abrirSesion(await entrarEnDispositivo(dispositivo, clavePin));
        } catch (err) {
          if (err instanceof ApiError && err.data?.codigo === 'dispositivo_desconocido') {
            // El teléfono ya no es de confianza: entra con el celular (y el código) o con Google.
            olvidarDispositivo(user.id);
            setModo('clave');
            setTelefono(user.telefono_verificado && user.telefono ? user.telefono : '');
          }
          throw err;
        }
      },
      onOlvide: () => setRecuperando({ telefono: user.telefono_verificado ? user.telefono ?? '' : '' }),
    });
  }

  function quitarRecordada(user: Usuario) {
    confirmar({
      icono: 'usuario',
      titulo: `¿Quitar a ${primerNombre(user)} de este teléfono?`,
      texto: 'Dejará de salir en «Continuar como». Puede volver a entrar cuando quiera con su celular y su clave.',
      textoBoton: 'Quitar',
      textoCancelar: 'Cancelar',
      accion: () => olvidarRecordada(user.id),
    });
  }

  const fuera = (
    <>
      <RecuperarClaveModal
        visible={!!recuperando}
        telefonoInicial={recuperando?.telefono ?? telefono}
        googleIdToken={recuperando?.googleIdToken}
        onCerrar={() => setRecuperando(null)}
        onListo={sesion => {
          setRecuperando(null);
          toast.exito('Clave nueva guardada', 'Ya entraste con tu clave nueva.');
          abrirSesion(sesion);
        }}
      />
      {clave.modal}
      {google.modal}
    </>
  );

  // ---------- Teléfono nuevo: el código de WhatsApp ----------
  if (codigoAcceso) {
    return (
      <EscenaAcceso fuera={fuera}>
        <LogoAcceso />
        <Text style={e.titulo}>Confirma que eres tú</Text>
        <Text style={e.texto}>
          Es la primera vez que entras en este teléfono. Te enviamos un código por WhatsApp al{' '}
          <Text style={styles.fuerte}>+57 {formatoCelular(codigoAcceso.telefono)}</Text>. Solo se pide esta vez.
        </Text>
        {codigoAcceso.codigo_prueba ? (
          <View style={[e.recuadro, styles.prueba]}>
            <Icon name="alerta" size={16} color={l.campoIcono} />
            <Text style={[e.texto, styles.pruebaTxt]}>
              Modo prueba (WhatsApp sin configurar): tu código es <Text style={styles.fuerte}>{codigoAcceso.codigo_prueba}</Text>
            </Text>
          </View>
        ) : null}
        <View style={[e.bloqueCampo, styles.separado]}>
          <CampoAcceso
            rotulo="CÓDIGO DE WHATSAPP"
            icono="whatsapp"
            placeholder="000000"
            value={codigo}
            onChangeText={v => {
              setCodigo(v.replace(/\D/g, '').slice(0, 6));
              limpiarError('codigo');
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            returnKeyType="done"
            onSubmitEditing={confirmarCodigo}
            accessibilityLabel="Código de 6 números"
            editable={!cargando}
          />
        </View>
        <FieldError mensaje={errores.codigo} />
        <PressableScale style={e.boton} scaleTo={0.97} onPress={confirmarCodigo} disabled={cargando}>
          {cargando ? <ActivityIndicator size="small" color={l.botonTexto} /> : <Text style={e.botonTexto}>Entrar</Text>}
        </PressableScale>
        <View style={styles.enlaces}>
          <TouchableOpacity onPress={reenviarCodigo} disabled={cargando || espera > 0} hitSlop={8}>
            <Text style={[styles.enlace, espera > 0 && styles.enlaceApagado]}>
              {espera > 0 ? `Reenviar en ${espera} s` : 'Reenviar código'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setCodigoAcceso(null);
              setPin('');
              setErrores({});
            }}
            disabled={cargando}
            hitSlop={8}>
            <Text style={styles.enlace}>Volver</Text>
          </TouchableOpacity>
        </View>
      </EscenaAcceso>
    );
  }

  return (
    <EscenaAcceso fuera={fuera}>
      <LogoAcceso />

      {error || google.error ? <Text style={e.error}>{error ?? google.error}</Text> : null}

      {/* cuentas con la sesión abierta en este teléfono (y las recordadas): a un toque */}
      {cuentas.length > 0 || cerradas.length > 0 ? (
        <>
          <Text style={styles.rotulo}>CONTINUAR COMO</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.cuentas}>
            {cuentas.map(cuenta => (
              <PressableScale
                key={cuenta.user.id}
                style={styles.cuenta}
                onPress={() => cambiarCuenta(cuenta.user.id)}
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel={`Continuar como ${nombreCompleto(cuenta.user)}`}>
                <View style={styles.cuentaAvatar}>
                  <Text style={styles.cuentaInicial}>{cuenta.user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <Text style={styles.cuentaNombre} numberOfLines={1}>
                  {primerNombre(cuenta.user)}
                </Text>
              </PressableScale>
            ))}
            {cerradas.map(({ user }) => (
              <PressableScale
                key={`recordada-${user.id}`}
                style={styles.cuenta}
                onPress={() => continuarCon(user)}
                onLongPress={() => quitarRecordada(user)}
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel={`Continuar como ${nombreCompleto(user)}${dispositivos[user.id] ? ' con tu clave' : ' con Google'}`}
                accessibilityHint="Mantén presionado para quitarla de este teléfono">
                <View style={styles.cuentaAvatar}>
                  <Text style={styles.cuentaInicial}>{user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                  <View style={styles.cuentaMarca}>
                    {dispositivos[user.id] ? <Icon name="candado" size={9} color="#1F1F1F" /> : <LogoGoogle size={10} />}
                  </View>
                </View>
                <Text style={styles.cuentaNombre} numberOfLines={1}>
                  {primerNombre(user)}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
          <SeparadorAcceso texto="o entra con otra cuenta" />
        </>
      ) : null}

      {modo === 'clave' ? (
        <>
          <View style={e.bloqueCampo}>
            <CampoAcceso
              rotulo="CELULAR"
              icono="telefono"
              placeholder="300 123 4567"
              value={telefono}
              onChangeText={valor => {
                setTelefono(valor.replace(/[^\d+ ]/g, '').slice(0, 16));
                limpiarError('telefono');
              }}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              returnKeyType="next"
              onSubmitEditing={() => campoPin.current?.focus()}
              accessibilityLabel="Número de celular"
              editable={!ocupado}
            />
          </View>
          <FieldError mensaje={errores.telefono} />

          <Text style={styles.rotulo}>CLAVE</Text>
          <CampoPin
            ref={campoPin}
            vidrio
            value={pin}
            onChangeText={v => {
              setPin(v);
              limpiarError('pin');
            }}
            onCompleto={v => {
              if (telefonoValido(limpiarCelular(telefono))) entrarConCelular(v);
            }}
            editable={!ocupado}
            conError={!!errores.pin}
            accessibilityLabel="Clave de 4 números"
          />
          <FieldError mensaje={errores.pin} />

          <TouchableOpacity style={styles.olvide} onPress={() => setRecuperando({ telefono })} disabled={ocupado}>
            <Text style={styles.olvideTexto}>¿Olvidaste tu clave?</Text>
          </TouchableOpacity>

          <PressableScale style={e.boton} scaleTo={0.97} onPress={() => entrarConCelular()} disabled={ocupado}>
            {cargando ? <ActivityIndicator size="small" color={l.botonTexto} /> : <Text style={e.botonTexto}>Entrar</Text>}
          </PressableScale>
        </>
      ) : (
        <>
          <View style={e.bloqueCampo}>
            <CampoAcceso
              rotulo="CORREO, CELULAR O USUARIO"
              icono="sobre"
              placeholder="nombre@correo.com"
              value={usuario}
              onChangeText={valor => {
                setUsuario(valor);
                limpiarError('usuario');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              accessibilityLabel="Correo, celular o usuario"
              editable={!ocupado}
            />
          </View>
          <FieldError mensaje={errores.usuario} />

          <View style={e.bloqueCampo}>
            <CampoAcceso
              rotulo="CONTRASEÑA"
              icono="candado"
              placeholder="Tu contraseña"
              value={password}
              onChangeText={valor => {
                setPassword(valor);
                limpiarError('password');
              }}
              accessibilityLabel="Contraseña"
              editable={!ocupado}
              clave
            />
          </View>
          <FieldError mensaje={errores.password} />
          <Text style={e.ayuda}>Al entrar te pediremos crear tu clave de 4 números.</Text>

          <PressableScale style={e.boton} scaleTo={0.97} onPress={entrarConContrasena} disabled={ocupado}>
            {cargando ? <ActivityIndicator size="small" color={l.botonTexto} /> : <Text style={e.botonTexto}>Entrar</Text>}
          </PressableScale>
        </>
      )}

      {conGoogle ? (
        <>
          <SeparadorAcceso texto="o" />
          <BotonGoogle onPress={() => entrarConGoogle(false)} cargando={google.cargando} disabled={cargando} />
        </>
      ) : null}

      <TouchableOpacity
        style={styles.otroModo}
        onPress={() => {
          setModo(m => (m === 'clave' ? 'contrasena' : 'clave'));
          setErrores({});
          setError(null);
        }}
        disabled={ocupado}>
        <Text style={styles.olvideTexto}>
          {modo === 'clave' ? '¿Tu cuenta es de antes? Entra con tu contraseña' : 'Entrar con mi celular y mi clave'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={e.pie} onPress={() => navigation.navigate('Register')} disabled={ocupado}>
        <Text style={e.pieTexto}>
          ¿No tienes cuenta? <Text style={e.enlace}>Regístrate</Text>
        </Text>
      </TouchableOpacity>
    </EscenaAcceso>
  );
}

// `l`: colores propios del login (paletasLogin en theme.tsx), del mismo modo que `c`.
const useStyles = makeStyles((_c, _sombras, l) => ({
  rotulo: { color: l.rotulo, fontFamily: font.bold, fontSize: 11, letterSpacing: 1.3, marginBottom: 6 },
  olvide: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: 2 },
  olvideTexto: { color: l.rotulo, fontFamily: font.semibold, fontSize: 13, textAlign: 'center' },
  otroModo: { minHeight: 44, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  fuerte: { fontFamily: font.bold, color: l.campoTexto },
  separado: { marginTop: 14 },
  prueba: { marginTop: 12, marginBottom: 0 },
  pruebaTxt: { flex: 1 },
  enlaces: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  enlace: { color: l.rotulo, fontFamily: font.bold, fontSize: 13, textDecorationLine: 'underline' },
  enlaceApagado: { opacity: 0.6, textDecorationLine: 'none' },
  // «Continuar como»: píldoras de las cuentas guardadas.
  cuentas: { gap: 8 },
  cuenta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    maxWidth: 170,
    paddingLeft: 5,
    paddingRight: 14,
    borderRadius: radius.pill,
    backgroundColor: l.campo,
  },
  cuentaAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: l.boton,
  },
  cuentaInicial: { color: l.botonTexto, fontFamily: font.displayExtra, fontSize: 13, includeFontPadding: false },
  // Candado (entra con la clave) o «G» (con Google) en la esquina del avatar de una cuenta recordada.
  cuentaMarca: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cuentaNombre: { flexShrink: 1, color: l.campoTexto, fontFamily: font.semibold, fontSize: 14 },
}));
