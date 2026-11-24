import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { pedirCodigoRegistro, register, verificarTelefonoRegistro } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import BotonGoogle, { useEntrarConGoogle } from '../components/BotonGoogle';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import CampoAcceso from '../components/login/CampoAcceso';
import CrearClaveVidrio from '../components/login/CrearClaveVidrio';
import EscenaAcceso from '../components/login/EscenaAcceso';
import {
  BotonVolverAcceso,
  CasillaPolitica,
  LogoAcceso,
  SeparadorAcceso,
  useAtrasAndroid,
  useEstilosAcceso,
} from '../components/login/estilosAcceso';
import VerificarTelefono, { formatoCelular } from '../components/VerificarTelefono';
import { googleDisponible } from '../google';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

// No se elige tipo al registrarse: toda cuenta nace como Cliente. Luego
// puede crear sus negocios (o unirse a otros) desde "Mis negocios" y hacerse
// domiciliario desde el menú del ícono de usuario.
//
// Tres pasos: confirmar el celular con un código por WhatsApp (con él se
// entra y se recupera la clave), nombre y política de privacidad, y crear la
// clave de 4 números. El correo ya no se pide aquí: al entrar, «Completa tu
// cuenta» lo ofrece (opcional).
//
// O, en vez del celular, «Continuar con Google»: si la cuenta de Google es
// nueva sigue en RegistroGoogle (nombre, política y clave); si ya existe,
// pide su clave y entra.
//
// Se ve igual que el login (EscenaAcceso): mismo fondo y misma tarjeta, con
// un botón de volver al login en la esquina de arriba.

