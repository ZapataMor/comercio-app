import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { actualizarPerfil, conectarGoogle, pedirCodigoTelefonoPerfil, verificarTelefonoPerfil } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import BotonGoogle from '../components/BotonGoogle';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import CampoAcceso from '../components/login/CampoAcceso';
import EscenaAcceso from '../components/login/EscenaAcceso';
import { BotonVolverAcceso, LogoAcceso, SeparadorAcceso, useAtrasAndroid, useEstilosAcceso } from '../components/login/estilosAcceso';
import VerificarTelefono, { formatoCelular } from '../components/VerificarTelefono';
import { fieldErrorsFromError, messageFromError } from '../formErrors';
import { elegirCuentaGoogle, googleDisponible } from '../google';
import { font, makeStyles, useTheme } from '../theme';

// ─────────────────────────────────────────────────────────────
// «Completa tu cuenta»: sale una vez, al entrar después de registrarse (o de
// crear la clave), y todo es opcional.
//
//  - Quien se registró con el celular: su correo. Lo recomendado es
//    «Conectar con Google», que deja el correo confirmado y otra forma de
//    entrar y de recuperar la cuenta si pierde el número; también puede
//    escribirlo (sin confirmar, sirve para avisos).
//  - Quien se registró con Google: su celular, confirmado con un código de
//    WhatsApp. El domiciliario lo necesita para llamar, y con él también
//    entra con su número.
//
// «Ahora no» (o «Listo») sigue a la app; todo esto también está en
// «Mi información».
// ─────────────────────────────────────────────────────────────

