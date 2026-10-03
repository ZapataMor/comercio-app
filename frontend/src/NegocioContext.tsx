/**
 * Mis negocios y el NEGOCIO ACTIVO.
 *
 * Modelo unificado: una persona puede ser propietaria de varios negocios y
 * trabajadora de otros. La app gestiona uno a la vez (el "activo"), que se
 * recuerda entre sesiones. Lo usan a la vez:
 *  - el switch Abierto/Cerrado de la topbar (Inicio),
 *  - el panel del negocio en el Inicio (productos, pedidos, equipo),
 *  - "Mi Tienda" (ver/crear/editar) y "Mis negocios" (cambiar de negocio).
 *
 * Así no hay copias distintas que se desincronicen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  actualizarNegocio,
  cambiarEstadoNegocio,
  crearNegocio,
  getMisNegocios,
  Negocio,
  NegocioInput,
} from './api';
import { useAuth } from './AuthContext';

const CLAVE_ACTIVO = 'negocio_activo';

type NegocioContextType = {
  /** Todos los negocios donde soy miembro activo (con mi rol). */
  negocios: Negocio[];
  /** El negocio que se está gestionando ahora (null si no tengo ninguno). */
  negocio: Negocio | null;
  /** ¿Soy propietario del negocio activo? (solo él edita datos e invita). */
  esPropietario: boolean;
  /** Mi código público, para que otros negocios me inviten. */
  codigoPublico: string | null;
  cargando: boolean;
  recargar: () => Promise<void>;
  /** Cambia el negocio activo. */
  seleccionar: (id: number) => void;
  /** Crea un negocio nuevo y lo deja como activo. */
  crear: (input: NegocioInput, imagenUri?: string) => Promise<Negocio>;
  /** Actualiza el negocio activo. `imagenUri` sube/reemplaza la foto. */
  guardar: (input: NegocioInput, imagenUri?: string) => Promise<Negocio>;
  /** Abrir/cerrar rápido (optimista). */
  setAbierto: (abierto: boolean) => Promise<void>;
};

const NegocioContext = createContext<NegocioContextType>({
  negocios: [],
  negocio: null,
  esPropietario: false,
  codigoPublico: null,
  cargando: false,
  recargar: async () => {},
  seleccionar: () => {},
  crear: async () => {
    throw new Error('NegocioProvider no montado');
  },
  guardar: async () => {
    throw new Error('NegocioProvider no montado');
  },
  setAbierto: async () => {},
});

export function NegocioProvider({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const token = auth?.token ?? null;

  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [activoId, setActivoId] = useState<number | null>(null);
  const [codigoPublico, setCodigoPublico] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const seleccionar = useCallback((id: number) => {
    setActivoId(id);
    AsyncStorage.setItem(CLAVE_ACTIVO, String(id)).catch(() => {});
  }, []);

  const recargar = useCallback(async () => {
    if (!token) {
      setNegocios([]);
      setActivoId(null);
      setCodigoPublico(null);
      return;
    }
    setCargando(true);
    try {
      const [{ negocios: lista, codigoPublico: codigo }, guardado] = await Promise.all([
        getMisNegocios(token),
        AsyncStorage.getItem(CLAVE_ACTIVO).catch(() => null),
      ]);
      setNegocios(lista);
      setCodigoPublico(codigo);
      // Conserva el activo si sigue siendo mío; si no (me quitaron, o es la
      // primera vez), toma el primero de la lista.
      setActivoId(prev => {
        const preferido = prev ?? (guardado ? Number(guardado) : null);
        return lista.some(n => n.id === preferido) ? preferido : lista[0]?.id ?? null;
      });
    } catch {
      // Silencioso: si falla, los negocios quedan como estaban.
    } finally {
      setCargando(false);
    }
  }, [token]);

  // Carga inicial (y al cambiar de sesión).
  useEffect(() => {
    setActivoId(null);
    recargar();
  }, [recargar]);

  const negocio = useMemo(
    () => negocios.find(n => n.id === activoId) ?? null,
    [negocios, activoId],
  );

  /** Reemplaza un negocio de la lista conservando mi rol en él. */
  const reemplazar = useCallback((actualizado: Negocio) => {
    setNegocios(lista =>
      lista.map(n => (n.id === actualizado.id ? { ...n, ...actualizado, rol: actualizado.rol ?? n.rol } : n)),
    );
  }, []);

  const crear = useCallback(
    async (input: NegocioInput, imagenUri?: string) => {
      if (!token) {
        throw new Error('Sesión no válida.');
      }
      const nuevo = await crearNegocio(token, input, imagenUri);
      setNegocios(lista => [...lista, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      seleccionar(nuevo.id);
      return nuevo;
    },
    [token, seleccionar],
  );

  const guardar = useCallback(
    async (input: NegocioInput, imagenUri?: string) => {
      if (!token || !negocio) {
        throw new Error('No hay un negocio seleccionado.');
      }
      const guardado = await actualizarNegocio(token, negocio.id, input, imagenUri);
      reemplazar(guardado);
      return guardado;
    },
    [negocio, token, reemplazar],
  );

  const setAbierto = useCallback(
    async (abierto: boolean) => {
      if (!token || !negocio) {
        return;
      }
      const previo = negocio;
      // Optimista: refleja el cambio al instante en la UI.
      reemplazar({ ...negocio, activo: abierto });
      try {
        reemplazar(await cambiarEstadoNegocio(token, negocio.id, abierto));
      } catch (e) {
        // Revierte si el servidor falla.
        reemplazar(previo);
        throw e;
      }
    },
    [negocio, token, reemplazar],
  );

  const valor = useMemo(
    () => ({
      negocios,
      negocio,
      esPropietario: negocio?.rol === 'propietario',
      codigoPublico,
      cargando,
      recargar,
      seleccionar,
      crear,
      guardar,
      setAbierto,
    }),
    [negocios, negocio, codigoPublico, cargando, recargar, seleccionar, crear, guardar, setAbierto],
  );

  return <NegocioContext.Provider value={valor}>{children}</NegocioContext.Provider>;
}

export const useNegocio = () => useContext(NegocioContext);
