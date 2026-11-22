/**
 * Pantalla Buscar: la flecha vuelve, los filtros cambian lo que se pide y los
 * resultados salen en lista (negocios y productos).
 * @format
 */

import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { buscarProductos, getCategoriasCatalogo, getNegocios, NegocioLista, ProductoConNegocio } from '../src/api';
import BuscarScreen from '../src/screens/BuscarScreen';

// Objeto fijo, como en la app: si cambiara en cada render, la pantalla recargaría sin parar.
const mockSesion = { auth: { token: 't', user: { id: 7, name: 'Ana María', roles: ['usuario'] } } };
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/AuthContext', () => ({ useAuth: () => mockSesion }));
// Sin navegador no hay foco: la pantalla se toma como enfocada al montarse.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback: () => void) => { require('react').useEffect(callback, [callback]); },
}));

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

async function montar(seccion: 'productos' | 'servicios' = 'productos', filtroId?: number) {
  const navigation = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) };
  let raiz: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <BuscarScreen navigation={navigation as any} route={{ key: 'b', name: 'Buscar', params: { seccion, filtroId } } as any} />,
    );
  });
  desmontar = () => act(() => raiz.unmount());
  await esperar();
  const textos = () =>
    raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));
  // Los botones de filtro también dicen «Negocios» y «Productos»: un título
  // de sección suma una vez más.
  const veces = (texto: string) => textos().filter(t => t === texto).length;
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
  return { navigation, textos, veces, buscar, tocar, raiz: raiz! };
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

test('la búsqueda encuentra negocios por su nombre, sin importar las tildes', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón Paisa')]));
  const { buscar, textos, veces } = await montar();

  await buscar('rincon');

  expect(textos()).toContain('El Rincón Paisa');
  expect(veces('Negocios')).toBe(2);
  expect(veces('Productos')).toBe(1);
});

test('un negocio que solo vende lo buscado sale en Productos, no en Negocios', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón Paisa')]));
  mockProductos.mockResolvedValue([producto(5, 'Bandeja paisa', 'El Rincón Paisa')]);
  const { buscar, textos, veces } = await montar();

  await buscar('bandeja');

  expect(textos()).toEqual(expect.arrayContaining(['Bandeja paisa', '$15.000', 'El Rincón Paisa']));
  expect(veces('Productos')).toBe(2);
  expect(veces('Negocios')).toBe(1);
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

test('el refresco conserva la consulta aplicada mientras se escribe otra búsqueda', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'Panadería')]));
  const pantalla = await montar();
  await pantalla.buscar('pan');
  mockProductos.mockClear();
  await act(async () => {
    pantalla.raiz.root.findByProps({ placeholder: 'Busca negocios o productos' }).props.onChangeText('pan con');
  });
  await refrescar();
  expect(mockProductos).toHaveBeenLastCalledWith('t', 'pan', null, false, SIN_FILTROS);
});



test('«Negocios» busca solo por el nombre del negocio y no pide productos', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'Barbería Juancho')]));
  const pantalla = await montar();
  await pantalla.tocar('Negocios: Solo negocios con ese nombre o parecido');
  await esperar();
  mockProductos.mockClear();
  await act(async () => {
    pantalla.raiz.root.findByProps({ placeholder: 'Busca negocios por su nombre' }).props.onChangeText('barberia');
  });
  await esperar();

  expect(mockNegocios).toHaveBeenLastCalledWith('t', 'barberia', 1, null, 'productos', { ...SIN_FILTROS, porNombre: true });
  expect(mockProductos).not.toHaveBeenCalled();
  expect(pantalla.textos()).toContain('Barbería Juancho');
});

test('«Productos» lista solo productos, también sin escribir', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón')]));
  mockProductos.mockResolvedValue([producto(5, 'Bandeja paisa', 'El Rincón')]);
  const pantalla = await montar();
  mockNegocios.mockClear();
  await pantalla.tocar('Productos: Solo productos');
  await esperar();

  expect(mockProductos).toHaveBeenLastCalledWith('t', '', null, true, SIN_FILTROS);
  expect(mockNegocios).not.toHaveBeenCalled();
  expect(pantalla.textos()).toContain('Bandeja paisa');
  expect(pantalla.textos()).not.toContain('Abiertos ahora');
});

test('«Abierto ahora» y una categoría se mandan a la búsqueda', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón')]));
  mockCategorias.mockResolvedValue([{ id: 4, nombre: 'Comidas rápidas' }]);
  const pantalla = await montar();
  await pantalla.tocar('Abierto ahora');
  await esperar();
  expect(mockNegocios).toHaveBeenLastCalledWith('t', undefined, 1, null, 'productos', { ...SIN_FILTROS, abierto: true });

  await pantalla.tocar('Comidas rápidas');
  await esperar();
  const filtros = { ...SIN_FILTROS, abierto: true, categoriaCatalogoId: 4 };
  expect(mockNegocios).toHaveBeenLastCalledWith('t', undefined, 1, null, 'productos', filtros);
  // Con una categoría también salen sus productos.
  expect(mockProductos).toHaveBeenLastCalledWith('t', '', null, false, filtros);

  // «Todos» vuelve a mostrar abiertos y cerrados.
  await pantalla.tocar('Todos: Abiertos y cerrados');
  await esperar();
  expect(mockNegocios).toHaveBeenLastCalledWith('t', undefined, 1, null, 'productos', { ...filtros, abierto: false });
});

test('sin resultados con filtros ofrece quitarlos', async () => {
  mockNegocios.mockResolvedValue(pagina([]));
  const pantalla = await montar();
  await pantalla.tocar('Abierto ahora');
  await esperar();

  expect(pantalla.textos()).toEqual(expect.arrayContaining(['No hay negocios abiertos ahora', 'Quitar filtros']));
});

test('sin escribir ni filtrar muestra una pista y no pide nada', async () => {
  mockCategorias.mockResolvedValue([{ id: 4, nombre: 'Comidas rápidas' }]);
  const { textos, tocar, navigation } = await montar();

  expect(mockNegocios).not.toHaveBeenCalled();
  expect(mockProductos).not.toHaveBeenCalled();
  expect(textos()).toEqual(
    expect.arrayContaining(['¿Qué buscas?', 'Negocios', 'Productos', 'Abierto ahora', 'Todos', 'Categorías', 'Comidas rápidas']),
  );

  await tocar('Volver');
  expect(navigation.goBack).toHaveBeenCalled();
});

test('llega con la categoría que estaba elegida en Explorar', async () => {
  mockNegocios.mockResolvedValue(pagina([negocio(1, 'El Rincón')]));
  await montar('productos', 4);
  expect(mockNegocios).toHaveBeenLastCalledWith('t', undefined, 1, null, 'productos', { ...SIN_FILTROS, categoriaCatalogoId: 4 });
});

test('en Servicios lista todos los negocios hallados, también por un servicio', async () => {
  mockNegocios.mockResolvedValue(pagina([{ ...negocio(1, 'Salón Bella'), coincide_nombre: false }]));
  const pantalla = await montar('servicios');
  await act(async () => {
    pantalla.raiz.root.findByProps({ placeholder: 'Busca negocios o servicios' }).props.onChangeText('corte');
  });
  await esperar();

  expect(mockNegocios).toHaveBeenLastCalledWith('t', 'corte', 1, null, 'servicios', SIN_FILTROS);
  expect(pantalla.textos()).toContain('Salón Bella');
});
