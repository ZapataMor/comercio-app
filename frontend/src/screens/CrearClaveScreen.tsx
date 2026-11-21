import React, { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { guardarClave } from '../api';
import { useAuth } from '../AuthContext';
import CrearClaveVidrio from '../components/login/CrearClaveVidrio';
import EscenaAcceso from '../components/login/EscenaAcceso';
import { LogoAcceso, useEstilosAcceso } from '../components/login/estilosAcceso';
import { fieldErrorsFromError, messageFromError } from '../formErrors';

// ─────────────────────────────────────────────────────────────
// «Crea tu clave»: la ven las cuentas que aún no tienen clave de 4 números
// (las de antes, con contraseña, o las de Google creadas antes del cambio).
// No se puede seguir en la app sin crearla (ver la `fase` en App.tsx); solo
// cerrar la sesión. Al crearla, este teléfono queda de confianza y, si le
// falta el correo o el celular verificado, sigue «Completa tu cuenta».
// ─────────────────────────────────────────────────────────────

export default function CrearClaveScreen() {
  const { auth, actualizarUsuario, guardarDispositivo, pedirCompletar, salir } = useAuth();
  const e = useEstilosAcceso();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorClave, setErrorClave] = useState<string | null>(null);
  if (!auth) return null;
  const { token, user } = auth;
  const nombre = user.name.trim().split(/\s+/)[0];

  async function crear(pin: string) {
    setCargando(true);
    setError(null);
    setErrorClave(null);
    try {
      const r = await guardarClave(token, pin);
      if (r.dispositivo) guardarDispositivo(r.user.id, r.dispositivo);
      // Le falta el correo o el celular verificado: se le ofrece una vez (opcional).
      if (!r.user.email || !r.user.telefono_verificado) pedirCompletar(r.user.id);
      actualizarUsuario(r.user);
    } catch (err) {
      const campos = fieldErrorsFromError(err);
      if (campos.pin || campos.pin_confirmation) {
        setErrorClave(campos.pin ?? campos.pin_confirmation);
      } else {
        setError(messageFromError(err));
      }
      setCargando(false);
    }
  }

  return (
    <EscenaAcceso>
      <LogoAcceso />
      <Text style={e.titulo}>Crea tu clave</Text>
      <Text style={e.subtitulo}>
        {nombre ? `Hola, ${nombre}. ` : ''}
        {user.telefono_verificado
          ? 'Desde ahora entras con tu celular y una clave de 4 números.'
          : 'Desde ahora entras con una clave de 4 números.'}
      </Text>

      {error ? <Text style={e.error}>{error}</Text> : null}

      <CrearClaveVidrio textoBoton="Guardar mi clave" cargando={cargando} onCrear={crear} errorServidor={errorClave} />

      <TouchableOpacity style={e.pie} onPress={() => salir()} disabled={cargando}>
        <Text style={e.pieTexto}>
          ¿No es tu cuenta? <Text style={e.enlace}>Cerrar sesión</Text>
        </Text>
      </TouchableOpacity>
    </EscenaAcceso>
  );
}
