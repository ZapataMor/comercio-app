/** Filtros del mapa del cliente: tipo de negocio y abiertos/cerrados. */
import { NegocioMapa } from './api';

export type Estado = 'todos' | 'abiertos' | 'cerrados';
export const ESTADOS: { valor: Estado; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'abiertos', texto: 'Abiertos' },
  { valor: 'cerrados', texto: 'Cerrados' },
];

/** Tipos del negocio; si el backend aún no manda `tipos`, su categoría. */
export function tiposDe(n: NegocioMapa): string[] {
  return n.tipos ?? (n.categoria ? [n.categoria] : []);
}

/** Negocios que pasan los dos filtros: un tipo (o todos) y su estado. */
export function filtrarNegocios(negocios: NegocioMapa[], tipo: string | null, estado: Estado): NegocioMapa[] {
  return negocios.filter(
    n =>
      (tipo === null || tiposDe(n).includes(tipo)) &&
      (estado === 'todos' || (estado === 'abiertos' ? n.abierto : !n.abierto)),
  );
}
