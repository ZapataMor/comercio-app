/**
 * El mapa del seguimiento va detrás del domiciliario: al abrir muestra a todos
 * y se acerca a la moto; con cada posición nueva la cámara se desplaza al
 * mismo ritmo con que se desliza la moto; si la persona mueve el mapa deja de
 * seguirla y aparece «Seguir al domiciliario».
 * @format
 */

import React from 'react';
import { Text, View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { MapaSeguimiento } from '../src/components/Mapa';

// Cámara simulada que anota cada movimiento (la de jest.setup no hace nada).
const mockCamara = { easeTo: jest.fn(), fitBounds: jest.fn() };
jest.mock('@maplibre/maplibre-react-native', () => {
  const R = require('react');
  const RN = require('react-native');
  const Map = (props: any) => R.createElement(RN.View, { ...props, testID: 'mapa' }, props.children);
  const Marker = (props: any) => R.createElement(RN.View, null, props.children);
  const Camera = R.forwardRef((_props: any, ref: any) => {
    R.useImperativeHandle(ref, () => mockCamara);
    return null;
  });
  const Nada = () => null;
  return { __esModule: true, Map, Marker, Camera, NativeUserLocation: Nada, LogManager: { onLog: jest.fn() } };
});

const NEGOCIO = { punto: { lat: 11.3826, lng: -72.2432 }, nombre: 'Jugos Maria' };
const ENTREGA = { lat: 11.39, lng: -72.25 };
const en = (lat: number, lng = -72.2395) => ({ lat, lng, hace_segundos: 3 });

let raiz: ReactTestRenderer.ReactTestRenderer;

function Mapa({ lat, refrescar }: { lat: number; refrescar?: () => Promise<void> }) {
  return <MapaSeguimiento domiciliario={en(lat)} negocio={NEGOCIO} entrega={ENTREGA} onRefrescar={refrescar} />;
}

const ultimoEaseTo = () => mockCamara.easeTo.mock.calls[mockCamara.easeTo.mock.calls.length - 1][0];
const botonSeguir = () => raiz.root.findAll(n => n.props.accessibilityLabel === 'Seguir al domiciliario' && !!n.props.onPress);
const arrastrar = () =>
  act(async () => {
    raiz.root.findByProps({ testID: 'mapa' }).props.onRegionWillChange({ nativeEvent: { userInteraction: true } });
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => raiz?.unmount());
  jest.useRealTimers();
});

async function abrir(lat = 11.3779) {
  await act(async () => {
    raiz = ReactTestRenderer.create(<Mapa lat={lat} />);
  });
}

it('al abrir muestra a todos un momento y luego se acerca a la moto', async () => {
  await abrir();
  expect(mockCamara.easeTo).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(1500);
  });

  expect(mockCamara.easeTo).toHaveBeenCalledTimes(1);
  expect(ultimoEaseTo()).toMatchObject({ center: [-72.2395, 11.3779], zoom: 15 });
});

it('con cada posición nueva la cámara va detrás, al ritmo de la moto (2 s, en línea recta)', async () => {
  await abrir();
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });

  await act(async () => raiz.update(<Mapa lat={11.378} />));

  expect(mockCamara.easeTo).toHaveBeenCalledTimes(2);
  expect(ultimoEaseTo()).toEqual({ center: [-72.2395, 11.378], duration: 2000, easing: 'linear' });
  // No toca el zoom: si la persona acercó el mapa, se respeta.
  expect(ultimoEaseTo().zoom).toBeUndefined();
});

it('si la persona mueve el mapa deja de seguir, y «Seguir al domiciliario» lo retoma', async () => {
  await abrir();
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  expect(botonSeguir()).toHaveLength(0);

  await arrastrar();
  await act(async () => raiz.update(<Mapa lat={11.378} />));
  expect(mockCamara.easeTo).toHaveBeenCalledTimes(1);
  expect(botonSeguir().length).toBeGreaterThan(0);
  expect(raiz.root.findAllByType(Text).some(t => t.props.children === 'Seguir al domiciliario')).toBe(true);

  await act(async () => botonSeguir()[0].props.onPress());

  expect(ultimoEaseTo()).toMatchObject({ center: [-72.2395, 11.378], duration: 600 });
  expect(botonSeguir()).toHaveLength(0);
  // Y vuelve a ir detrás con las siguientes.
  await act(async () => raiz.update(<Mapa lat={11.3781} />));
  expect(ultimoEaseTo()).toMatchObject({ center: [-72.2395, 11.3781], duration: 2000 });
});

it('si movió el mapa antes de que se acercara, no le quita la vista', async () => {
  await abrir();
  await arrastrar();

  await act(async () => {
    jest.advanceTimersByTime(1500);
  });

  expect(mockCamara.easeTo).not.toHaveBeenCalled();
  expect(botonSeguir().length).toBeGreaterThan(0);
});

it('un salto grande (más de 1 km) la cámara lo hace rápido, sin arrastrarse 2 s', async () => {
  await abrir();
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });

  await act(async () => raiz.update(<Mapa lat={11.41} />));

  expect(ultimoEaseTo()).toMatchObject({ duration: 600 });
});

it('el botón de actualizar vuelve a seguir a la moto', async () => {
  const refrescar = jest.fn().mockResolvedValue(undefined);
  await act(async () => {
    raiz = ReactTestRenderer.create(<Mapa lat={11.3779} refrescar={refrescar} />);
  });
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  await arrastrar();
  expect(botonSeguir().length).toBeGreaterThan(0);

  await act(async () => {
    raiz.root.findByProps({ accessibilityLabel: 'Actualizar ubicación del domiciliario' }).props.onPress();
  });
  await act(async () => {
    jest.advanceTimersByTime(700);
  });

  expect(refrescar).toHaveBeenCalledTimes(1);
  expect(botonSeguir()).toHaveLength(0);
  expect(ultimoEaseTo()).toMatchObject({ center: [-72.2395, 11.3779] });
});

it('sin domiciliario no hay botón de seguir', async () => {
  await act(async () => {
    raiz = ReactTestRenderer.create(<MapaSeguimiento negocio={NEGOCIO} entrega={ENTREGA} />);
  });
  await arrastrar();
  expect(botonSeguir()).toHaveLength(0);
  expect(raiz.root.findAllByType(View).length).toBeGreaterThan(0);
});

it('si movió el mapa (por ejemplo al desplazar la página), vuelve solo a la moto tras unos segundos sin tocarlo', async () => {
  await abrir();
  await act(async () => {
    jest.advanceTimersByTime(1500);
  });
  await arrastrar();
  await act(async () => raiz.update(<Mapa lat={11.378} />));
  expect(botonSeguir().length).toBeGreaterThan(0);

  // Mientras lo sigue moviendo, la espera se reinicia.
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  await arrastrar();
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  expect(botonSeguir().length).toBeGreaterThan(0);

  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(botonSeguir()).toHaveLength(0);
  expect(ultimoEaseTo()).toMatchObject({ center: [-72.2395, 11.378], duration: 600 });
});
