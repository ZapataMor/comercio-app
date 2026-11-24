/**
 * Lo que el domiciliario lee de un pedido disponible antes de tomarlo: hacia
 * dónde va (el barrio; la dirección exacta la ve al tomarlo) y cuánto cobra,
 * con el cambio que debe llevar.
 */
import type { Pedido } from './api';
import { cop } from './opcionesProducto';

export function textoEntrega(p: Pick<Pedido, 'direccion_entrega' | 'barrio_entrega'>): string {
  if (p.direccion_entrega) return `Entregar: ${p.direccion_entrega}`;
  if (p.barrio_entrega) return `Entregar en el barrio ${p.barrio_entrega}`;
  return 'Entregar: la dirección la ves al tomar el pedido';
}

export function textoCobro(p: Pick<Pedido, 'cobrar' | 'paga_con'>): string {
  const cambio = p.paga_con != null && p.paga_con > p.cobrar ? p.paga_con - p.cobrar : 0;
  return cambio > 0
    ? `Cobrar ${cop(p.cobrar)} en efectivo. Paga con ${cop(p.paga_con!)}: lleva ${cop(cambio)} de cambio.`
    : `Cobrar ${cop(p.cobrar)} en efectivo (paga con el valor exacto).`;
}
