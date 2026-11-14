import { NegocioMapa } from '../src/api';
import { filtrarNegocios, tiposDe } from '../src/filtrosMapa';

const negocio = (id: number, abierto: boolean, tipos?: string[], categoria: string | null = null): NegocioMapa => ({
  id,
  nombre: `N${id}`,
  categoria,
  tipos,
  direccion: null,
  abierto,
  lat: 11.38,
  lng: -72.24,
});

const lista = [
  negocio(1, true, ['Farmacia', 'Tienda']),
  negocio(2, false, ['Farmacia']),
  negocio(3, true, ['Peluquería']),
  negocio(4, false, undefined, 'Restaurante'),
];
const ids = (l: NegocioMapa[]) => l.map(n => n.id);

test('sin filtros se ven todos', () => {
  expect(ids(filtrarNegocios(lista, [], 'todos'))).toEqual([1, 2, 3, 4]);
});

test('un tipo muestra solo los negocios de ese tipo', () => {
  expect(ids(filtrarNegocios(lista, ['Farmacia'], 'todos'))).toEqual([1, 2]);
  expect(ids(filtrarNegocios(lista, ['Peluquería'], 'todos'))).toEqual([3]);
});

test('abiertos y cerrados se combinan con el tipo', () => {
  expect(ids(filtrarNegocios(lista, [], 'abiertos'))).toEqual([1, 3]);
  expect(ids(filtrarNegocios(lista, [], 'cerrados'))).toEqual([2, 4]);
  expect(ids(filtrarNegocios(lista, ['Farmacia'], 'cerrados'))).toEqual([2]);
});

test('sin `tipos` (backend viejo) se usa la categoría', () => {
  expect(tiposDe(lista[3])).toEqual(['Restaurante']);
  expect(ids(filtrarNegocios(lista, ['Restaurante'], 'todos'))).toEqual([4]);
});

test('con varios tipos marcados se ven los negocios de cualquiera de ellos', () => {
  expect(ids(filtrarNegocios(lista, ['Peluquería', 'Restaurante'], 'todos'))).toEqual([3, 4]);
  expect(ids(filtrarNegocios(lista, ['Peluquería', 'Restaurante'], 'abiertos'))).toEqual([3]);
});
