import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Keyboard,
  LayoutAnimation,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { login, Usuario } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import BotonGoogle, { useEntrarConGoogle } from '../components/BotonGoogle';
import FieldError from '../components/FieldError';
import Icon, { IconName } from '../components/Icon';
import CarruselFondo from '../components/login/CarruselFondo';
import FiltroCine from '../components/login/FiltroCine';
import { FOTOS_LOGIN } from '../components/login/fotosLogin';
import TarjetaVidrio from '../components/login/TarjetaVidrio';
import { marca, VitrinaLogo } from '../components/Logo';
import RecuperarClaveModal from '../components/RecuperarClaveModal';
import { googleDisponible } from '../google';
import { useToast } from '../Toast';
import {
  FieldErrors,
  fieldErrorsFromError,
  messageFromError,
} from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

// ─────────────────────────────────────────────────────────────
// Login — fotos de Maicao a pantalla completa con filtro de cine y una
// tarjeta de vidrio centrada.
//
// Capas, de atrás hacia adelante:
//   1. CarruselFondo: fotos con paneo + zoom que se empujan cada 7 s.
//   2. FiltroCine: baño de color, viñeta, grano y velos.
//   3. Nombre del lugar (esquina inferior izquierda).
//   4. TarjetaVidrio con el formulario.
//
// Como el resto de la app, sigue el modo por hora (día 05:00–17:59, noche el
// resto) a través del tema: fotos, filtro y colores cambian con él. Los
// colores propios del login están en theme.tsx (`paletasLogin`).
//
// Con cuentas guardadas en el teléfono (ver AuthContext), arriba de los
// campos sale «Continuar como» para volver a cualquiera con un toque.
// Si se llegó desde «Agregar cuenta», «atrás» vuelve a la cuenta anterior.
// ─────────────────────────────────────────────────────────────

const ANCHO_TARJETA_MAX = 356;
const FOCO_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/** Primer nombre, para la píldora de una cuenta guardada. */
function primerNombre(user: Usuario): string {
  return (
    user.name.trim().split(/\s+/)[0] || user.email || user.telefono || 'Cuenta'
  );
}

type CampoProps = Omit<TextInputProps, 'style'> & {
  rotulo: string;
  icono: IconName;
  /** Ojo de ver/ocultar a la derecha (campo de contraseña). */
  ojo?: { visible: boolean; alternar: () => void };
};

