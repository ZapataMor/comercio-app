/**
 * Pantalla Explorar: un toque lleva al catálogo, los cerrados van aparte y la
 * barra de búsqueda abre la pantalla Buscar.
 * @format
 */

import React from 'react';
import { FlatList, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { buscarProductos, getCategoriasCatalogo, getNegocios, NegocioLista } from '../src/api';
import ExplorarScreen from '../src/screens/ExplorarScreen';

// Objeto fijo, como en la app: si cambiara en cada render, la pantalla recargaría sin parar.
const mockSesion = { auth: { token: 't', user: { id: 7, name: 'Ana María', roles: ['usuario'] } } };
// El atajo al pedido en curso tiene su propia prueba (PedidoEnCurso).
jest.mock('../src/components/AvisoPedidoEnCurso', () => () => null);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// La barra de catálogos (Productos / Servicios / Propiedades) tiene su propia prueba.
jest.mock('../src/components/BarraCatalogo', () => ({
  ...jest.requireActual('../src/components/BarraCatalogo'),
  __esModule: true,
  default: () => null,
}));
jest.mock('../src/AuthContext', () => ({ useAuth: () => mockSesion }));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getNegocios: jest.fn(),
  buscarProductos: jest.fn(),
  getTiposNegocio: jest.fn(async () => []),
  getCategoriasCatalogo: jest.fn(async () => []),
}));

// Sin navegador no hay foco: la prueba dispara el refresco cuando le conviene.
let mockRefrescar = () => {};
jest.mock('../src/usePolling', () => ({
  ...jest.requireActual('../src/usePolling'),
  useEnVivo: jest.fn(),
  REFRESCO_NEGOCIOS: 5000,
  usePolling: (cargar: () => void) => {
    mockRefrescar = cargar;
  },
}));

const mockNegocios = getNegocios as jest.Mock;
const mockProductos = buscarProductos as jest.Mock;
const mockCategorias = getCategoriasCatalogo as jest.Mock;

/** Filtros que la pantalla manda sin tocar ningún botón. */
const SIN_FILTROS = { abierto: false, categoriaCatalogoId: null, porNombre: false };

function negocio(id: number, nombre: string, abierto = true): NegocioLista {
  return {
    id,
    nombre,
    descripcion: null,
    categoria: 'Restaurante',
    categorias: ['Restaurante'],
    direccion: null,
    productos: 3,
    abierto,
    tiempo_preparacion: 20,
  };
}


const pagina = (negocios: NegocioLista[]) => ({ negocios, pagina: 1, ultimaPagina: 1 });

/** Un poco más que la espera de la búsqueda. */
async function esperar(ms = 420) {
  await act(async () => {
    await new Promise<void>(listo => setTimeout(() => listo(), ms));
  });
}

let desmontar = () => {};

async function montar(seccion: 'productos' | 'servicios' = 'productos') {
  const navigation = { navigate: jest.fn() };
  let raiz: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <ExplorarScreen navigation={navigation as any} route={{ key: 'e', name: 'Explorar', params: { seccion } } as any} />,
    );
  });
  desmontar = () => act(() => raiz.unmount());
  await esperar();
  const textos = () =>
    raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));
  const tocar = async (etiqueta: string) => {
    await act(async () => {
      raiz.root.findAll(n => n.props.accessibilityLabel === etiqueta && !!n.props.onPress)[0].props.onPress();
    });
  };
  const finDeLista = async () => {
    await act(async () => {
      raiz.root.findByType(FlatList).props.onEndReached();
    });
  };
  return { navigation, textos, tocar, finDeLista, raiz: raiz! };
}

async function refrescar() {
  await act(async () => {
    mockRefrescar();
  });
}

beforeEach(() => {
  mockNegocios.mockReset();
  mockProductos.mockReset();
  mockProductos.mockResolvedValue([]);
  mockCategorias.mockResolvedValue([]);
});

afterEach(() => {
  desmontar();
});

test('saluda por el primer nombre y separa abiertos de cerrados', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón'), negocio(2, 'La Fonda', false)]));
  const { textos } = await montar();

  expect(textos()).toEqual(
    expect.arrayContaining(['Hola, Ana', 'Abiertos ahora', 'Cerrados por ahora']),
  );
});

