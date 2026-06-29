/**
 * Estado compartido del negocio del comerciante.
 *
 * Centraliza "mi negocio" para que lo usen a la vez:
 *  - el switch Abierto/Cerrado de la topbar (Inicio),
 *  - la tarjeta "Mi negocio" del Inicio,
 *  - la pantalla "Mi Tienda" (ver/crear/editar).
 *
 * Así no hay tres copias distintas que se desincronicen.
 */
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
  getNegocio,
  Negocio,
  NegocioInput,
} from './api';
import { useAuth } from './AuthContext';

type NegocioContextType = {
  negocio: Negocio | null;
  cargando: boolean;
  recargar: () => Promise<void>;
  /** Crea (si no existe) o actualiza el negocio. `imagenUri` sube/reemplaza la foto. */
  guardar: (input: NegocioInput, imagenUri?: string) => Promise<Negocio>;
  /** Abrir/cerrar rápido (optimista). */
  setAbierto: (abierto: boolean) => Promise<void>;
};

const NegocioContext = createContext<NegocioContextType>({
  negocio: null,
  cargando: false,
  recargar: async () => {},
  guardar: async () => {
    throw new Error('NegocioProvider no montado');
  },
  setAbierto: async () => {},
});

export function NegocioProvider({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const token = auth?.token ?? null;
  const esComerciante = auth?.user.roles.includes('comerciante') ?? false;

  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [cargando, setCargando] = useState(false);

  const recargar = useCallback(async () => {
    if (!token || !esComerciante) {
      setNegocio(null);
      return;
    }
    setCargando(true);
    try {
      setNegocio(await getNegocio(token));
    } catch {
      // Silencioso: si falla, el negocio queda como estaba.
    } finally {
      setCargando(false);
    }
  }, [token, esComerciante]);

  // Carga inicial (y al cambiar de sesión).
  useEffect(() => {
    recargar();
  }, [recargar]);

  const guardar = useCallback(
    async (input: NegocioInput, imagenUri?: string) => {
      if (!token) {
        throw new Error('Sesión no válida.');
      }
      const guardado = negocio
        ? await actualizarNegocio(token, input, imagenUri)
        : await crearNegocio(token, input, imagenUri);
      setNegocio(guardado);
      return guardado;
    },
    [negocio, token],
  );

  const setAbierto = useCallback(
    async (abierto: boolean) => {
      if (!token || !negocio) {
        return;
      }
      const previo = negocio.activo;
      // Optimista: refleja el cambio al instante en la UI.
      setNegocio({ ...negocio, activo: abierto });
      try {
        const actualizado = await cambiarEstadoNegocio(token, abierto);
        setNegocio(actualizado);
      } catch (e) {
        // Revierte si el servidor falla.
        setNegocio(n => (n ? { ...n, activo: previo } : n));
        throw e;
      }
    },
    [negocio, token],
  );

  const valor = useMemo(
    () => ({ negocio, cargando, recargar, guardar, setAbierto }),
    [negocio, cargando, recargar, guardar, setAbierto],
  );

  return <NegocioContext.Provider value={valor}>{children}</NegocioContext.Provider>;
}

export const useNegocio = () => useContext(NegocioContext);
