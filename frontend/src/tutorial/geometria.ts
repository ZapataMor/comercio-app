/**
 * Cuentas del tutorial: dónde va la tarjeta con el texto y por dónde pasa la
 * flecha que la une con el recuadro.
 *
 * La flecha es recta: si la tarjeta queda justo encima o debajo del elemento,
 * es una sola línea vertical; si no, baja (o sube), dobla en ángulo recto,
 * corre en horizontal y vuelve a doblar en ángulo recto hasta el recuadro.
 * Nunca hay diagonales ni curvas.
 *
 * Todo en coordenadas de la capa del tutorial (0,0 = su esquina de arriba a
 * la izquierda). Funciones puras: se prueban sin dispositivo.
 */

export type Rect = { x: number; y: number; ancho: number; alto: number };

export type Punto = { x: number; y: number };

/** Lo que hay disponible para dibujar: el tamaño de la capa y sus márgenes seguros. */
export type Lienzo = { ancho: number; alto: number; arriba: number; abajo: number };

/** Dónde quedó la tarjeta respecto del elemento señalado. */
export type Lado = 'arriba' | 'abajo' | 'centro';

export type Ubicacion = {
  /** Recuadro alrededor del elemento (ya con su margen), o null sin elemento. */
  recuadro: Rect | null;
  tarjeta: Rect;
  lado: Lado;
  /** Puntos de la flecha, de la tarjeta al recuadro (vacío si no hay flecha). */
  flecha: Punto[];
  /** Hacia dónde apunta la punta de la flecha. */
  punta: 'arriba' | 'abajo' | null;
};

/** Margen del recuadro alrededor del elemento. */
export const MARGEN_RECUADRO = 6;
/** Distancia mínima entre la tarjeta y el recuadro (ahí corre la flecha). */
export const SEPARACION = 52;
/** Margen de la tarjeta contra los bordes de la pantalla. */
export const BORDE = 16;
/** La flecha no sale de las esquinas redondeadas de la tarjeta. */
const ESQUINA_TARJETA = 28;
/** Ancho máximo de la tarjeta (en tablets no se estira de lado a lado). */
export const ANCHO_MAX_TARJETA = 360;

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/** Ancho de la tarjeta en un lienzo. */
export function anchoTarjeta(lienzo: Lienzo): number {
  return Math.min(lienzo.ancho - BORDE * 2, ANCHO_MAX_TARJETA);
}

/** El elemento con su margen, recortado a la parte visible del lienzo. */
export function recuadroDe(objetivo: Rect, lienzo: Lienzo): Rect | null {
  const x1 = Math.max(objetivo.x - MARGEN_RECUADRO, 2);
  const y1 = Math.max(objetivo.y - MARGEN_RECUADRO, 2);
  const x2 = Math.min(objetivo.x + objetivo.ancho + MARGEN_RECUADRO, lienzo.ancho - 2);
  const y2 = Math.min(objetivo.y + objetivo.alto + MARGEN_RECUADRO, lienzo.alto - 2);
  if (x2 - x1 < 8 || y2 - y1 < 8) return null;
  return { x: x1, y: y1, ancho: x2 - x1, alto: y2 - y1 };
}

/** ¿Se ve el elemento lo suficiente como para señalarlo? */
export function esVisible(objetivo: Rect | null | undefined, lienzo: Lienzo): objetivo is Rect {
  if (!objetivo) return false;
  const { x, y, ancho, alto } = objetivo;
  if (![x, y, ancho, alto].every(Number.isFinite) || ancho <= 0 || alto <= 0) return false;
  const visibleAlto = Math.min(y + alto, lienzo.alto - lienzo.abajo) - Math.max(y, 0);
  const visibleAncho = Math.min(x + ancho, lienzo.ancho) - Math.max(x, 0);
  // Al menos la mitad del alto (o 40 px) y algo de ancho a la vista.
  return visibleAncho > 8 && visibleAlto >= Math.min(40, alto / 2);
}

/**
 * Ubica la tarjeta (debajo del elemento si cabe, si no encima; si no cabe en
 * ninguno, donde haya más espacio) y traza la flecha.
 */
