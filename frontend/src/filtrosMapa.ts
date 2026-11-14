/** Filtros del mapa del cliente: tipos de negocio y abiertos/cerrados. */
import { NegocioMapa } from './api';
import { IconName } from './components/Icon';

export type Estado = 'todos' | 'abiertos' | 'cerrados';
export const ESTADOS: { valor: Estado; texto: string; icono: IconName }[] = [
  { valor: 'todos', texto: 'Todos', icono: 'negocios' },
  { valor: 'abiertos', texto: 'Abiertos', icono: 'tienda' },
  { valor: 'cerrados', texto: 'Cerrados', icono: 'reloj' },
];

/** Tipos del negocio; si el backend aún no manda `tipos`, su categoría. */
export function tiposDe(n: NegocioMapa): string[] {
  return n.tipos ?? (n.categoria ? [n.categoria] : []);
}

/**
 * Negocios que pasan los dos filtros: alguno de los tipos marcados (sin
 * ninguno marcado, todos) y su estado.
 */
export function filtrarNegocios(negocios: NegocioMapa[], tipos: string[], estado: Estado): NegocioMapa[] {
  return negocios.filter(
    n =>
      (tipos.length === 0 || tiposDe(n).some(t => tipos.includes(t))) &&
      (estado === 'todos' || (estado === 'abiertos' ? n.abierto : !n.abierto)),
  );
}
