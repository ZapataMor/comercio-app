import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { entrarConGoogle } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import { LogoGoogle } from '../components/BotonGoogle';
import FieldError from '../components/FieldError';
import CampoAcceso from '../components/login/CampoAcceso';
import EscenaAcceso from '../components/login/EscenaAcceso';
import { BotonVolverAcceso, CasillaPolitica, LogoAcceso, useEstilosAcceso } from '../components/login/estilosAcceso';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { useTheme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RegistroGoogle'>;

// Último paso del registro con Google: la cuenta de Google ya se eligió y el
// backend dijo que es nueva. Aquí se revisa el nombre que trae Google y se
// acepta la política de privacidad (Ley 1581), igual que en el registro con
// el celular. No se pide contraseña ni celular: la contraseña se puede crear
// después en «Mi información», y el celular se pide en el primer pedido.
//
// Se ve igual que el login (EscenaAcceso): mismo fondo y misma tarjeta.

export default function RegistroGoogleScreen({ navigation, route }: Props) {
  const { idToken, perfil } = route.params;
  const { login: l } = useTheme();
  const e = useEstilosAcceso();
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
    } catch (err) {
      const campos = fieldErrorsFromError(err);
      if (campos.id_token) {
        // El permiso de Google vence en una hora: hay que volver a elegir la cuenta.
        setError(`${campos.id_token} Vuelve atrás y elige otra vez tu cuenta de Google.`);
      } else if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        setError(messageFromError(err));
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <EscenaAcceso>
      <BotonVolverAcceso onPress={() => navigation.goBack()} disabled={cargando} />
      <LogoAcceso />
      <Text style={e.titulo}>Crear cuenta</Text>
      <Text style={e.subtitulo}>Ya casi: revisa tus datos</Text>

      {error ? <Text style={e.error}>{error}</Text> : null}

      <View style={e.recuadro}>
        <View style={estiloLogo}>
          <LogoGoogle size={16} />
        </View>
        <View style={e.recuadroTexto}>
          <Text style={e.recuadroEtiqueta}>CUENTA DE GOOGLE</Text>
          <Text style={e.recuadroValor} numberOfLines={1}>
            {perfil.email}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} disabled={cargando} hitSlop={8}>
          <Text style={e.recuadroAccion}>Cambiar</Text>
        </TouchableOpacity>
      </View>

      <View style={e.bloqueCampo}>
        <CampoAcceso
          rotulo="NOMBRE(S)"
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
          rotulo="APELLIDOS"
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

      <Text style={e.nota}>Entrarás con Google. Si quieres, luego creas una contraseña en «Mi información».</Text>

      <PressableScale
        style={[e.boton, cargando && e.botonInactivo]}
        scaleTo={0.97}
        onPress={crearCuenta}
        disabled={cargando}
        accessibilityRole="button">
        {cargando ? <ActivityIndicator size="small" color={l.botonTexto} /> : <Text style={e.botonTexto}>Crear cuenta</Text>}
      </PressableScale>

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
