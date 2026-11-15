/**
 * Propiedades (casas en venta o alquiler y patios para eventos): nombres,
 * precios y los filtros del mapa. Sin React, para poder probarlo solo.
 */
import { PropiedadResumen, TipoPropiedad } from './api';
import { IconName } from './components/Icon';

export const TIPOS_PROPIEDAD: { valor: TipoPropiedad; texto: string; corto: string; icono: IconName }[] = [
  { valor: 'venta', texto: 'Casa en venta', corto: 'Venta', icono: 'casa' },
  { valor: 'alquiler', texto: 'Casa en alquiler', corto: 'Alquiler', icono: 'llave' },
  { valor: 'eventos', texto: 'Patio para eventos', corto: 'Eventos', icono: 'fiesta' },
];

export function tipoPropiedad(tipo: TipoPropiedad) {
  return TIPOS_PROPIEDAD.find(t => t.valor === tipo) ?? TIPOS_PROPIEDAD[0];
}

/** "$250.000.000". */
export function pesos(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/** Lo que se paga, con su periodo: "/mes" en alquiler, "por evento" en patios. */
export function periodoPrecio(tipo: TipoPropiedad): string {
  return tipo === 'alquiler' ? '/mes' : tipo === 'eventos' ? ' por evento' : '';
}

/** Precio corto para el pin del mapa: "$250 M", "$1,3 M", "$850 mil". */
export function precioCorto(n: number): string {
  if (n >= 1_000_000) {
    const millones = n / 1_000_000;
    const redondeo = millones >= 10 ? Math.round(millones) : Math.round(millones * 10) / 10;
    return `$${redondeo.toLocaleString('es-CO')} M`;
  }
  if (n >= 1000) return `$${Math.round(n / 1000)} mil`;
  return `$${n}`;
}

/** "3 hab · 2 baños · 120 m²" o "150 personas · 500 m²". */
export function datosClave(p: Pick<PropiedadResumen, 'tipo' | 'habitaciones' | 'banos' | 'area_m2' | 'capacidad'>): string {
  const partes =
    p.tipo === 'eventos'
      ? [p.capacidad ? `${p.capacidad} personas` : null]
      : [
          p.habitaciones != null ? `${p.habitaciones} hab` : null,
          p.banos != null ? `${p.banos} ${p.banos === 1 ? 'baño' : 'baños'}` : null,
        ];
  return [...partes, p.area_m2 ? `${p.area_m2} m²` : null].filter(Boolean).join(' · ');
}

/** "hoy", "ayer", "hace 5 días", "hace 3 meses". */
export function haceCuantoPublicada(iso: string | null, ahora = new Date()): string {
  if (!iso) return '';
  const dias = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
}

// --- Filtros del mapa de propiedades ---

/** Filtro por tipo del mapa: uno a la vez, o todas. */
export const FILTRO_TIPOS: { valor: TipoPropiedad | null; texto: string; icono: IconName }[] = [
  { valor: null, texto: 'Todas', icono: 'mapa' },
  ...TIPOS_PROPIEDAD.map(t => ({ valor: t.valor, texto: t.corto, icono: t.icono })),
];

export type RangoPrecio = { texto: string; max: number | null };

/** Topes de precio que tienen sentido para el tipo: en venta, millones; en alquiler y eventos, miles. */
export function rangosPrecio(tipo: TipoPropiedad): RangoPrecio[] {
  const topes =
    tipo === 'venta'
      ? [100_000_000, 200_000_000, 300_000_000, 500_000_000]
      : tipo === 'alquiler'
        ? [500_000, 800_000, 1_200_000, 2_000_000]
        : [300_000, 600_000, 1_000_000, 2_000_000];
  return [{ texto: 'Cualquier precio', max: null }, ...topes.map(max => ({ texto: `Hasta ${precioCorto(max)}`, max }))];
}

export const HABITACIONES = [
  { valor: 0, texto: 'Cualquiera' },
  { valor: 1, texto: '1 o más' },
  { valor: 2, texto: '2 o más' },
  { valor: 3, texto: '3 o más' },
  { valor: 4, texto: '4 o más' },
];

export type FiltroMapaPropiedades = { tipo: TipoPropiedad | null; precioMax: number | null; habitaciones: number };

/**
 * Las que pasan los filtros: el tipo (null = todas), el tope de precio y las
 * habitaciones mínimas (a los patios no se les piden).
 */
export function filtrarPropiedades<T extends PropiedadResumen>(lista: T[], f: FiltroMapaPropiedades): T[] {
  return lista.filter(
    p =>
      (f.tipo == null || p.tipo === f.tipo) &&
      (f.precioMax == null || p.precio <= f.precioMax) &&
      (f.habitaciones === 0 || p.tipo === 'eventos' || (p.habitaciones ?? 0) >= f.habitaciones),
  );
}
