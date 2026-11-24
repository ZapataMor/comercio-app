/**
 * Lo que se hizo para que pedir sea fácil: el billete con que se paga, los
 * mensajes de error para la persona, los barrios con espacios y el mapa de
 * la casa, que no se guarda tal como abre y pregunta antes de guardar.
 * @format
 */
import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ApiError } from '../src/api';
import { billetesPara } from '../src/billetes';
import { barrioValido, limpiarBarrio, limpiarIndicaciones } from '../src/direccion';
import { MENSAJE_FALLO, messageFromError } from '../src/formErrors';
import SelectorUbicacion from '../src/components/SelectorUbicacion';

let mockMapa: any;
jest.mock('../src/components/Mapa', () => ({
  MAICAO: { centro: { lat: 11.38, lng: -72.24 }, zoom: 12.4 },
  ZOOM: { ciudad: 12.4, zona: 14, barrio: 15, cuadra: 16, puerta: 16.5 },
  vistaDe: (centro: unknown, zoom = 15) => ({ centro, zoom }),
  MapaVitrina: (props: any) => {
    mockMapa = props;
    return null;
  },
  PinEntrega: () => null,
  PinNegocio: () => null,
}));
jest.mock('../src/ubicacion', () => ({
  permisoUbicacion: jest.fn(async () => 'denegado'),
  pedirPermisoUbicacion: jest.fn(async () => false),
  miUbicacion: jest.fn(),
  distanciaMetros: jest.fn(() => 0),
}));
jest.mock('../src/api', () => ({ ...jest.requireActual('../src/api'), getCentroBarrio: jest.fn(async () => null) }));
const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

test('los billetes son los siguientes valores redondos sobre el total', () => {
  expect(billetesPara(12500)).toEqual([20000, 50000, 100000]);
  expect(billetesPara(23000)).toEqual([30000, 50000, 100000]);
  expect(billetesPara(37000)).toEqual([40000, 50000, 100000]);
  // Justo 50.000: ese ya es el valor exacto; queda el de 100.000 (y «Otro valor»).
  expect(billetesPara(50000)).toEqual([100000]);
});

test('los errores técnicos nunca llegan tal cual a la persona', () => {
  expect(messageFromError(new ApiError('Server Error', 500))).toBe('Tuvimos un problema de nuestro lado. Intenta de nuevo en un momento.');
  expect(messageFromError(new ApiError('Unauthenticated.', 401))).toContain('Vuelve a entrar');
  expect(messageFromError(new ApiError('Error en la petición.', 422))).toBe(MENSAJE_FALLO);
  expect(messageFromError(new TypeError("Cannot read property 'x' of undefined"))).toBe(MENSAJE_FALLO);
  // Los del servidor en español se dejan como vienen.
  expect(messageFromError(new ApiError('Ese negocio no está disponible.', 422))).toBe('Ese negocio no está disponible.');
  expect(messageFromError(new Error('Sin internet'))).toBe('Sin internet');
});

test('los barrios se escriben con sus espacios y puntos, sin guiones', () => {
  expect(barrioValido('Santa Isabel')).toBe(true);
  expect(barrioValido('Urb. Villa Inés')).toBe(true);
  expect(barrioValido('')).toBe(false);
  expect(limpiarBarrio('  Santa   Isabel! ')).toBe('Santa Isabel');
  expect(limpiarIndicaciones('Casa azul\nfrente al parque')).toBe('Casa azul frente al parque');
});

describe('mapa de la casa', () => {
  let raiz: ReactTestRenderer.ReactTestRenderer;
  const onCambiar = jest.fn();
  const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));
  const tocarTexto = (texto: string) =>
    act(async () => {
      raiz.root
        .findAll(n => typeof n.props.onPress === 'function' && n.findAllByType(Text).some(t => [t.props.children].flat(Infinity).join('') === texto))[0]
        .props.onPress();
    });

  beforeEach(async () => {
    jest.clearAllMocks();
    await act(async () => {
      raiz = ReactTestRenderer.create(<SelectorUbicacion tipo="entrega" valor={null} onCambiar={onCambiar} barrio="Santa Isabel" />);
    });
    await tocarTexto('Marcar mi casa en el mapa');
  });
  afterEach(() => act(() => raiz.unmount()));

  test('abre acercado (no toda la ciudad) y no deja guardar sin moverlo', async () => {
    expect(mockMapa.vistaInicial.zoom).toBeGreaterThanOrEqual(14);
    await tocarTexto('Guardar ubicación');

    expect(textos()).toContain('Primero mueve el mapa hasta tu casa, o toca «Estoy en mi casa».');
    expect(textos()).not.toContain('¿Esta es la puerta de tu casa?');
    expect(onCambiar).not.toHaveBeenCalled();
  });

  test('después de moverlo pregunta si es la puerta de la casa y guarda el punto', async () => {
    await act(async () => {
      mockMapa.onArrastrar();
      mockMapa.onMover({ lat: 11.39, lng: -72.25 });
    });
    await tocarTexto('Guardar ubicación');
    expect(textos()).toContain('¿Esta es la puerta de tu casa?');

    await tocarTexto('Sí, es aquí');
    expect(onCambiar).toHaveBeenCalledWith({ lat: 11.39, lng: -72.25 });
  });
});
