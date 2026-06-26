import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Usuario } from './api';

type Sesion = { token: string; user: Usuario } | null;

type AuthContextType = {
  auth: Sesion;
  cargando: boolean; // true mientras se lee la sesión guardada al iniciar
  entrar: (token: string, user: Usuario) => void;
  salir: () => void;
};

const CLAVE = 'sesion';

const AuthContext = createContext<AuthContextType>({
  auth: null,
  cargando: true,
  entrar: () => {},
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

  const entrar = (token: string, user: Usuario) => {
    const sesion = { token, user };
    setAuth(sesion);
    AsyncStorage.setItem(CLAVE, JSON.stringify(sesion));
  };

  const salir = () => {
    setAuth(null);
    AsyncStorage.removeItem(CLAVE);
  };

  return (
    <AuthContext.Provider value={{ auth, cargando, entrar, salir }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
