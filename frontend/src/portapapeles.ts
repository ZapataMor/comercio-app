/**
 * Copiar texto al portapapeles con el módulo nativo propio
 * (android/.../PortapapelesPackage.kt). Si no está (iOS aún sin compilar,
 * Jest), abre la hoja de compartir, que también deja copiarlo.
 */
import { NativeModules, Share } from 'react-native';

type ModuloPortapapeles = { copiar(texto: string): Promise<void> };

const modulo: ModuloPortapapeles | undefined = NativeModules.Portapapeles;

/** Devuelve true si quedó copiado; false si se abrió la hoja de compartir. */
export async function copiarTexto(texto: string): Promise<boolean> {
  if (modulo) {
    try {
      await modulo.copiar(texto);
      return true;
    } catch {
      // Cae a compartir.
    }
  }
  await Share.share({ message: texto });
  return false;
}