export function ubicar(objetivo: Rect | null, altoTarjeta: number, lienzo: Lienzo): Ubicacion {
  const ancho = anchoTarjeta(lienzo);
  const minY = lienzo.arriba + 8;
  const maxY = lienzo.alto - lienzo.abajo - 8 - altoTarjeta;
  const recuadro = objetivo && esVisible(objetivo, lienzo) ? recuadroDe(objetivo, lienzo) : null;

  if (!recuadro) {
    const tarjeta = {
      x: (lienzo.ancho - ancho) / 2,
      y: limitar((lienzo.alto - altoTarjeta) / 2, minY, maxY),
      ancho,
      alto: altoTarjeta,
    };
    return { recuadro: null, tarjeta, lado: 'centro', flecha: [], punta: null };
  }

  const centroX = recuadro.x + recuadro.ancho / 2;
  const x = limitar(centroX - ancho / 2, BORDE, lienzo.ancho - BORDE - ancho);

  const libreAbajo = lienzo.alto - lienzo.abajo - (recuadro.y + recuadro.alto);
  const libreArriba = recuadro.y - lienzo.arriba;
  const necesita = altoTarjeta + SEPARACION + 8;
  let lado: Lado;
  if (libreAbajo >= necesita) lado = 'abajo';
  else if (libreArriba >= necesita) lado = 'arriba';
  else lado = libreAbajo >= libreArriba ? 'abajo' : 'arriba';

  const yIdeal = lado === 'abajo' ? recuadro.y + recuadro.alto + SEPARACION : recuadro.y - SEPARACION - altoTarjeta;
  const y = limitar(yIdeal, minY, maxY);
  const tarjeta = { x, y, ancho, alto: altoTarjeta };

  const flecha = trazarFlecha(tarjeta, recuadro, lado);
  return { recuadro, tarjeta, lado, flecha, punta: flecha.length ? (lado === 'abajo' ? 'arriba' : 'abajo') : null };
}

/**
 * Flecha ortogonal de la tarjeta al recuadro. Sale del borde de la tarjeta
 * que mira al elemento y llega al borde del recuadro, en su centro.
 * Devuelve [] si la tarjeta quedó encima del recuadro (no hay por dónde pasar).
 */
export function trazarFlecha(tarjeta: Rect, recuadro: Rect, lado: Lado): Punto[] {
  if (lado === 'centro') return [];
  const destinoX = recuadro.x + recuadro.ancho / 2;
  const salidaX = limitar(destinoX, tarjeta.x + ESQUINA_TARJETA, tarjeta.x + tarjeta.ancho - ESQUINA_TARJETA);
  const salidaY = lado === 'abajo' ? tarjeta.y : tarjeta.y + tarjeta.alto;
  const llegadaY = lado === 'abajo' ? recuadro.y + recuadro.alto : recuadro.y;

  // Debe quedar espacio para la línea y la punta.
  const recorrido = lado === 'abajo' ? salidaY - llegadaY : llegadaY - salidaY;
  const recta = Math.abs(salidaX - destinoX) < 1;
  if (recorrido < (recta ? 18 : 28)) return [];

  const inicio = { x: salidaX, y: salidaY };
  const fin = { x: destinoX, y: llegadaY };
  if (recta) return [inicio, fin];
  // El último tramo (el de la punta) nunca queda más corto que la punta.
  const final = Math.min(Math.max(recorrido / 2, 22), recorrido - 6);
  const medioY = Math.round(lado === 'abajo' ? llegadaY + final : llegadaY - final);
  return [inicio, { x: salidaX, y: medioY }, { x: destinoX, y: medioY }, fin];
}

/** Camino SVG (M/V/H) de la flecha: solo tramos verticales y horizontales. */
export function caminoFlecha(puntos: Punto[]): string {
  if (puntos.length < 2) return '';
  let d = `M${puntos[0].x} ${puntos[0].y}`;
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    d += a.x === b.x ? ` V${b.y}` : ` H${b.x}`;
  }
  return d;
}

/** Rectángulo con esquinas redondeadas como camino SVG (para el hueco del velo). */
export function caminoRectRedondeado({ x, y, ancho, alto }: Rect, r: number): string {
  const rr = Math.max(0, Math.min(r, ancho / 2, alto / 2));
  return (
    `M${x + rr} ${y} H${x + ancho - rr} A${rr} ${rr} 0 0 1 ${x + ancho} ${y + rr} ` +
    `V${y + alto - rr} A${rr} ${rr} 0 0 1 ${x + ancho - rr} ${y + alto} ` +
    `H${x + rr} A${rr} ${rr} 0 0 1 ${x} ${y + alto - rr} V${y + rr} A${rr} ${rr} 0 0 1 ${x + rr} ${y} Z`
  );
}
