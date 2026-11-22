/**
 * Propiedades: precios, filtros del mapa y el catálogo de Explorar en la
 * sección «Propiedades».
 * @format
 */
import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { getNegocios, getPropiedades, PropiedadResumen } from '../src/api';
import { datosClave, filtrarPropiedades, haceCuantoPublicada, periodoPrecio, precioCorto, rangosPrecio } from '../src/propiedades';
import ExplorarScreen from '../src/screens/ExplorarScreen';

const mockSesion = { auth: { token: 't', user: { id: 7, name: 'Ana', roles: ['usuario'] } } };
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/AuthContext', () => ({ useAuth: () => mockSesion }));
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getNegocios: jest.fn(),
  getTiposNegocio: jest.fn(async () => []),
  getPropiedades: jest.fn(),
}));
jest.mock('../src/usePolling', () => ({
  ...jest.requireActual('../src/usePolling'),
  useEnVivo: jest.fn(),
  usePolling: jest.fn(),
}));

function propiedad(id: number, cambios: Partial<PropiedadResumen> = {}): PropiedadResumen {
  return {
    id, tipo: 'venta', titulo: `Casa ${id}`, precio: 200_000_000, negociable: false, direccion: 'Calle 1 # 2-3',
    barrio: 'Centro', habitaciones: 3, banos: 2, area_m2: 120, capacidad: null, foto: null,
    publicada_at: null, lat: 11.38, lng: -72.24, ...cambios,
  };
}

test('precios cortos para el pin del mapa', () => {
  expect(precioCorto(250_000_000)).toBe('$250 M');
  expect(precioCorto(1_300_000)).toBe('$1,3 M');
  expect(precioCorto(2_000_000)).toBe('$2 M');
  expect(precioCorto(850_000)).toBe('$850 mil');
  expect(periodoPrecio('alquiler')).toBe('/mes');
  expect(periodoPrecio('eventos')).toBe(' por evento');
  expect(periodoPrecio('venta')).toBe('');
});

test('datos clave de una casa y de un patio', () => {
  expect(datosClave(propiedad(1))).toBe('3 hab · 2 baños · 120 m²');
  expect(datosClave(propiedad(2, { tipo: 'eventos', habitaciones: null, banos: null, capacidad: 150, area_m2: null }))).toBe('150 personas');
  expect(datosClave(propiedad(3, { banos: 1, area_m2: null }))).toBe('3 hab · 1 baño');
});

test('hace cuánto se publicó', () => {
  const ahora = new Date('2026-11-14T12:00:00Z');
  expect(haceCuantoPublicada('2026-11-14T08:00:00Z', ahora)).toBe('hoy');
  expect(haceCuantoPublicada('2026-11-13T08:00:00Z', ahora)).toBe('ayer');
  expect(haceCuantoPublicada('2026-11-04T12:00:00Z', ahora)).toBe('hace 10 días');
  expect(haceCuantoPublicada('2026-08-14T12:00:00Z', ahora)).toBe('hace 3 meses');
});

test('los filtros del mapa: tipo, tope de precio y habitaciones (no a los patios)', () => {
  const lista = [
    propiedad(1, { precio: 300_000_000, habitaciones: 4 }),
    propiedad(2, { tipo: 'alquiler', precio: 900_000, habitaciones: 2 }),
    propiedad(3, { tipo: 'eventos', precio: 600_000, habitaciones: null, capacidad: 100 }),
  ];
  const ids = (f: Parameters<typeof filtrarPropiedades>[1]) => filtrarPropiedades(lista, f).map(p => p.id);
  expect(ids({ tipo: null, precioMax: null, habitaciones: 0 })).toEqual([1, 2, 3]);
  expect(ids({ tipo: 'alquiler', precioMax: null, habitaciones: 0 })).toEqual([2]);
  expect(ids({ tipo: null, precioMax: 1_000_000, habitaciones: 0 })).toEqual([2, 3]);
  expect(ids({ tipo: null, precioMax: null, habitaciones: 3 })).toEqual([1, 3]);
  // Los topes de precio dependen del tipo: en venta son millones.
  expect(rangosPrecio('venta')[1].texto).toBe('Hasta $100 M');
  expect(rangosPrecio('alquiler')[1].texto).toBe('Hasta $500 mil');
  expect(rangosPrecio('eventos')[0].max).toBeNull();
});

test('Explorar en Propiedades lista casas y patios, filtra por tipo y abre el detalle', async () => {
  (getPropiedades as jest.Mock).mockResolvedValue({
    propiedades: [propiedad(1, { titulo: 'Casa esquinera' }), propiedad(2, { tipo: 'eventos', titulo: 'Patio La Ceiba', capacidad: 120, habitaciones: null })],
    pagina: 1, ultimaPagina: 1, total: 2,
  });
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  let raiz: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <ExplorarScreen navigation={navigation as any} route={{ key: 'e', name: 'Explorar', params: { seccion: 'propiedades' } } as any} />,
    );
  });
  await act(async () => { await new Promise<void>(r => setTimeout(() => r(), 20)); });

  const textos = () => raiz!.root.findAllByType(Text).map(t => t.props.children).flat();
  expect(getNegocios).not.toHaveBeenCalled();
  expect(getPropiedades).toHaveBeenLastCalledWith('t', { tipo: null, buscar: '' });
  expect(textos()).toContain('Casa esquinera');
  expect(textos()).toContain('Patio La Ceiba');
  expect(textos()).toContain('Patio para eventos');

  // La pestaña «Eventos» pide solo patios.
  const pestana = raiz!.root.findAll(n => n.props.accessibilityRole === 'tab' && n.findAllByType(Text).some(t => t.props.children === 'Eventos'))[0];
  await act(async () => pestana.props.onPress());
  await act(async () => { await new Promise<void>(r => setTimeout(() => r(), 20)); });
  expect(getPropiedades).toHaveBeenLastCalledWith('t', { tipo: 'eventos', buscar: '' });

  // El botón del mapa lleva al mapa de propiedades, no al de negocios.
  await act(async () => raiz!.root.findByProps({ accessibilityLabel: 'Ver propiedades en el mapa' }).props.onPress());
  expect(navigation.navigate).toHaveBeenLastCalledWith('MapaPropiedades');

  const tarjeta = raiz!.root.findAll(n => typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith('Casa en venta: Casa esquinera') && n.props.onPress)[0];
  await act(async () => tarjeta.props.onPress());
  expect(navigation.navigate).toHaveBeenLastCalledWith('Propiedad', { id: 1, titulo: 'Casa esquinera' });
  act(() => raiz!.unmount());
});
