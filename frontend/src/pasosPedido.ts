/**
 * Los pasos de un pedido dichos desde el cliente (no desde la operación de la
 * tienda), y cuáles cuentan como «en curso».
 */
export const PASO_CLIENTE: Record<string, string> = {
  pendiente: 'Esperando que la tienda acepte',
  // Solo por transferencia: pagar y que el negocio confirme que le llegó.
  pago: 'Pago por transferencia',
  aceptado: 'La tienda prepara tu pedido',
  listo: 'Listo, esperando al domiciliario',
  tomado: 'Un domiciliario va por tu pedido',
  recogido: 'El domiciliario ya lo tiene',
  en_camino: 'Va en camino a tu casa',
  entregado: 'Entregado',
  devolviendo: 'Regresando a la tienda',
};

/** El pedido todavía no llega: el cliente debe poder volver a él desde el inicio. */
export const ESTADOS_EN_CURSO = ['pendiente', 'aceptado', 'listo', 'tomado', 'recogido', 'en_camino'];
