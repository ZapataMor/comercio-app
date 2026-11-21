/**
 * Clave de 4 números (como Nequi). Las mismas reglas que el backend
 * (App\Rules\ClaveCuatro), para avisar antes de enviar: ni repetida (0000),
 * ni seguida (1234, 9876), ni dos pares iguales (1212), ni de las más usadas.
 */

const COMUNES = ['1004', '2000', '1122', '1010', '2001', '1001', '2580', '0852'];

export const LARGO_CLAVE = 4;

/** Por qué la clave no sirve, o null si sirve. */
export function problemaClave(clave: string): string | null {
  if (!/^\d{4}$/.test(clave)) return 'La clave debe tener exactamente 4 números.';
  const d = clave.split('').map(Number);
  if (new Set(d).size === 1) return 'No uses el mismo número cuatro veces.';
  let sube = true;
  let baja = true;
  for (let i = 1; i < 4; i++) {
    sube = sube && d[i] === d[i - 1] + 1;
    baja = baja && d[i] === d[i - 1] - 1;
  }
  if (sube || baja) return 'No uses números seguidos como 1234 o 4321.';
  if (d[0] === d[2] && d[1] === d[3]) return 'No repitas el mismo par, como 1212.';
  if (COMUNES.includes(clave)) return 'Esa clave es de las más usadas. Elige otra.';
  return null;
}

/** Revisa la clave nueva y su confirmación. Devuelve los errores por campo. */
export function erroresClaveNueva(clave: string, confirmar: string): { pin?: string; confirmar?: string } {
  const problema = problemaClave(clave);
  if (problema) return { pin: problema };
  if (confirmar !== clave) return { confirmar: 'Las dos claves no coinciden.' };
  return {};
}
