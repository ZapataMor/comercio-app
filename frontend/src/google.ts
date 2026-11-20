/**
 * Entrar con Google. En Android abre la hoja de cuentas de Google del teléfono
 * (Credential Manager, ver android/.../GoogleAccesoPackage.kt) y devuelve el
 * «ID token» de la cuenta elegida; el backend lo verifica (POST /api/google).
 *
 * El botón solo aparece si `googleDisponible()`: Android con el módulo nativo
 * y GOOGLE_WEB_CLIENT_ID puesto en src/config.ts. En iOS aún no está.
 */
import { NativeModules, Platform } from 'react-native';
import { GOOGLE_WEB_CLIENT_ID } from './config';

type ModuloGoogle = { elegirCuenta: (webClientId: string) => Promise<string> };

function modulo(): ModuloGoogle | undefined {
  return NativeModules.GoogleAcceso as ModuloGoogle | undefined;
}

export function googleDisponible(): boolean {
  return Platform.OS === 'android' && !!modulo() && GOOGLE_WEB_CLIENT_ID.trim() !== '';
}

/**
 * Pide elegir una cuenta de Google. Devuelve su ID token, o null si la persona
 * cerró la ventana. Lanza un Error con un mensaje para mostrar si algo falla.
 */
export async function elegirCuentaGoogle(): Promise<string | null> {
  const nativo = modulo();
  if (!nativo || !googleDisponible()) {
    throw new Error('Entrar con Google no está disponible en este teléfono.');
  }
  try {
    return await nativo.elegirCuenta(GOOGLE_WEB_CLIENT_ID.trim());
  } catch (e: any) {
    if (e?.code === 'cancelado') return null;
    if (e?.code === 'sin_cuentas') {
      throw new Error('No encontramos cuentas de Google en este teléfono. Agrega una en Ajustes y vuelve a intentarlo.');
    }
    // Configuración de Google Cloud incompleta (huella SHA-1, ID de cliente…),
    // sin Google Play Services, etc. El detalle queda en la consola.
    console.warn('[google] no se pudo elegir la cuenta:', e?.message ?? e);
    throw new Error('No fue posible entrar con Google. Inténtalo de nuevo o entra con tu celular.');
  }
}