export default function CompletarCuentaScreen() {
  const { auth, actualizarUsuario, terminarCompletar } = useAuth();
  const { login: l } = useTheme();
  const e = useEstilosAcceso();
  const styles = useStyles();
  // Qué le faltaba al llegar: esas secciones siguen visibles (con ✓) al completarlas.
  const [pideCorreo] = useState(() => !auth?.user.email);
  const [pideCelular] = useState(() => !auth?.user.telefono_verificado);
  const [correo, setCorreo] = useState('');
  const [errorCorreo, setErrorCorreo] = useState<string | undefined>();
  const [guardandoCorreo, setGuardandoCorreo] = useState(false);
  const [conectando, setConectando] = useState(false);
  // En el paso del código de WhatsApp, cómo volver al del número.
  const [volverAlNumero, setVolverAlNumero] = useState<(() => void) | null>(null);
  // La flecha (y el «atrás» de Android): del código al número; si no, sigue a
  // la app como «Ahora no» (la cuenta ya está creada).
  const volver = () => (volverAlNumero ? volverAlNumero() : terminarCompletar());
  useAtrasAndroid(volver);
  if (!auth) return null;
  const { token, user } = auth;
  const correoListo = !!user.email;
  const celularListo = !!user.telefono_verificado;
  const algoHecho = (pideCorreo && correoListo) || (pideCelular && celularListo);

  async function conGoogle() {
    setErrorCorreo(undefined);
    setConectando(true);
    try {
      const idToken = await elegirCuentaGoogle();
      if (!idToken) return;
      actualizarUsuario((await conectarGoogle(token, idToken)).user);
    } catch (err) {
      setErrorCorreo(messageFromError(err));
    } finally {
      setConectando(false);
    }
  }

  async function guardarCorreo() {
    const limpio = correo.trim();
    if (!/^\S+@\S+\.\S+$/.test(limpio)) {
      setErrorCorreo('Escribe un correo válido, como nombre@correo.com.');
      return;
    }
    setErrorCorreo(undefined);
    setGuardandoCorreo(true);
    try {
      const actualizado = await actualizarPerfil(token, {
        name: user.name,
        apellidos: user.apellidos ?? '',
        email: limpio,
        ...(user.telefono ? { telefono: user.telefono } : {}),
      });
      actualizarUsuario(actualizado);
    } catch (err) {
      setErrorCorreo(fieldErrorsFromError(err).email ?? messageFromError(err));
    } finally {
      setGuardandoCorreo(false);
    }
  }

  return (
    <EscenaAcceso>
      <BotonVolverAcceso onPress={volver} accessibilityLabel={volverAlNumero ? 'Volver al número' : 'Volver, entrar a Vitrina'} />
      <LogoAcceso />
      <Text style={e.titulo}>Completa tu cuenta</Text>
      <Text style={e.subtitulo}>Es opcional: también puedes hacerlo después en Mi información.</Text>

      {pideCorreo ? (
        <View style={styles.seccion}>
          <Text style={styles.rotulo}>TU CORREO</Text>
          {correoListo ? (
            <Listo etiqueta={user.google ? 'GOOGLE CONECTADO' : 'CORREO GUARDADO'} valor={user.email ?? ''} />
          ) : (
            <>
              <Text style={[e.texto, styles.explica]}>Para recibir avisos y tener otra forma de entrar si algún día cambias de número.</Text>
              {googleDisponible() ? (
                <>
                  <BotonGoogle texto="Conectar con Google" onPress={conGoogle} cargando={conectando} disabled={guardandoCorreo} style={styles.google} />
                  <SeparadorAcceso texto="o escríbelo" />
                </>
              ) : null}
              <View style={e.bloqueCampo}>
                <CampoAcceso
                  rotulo="CORREO"
                  icono="sobre"
                  placeholder="nombre@correo.com"
                  value={correo}
                  onChangeText={v => {
                    setCorreo(v);
                    setErrorCorreo(undefined);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  accessibilityLabel="Correo"
                  editable={!guardandoCorreo && !conectando}
                />
              </View>
              <FieldError mensaje={errorCorreo} />
              <PressableScale style={[e.boton, styles.secundario]} scaleTo={0.97} onPress={guardarCorreo} disabled={guardandoCorreo || conectando}>
                {guardandoCorreo ? <ActivityIndicator size="small" color={l.botonTexto} /> : <Text style={e.botonTexto}>Guardar correo</Text>}
              </PressableScale>
            </>
          )}
        </View>
      ) : null}

      {pideCelular ? (
        <View style={styles.seccion}>
          <Text style={styles.rotulo}>TU CELULAR</Text>
          {celularListo ? (
            <Listo etiqueta="CELULAR CONFIRMADO" valor={`+57 ${formatoCelular(user.telefono ?? '')}`} />
          ) : (
            <>
              <Text style={[e.texto, styles.explica]}>Para que el domiciliario pueda llamarte y para entrar también con tu número.</Text>
              <VerificarTelefono
                vidrio
                onPaso={v => setVolverAlNumero(() => v)}
                telefonoInicial={user.telefono ?? ''}
                pedir={tel => pedirCodigoTelefonoPerfil(token, tel)}
                verificar={async (tel, codigo) => actualizarUsuario(await verificarTelefonoPerfil(token, tel, codigo))}
              />
            </>
          )}
        </View>
      ) : null}

      {algoHecho ? (
        <PressableScale style={[e.boton, styles.final]} scaleTo={0.97} onPress={terminarCompletar} accessibilityRole="button">
          <Text style={e.botonTexto}>Listo, entrar a Vitrina</Text>
        </PressableScale>
      ) : (
        <TouchableOpacity style={e.pie} onPress={terminarCompletar} accessibilityRole="button">
          <Text style={e.pieTexto}>
            <Text style={e.enlace}>Ahora no</Text>, entrar a Vitrina
          </Text>
        </TouchableOpacity>
      )}
    </EscenaAcceso>
  );
}

/** Recuadro de algo ya completado. */
function Listo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  const { login: l } = useTheme();
  const e = useEstilosAcceso();
  return (
    <View style={e.recuadro}>
      <Icon name="check" size={18} color={l.campoIcono} />
      <View style={e.recuadroTexto}>
        <Text style={e.recuadroEtiqueta}>{etiqueta}</Text>
        <Text style={e.recuadroValor} numberOfLines={1}>
          {valor}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((_c, _sombras, l) => ({
  seccion: { marginTop: 8, marginBottom: 6 },
  rotulo: { color: l.rotulo, fontFamily: font.bold, fontSize: 11, letterSpacing: 1.3, marginBottom: 8 },
  explica: { marginBottom: 12 },
  google: { marginTop: 4 },
  secundario: { marginTop: 4 },
  final: { marginTop: 18 },
}));