/** Campo hundido del login: rótulo, ícono a la izquierda y anillo de foco. */
function Campo({ rotulo, icono, ojo, onFocus, onBlur, ...props }: CampoProps) {
  const { login: l } = useTheme();
  const styles = useStyles();
  const foco = useRef(new Animated.Value(0)).current;

  function enfocar(encendido: boolean) {
    Animated.timing(foco, {
      toValue: encendido ? 1 : 0,
      duration: 180,
      easing: FOCO_EASE,
      useNativeDriver: true,
    }).start();
  }

  return (
    <>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <View style={styles.campo}>
        <TextInput
          {...props}
          style={[styles.campoTexto, ojo && styles.campoTextoClave]}
          placeholderTextColor={l.campoEjemplo}
          cursorColor={l.cursor}
          selectionColor={l.cursor}
          selectionHandleColor={l.cursor}
          secureTextEntry={ojo ? !ojo.visible : undefined}
          onFocus={e => {
            enfocar(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            enfocar(false);
            onBlur?.(e);
          }}
        />
        <View pointerEvents="none" style={styles.campoIcono}>
          <Icon name={icono} size={20} color={l.campoIcono} />
        </View>
        {/* foco: borde de 1 px + anillo de 3 px */}
        <Animated.View
          pointerEvents="none"
          style={[styles.campoFoco, { opacity: foco }]}
        />
        {ojo ? (
          <TouchableOpacity
            style={styles.ojo}
            onPress={ojo.alternar}
            accessibilityRole="button"
            accessibilityLabel={
              ojo.visible ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
          >
            <Icon
              name={ojo.visible ? 'ojo-cerrado' : 'ojo'}
              size={20}
              color={l.ojo}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
}

export default function LoginScreen({ navigation }: Props) {
  const {
    entrar: guardarSesion,
    cuentas,
    agregando,
    cambiarCuenta,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const { modo, login: l } = useTheme();
  const styles = useStyles();
  // Correo, celular o nombre de usuario.
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  // Ojo del campo de contraseña: la muestra mientras está encendido.
  const [verClave, setVerClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<FieldErrors>({});
  // "¿Olvidaste tu contraseña?" abierto.
  const [recuperando, setRecuperando] = useState(false);
  const toast = useToast();
  // «Continuar con Google»: si la cuenta es nueva, falta el último paso del registro.
  const google = useEntrarConGoogle((idToken, perfil) =>
    navigation.navigate('RegistroGoogle', { idToken, perfil }),
  );
  const ocupado = cargando || google.cargando;
  // Tamaño de la pantalla. El fondo guarda el alto completo: al abrir el
  // teclado la pantalla se encoge y el fondo queda quieto debajo, en vez de
  // reescalar las fotos.
  const [lienzo, setLienzo] = useState<{ w: number; h: number } | null>(null);

  // Alto actual de la pantalla (baja si el sistema la encoge con el teclado)
  // y alto del teclado abierto.
  const [altoActual, setAltoActual] = useState(0);
  const [teclado, setTeclado] = useState(0);

  function medir(ev: LayoutChangeEvent) {
    const { width, height } = ev.nativeEvent.layout;
    setAltoActual(height);
    setLienzo(prev =>
      prev && prev.w === width && prev.h >= height
        ? prev
        : { w: width, h: height },
    );
  }

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  // Teclado: con la app de borde a borde (Android 15+) la ventana no se
  // encoge al abrirlo, así que la tarjeta se centra en el espacio libre de
  // arriba. Si el sistema sí la encoge, ese tramo ya no se descuenta.
  useEffect(() => {
    const cambiar = (alto: number) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTeclado(alto);
    };
    const ios = Platform.OS === 'ios';
    const abre = Keyboard.addListener(
      ios ? 'keyboardWillShow' : 'keyboardDidShow',
      e => cambiar(e.endCoordinates.height),
    );
    const cierra = Keyboard.addListener(
      ios ? 'keyboardWillHide' : 'keyboardDidHide',
      () => cambiar(0),
    );
    return () => {
      abre.remove();
      cierra.remove();
    };
  }, []);
  const tapaTeclado = Math.max(
    0,
    teclado - ((lienzo?.h ?? altoActual) - altoActual),
  );

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

  async function entrar() {
    setError(null);
    google.setError(null);
    setErrores({});
    const nuevosErrores: FieldErrors = {};
    if (!usuario.trim())
      nuevosErrores.usuario = 'Escribe tu correo, celular o usuario.';
    if (!password)
      nuevosErrores.password = 'El campo contraseña es obligatorio.';
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    setCargando(true);
    try {
      const { token, user } = await login(usuario.trim(), password);
      guardarSesion(token, user);
    } catch (err) {
      const campos = fieldErrorsFromError(err);
      if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        setError(messageFromError(err));
      }
    } finally {
      setCargando(false);
    }
  }

  const anchoTarjeta = Math.min((lienzo?.w ?? 360) - 40, ANCHO_TARJETA_MAX);

  return (
    <View style={styles.raiz} onLayout={medir}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* ══ Fondo: fotos + filtro de cine + nombre del lugar ══ */}
      {lienzo ? (
        <CarruselFondo
          key={modo}
          fotos={FOTOS_LOGIN[modo]}
          ancho={lienzo.w}
          alto={lienzo.h}
          abajo={insets.bottom}
          colorLugar={l.lugar}
          filtro={<FiltroCine ancho={lienzo.w} alto={lienzo.h} c={l} />}
        />
      ) : null}

      {/* ══ Tarjeta: desplazable por si no cabe (teclado abierto, cuentas
          guardadas); cuando cabe, queda centrada. ══ */}
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.contenido,
          {
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom, tapaTeclado) + 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <TarjetaVidrio ancho={anchoTarjeta} c={l}>
          <VitrinaLogo
            height={40}
            chip={false}
            modo={modo}
            textColor={modo === 'noche' ? marca.arena : marca.tinta}
            style={styles.logo}
          />

          {error || google.error ? (
            <Text style={styles.error}>{error ?? google.error}</Text>
          ) : null}

          {/* cuentas con la sesión abierta en este teléfono: a un toque */}
          {cuentas.length > 0 ? (
            <>
              <Text style={styles.rotulo}>CONTINUAR COMO</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.cuentas}
              >
                {cuentas.map(cuenta => (
                  <PressableScale
                    key={cuenta.user.id}
                    style={styles.cuenta}
                    onPress={() => cambiarCuenta(cuenta.user.id)}
                    disabled={ocupado}
                    accessibilityRole="button"
                    accessibilityLabel={`Continuar como ${[
                      cuenta.user.name,
                      cuenta.user.apellidos,
                    ]
                      .filter(Boolean)
                      .join(' ')}`}
                  >
                    <View style={styles.cuentaAvatar}>
                      <Text style={styles.cuentaInicial}>
                        {cuenta.user.name.trim().charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                    <Text style={styles.cuentaNombre} numberOfLines={1}>
                      {primerNombre(cuenta.user)}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>
              <View style={styles.separador}>
                <View style={styles.separadorLinea} />
                <Text style={styles.separadorTxt}>o entra con otra cuenta</Text>
                <View style={styles.separadorLinea} />
              </View>
            </>
          ) : null}

          <View style={styles.bloqueCampo}>
            <Campo
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

          <View style={styles.bloqueCampo}>
            <Campo
              rotulo="CONTRASEÑA"
              icono="candado"
              placeholder="Tu contraseña"
              value={password}
              onChangeText={valor => {
                setPassword(valor);
                limpiarError('password');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Contraseña"
              editable={!ocupado}
              ojo={{ visible: verClave, alternar: () => setVerClave(v => !v) }}
            />
          </View>
          <FieldError mensaje={errores.password} />

          <TouchableOpacity
            style={styles.olvide}
            onPress={() => setRecuperando(true)}
            disabled={ocupado}
          >
            <Text style={styles.olvideTexto}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <PressableScale
            style={styles.boton}
            scaleTo={0.97}
            onPress={entrar}
            disabled={ocupado}
          >
            {cargando ? (
              <ActivityIndicator size="small" color={l.botonTexto} />
            ) : (
              <Text style={styles.botonTexto}>Entrar</Text>
            )}
          </PressableScale>

          {googleDisponible() ? (
            <>
              <View style={styles.separador}>
                <View style={styles.separadorLinea} />
                <Text style={styles.separadorTxt}>o</Text>
                <View style={styles.separadorLinea} />
              </View>
              <BotonGoogle
                onPress={() => {
                  setError(null);
                  setErrores({});
                  google.iniciar();
                }}
                cargando={google.cargando}
                disabled={cargando}
              />
            </>
          ) : null}

          <TouchableOpacity
            style={styles.registro}
            onPress={() => navigation.navigate('Register')}
            disabled={ocupado}
          >
            <Text style={styles.registroTexto}>
              ¿No tienes cuenta?{' '}
              <Text style={styles.registroEnlace}>Regístrate</Text>
            </Text>
          </TouchableOpacity>
        </TarjetaVidrio>
      </ScrollView>

      <RecuperarClaveModal
        visible={recuperando}
        identificadorInicial={usuario}
        onCerrar={() => setRecuperando(false)}
        onListo={(identificador, mensaje) => {
          setRecuperando(false);
          setUsuario(identificador);
          setPassword('');
          setErrores({});
          setError(null);
          toast.exito('Contraseña cambiada', mensaje);
        }}
      />
    </View>
  );
}

const ALTO_CAMPO = 48;

// `l`: colores propios del login (paletasLogin en theme.tsx), del mismo modo que `c`.
const useStyles = makeStyles((c, _sombras, l) => {
  return {
    raiz: { flex: 1, backgroundColor: l.sombraEscena, overflow: 'hidden' },
    fill: { flex: 1 },
    contenido: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    logo: { alignSelf: 'center', marginBottom: 20 },
    rotulo: {
      color: l.rotulo,
      fontFamily: font.bold,
      fontSize: 11,
      letterSpacing: 1.3,
      marginBottom: 6,
    },
    bloqueCampo: { marginBottom: 12 },
    // Campo hundido: sombra interior arriba y filo de luz abajo.
    campo: {
      height: ALTO_CAMPO,
      borderRadius: radius.md,
      backgroundColor: l.campo,
      boxShadow: `inset 0px 2px 5px 0px ${l.campoHundido}, inset 0px -1px 0px 0px ${l.campoFilo}`,
      justifyContent: 'center',
    },
    campoIcono: {
      position: 'absolute',
      left: 12,
      top: (ALTO_CAMPO - 20) / 2,
      width: 20,
      height: 20,
    },
    campoTexto: {
      height: ALTO_CAMPO,
      paddingLeft: 44,
      paddingRight: 14,
      paddingVertical: 0,
      color: l.campoTexto,
      fontFamily: font.medium,
      fontSize: 16,
    },
    // Deja lugar al ojo a la derecha del campo de contraseña.
    campoTextoClave: { paddingRight: ALTO_CAMPO },
    campoFoco: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: l.foco,
      boxShadow: `0px 0px 0px 3px ${l.foco}`,
    },
    ojo: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: ALTO_CAMPO,
      height: ALTO_CAMPO,
      alignItems: 'center',
      justifyContent: 'center',
    },
    olvide: {
      alignSelf: 'flex-end',
      minHeight: 44,
      justifyContent: 'center',
      marginTop: -8,
    },
    olvideTexto: { color: l.rotulo, fontFamily: font.semibold, fontSize: 13 },
    boton: {
      height: 51,
      borderRadius: radius.md,
      backgroundColor: l.boton,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    botonTexto: {
      color: l.botonTexto,
      fontFamily: font.bold,
      fontSize: 16,
      includeFontPadding: false,
    },
    registro: {
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 6,
    },
    registroTexto: {
      color: l.rotulo,
      fontFamily: font.regular,
      fontSize: 14,
      textAlign: 'center',
    },
    registroEnlace: { fontFamily: font.bold, textDecorationLine: 'underline' },
    // Aviso general: mismos colores de error que el resto de la app.
    error: {
      backgroundColor: c.dangerSoft,
      color: c.danger,
      fontFamily: font.medium,
      padding: 10,
      borderRadius: radius.sm,
      marginBottom: 16,
      fontSize: 13,
    },
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
    cuentaInicial: {
      color: l.botonTexto,
      fontFamily: font.displayExtra,
      fontSize: 13,
      includeFontPadding: false,
    },
    cuentaNombre: {
      flexShrink: 1,
      color: l.campoTexto,
      fontFamily: font.semibold,
      fontSize: 14,
    },
    separador: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 16,
      marginBottom: 14,
    },
    separadorLinea: {
      flex: 1,
      height: 1,
      backgroundColor: l.rotulo,
      opacity: 0.25,
    },
    separadorTxt: { color: l.rotulo, fontFamily: font.medium, fontSize: 12 },
  };
});
