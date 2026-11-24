import { useCallback, useState } from 'react';
import { getTarifaDomicilio } from './api';
import { useAuth } from './AuthContext';
import { useLectura } from './useLectura';
import { useEnVivo } from './usePolling';

/**
 * Lo que cuesta el domicilio hoy (es uno solo para toda la ciudad), para
 * mostrarlo desde la tienda y el carrito y no solo al confirmar. null mientras
 * carga o si no se pudo consultar: entonces no se muestra nada (nunca $0).
 */
export function useTarifaDomicilio(): number | null {
  const { auth } = useAuth();
  const token = auth?.token;
  const [tarifa, setTarifa] = useState<number | null>(null);
  const cargar = useCallback(() => {
    if (!token) return;
    getTarifaDomicilio(token)
      .then(setTarifa)
      .catch(() => setTarifa(null));
  }, [token]);
  useLectura(cargar, [cargar]);
  // El administrador la cambia: se ve al instante.
  useEnVivo(['ajustes'], cargar);
  return tarifa;
}
