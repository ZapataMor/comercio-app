import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { alRechazarToken, Usuario } from './api';
import { eliminarPush, escucharRotacionToken, registrarPush } from './pushNotifications';

type Sesion = { token: string; user: Usuario } | null;

type AuthContextType = {
  auth: Sesion;
  cargando: boolean; // true mientras se lee la sesión guardada al iniciar
  entrar: (token: string, user: Usuario) => void;
  /** Refresca los datos del usuario en la sesión (p. ej. tras editar el perfil). */
  actualizarUsuario: (user: Usuario) => void;
  salir: () => void;
};

const CLAVE = 'sesion';

const AuthContext = createContext<AuthContextType>({
  auth: null,
  cargando: true,
  entrar: () => {},
  actualizarUsuario: () => {},
  salir: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<Sesion>(null);
  const [cargando, setCargando] = useState(true);

  // Al arrancar, recupera la sesión guardada (si la hay).
  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then(raw => {
        if (raw) {
          try {
            setAuth(JSON.parse(raw));
          } catch {}
        }
      })
      .finally(() => setCargando(false));
  }, []);

  // Si el backend rechaza el token de la sesión actual (401), se descarta la
  // sesión y la app vuelve al login. No se llama a eliminarPush: con un token
  // inválido el backend también lo rechazaría.
  const tokenActual = useRef<string | null>(null);
  tokenActual.current = auth?.token ?? null;

  useEffect(() => {
    alRechazarToken(token => {
      if (token !== tokenActual.current) {
        return;
      }
      tokenActual.current = null;
      setAuth(null);
      AsyncStorage.removeItem(CLAVE);
    });
    return () => alRechazarToken(null);
  }, []);

  useEffect(() => {
    if (!auth?.token) {
      return;
    }

    registrarPush(auth.token);

    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        registrarPush(auth.token);
      }
    });

    const unsubscribeTokenRefresh = escucharRotacionToken(auth.token);

    return () => {
      appStateSubscription.remove();
      unsubscribeTokenRefresh();
    };
  }, [auth?.token, auth?.user.id]);

  const entrar = (token: string, user: Usuario) => {
    const sesion = { token, user };
    setAuth(sesion);
    AsyncStorage.setItem(CLAVE, JSON.stringify(sesion));
  };

  const actualizarUsuario = (user: Usuario) => {
    setAuth(prev => {
      if (!prev) {
        return prev;
      }
      const sesion = { ...prev, user };
      AsyncStorage.setItem(CLAVE, JSON.stringify(sesion));
      return sesion;
    });
  };

  const salir = () => {
    if (auth?.token) {
      eliminarPush(auth.token);
    }
    setAuth(null);
    AsyncStorage.removeItem(CLAVE);
  };

  return (
    <AuthContext.Provider value={{ auth, cargando, entrar, actualizarUsuario, salir }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