test('un negocio que cierra pasa a cerrados sin salir de la pantalla', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón'), negocio(2, 'La Fonda')]));
  const { textos } = await montar();
  expect(textos()).not.toContain('Cerrados por ahora');

  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón'), negocio(2, 'La Fonda', false)]));
  await refrescar();

  expect(textos()).toEqual(expect.arrayContaining(['Abiertos ahora', 'Cerrados por ahora']));
});

test('el refresco conserva las páginas ya cargadas', async () => {
  mockNegocios.mockImplementation(async (_t, _b, n = 1) => ({
    negocios: [negocio(n, `Negocio ${n}`)],
    pagina: n,
    ultimaPagina: 3,
  }));
  const { textos, finDeLista } = await montar();
  await finDeLista();
  expect(textos()).toContain('Negocio 2');

  await refrescar();

  expect(textos()).toEqual(expect.arrayContaining(['Negocio 1', 'Negocio 2']));
  expect(textos()).not.toContain('Negocio 3');
});

test('un refresco fallido no borra la lista ni muestra error', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón')]));
  const { textos } = await montar();

  mockNegocios.mockRejectedValue(new Error('Sin conexión'));
  await refrescar();

  expect(textos()).toContain('El Rincón');
  expect(textos()).not.toContain('Sin conexión');
});

test('si todos están abiertos no aparece la sección de cerrados', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón')]));
  const { textos } = await montar();

  expect(textos()).not.toContain('Cerrados por ahora');
});

test('un toque abre el catálogo, también si el negocio está cerrado', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón'), negocio(2, 'La Fonda', false)]));
  const { navigation, tocar } = await montar();

  await tocar('El Rincón');
  expect(navigation.navigate).toHaveBeenLastCalledWith('Negocio', { id: 1, nombre: 'El Rincón', seccion: 'productos' });

  await tocar('La Fonda, cerrado');
  expect(navigation.navigate).toHaveBeenLastCalledWith('Negocio', { id: 2, nombre: 'La Fonda', seccion: 'productos' });
});

test('el descanso agrupa el negocio aparte y su tarjeta dice «Almorzando»', async () => {
  mockNegocios.mockResolvedValue(pagina([{ ...negocio(1, 'Salón', false), estado_texto: 'Almorzando' }]));
  const { textos, tocar, navigation } = await montar();
  // La tarjeta lo dice sobre la foto, sin tener que entrar.
  expect(textos()).toContain('Almorzando');
  expect(textos()).toContain('En descanso de almuerzo');
  expect(textos()).not.toContain('Cerrados por ahora');
  await tocar('Salón, almorzando');
  expect(navigation.navigate).toHaveBeenLastCalledWith('Negocio', { id: 1, nombre: 'Salón', seccion: 'productos' });
});

test('el catálogo inicial lista tiendas y no consulta todos los productos', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'Mi tienda')]));
  const { textos } = await montar();
  expect(textos()).toContain('Mi tienda');
  expect(mockProductos).not.toHaveBeenCalled();
  expect(mockNegocios).toHaveBeenLastCalledWith('t', undefined, 1, null, 'productos', SIN_FILTROS);
});

test('Servicios mantiene las tarjetas de negocios y abre su catálogo de servicios', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'Taller mixto')]));
  const { textos, tocar, navigation } = await montar('servicios');
  expect(textos()).toContain('Taller mixto');
  expect(mockProductos).not.toHaveBeenCalled();
  expect(mockNegocios).toHaveBeenLastCalledWith('t', undefined, 1, null, 'servicios', SIN_FILTROS);
  await tocar('Taller mixto');
  expect(navigation.navigate).toHaveBeenLastCalledWith('Negocio', { id: 1, nombre: 'Taller mixto', seccion: 'servicios' });
});

test('la barra de búsqueda abre la pantalla Buscar con la categoría elegida', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón')]));
  mockCategorias.mockResolvedValue([{ id: 4, nombre: 'Comidas rápidas' }]);
  const { navigation, tocar, textos } = await montar();
  // La barra no busca aquí: no hay botones de filtro en Explorar.
  expect(textos()).not.toContain('Abierto ahora');

  await tocar('Comidas rápidas');
  await esperar();
  expect(mockNegocios).toHaveBeenLastCalledWith('t', undefined, 1, null, 'productos', { ...SIN_FILTROS, categoriaCatalogoId: 4 });
  expect(mockProductos).not.toHaveBeenCalled();

  await tocar('Busca negocios o productos');
  expect(navigation.navigate).toHaveBeenLastCalledWith('Buscar', { seccion: 'productos', filtroId: 4 });
});
