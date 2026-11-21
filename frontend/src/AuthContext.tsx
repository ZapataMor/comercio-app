/**
 * Sesión de la app, con varias cuentas a la vez como en Instagram: quien
 * maneja más de un perfil en el mismo teléfono (su cuenta personal y la de
 * su negocio, p. ej.) pasa de una a otra desde «Mi perfil» sin volver a
 * escribir la clave.
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
 *
 * Teléfono de confianza: al entrar, el backend entrega un token por cuenta
 * (`dispositivos`, en `dispositivos`) que dice que en este teléfono la
 * persona ya demostró quién es (código de WhatsApp o Google). Con él entra
 * solo con su clave de 4 números.
 *
 * Las cuentas con la sesión cerrada se recuerdan si tienen ese token o
 * entran con Google (`recordadas`, guardadas en `cuentasGoogle`):
 * siguen en «Continuar como» y vuelven a entrar con la clave (o eligiendo la
 * cuenta de Google). De esas no se guarda el token de sesión, solo los datos
 * para mostrarlas. «Cerrar todas las sesiones» y «Quitar de este teléfono»
 * las olvidan, junto con su token de confianza.
 *
 * `porCompletar`: la cuenta que acaba de registrarse ve una vez «Completa tu
 * cuenta» (correo o celular, opcionales).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { alRechazarToken, Usuario } from './api';
import { eliminarPush, escucharRotacionToken, registrarPush } from './pushNotifications';
import { detenerRastreo } from './ubicacion';

/** Una sesión abierta en este teléfono. */
export type Cuenta = { token: string; user: Usuario };
/** Cuenta con la sesión cerrada que el teléfono recuerda (sin token de sesión). */
export type CuentaRecordada = { user: Usuario };
/** Cómo se entró: el token del teléfono de confianza y si la cuenta es nueva. */
export type OpcionesEntrar = { dispositivo?: string | null; nueva?: boolean };
type Sesion = Cuenta | null;

