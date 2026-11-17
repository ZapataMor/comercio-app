/**
 * Sesión de la app, con varias cuentas a la vez como en Instagram: quien
 * maneja más de un perfil en el mismo teléfono (su cuenta personal y la de
 * su negocio, p. ej.) pasa de una a otra desde «Mi perfil» sin volver a
 * escribir la contraseña.
 *
 * En el teléfono se guardan:
 *   · `sesion`:  la cuenta activa (la app arranca en ella).
 *   · `cuentas`: todas las cuentas con la sesión abierta, la activa incluida,
 *                de la usada más recientemente a la más antigua.
 *
 * «Agregar cuenta» lleva al login sin cerrar ninguna sesión: ahí se puede
 * entrar con otra cuenta o volver a una de las guardadas con un toque.
 * «Cerrar sesión» cierra solo la cuenta activa y sigue con la más reciente
 * de las demás; «Cerrar todas las sesiones» deja el teléfono sin ninguna.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { alRechazarToken, Usuario } from './api';
import { eliminarPush, escucharRotacionToken, registrarPush } from './pushNotifications';
import { detenerRastreo } from './ubicacion';

/** Una sesión abierta en este teléfono. */
export type Cuenta = { token: string; user: Usuario };
type Sesion = Cuenta | null;

type AuthContextType = {
  auth: Sesion;
  cargando: boolean; // true mientras se lee la sesión guardada al iniciar
  /** Cuentas con la sesión abierta en este teléfono (la activa incluida), de la más reciente a la más antigua. */
  cuentas: Cuenta[];
  /** true mientras se agrega otra cuenta desde «Mi perfil»: el login puede volver a la anterior. */
  agregando: boolean;
  entrar: (token: string, user: Usuario) => void;
  /** Pasa a otra de las cuentas guardadas, sin contraseña. */
  cambiarCuenta: (userId: number) => void;
  /** Lleva al login para entrar con otra cuenta, sin cerrar las sesiones abiertas. */
  agregarCuenta: () => void;
  /** Refresca los datos del usuario en la sesión (p. ej. tras editar el perfil). */
  actualizarUsuario: (user: Usuario) => void;
  /**
   * Cierra la sesión de la cuenta activa. Si hay otras guardadas sigue con la
   * más reciente y la devuelve; si no, vuelve al login (devuelve null).
   */
  salir: () => Cuenta | null;
  /** Cierra la sesión de todas las cuentas guardadas en el teléfono. */
  salirDeTodas: () => void;
};

const CLAVE = 'sesion';
const CLAVE_CUENTAS = 'cuentas';

const AuthContext = createContext<AuthContextType>({
  auth: null,
  cargando: true,
  cuentas: [],
  agregando: false,
  entrar: () => {},
  cambiarCuenta: () => {},
  agregarCuenta: () => {},
  actualizarUsuario: () => {},
  salir: () => null,
  salirDeTodas: () => {},
});

function esCuenta(valor: unknown): valor is Cuenta {
  const c = valor as Cuenta | null;
  return !!c && typeof c.token === 'string' && !!c.user && typeof c.user.id === 'number';
}