export default function RegisterScreen({ navigation }: Props) {
  const { login: l } = useTheme();
  const e = useEstilosAcceso();
  const { entrar: guardarSesion } = useAuth();
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  // Celular confirmado por WhatsApp y el token que pide /register.
  const [celular, setCelular] = useState<{ telefono: string; token: string } | null>(null);
  // Después de los datos, el paso de crear la clave.
  const [creandoClave, setCreandoClave] = useState(false);
  const [errorClave, setErrorClave] = useState<string | null>(null);
  // En el paso del código de WhatsApp, cómo volver al del número.
  const [volverAlNumero, setVolverAlNumero] = useState<(() => void) | null>(null);
  // Autorización del tratamiento de datos (Ley 1581): casilla sin marcar por defecto.
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<FieldErrors>({});
  const google = useEntrarConGoogle((idToken, perfil) => navigation.navigate('RegistroGoogle', { idToken, perfil }));
  const conGoogle = googleDisponible();

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  /** Paso de los datos: nombre, apellidos y política. Sigue con la clave. */
  function seguirAClave() {
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
    setErrorClave(null);
    setCreandoClave(true);
  }

  async function crearCuenta(pin: string) {
    if (!celular) return;
    setError(null);
    setErrorClave(null);
    setCargando(true);
    try {
      const r = await register({
        name: nombre.trim(),
        apellidos: apellidos.trim(),
        pin,
        telefono: celular.telefono,
        verificacion: celular.token,
        acepta_terminos: aceptaTerminos,
      });
      // Cuenta nueva: al entrar ve «Completa tu cuenta» (correo, opcional).
      guardarSesion(r.token, r.user, { dispositivo: r.dispositivo, nueva: true });
    } catch (err) {
      const campos = fieldErrorsFromError(err);
      if (campos.telefono || campos.verificacion) {
        // La verificación venció o el número ya tiene cuenta: volver a confirmarlo.
        setCelular(null);
        setCreandoClave(false);
        setError(campos.telefono ?? campos.verificacion);
      } else if (campos.pin || campos.pin_confirmation) {
        setErrorClave(campos.pin ?? campos.pin_confirmation);
      } else if (Object.keys(campos).length > 0) {
        setCreandoClave(false);
        setErrores(campos);
      } else {
        setError(messageFromError(err));
      }
    } finally {
      setCargando(false);
    }
  }

  // La flecha (y el «atrás» de Android) va al paso anterior; desde el primero, al login.
  function volver() {
    if (creandoClave) setCreandoClave(false);
    else if (celular) setCelular(null);
    else if (volverAlNumero) volverAlNumero();
    else navigation.goBack();
  }
  useAtrasAndroid(cargando || google.cargando ? () => {} : volver);

  const avisoGeneral = error ?? (!celular ? google.error : null);
  const irAlLogin = (
    <TouchableOpacity style={e.pie} onPress={() => navigation.goBack()} disabled={cargando || google.cargando}>
      <Text style={e.pieTexto}>
        ¿Ya tienes cuenta? <Text style={e.enlace}>Inicia sesión</Text>
      </Text>
    </TouchableOpacity>
  );

  return (
    <EscenaAcceso>
      {google.modal}
      <BotonVolverAcceso
        onPress={volver}
        disabled={cargando || google.cargando}
        accessibilityLabel={creandoClave || celular || volverAlNumero ? 'Volver al paso anterior' : 'Volver al inicio de sesión'}
      />
      <LogoAcceso />
      <Text style={e.titulo}>Crear cuenta</Text>
      <Text style={e.subtitulo}>
        {creandoClave
          ? 'Último paso: crea tu clave'
          : celular
            ? 'Únete a Vitrina'
            : conGoogle
              ? 'Empieza con Google o con tu celular'
              : 'Empieza con tu número de celular'}
      </Text>

      {avisoGeneral ? <Text style={e.error}>{avisoGeneral}</Text> : null}

      {!celular ? (
        <>
          {conGoogle ? (
            <>
              <BotonGoogle
                onPress={() => {
                  setError(null);
                  google.iniciar();
                }}
                cargando={google.cargando}
              />
              <SeparadorAcceso texto="o con tu celular" />
            </>
          ) : null}
          <VerificarTelefono
            vidrio
            onPaso={v => setVolverAlNumero(() => v)}
            pedir={pedirCodigoRegistro}
            verificar={async (telefono, codigo) => {
              const token = await verificarTelefonoRegistro(telefono, codigo);
              setError(null);
              setCelular({ telefono, token });
            }}
          />
          {irAlLogin}
        </>
      ) : creandoClave ? (
        <>
          <View style={e.recuadro}>
            <Icon name="check" size={18} color={l.campoIcono} />
            <View style={e.recuadroTexto}>
              <Text style={e.recuadroEtiqueta}>Celular confirmado</Text>
              <Text style={e.recuadroValor}>+57 {formatoCelular(celular.telefono)}</Text>
            </View>
            <TouchableOpacity onPress={() => setCreandoClave(false)} disabled={cargando} hitSlop={8}>
              <Text style={e.recuadroAccion}>Atrás</Text>
            </TouchableOpacity>
          </View>
          <CrearClaveVidrio textoBoton="Crear cuenta" cargando={cargando} onCrear={crearCuenta} errorServidor={errorClave} />
        </>
      ) : (
        <>
          <View style={e.recuadro}>
            <Icon name="check" size={18} color={l.campoIcono} />
            <View style={e.recuadroTexto}>
              <Text style={e.recuadroEtiqueta}>Celular confirmado</Text>
              <Text style={e.recuadroValor}>+57 {formatoCelular(celular.telefono)}</Text>
            </View>
            <TouchableOpacity onPress={() => setCelular(null)} disabled={cargando} hitSlop={8}>
              <Text style={e.recuadroAccion}>Cambiar</Text>
            </TouchableOpacity>
          </View>

          <View style={e.bloqueCampo}>
            <CampoAcceso
              rotulo="Nombre(s)"
              icono="usuario"
              value={nombre}
              onChangeText={valor => {
                setNombre(valor);
                limpiarError('name');
              }}
              placeholder="Ej: Ana María"
              autoCapitalize="words"
              textContentType="givenName"
              autoComplete="name-given"
              editable={!cargando}
              accessibilityLabel="Nombre(s)"
            />
          </View>
          <FieldError mensaje={errores.name} />

          <View style={e.bloqueCampo}>
            <CampoAcceso
              rotulo="Apellidos"
              icono="usuarios"
              value={apellidos}
              onChangeText={valor => {
                setApellidos(valor);
                limpiarError('apellidos');
              }}
              placeholder="Ej: Pérez Gómez"
              autoCapitalize="words"
              textContentType="familyName"
              autoComplete="name-family"
              editable={!cargando}
              accessibilityLabel="Apellidos"
            />
          </View>
          <FieldError mensaje={errores.apellidos} />

          <CasillaPolitica
            marcada={aceptaTerminos}
            alCambiar={() => {
              setAceptaTerminos(v => !v);
              limpiarError('acepta_terminos');
            }}
            deshabilitada={cargando}
          />
          <FieldError mensaje={errores.acepta_terminos} />

          <Text style={e.nota}>¿Tienes un negocio? Créalo después desde "Mis negocios".</Text>

          <PressableScale style={e.boton} scaleTo={0.97} onPress={seguirAClave} accessibilityRole="button">
            <Text style={e.botonTexto}>Continuar</Text>
          </PressableScale>

          {irAlLogin}
        </>
      )}
    </EscenaAcceso>
  );
}