type AuthContextType = {
  auth: Sesion;
  cargando: boolean; // true mientras se lee la sesión guardada al iniciar
  /** Cuentas con la sesión abierta en este teléfono (la activa incluida), de la más reciente a la más antigua. */
  cuentas: Cuenta[];
  /** true mientras se agrega otra cuenta desde «Mi perfil»: el login puede volver a la anterior. */
  agregando: boolean;
  /** Cuentas con la sesión cerrada: en el login vuelven a entrar con la clave (o con Google). */
  recordadas: CuentaRecordada[];
  /** Deja de recordar una cuenta en este teléfono (y deja de ser de confianza para ella). */
  olvidarRecordada: (userId: number) => void;
  /** Token del teléfono de confianza de cada cuenta (por id). */
  dispositivos: Record<number, string>;
  /** Guarda el token de confianza de una cuenta. */
  guardarDispositivo: (userId: number, token: string) => void;
  /** El backend dijo que este teléfono ya no es de confianza para la cuenta. */
  olvidarDispositivo: (userId: number) => void;
  /** Cuenta que debe ver «Completa tu cuenta» (una vez). */
  porCompletar: number | null;
  /** Termina (o salta) «Completa tu cuenta». */
  terminarCompletar: () => void;
  entrar: (token: string, user: Usuario, opciones?: OpcionesEntrar) => void;
  /** Pasa a otra de las cuentas guardadas, sin escribir la clave. */
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
const CLAVE_RECORDADAS = 'cuentasGoogle';
const CLAVE_DISPOSITIVOS = 'dispositivos';

const AuthContext = createContext<AuthContextType>({
  auth: null,
  cargando: true,
  cuentas: [],
  agregando: false,
  recordadas: [],
  olvidarRecordada: () => {},
  dispositivos: {},
  guardarDispositivo: () => {},
  olvidarDispositivo: () => {},
  porCompletar: null,
  terminarCompletar: () => {},
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

function esRecordada(valor: unknown): valor is CuentaRecordada {
  const c = valor as CuentaRecordada | null;
  return !!c && !!c.user && typeof c.user.id === 'number' && typeof c.user.name === 'string';
}

function esMapaDispositivos(valor: unknown): valor is Record<string, string> {
  return !!valor && typeof valor === 'object' && !Array.isArray(valor) && Object.values(valor).every(v => typeof v === 'string');
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
  const [recordadas, setRecordadas] = useState<CuentaRecordada[]>([]);
  const [dispositivos, setDispositivos] = useState<Record<number, string>>({});
  const [porCompletar, setPorCompletar] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  // Copias al día para las funciones del contexto (que no cambian entre renders)
  // y para el aviso de token rechazado.
  const authRef = useRef<Sesion>(null);
  const cuentasRef = useRef<Cuenta[]>([]);
  const recordadasRef = useRef<CuentaRecordada[]>([]);
  const dispositivosRef = useRef<Record<number, string>>({});
  const porCompletarRef = useRef<number | null>(null);
  porCompletarRef.current = porCompletar;
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

  const fijarRecordadas = useCallback((lista: CuentaRecordada[]) => {
    recordadasRef.current = lista;
    setRecordadas(lista);
    if (lista.length > 0) {
      AsyncStorage.setItem(CLAVE_RECORDADAS, JSON.stringify(lista)).catch(() => {});
    } else {
      AsyncStorage.removeItem(CLAVE_RECORDADAS).catch(() => {});
    }
  }, []);

  const fijarDispositivos = useCallback((mapa: Record<number, string>) => {
    dispositivosRef.current = mapa;
    setDispositivos(mapa);
    if (Object.keys(mapa).length > 0) {
      AsyncStorage.setItem(CLAVE_DISPOSITIVOS, JSON.stringify(mapa)).catch(() => {});
    } else {
      AsyncStorage.removeItem(CLAVE_DISPOSITIVOS).catch(() => {});
    }
  }, []);

  const guardarDispositivo = useCallback(
    (userId: number, token: string) => {
      if (dispositivosRef.current[userId] === token) return;
      fijarDispositivos({ ...dispositivosRef.current, [userId]: token });
    },
    [fijarDispositivos],
  );

  const olvidarDispositivo = useCallback(
    (userId: number) => {
      if (!(userId in dispositivosRef.current)) return;
      const resto = { ...dispositivosRef.current };
      delete resto[userId];
      fijarDispositivos(resto);
    },
    [fijarDispositivos],
  );

  /**
   * Recuerda la cuenta (sin token de sesión) para volver desde «Continuar
   * como»: con la clave si este teléfono es de confianza, o con Google.
   */
  const recordar = useCallback(
    (user: Usuario) => {
      if (!user.google && !dispositivosRef.current[user.id]) return;
      fijarRecordadas([{ user }, ...recordadasRef.current.filter(r => r.user.id !== user.id)]);
    },
    [fijarRecordadas],
  );

  // Al arrancar, recupera la sesión activa y las demás cuentas guardadas.
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CLAVE),
      AsyncStorage.getItem(CLAVE_CUENTAS),
      AsyncStorage.getItem(CLAVE_RECORDADAS),
      AsyncStorage.getItem(CLAVE_DISPOSITIVOS),
    ])
      .then(([rawSesion, rawCuentas, rawRecordadas, rawDispositivos]) => {
        const mapa = leer(rawDispositivos);
        if (esMapaDispositivos(mapa)) {
          const porId: Record<number, string> = {};
          Object.entries(mapa).forEach(([id, token]) => {
            if (Number(id) > 0) porId[Number(id)] = token;
          });
          dispositivosRef.current = porId;
          setDispositivos(porId);
        }
        const recordadasGuardadas = leer(rawRecordadas);
        const listaRecordadas = Array.isArray(recordadasGuardadas) ? recordadasGuardadas.filter(esRecordada) : [];
        recordadasRef.current = listaRecordadas;
        setRecordadas(listaRecordadas);
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
      const rechazada = cuentasRef.current.find(c => c.token === token);
      if (rechazada) {
        fijarCuentas(cuentasRef.current.filter(c => c.token !== token));
        recordar(rechazada.user);
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
  }, [fijarCuentas, fijarSesion, recordar]);

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
    (token: string, user: Usuario, opciones?: OpcionesEntrar) => {
      if (opciones?.dispositivo) guardarDispositivo(user.id, opciones.dispositivo);
      if (opciones?.nueva) setPorCompletar(user.id);
      // Otra cuenta: lo que compartía la anterior se apaga.
      if (ultimoToken.current && ultimoToken.current !== token) detenerRastreo();
      ultimoToken.current = token;
      const sesion = { token, user };
      setAgregando(false);
      fijarSesion(sesion);
      fijarCuentas([sesion, ...cuentasRef.current.filter(c => c.user.id !== user.id)]);
      // Con la sesión abierta ya sale entre las cuentas guardadas.
      if (recordadasRef.current.some(r => r.user.id === user.id)) {
        fijarRecordadas(recordadasRef.current.filter(r => r.user.id !== user.id));
      }
    },
    [fijarCuentas, fijarSesion, fijarRecordadas, guardarDispositivo],
  );

  const olvidarRecordada = useCallback(
    (userId: number) => {
      fijarRecordadas(recordadasRef.current.filter(r => r.user.id !== userId));
      olvidarDispositivo(userId);
    },
    [fijarRecordadas, olvidarDispositivo],
  );

  const terminarCompletar = useCallback(() => setPorCompletar(null), []);

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
    recordar(actual.user);
    if (porCompletarRef.current === actual.user.id) setPorCompletar(null);
    return siguiente;
  }, [fijarCuentas, fijarSesion, recordar]);

  const salirDeTodas = useCallback(() => {
    detenerRastreo();
    if (authRef.current) {
      eliminarPush(authRef.current.token);
    }
    ultimoToken.current = null;
    setAgregando(false);
    setPorCompletar(null);
    fijarCuentas([]);
    fijarRecordadas([]);
    // El teléfono queda sin ninguna cuenta: tampoco es de confianza para ninguna.
    fijarDispositivos({});
    fijarSesion(null);
  }, [fijarCuentas, fijarSesion, fijarRecordadas, fijarDispositivos]);

  const valor = useMemo(
    () => ({
      auth,
      cargando,
      cuentas,
      agregando,
      recordadas,
      olvidarRecordada,
      dispositivos,
      guardarDispositivo,
      olvidarDispositivo,
      porCompletar,
      terminarCompletar,
      entrar,
      cambiarCuenta,
      agregarCuenta,
      actualizarUsuario,
      salir,
      salirDeTodas,
    }),
    [
      auth, cargando, cuentas, agregando, recordadas, olvidarRecordada, dispositivos, guardarDispositivo, olvidarDispositivo,
      porCompletar, terminarCompletar, entrar, cambiarCuenta, agregarCuenta, actualizarUsuario, salir, salirDeTodas,
    ],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
