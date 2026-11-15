/**
 * Fotos que se suben desde el celular: antes de enviarlas se achican en el
 * teléfono (lado mayor de 1600 px, JPEG al 80 %). Una foto de cámara pesa
 * 4-8 MB; así queda en unos 200-400 KB y sube en segundos aun con datos
 * móviles. La librería endereza la foto según su orientación EXIF.
 *
 * Si algo falla (formato raro, archivo ilegible), se sube la original: el
 * servidor igual la acepta y la achica de su lado.
 */
import ImageResizer from '@bam.tech/react-native-image-resizer';

export const LADO_MAXIMO_FOTO = 1600;
const CALIDAD = 80;

export async function comprimirFoto(uri: string): Promise<string> {
  try {
    const r = await ImageResizer.createResizedImage(uri, LADO_MAXIMO_FOTO, LADO_MAXIMO_FOTO, 'JPEG', CALIDAD, 0, null, false, {
      mode: 'contain',
      onlyScaleDown: true,
    });
    return r.uri || uri;
  } catch {
    return uri;
  }
}
