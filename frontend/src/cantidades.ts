export type Medida = { tipo_venta?: string; unidad_medida?: string };

export const esPorPeso = (p: Medida) => p.tipo_venta === 'peso';
export const redondearCantidad = (n: number) => Math.round(n * 1000) / 1000;
export const cantidadValida = (n: number, peso = true) => Number.isFinite(n)
  && n >= (peso ? 0.001 : 1) && n <= 99
  && Math.abs(n - (peso ? redondearCantidad(n) : Math.round(n))) < 1e-8;
export const textoCantidad = (p: { cantidad: number; unidad_medida?: string }) =>
  `${p.cantidad.toLocaleString('es-CO', { maximumFractionDigits: 3 })}${p.unidad_medida && p.unidad_medida !== 'unidad' ? ` ${p.unidad_medida}` : '×'}`;
