import type { ModoRuta } from './api';
import { abrirEnGoogleMaps } from './components/Mapa';
import type { DestinoRuta } from './navTypes';
import { navigationRef } from './RootNavigation';

/**
 * «Cómo llegar»: abre la ruta dentro de la app (pantalla Ruta). Sin
 * coordenadas, solo con la dirección en texto, no hay cómo trazarla: se abre
 * Google Maps, que la busca por su cuenta.
 *
 * Va aparte de Mapa.tsx para que las piezas del mapa no dependan de la
 * navegación.
 */
export function comoLlegar(destino: DestinoRuta | string, opciones?: { modo?: ModoRuta; elegirModo?: boolean }) {
  if (typeof destino === 'string') {
    abrirEnGoogleMaps(destino, opciones?.modo);
    return;
  }
  if (navigationRef.isReady()) navigationRef.navigate('Ruta', { destino, ...opciones });
}
