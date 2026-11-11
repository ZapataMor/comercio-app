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
export const errorDireccion = 'Escribe Calle o Carrera y el Número de la casa. Solo letras, números, espacios o guiones.';

export const campoDireccionValido = (v: string) => /^[\p{L}\p{N}-]+$/u.test(v);
export const limpiarCampoDireccion = (v: string) => v.replace(/[^\p{L}\p{N}-]/gu, '');
// Calle, carrera y nombre admiten varias palabras («San Martín», «Mi casa»).
export const textoDireccionValido = (v: string) => /^[\p{L}\p{N}-]+(?: [\p{L}\p{N}-]+)*$/u.test(v);
// Quita los espacios dobles que deja escribir palabra por palabra en calle o carrera.
export const normalizarDireccion = (v: string) => v.replace(/\s+/g, ' ').trim();
export const limpiarTextoDireccion = (v: string) => v.replace(/[^\p{L}\p{N} -]/gu, '').replace(/\s+/g, ' ').replace(/^ /, '');
