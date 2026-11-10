import NetInfo from '@react-native-community/netinfo';

export const TIEMPO_PETICION_MS = 20000;
type EstadoRed = { sinInternet: boolean; aviso: string };
let estado: EstadoRed = { sinInternet: false, aviso: '' };
const listeners = new Set<(value: EstadoRed) => void>();
function publicar(value: EstadoRed) {
  estado = value;
  listeners.forEach(listener => listener(value));
}
export function observarRed(listener: (value: EstadoRed) => void) {
  listeners.add(listener);
  listener(estado);
  return () => { listeners.delete(listener); };
}
export function iniciarMonitorRed() {
  return NetInfo.addEventListener(info => {
    const sinInternet = info.isConnected === false || info.isInternetReachable === false;
    publicar({ sinInternet, aviso: sinInternet ? 'Sin internet. Revisa tus datos móviles o el Wi-Fi.' : '' });
  });
}
export class ErrorRed extends Error {}

// El plazo cubre también la descarga del cuerpo. La carrera garantiza el fin
// incluso si una implementación nativa no respeta AbortController.
export async function solicitar(url: string, options: RequestInit = {}): Promise<Response> {
  if (estado.sinInternet) {
    throw new ErrorRed('Sin internet. Revisa tu conexión antes de intentarlo de nuevo.');
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dejarDeObservar: (() => void) | undefined;
  const fallo = (mensaje: string) => {
    publicar({ ...estado, aviso: mensaje });
    return new ErrorRed(mensaje);
  };
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...options, signal: controller.signal });
        const cuerpo = await response.json().catch(error => {
          if (error instanceof SyntaxError && !response.ok) return {};
          throw error;
        });
        const data = cuerpo && typeof cuerpo === 'object' ? cuerpo : {};
        if (response.status === 429 && !data?.message) {
          data.message = 'Has realizado demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.';
        }
        if ([502, 503, 504].includes(response.status)) {
          data.message = 'El servidor no pudo completar la solicitud. Revisa si la operación se realizó antes de intentarlo de nuevo.';
          publicar({ ...estado, aviso: data.message });
        }
        // Mantiene la interfaz usada por los consumidores sin volver a leer el cuerpo.
        return { ok: response.ok, status: response.status, headers: response.headers,
          json: async () => data } as Response;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(fallo('La solicitud tardó demasiado. No pudimos confirmar el resultado. Revisa si el cambio se realizó antes de intentarlo de nuevo.'));
          controller.abort();
        }, TIEMPO_PETICION_MS);
        dejarDeObservar = observarRed(value => {
          if (value.sinInternet) {
            reject(new ErrorRed('Te quedaste sin internet. No pudimos confirmar la solicitud. Revisa tu conexión y el estado de la operación.'));
            controller.abort();
          }
        });
      }),
    ]);
  } catch (error) {
    if (error instanceof ErrorRed) throw error;
    throw fallo('No fue posible conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.');
  } finally {
    if (timer) clearTimeout(timer);
    dejarDeObservar?.();
  }
}
