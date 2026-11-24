import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { entrarConGoogle } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import { LogoGoogle } from '../components/BotonGoogle';
import FieldError from '../components/FieldError';
import CampoAcceso from '../components/login/CampoAcceso';
import CrearClaveVidrio from '../components/login/CrearClaveVidrio';
import EscenaAcceso from '../components/login/EscenaAcceso';
import { BotonVolverAcceso, CasillaPolitica, LogoAcceso, useAtrasAndroid, useEstilosAcceso } from '../components/login/estilosAcceso';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'RegistroGoogle'>;

// Últimos pasos del registro con Google: la cuenta de Google ya se eligió y
// el backend dijo que es nueva. Primero se revisa el nombre que trae Google
// y se acepta la política de privacidad (Ley 1581), igual que en el registro
// con el celular; después se crea la clave de 4 números. El celular no se
// pide aquí: al entrar, «Completa tu cuenta» lo ofrece (opcional), y se pide
// en el primer pedido.
//
// Se ve igual que el login (EscenaAcceso): mismo fondo y misma tarjeta.

export default function RegistroGoogleScreen({ navigation, route }: Props) {
  const { idToken, perfil } = route.params;
  const e = useEstilosAcceso();
  const { entrar: guardarSesion } = useAuth();
  const [nombre, setNombre] = useState(perfil.name);
  const [apellidos, setApellidos] = useState(perfil.apellidos);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [creandoClave, setCreandoClave] = useState(false);
  const [errorClave, setErrorClave] = useState<string | null>(null);
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
    setError(null);
    setErrorClave(null);
    setCargando(true);
    try {
      const r = await entrarConGoogle(idToken, {
        registro: { name: nombre.trim(), apellidos: apellidos.trim(), acepta_terminos: true, pin },
      });
      if (r.nuevo || r.requiere_pin) {
        setError('No se pudo crear la cuenta. Inténtalo de nuevo.');
      } else {
        // Cuenta nueva: al entrar ve «Completa tu cuenta» (celular, opcional).
        guardarSesion(r.token, r.user, { dispositivo: r.dispositivo, nueva: true });
      }
    } catch (err) {
      const campos = fieldErrorsFromError(err);
      if (campos.id_token) {
        // El permiso de Google vence en una hora: hay que volver a elegir la cuenta.
        setError(`${campos.id_token} Vuelve atrás y elige otra vez tu cuenta de Google.`);
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

  // La flecha (y el «atrás» de Android): de la clave a los datos; de los datos, a la pantalla anterior.
  const volver = () => (creandoClave ? setCreandoClave(false) : navigation.goBack());
  useAtrasAndroid(cargando ? () => {} : volver);

  const cuentaGoogle = (
    <View style={e.recuadro}>
      <View style={estiloLogo}>
        <LogoGoogle size={16} />
      </View>
      <View style={e.recuadroTexto}>
        <Text style={e.recuadroEtiqueta}>Cuenta de Google</Text>
        <Text style={e.recuadroValor} numberOfLines={1}>
          {perfil.email}
        </Text>
      </View>
      <TouchableOpacity onPress={volver} disabled={cargando} hitSlop={8}>
        <Text style={e.recuadroAccion}>{creandoClave ? 'Atrás' : 'Cambiar'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <EscenaAcceso>
      <BotonVolverAcceso onPress={volver} disabled={cargando} />
      <LogoAcceso />
      <Text style={e.titulo}>Crear cuenta</Text>
      <Text style={e.subtitulo}>{creandoClave ? 'Último paso: crea tu clave' : 'Ya casi: revisa tus datos'}</Text>

      {error ? <Text style={e.error}>{error}</Text> : null}

      {cuentaGoogle}

      {creandoClave ? (
        <CrearClaveVidrio textoBoton="Crear cuenta" cargando={cargando} onCrear={crearCuenta} errorServidor={errorClave} />
      ) : (
        <>
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
            deshabilitada={false}
          />
          <FieldError mensaje={errores.acepta_terminos} />

          <PressableScale style={e.boton} scaleTo={0.97} onPress={seguirAClave} accessibilityRole="button">
            <Text style={e.botonTexto}>Continuar</Text>
          </PressableScale>
        </>
      )}

      <TouchableOpacity style={e.pie} onPress={() => navigation.navigate('Login')} disabled={cargando}>
        <Text style={e.pieTexto}>
          ¿Ya tienes cuenta? <Text style={e.enlace}>Inicia sesión</Text>
        </Text>
      </TouchableOpacity>
    </EscenaAcceso>
  );
}

// Fondo blanco detrás de la «G», como en el botón de Google.
const estiloLogo = {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: '#FFFFFF',
  alignItems: 'center',
  justifyContent: 'center',
} as const;