function leer(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<Sesion>(null);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [agregando, setAgregando] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Copias al día para las funciones del contexto (que no cambian entre renders)
  // y para el aviso de token rechazado.
  const authRef = useRef<Sesion>(null);
  const cuentasRef = useRef<Cuenta[]>([]);
  // Token de la última cuenta activa. Sigue puesto mientras se agrega otra:
  // si se vuelve a la misma, lo que compartía (el GPS del domiciliario) sigue.
  const ultimoToken = useRef<string | null>(null);

  const fijarSesion = useCallback((sesion: Sesion) => {
    authRef.current = sesion;
    setAuth(sesion);
    if (sesion) {
      AsyncStorage.setItem(CLAVE, JSON.stringify(sesion)).catch(() => {});
    } else {
      AsyncStorage.removeItem(CLAVE).catch(() => {});
    }
  }, []);

  const fijarCuentas = useCallback((lista: Cuenta[]) => {
    cuentasRef.current = lista;
    setCuentas(lista);
    if (lista.length > 0) {
      AsyncStorage.setItem(CLAVE_CUENTAS, JSON.stringify(lista)).catch(() => {});
    } else {
      AsyncStorage.removeItem(CLAVE_CUENTAS).catch(() => {});
    }
  }, []);

  // Al arrancar, recupera la sesión activa y las demás cuentas guardadas.
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(CLAVE), AsyncStorage.getItem(CLAVE_CUENTAS)])
      .then(([rawSesion, rawCuentas]) => {
        const sesion = leer(rawSesion);
        const guardadas = leer(rawCuentas);
        let lista = Array.isArray(guardadas) ? guardadas.filter(esCuenta) : [];
        if (esCuenta(sesion)) {
          // La activa va de primera (las instalaciones de antes solo guardaban esa).
          lista = [sesion, ...lista.filter(c => c.user.id !== sesion.user.id)];
          authRef.current = sesion;
          ultimoToken.current = sesion.token;
          setAuth(sesion);
        }
        cuentasRef.current = lista;
        setCuentas(lista);
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  // Si el backend rechaza un token (401), esa sesión se quita de las guardadas.
  // Si era la activa, la app vuelve al login (con las demás cuentas a un toque).
  // No se llama a eliminarPush: con un token inválido el backend también lo rechazaría.
  useEffect(() => {
    alRechazarToken(token => {
      if (cuentasRef.current.some(c => c.token === token)) {
        fijarCuentas(cuentasRef.current.filter(c => c.token !== token));
      }
      if (token !== authRef.current?.token) {
        return;
      }
      // El GPS del domiciliario sigue aunque se cierre la app: con la sesión rechazada se apaga.
      detenerRastreo();
      ultimoToken.current = null;
      setAgregando(false);
      fijarSesion(null);
    });
    return () => alRechazarToken(null);
  }, [fijarCuentas, fijarSesion]);

  useEffect(() => {
    if (!auth?.token) {
      return;
    }

    // El token del teléfono se reasigna a la cuenta que lo registra: al
    // cambiar de cuenta, los avisos pasan a la nueva.
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

  const entrar = useCallback(
    (token: string, user: Usuario) => {
      // Otra cuenta: lo que compartía la anterior se apaga.
      if (ultimoToken.current && ultimoToken.current !== token) detenerRastreo();
      ultimoToken.current = token;
      const sesion = { token, user };
      setAgregando(false);
      fijarSesion(sesion);
      fijarCuentas([sesion, ...cuentasRef.current.filter(c => c.user.id !== user.id)]);
    },
    [fijarCuentas, fijarSesion],
  );

  const cambiarCuenta = useCallback(
    (userId: number) => {
      const cuenta = cuentasRef.current.find(c => c.user.id === userId);
      if (cuenta) entrar(cuenta.token, cuenta.user);
    },
    [entrar],
  );

  const agregarCuenta = useCallback(() => {
    // Ninguna sesión se cierra y la activa sigue guardada: si se cierra la app
    // a medio agregar, al abrirla vuelve a esa cuenta.
    authRef.current = null;
    setAuth(null);
    setAgregando(true);
  }, []);

  const actualizarUsuario = useCallback(
    (user: Usuario) => {
      const actual = authRef.current;
      if (actual && actual.user.id === user.id) {
        const sesion = { ...actual, user };
        fijarSesion(sesion);
        fijarCuentas(cuentasRef.current.map(c => (c.user.id === user.id ? sesion : c)));
      } else if (cuentasRef.current.some(c => c.user.id === user.id)) {
        // Respuesta que llegó después de cambiar de cuenta: se guarda en la
        // cuenta que corresponde, sin tocar la activa.
        fijarCuentas(cuentasRef.current.map(c => (c.user.id === user.id ? { ...c, user } : c)));
      }
    },
    [fijarCuentas, fijarSesion],
  );

  const salir = useCallback((): Cuenta | null => {
    const actual = authRef.current;
    if (!actual) {
      return null;
    }
    // Cerrar sesión SÍ deja de compartir la ubicación (cerrar la app no).
    detenerRastreo();
    eliminarPush(actual.token);
    const resto = cuentasRef.current.filter(c => c.user.id !== actual.user.id);
    const siguiente = resto[0] ?? null;
    ultimoToken.current = siguiente?.token ?? null;
    setAgregando(false);
    fijarCuentas(resto);
    fijarSesion(siguiente);
    return siguiente;
  }, [fijarCuentas, fijarSesion]);

  const salirDeTodas = useCallback(() => {
    detenerRastreo();
    if (authRef.current) {
      eliminarPush(authRef.current.token);
    }
    ultimoToken.current = null;
    setAgregando(false);
    fijarCuentas([]);
    fijarSesion(null);
  }, [fijarCuentas, fijarSesion]);

  const valor = useMemo(
    () => ({
      auth,
      cargando,
      cuentas,
      agregando,
      entrar,
      cambiarCuenta,
      agregarCuenta,
      actualizarUsuario,
      salir,
      salirDeTodas,
    }),
    [auth, cargando, cuentas, agregando, entrar, cambiarCuenta, agregarCuenta, actualizarUsuario, salir, salirDeTodas],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
