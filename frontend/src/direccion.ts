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
  return !!((p.calle.trim() || p.carrera.trim()) && p.casa.trim()) && value.length <= 255;
}
export const telefonoValido = (value: string) => /^3[0-9]{9}$/.test(value);
export const errorTelefono = 'El teléfono debe tener exactamente 10 números y empezar por 3.';
export const errorDireccion = 'Escribe Calle o Carrera y el Número de la casa.';
