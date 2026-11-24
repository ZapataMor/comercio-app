export type PartesDireccion = { calle: string; carrera: string; casa: string };
export function separarDireccion(value: string): PartesDireccion {
  const match = /^(?:Calle (.*?))?(?: ?Carrera (.*?))? #\s*([^#]*)$/.exec(value);
  return match ? { calle: match[1] ?? '', carrera: match[2] ?? '', casa: match[3] ?? '' }
    : { calle: '', carrera: '', casa: '' };
}
export function unirDireccion({ calle, carrera, casa }: PartesDireccion): string {
  return `${[calle ? `Calle ${calle}` : '', carrera ? `Carrera ${carrera}` : ''].filter(Boolean).join(' ')} #${casa}`;
}
export function direccionValida(value: string): boolean {
  const p = separarDireccion(value);
  return !!((p.calle.trim() || p.carrera.trim()) && p.casa.trim())
    && [p.calle, p.carrera].every(v => !v.trim() || textoDireccionValido(v.trim())) && (!p.casa.trim() || campoDireccionValido(p.casa.trim()))
    && value.length <= 255;
}
export const telefonoValido = (value: string) => /^3[0-9]{9}$/.test(value);
export const errorTelefono = 'El teléfono debe tener exactamente 10 números y empezar por 3.';
export const errorDireccion = 'Escribe la Calle o la Carrera y el Número de la casa (si no tiene número, escribe SN). Solo letras, números, espacios o guiones.';

export const campoDireccionValido = (v: string) => /^[\p{L}\p{N}-]+$/u.test(v);
export const limpiarCampoDireccion = (v: string) => v.replace(/[^\p{L}\p{N}-]/gu, '');
// Calle, carrera y nombre admiten varias palabras («San Martín», «Mi casa»).
export const textoDireccionValido = (v: string) => /^[\p{L}\p{N}-]+(?: [\p{L}\p{N}-]+)*$/u.test(v);
// Quita los espacios dobles que deja escribir palabra por palabra en calle o carrera.
export const normalizarDireccion = (v: string) => v.replace(/\s+/g, ' ').trim();
export const limpiarTextoDireccion = (v: string) => v.replace(/[^\p{L}\p{N} -]/gu, '').replace(/\s+/g, ' ').replace(/^ /, '');
// Barrio: palabras con espacios, guiones o puntos, como en el catálogo («Santa Isabel», «Urb. Villa Inés»).
export const barrioValido = (v: string) => /^[\p{L}\p{N}][\p{L}\p{N}. -]*$/u.test(v.trim());
export const limpiarBarrio = (v: string) => v.replace(/[^\p{L}\p{N}. -]/gu, '').replace(/\s+/g, ' ').trim();
/** Lo que el cliente escribe para llegar a su casa: texto libre, sin saltos de línea. */
export const MAX_INDICACIONES = 255;
export const limpiarIndicaciones = (v: string) => v.replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').slice(0, MAX_INDICACIONES);
