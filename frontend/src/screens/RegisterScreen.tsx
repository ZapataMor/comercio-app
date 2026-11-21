import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { pedirCodigoRegistro, register, verificarTelefonoRegistro } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import BotonGoogle, { useEntrarConGoogle } from '../components/BotonGoogle';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import CampoAcceso from '../components/login/CampoAcceso';
import EscenaAcceso from '../components/login/EscenaAcceso';
import {
  BotonVolverAcceso,
  CasillaPolitica,
  LogoAcceso,
  SeparadorAcceso,
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
// Primero se confirma el celular con un código por WhatsApp (con él se
// entra y se recupera la contraseña); después se llenan los datos. El
// correo es opcional.
//
// O, en vez del celular, «Continuar con Google»: si la cuenta de Google es
// nueva sigue en RegistroGoogle (nombre y política); si ya existe, entra.
//
// Se ve igual que el login (EscenaAcceso): mismo fondo y misma tarjeta, con
// un botón de volver al login en la esquina de arriba.

export default function RegisterScreen({ navigation }: Props) {
  const { login: l } = useTheme();
  const e = useEstilosAcceso();
  const { entrar: guardarSesion } = useAuth();
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  // Celular confirmado por WhatsApp y el token que pide /register.
  const [celular, setCelular] = useState<{ telefono: string; token: string } | null>(null);
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

  async function crearCuenta() {
    setError(null);
    setErrores({});

    const nuevosErrores: FieldErrors = {};
    if (!nombre.trim()) nuevosErrores.name = 'El campo nombre es obligatorio.';
    if (!apellidos.trim()) nuevosErrores.apellidos = 'El campo apellidos es obligatorio.';
    if (!password) nuevosErrores.password = 'El campo contraseña es obligatorio.';
    if (!aceptaTerminos) {
      nuevosErrores.acepta_terminos = 'Debes aceptar la política de privacidad para crear la cuenta.';
    }
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    if (password.length < 5) {
      setErrores({ password: 'La contraseña debe tener al menos 5 caracteres.' });
      return;
    }
    if (password !== confirmar) {
      setErrores({ confirmar: 'La contraseña y su confirmación deben ser iguales.' });
      return;
    }

    if (!celular) return;
    setCargando(true);
    try {
      const { token, user } = await register({
        name: nombre.trim(),
        apellidos: apellidos.trim(),
        email: email.trim() || null,
        password,
        telefono: celular.telefono,
        verificacion: celular.token,
        acepta_terminos: aceptaTerminos,
      });
      guardarSesion(token, user);
    } catch (err) {
      const campos = fieldErrorsFromError(err, { password_confirmation: 'confirmar' });
      if (campos.telefono || campos.verificacion) {
        // La verificación venció o el número ya tiene cuenta: volver a confirmarlo.
        setCelular(null);
        setError(campos.telefono ?? campos.verificacion);
      } else if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        setError(messageFromError(err));
      }
    } finally {
      setCargando(false);
    }
  }

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
      <BotonVolverAcceso
        onPress={() => navigation.goBack()}
        disabled={cargando || google.cargando}
        accessibilityLabel="Volver al inicio de sesión"
      />
      <LogoAcceso />
      <Text style={e.titulo}>Crear cuenta</Text>
      <Text style={e.subtitulo}>
        {celular ? 'Únete a Vitrina' : conGoogle ? 'Empieza con Google o con tu celular' : 'Empieza con tu número de celular'}
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
            pedir={pedirCodigoRegistro}
            verificar={async (telefono, codigo) => {
              const token = await verificarTelefonoRegistro(telefono, codigo);
              setError(null);
              setCelular({ telefono, token });
            }}
          />
          {irAlLogin}
        </>
      ) : (
        <>
          <View style={e.recuadro}>
            <Icon name="check" size={18} color={l.campoIcono} />
            <View style={e.recuadroTexto}>
              <Text style={e.recuadroEtiqueta}>CELULAR CONFIRMADO</Text>
              <Text style={e.recuadroValor}>+57 {formatoCelular(celular.telefono)}</Text>
            </View>
            <TouchableOpacity onPress={() => setCelular(null)} disabled={cargando} hitSlop={8}>
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

          <View style={e.bloqueCampo}>
            <CampoAcceso
              rotulo="CORREO (OPCIONAL)"
              icono="sobre"
              value={email}
              onChangeText={valor => {
                setEmail(valor);
                limpiarError('email');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="correo@ejemplo.co"
              editable={!cargando}
              accessibilityLabel="Correo"
            />
          </View>
          <FieldError mensaje={errores.email} />
          <Text style={e.ayuda}>Otra forma de entrar y de recuperar tu contraseña.</Text>

          <View style={e.bloqueCampo}>
            <CampoAcceso
              rotulo="CONTRASEÑA"
              icono="candado"
              value={password}
              onChangeText={valor => {
                setPassword(valor);
                limpiarError('password');
              }}
              placeholder="Mínimo 5 caracteres"
              editable={!cargando}
              accessibilityLabel="Contraseña"
              clave
            />
          </View>
          <FieldError mensaje={errores.password} />

          <View style={e.bloqueCampo}>
            <CampoAcceso
              rotulo="CONFIRMAR CONTRASEÑA"
              icono="candado"
              value={confirmar}
              onChangeText={valor => {
                setConfirmar(valor);
                limpiarError('confirmar');
              }}
              placeholder="Repite la contraseña"
              editable={!cargando}
              accessibilityLabel="Confirmar contraseña"
              clave
            />
          </View>
          <FieldError mensaje={errores.confirmar} />

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

          <PressableScale
            style={[e.boton, cargando && e.botonInactivo]}
            scaleTo={0.97}
            onPress={crearCuenta}
            disabled={cargando}
            accessibilityRole="button">
            {cargando ? <ActivityIndicator size="small" color={l.botonTexto} /> : <Text style={e.botonTexto}>Crear cuenta</Text>}
          </PressableScale>

          {irAlLogin}
        </>
      )}
    </EscenaAcceso>
  );
}
