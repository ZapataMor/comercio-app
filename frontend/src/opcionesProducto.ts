/**
 * Qué se puede ver y elegir de un producto según su tipo: la ropa y el calzado
 * se piden con talla y color; a la comida se le quitan ingredientes (los que el
 * negocio deja quitar) y se le piden extras, cada uno con su precio por porción;
 * los demás tipos solo muestran su información.
 */
import { ExtraProducto, Producto } from './api';

/** Un extra elegido: cuántas porciones y a cuánto estaba cada una al elegirlo. */
export type ExtraElegido = { nombre: string; cantidad: number; precio: number };

/** Lo que el cliente eligió para una línea del carrito. */
export type OpcionesLinea = {
  talla?: string;
  color?: string;
  /** Ingredientes que no quiere. */
  sin?: string[];
  /** Extras que pide aparte, con porciones y precio. */
  extras?: ExtraElegido[];
  /** De pedidos anteriores a los extras: ingredientes de los que quería más. */
  extra?: string[];
};

/** Porciones máximas de un mismo extra por unidad (igual que el servidor). */
export const MAX_PORCIONES_EXTRA = 10;

const esComida = (p: Producto) => p.tipo_producto?.slug === 'comida';
const esRopa = (p: Producto) => p.tipo_producto?.slug === 'ropa-y-calzado';

export const ingredientesDe = (p: Producto) => (esComida(p) ? p.atributos ?? [] : []);
/** Ingredientes que el cliente no puede quitar (la carne de la hamburguesa). */
export const ingredientesFijosDe = (p: Producto) => (esComida(p) ? p.ingredientes_fijos ?? [] : []);
export const extrasDe = (p: Producto): ExtraProducto[] => (esComida(p) ? p.extras ?? [] : []);
export const tallasDe = (p: Producto) => (esRopa(p) ? p.atributos ?? [] : []);
export const coloresDe = (p: Producto) => (esRopa(p) ? p.colores ?? [] : []);

/** Información que solo se muestra (para qué sirve, características...). */
export const informacionDe = (p: Producto) => (esComida(p) || esRopa(p) ? [] : p.atributos ?? []);

/** El detalle permite elegir peso, talla o color antes de agregar. */
export const pideEleccion = (p: Producto) => p.tipo_venta === 'peso' || tallasDe(p).length > 0 || coloresDe(p).length > 0;

/** Hay algo que el cliente puede ajustar antes de agregarlo: se abre la ficha. */
export const sePersonaliza = (p: Producto) =>
  pideEleccion(p) || ingredientesDe(p).length > ingredientesFijosDe(p).length || extrasDe(p).length > 0;

/** Lo que suman los extras a UNA unidad. */
export function costoExtras(o?: OpcionesLinea): number {
  return (o?.extras ?? []).reduce((s, e) => s + e.precio * e.cantidad, 0);
}

/** Precio de una unidad de una línea, con sus extras. */
export const precioUnitario = (i: { precio: number; opciones?: OpcionesLinea }) => i.precio + costoExtras(i.opciones);

/** Lo que vale una línea completa (unidad con extras × cantidad). */
export const precioLinea = (i: { precio: number; opciones?: OpcionesLinea; cantidad: number }) =>
  Math.round(precioUnitario(i) * i.cantidad * 100) / 100;

export const cop = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');

/** Precio para el cliente: la unidad solo se dice cuando no es por unidad ("/ kg"). */
export function precioDe(p: Producto) {
  if (p.unidad_medida && p.unidad_medida !== 'unidad' && p.precio_formateado) {
    return p.precio_formateado;
  }
  return cop(p.precio);
}

/** Lo que cuesta una porción de un extra, para mostrarlo junto a su nombre. */
export const precioExtra = (precio: number) => (precio > 0 ? `+ ${cop(precio)}` : 'Gratis');

/**
 * El cliente cambió algo de lo que trae el producto. Elegir talla o color solo
 * cuenta si había de dónde escoger.
 */
export function estaModificado(o: OpcionesLinea | undefined, p: Producto): boolean {
  if (!o) return false;
  return (
    !!o.sin?.length ||
    (o.extras ?? []).some(e => e.cantidad > 0) ||
    (!!o.talla && tallasDe(p).length > 1) ||
    (!!o.color && coloresDe(p).length > 1)
  );
}

/** Las opciones de una línea, para leerlas de corrido (igual que el servidor). */
export function detalleOpciones(o?: OpcionesLinea): string | null {
  if (!o) {
    return null;
  }
  const lista = (v: string[]) => v.join(', ').toLowerCase();
  const extras = (o.extras ?? [])
    .filter(e => e.cantidad > 0)
    .map(e => e.nombre.toLowerCase() + (e.cantidad > 1 ? ` x${e.cantidad}` : ''));
  const partes = [
    o.talla ? `Talla ${o.talla}` : null,
    o.color ?? null,
    o.sin?.length ? `Sin ${lista(o.sin)}` : null,
    o.extra?.length ? `Extra ${lista(o.extra)}` : null,
    extras.length ? `Extras: ${extras.join(', ')}` : null,
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
