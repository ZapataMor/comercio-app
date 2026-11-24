/**
 * Con cuánto se puede pagar un total en efectivo: el siguiente valor redondo
 * de 10.000 y los billetes de 50.000 y 100.000 (o sus múltiplos) que lo
 * superen, hasta tres. Con eso el cliente dice con qué paga y el domiciliario
 * lleva el cambio.
 */
export function billetesPara(total: number): number[] {
  const opciones = [10000, 50000, 100000].map(paso => Math.ceil(total / paso) * paso).filter(v => v > total);
  return Array.from(new Set(opciones)).sort((x, y) => x - y).slice(0, 3);
}
