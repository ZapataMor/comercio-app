/**
 * Pantalla Explorar: un toque lleva al catálogo, los cerrados van aparte y la
 * búsqueda encuentra negocios y productos.
 * @format
 */

import React from 'react';
import { FlatList, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { buscarProductos, getNegocios, NegocioLista, ProductoConNegocio } from '../src/api';
import ExplorarScreen from '../src/screens/ExplorarScreen';

// Objeto fijo, como en la app: si cambiara en cada render, la pantalla recargaría sin parar.
const mockSesion = { auth: { token: 't', user: { id: 7, name: 'Ana María', roles: ['usuario'] } } };
jest.mock('../src/AuthContext', () => ({ useAuth: () => mockSesion }));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getNegocios: jest.fn(),
  buscarProductos: jest.fn(),
  getTiposNegocio: jest.fn(async () => []),
}));

// Sin navegador no hay foco: la prueba dispara el refresco cuando le conviene.
let mockRefrescar = () => {};
jest.mock('../src/usePolling', () => ({
  REFRESCO_NEGOCIOS: 5000,
  usePolling: (cargar: () => void) => {
    mockRefrescar = cargar;
  },
}));

const mockNegocios = getNegocios as jest.Mock;
const mockProductos = buscarProductos as jest.Mock;

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

function producto(id: number, nombre: string, negocioNombre: string): ProductoConNegocio {
  return {
    id,
    nombre,
    descripcion: null,
    precio: 15000,
    unidad_medida: 'unidad',
    disponible: true,
    categoria: null,
    negocio: { id: 90, nombre: negocioNombre, abierto: true },
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
  const buscar = async (texto: string) => {
    await act(async () => {
      raiz.root.findByProps({ placeholder: 'Busca negocios o productos' }).props.onChangeText(texto);
    });
    await esperar();
  };
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
  return { navigation, textos, buscar, tocar, finDeLista };
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
});

afterEach(() => {
  desmontar();
});

test('saluda por el primer nombre y separa abiertos de cerrados', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón'), negocio(2, 'La Fonda', false)]));
  const { textos } = await montar();

  expect(textos()).toEqual(
    expect.arrayContaining(['Hola, Ana', 'Abiertos ahora', 'Cerrados por ahora', 'Cerrado']),
  );
});

test('un negocio que cierra pasa a cerrados sin salir de la pantalla', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón'), negocio(2, 'La Fonda')]));
  const { textos } = await montar();
  expect(textos()).not.toContain('Cerrados por ahora');

  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón'), negocio(2, 'La Fonda', false)]));
  await refrescar();

  expect(textos()).toEqual(expect.arrayContaining(['Abiertos ahora', 'Cerrados por ahora', 'Cerrado']));
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

test('el refresco mantiene los resultados de la búsqueda', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón')]));
  mockProductos.mockResolvedValue([producto(5, 'Empanada', 'El Rincón')]);
  const { textos, buscar } = await montar();
  await buscar('empa');

  mockProductos.mockResolvedValue([
    { ...producto(5, 'Empanada', 'El Rincón'), negocio: { id: 90, nombre: 'El Rincón', abierto: false } },
  ]);
  await refrescar();

  expect(textos()).toEqual(expect.arrayContaining(['Empanada', 'El Rincón · Cerrado']));
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

test('la búsqueda encuentra negocios por su nombre, sin importar las tildes', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón Paisa')]));
  const { buscar, textos } = await montar();

  await buscar('rincon');

  expect(textos()).toEqual(expect.arrayContaining(['Negocios', 'El Rincón Paisa']));
  expect(textos()).not.toContain('Productos');
});

test('un negocio que solo vende lo buscado sale en Productos, no en Negocios', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón Paisa')]));
  mockProductos.mockResolvedValue([producto(5, 'Bandeja paisa', 'El Rincón Paisa')]);
  const { buscar, textos } = await montar();

  await buscar('bandeja');

  expect(textos()).toEqual(expect.arrayContaining(['Productos', 'Bandeja paisa', '$15.000', 'El Rincón Paisa']));
  expect(textos()).not.toContain('Negocios');
});

test('sin resultados lo dice y sugiere qué hacer', async () => {
  mockNegocios.mockResolvedValue(pagina([]));
  const { buscar, textos } = await montar();

  await buscar('zzz');

  expect(textos()).toEqual(
    expect.arrayContaining(['No encontramos "zzz"', 'Prueba con otro nombre o producto.']),
  );
});

test('una búsqueda vieja que responde tarde no pisa la nueva', async () => {
  mockNegocios.mockResolvedValue(pagina([]));
  const { buscar, textos } = await montar();

  let responderVieja: (valor: unknown) => void = () => {};
  mockNegocios.mockReturnValueOnce(new Promise(resolver => (responderVieja = resolver)));
  await buscar('pollo');

  mockNegocios.mockResolvedValue(pagina([negocio(2, 'Pizza Nostra')]));
  await buscar('pizza');
  await act(async () => {
    responderVieja(pagina([negocio(3, 'Pollo Express')]));
  });
  await esperar();

  expect(textos()).toContain('Pizza Nostra');
  expect(textos()).not.toContain('Pollo Express');
});

test('el catálogo inicial lista tiendas y no consulta todos los productos', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'Mi tienda')]));
  const { textos } = await montar();
  expect(textos()).toContain('Mi tienda');
  expect(mockProductos).not.toHaveBeenCalled();
  expect(mockNegocios).toHaveBeenLastCalledWith('t', undefined, 1, null, 'productos');
});

test('Servicios mantiene las tarjetas de negocios y abre su catálogo de servicios', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'Taller mixto')]));
  const { textos, tocar, navigation } = await montar('servicios');
  expect(textos()).toContain('Taller mixto');
  expect(mockProductos).not.toHaveBeenCalled();
  expect(mockNegocios).toHaveBeenLastCalledWith('t', undefined, 1, null, 'servicios');
  await tocar('Taller mixto');
  expect(navigation.navigate).toHaveBeenLastCalledWith('Negocio', { id: 1, nombre: 'Taller mixto', seccion: 'servicios' });
});
