/**
 * Qué se puede ver y elegir de un producto según su tipo: la ropa y el calzado
 * se piden con talla y color, a la comida se le quitan ingredientes o se piden
 * más (solo de los que trae) y los demás tipos solo muestran su información.
 */
import { Producto } from './api';

/** Lo que el cliente eligió para una línea del carrito. */
export type OpcionesLinea = {
  talla?: string;
  color?: string;
  /** Ingredientes que no quiere. */
  sin?: string[];
  /** Ingredientes de los que quiere más. */
  extra?: string[];
};

const esComida = (p: Producto) => p.tipo_producto?.slug === 'comida';
const esRopa = (p: Producto) => p.tipo_producto?.slug === 'ropa-y-calzado';

export const ingredientesDe = (p: Producto) => (esComida(p) ? p.atributos ?? [] : []);
export const tallasDe = (p: Producto) => (esRopa(p) ? p.atributos ?? [] : []);
export const coloresDe = (p: Producto) => (esRopa(p) ? p.colores ?? [] : []);

/** Información que solo se muestra (para qué sirve, características...). */
export const informacionDe = (p: Producto) => (esComida(p) || esRopa(p) ? [] : p.atributos ?? []);

/** No se puede agregar sin pasar por el detalle: hay que elegir talla o color. */
export const pideEleccion = (p: Producto) => tallasDe(p).length > 0 || coloresDe(p).length > 0;

/** Precio para el cliente: la unidad solo se dice cuando no es por unidad ("/ kg"). */
export function precioDe(p: Producto) {
  if (p.unidad_medida && p.unidad_medida !== 'unidad' && p.precio_formateado) {
    return p.precio_formateado;
  }
  return '$' + Math.round(p.precio).toLocaleString('es-CO');
}

/** Las opciones de una línea, para leerlas de corrido (igual que el servidor). */
export function detalleOpciones(o?: OpcionesLinea): string | null {
  if (!o) {
    return null;
  }
  const lista = (v: string[]) => v.join(', ').toLowerCase();
  const partes = [
    o.talla ? `Talla ${o.talla}` : null,
    o.color ?? null,
    o.sin?.length ? `Sin ${lista(o.sin)}` : null,
    o.extra?.length ? `Extra ${lista(o.extra)}` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

/** Tono real de los colores más comunes. Son del producto, no del tema. */
const MUESTRAS: Record<string, string> = {
  negro: '#1C1C1E',
  blanco: '#FFFFFF',
  gris: '#9A9AA0',
  azul: '#2F5FB3',
  rojo: '#C8352B',
  verde: '#2F8F5B',
  beige: '#D9C7A7',
  café: '#6F4E37',
  cafe: '#6F4E37',
  rosado: '#EE9AB4',
  amarillo: '#EFC53F',
  naranja: '#E8833A',
  morado: '#7B4FA6',
};

/** Muestra del color por su nombre; null si el comerciante escribió otro. */
export const muestraColor = (nombre: string) => MUESTRAS[nombre.trim().toLowerCase()] ?? null;
