import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { login, Usuario } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import BotonGoogle, { LogoGoogle, useEntrarConGoogle } from '../components/BotonGoogle';
import { useConfirmar } from '../components/Confirmacion';
import FieldError from '../components/FieldError';
import CampoAcceso from '../components/login/CampoAcceso';
import EscenaAcceso from '../components/login/EscenaAcceso';
import { LogoAcceso, SeparadorAcceso, useEstilosAcceso } from '../components/login/estilosAcceso';
import RecuperarClaveModal from '../components/RecuperarClaveModal';
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
// Con cuentas guardadas en el teléfono (ver AuthContext), arriba de los
// campos sale «Continuar como» para volver a cualquiera con un toque. Ahí
// también salen las cuentas de Google con la sesión cerrada (con una «G»):
// esas entran eligiendo otra vez la cuenta de Google; con un toque largo se
// quitan del teléfono.
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
  const { entrar: guardarSesion, cuentas, recordadas, olvidarRecordada, agregando, cambiarCuenta } = useAuth();
  const { login: l } = useTheme();
  const e = useEstilosAcceso();
  const styles = useStyles();
  const confirmar = useConfirmar();
  // Correo, celular o nombre de usuario.
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<FieldErrors>({});
  // "¿Olvidaste tu contraseña?" abierto.
  const [recuperando, setRecuperando] = useState(false);
  const toast = useToast();
  // «Continuar con Google»: si la cuenta es nueva, falta el último paso del registro.
  const google = useEntrarConGoogle((idToken, perfil) => navigation.navigate('RegistroGoogle', { idToken, perfil }));
  const ocupado = cargando || google.cargando;
  const conGoogle = googleDisponible();
  // Cuentas de Google recordadas que no tienen ya la sesión abierta.
  const deGoogle = conGoogle ? recordadas.filter(r => !cuentas.some(c => c.user.id === r.user.id)) : [];

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

  async function entrar() {
    setError(null);
    google.setError(null);
    setErrores({});
    const nuevosErrores: FieldErrors = {};
    if (!usuario.trim()) nuevosErrores.usuario = 'Escribe tu correo, celular o usuario.';
    if (!password) nuevosErrores.password = 'El campo contraseña es obligatorio.';
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

  function entrarConGoogle(rapido: boolean) {
    setError(null);
    setErrores({});
    google.iniciar(rapido);
  }

  function quitarRecordada(user: Usuario) {
    confirmar({
      icono: 'usuario',
      titulo: `¿Quitar a ${primerNombre(user)} de este teléfono?`,
      texto: 'Dejará de salir en «Continuar como». Puede volver a entrar cuando quiera con «Continuar con Google».',
      textoBoton: 'Quitar',
      textoCancelar: 'Cancelar',
      accion: () => olvidarRecordada(user.id),
    });
  }

  const recuperar = (
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
  );

  return (
    <EscenaAcceso fuera={recuperar}>
      <LogoAcceso />

      {error || google.error ? <Text style={e.error}>{error ?? google.error}</Text> : null}

      {/* cuentas con la sesión abierta en este teléfono (y las de Google
          recordadas): a un toque */}
      {cuentas.length > 0 || deGoogle.length > 0 ? (
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
            {deGoogle.map(({ user }) => (
              <PressableScale
                key={`google-${user.id}`}
                style={styles.cuenta}
                onPress={() => entrarConGoogle(true)}
                onLongPress={() => quitarRecordada(user)}
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel={`Continuar como ${nombreCompleto(user)} con Google`}
                accessibilityHint="Mantén presionado para quitarla de este teléfono">
                <View style={styles.cuentaAvatar}>
                  <Text style={styles.cuentaInicial}>{user.name.trim().charAt(0).toUpperCase() || '?'}</Text>
                  <View style={styles.cuentaG}>
                    <LogoGoogle size={10} />
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

      <TouchableOpacity style={styles.olvide} onPress={() => setRecuperando(true)} disabled={ocupado}>
        <Text style={styles.olvideTexto}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>

      <PressableScale style={e.boton} scaleTo={0.97} onPress={entrar} disabled={ocupado}>
        {cargando ? <ActivityIndicator size="small" color={l.botonTexto} /> : <Text style={e.botonTexto}>Entrar</Text>}
      </PressableScale>

      {conGoogle ? (
        <>
          <SeparadorAcceso texto="o" />
          <BotonGoogle onPress={() => entrarConGoogle(false)} cargando={google.cargando} disabled={cargando} />
        </>
      ) : null}

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
  olvide: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: -8 },
  olvideTexto: { color: l.rotulo, fontFamily: font.semibold, fontSize: 13 },
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
  // «G» de Google en la esquina del avatar de una cuenta recordada.
  cuentaG: {
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
