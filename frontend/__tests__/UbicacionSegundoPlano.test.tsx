/**
 * GPS del domiciliario también con la app en segundo plano: el servicio en
 * primer plano de Android, el envío al ritmo de las lecturas del GPS (sin
 * timers de JS), el aviso fijo cuando no se puede compartir (sin permiso,
 * aproximada, GPS apagado) y el botón «actualizar» del mapa que ve el cliente.
 * @format
 */

import Geolocation from '@react-native-community/geolocation';
import notifee from '@notifee/react-native';
import React from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Linking, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { enviarUbicacion } from '../src/api';
import AvisoUbicacion from '../src/components/AvisoUbicacion';
import { MapaSeguimiento, NotaEnVivo } from '../src/components/Mapa';
import { ID_AVISO_UBICACION } from '../src/servicioUbicacion';
import { EstadoUbicacion, ProblemaUbicacion, useCompartirUbicacion, useEstadoUbicacion } from '../src/ubicacion';

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  enviarUbicacion: jest.fn(),
}));

const mockEnviar = enviarUbicacion as jest.Mock;
const watch = Geolocation.watchPosition as jest.Mock;
const clearWatch = Geolocation.clearWatch as jest.Mock;
const mostrarAviso = notifee.displayNotification as jest.Mock;
const detenerServicio = notifee.stopForegroundService as jest.Mock;
const quitarAviso = notifee.cancelNotification as jest.Mock;
const cambiosApp = AppState.addEventListener as jest.Mock;
const FINA = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const APROX = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
const { GRANTED, DENIED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;
let mockCheck: jest.SpyInstance;
let mockPedir: jest.SpyInstance;
/** Lo que el domiciliario elige en el diálogo de permisos. */
const elige = (fina: string, aprox: string) => mockPedir.mockResolvedValue({ [FINA]: fina, [APROX]: aprox });

const INICIO = new Date('2026-11-16T15:00:00-05:00').getTime();
const MAICAO = { lat: 11.3779, lng: -72.2395 };
/** Un punto `metros` al norte de MAICAO. */
const norte = (metros: number) => ({ lat: MAICAO.lat + metros / 111320, lng: MAICAO.lng });

let estadoVisto: EstadoUbicacion | null = null;
function Compartir({ activo, onProblema }: { activo: boolean; onProblema?: (m: ProblemaUbicacion) => void }) {
  useCompartirUbicacion('t', activo, onProblema);
  estadoVisto = useEstadoUbicacion();
  return <AvisoUbicacion />;
}
const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));

let raiz: ReactTestRenderer.ReactTestRenderer;

async function montar(onProblema?: (m: ProblemaUbicacion) => void) {
  await act(async () => {
    raiz = ReactTestRenderer.create(<Compartir activo onProblema={onProblema} />);
  });
  await act(async () => {});
}

/** El GPS entrega una lectura `enMs` después del inicio. */
async function leerGps(punto: { lat: number; lng: number }, enMs: number) {
  jest.setSystemTime(INICIO + enMs);
  const alLeer = watch.mock.calls[watch.mock.calls.length - 1][0];
  await act(async () => {
    alLeer({ coords: { latitude: punto.lat, longitude: punto.lng } });
  });
}

async function pasarA(estado: AppStateStatus) {
  (AppState as { currentState: AppStateStatus }).currentState = estado;
  await act(async () => {
    cambiosApp.mock.calls.forEach(([, oyente]) => oyente(estado));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(INICIO);
  jest.replaceProperty(Platform, 'OS', 'android');
  // Recién instalada: sin permiso hasta que conteste el diálogo.
  mockCheck = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  mockPedir = jest.spyOn(PermissionsAndroid, 'requestMultiple');
  elige(GRANTED, GRANTED);
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
  jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);
  (AppState as { currentState: AppStateStatus }).currentState = 'active';
  mockEnviar.mockResolvedValue(true);
});

afterEach(() => {
  act(() => raiz?.unmount());
  jest.useRealTimers();
});

describe('Compartir la ubicación del domiciliario', () => {
  it('arranca el servicio en primer plano de tipo ubicación y lee el GPS también quieto', async () => {
    await montar();

    expect(mostrarAviso).toHaveBeenCalledTimes(1);
    const aviso = mostrarAviso.mock.calls[0][0];
    expect(aviso.id).toBe(ID_AVISO_UBICACION);
    expect(aviso.android.asForegroundService).toBe(true);
    expect(aviso.android.foregroundServiceTypes).toEqual([8]);
    expect(watch).toHaveBeenCalledTimes(1);
    expect(watch.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, distanceFilter: 0 });
  });

  it('en segundo plano sigue enviando: moviéndose cada 5 s como mucho y quieto cada 30 s', async () => {
    await montar();
    await pasarA('background');

    expect(clearWatch).not.toHaveBeenCalled();
    expect(detenerServicio).not.toHaveBeenCalled();

    await leerGps(MAICAO, 0);
    expect(mockEnviar).toHaveBeenCalledTimes(1);
    expect(mockEnviar).toHaveBeenLastCalledWith('t', MAICAO);

    // Se movió 50 m, pero hace menos de 5 s del último envío.
    await leerGps(norte(50), 3000);
    expect(mockEnviar).toHaveBeenCalledTimes(1);

    await leerGps(norte(50), 6000);
    expect(mockEnviar).toHaveBeenCalledTimes(2);
    expect(mockEnviar).toHaveBeenLastCalledWith('t', norte(50));

    // Quieto (2 m es ruido del GPS): espera 30 s para reenviar.
    await leerGps(norte(52), 16000);
    expect(mockEnviar).toHaveBeenCalledTimes(2);
    await leerGps(norte(52), 37000);
    expect(mockEnviar).toHaveBeenCalledTimes(3);
  });

  it('sin red reintenta con la siguiente lectura', async () => {
    mockEnviar.mockRejectedValueOnce(new Error('Sin conexión'));
    await montar();

    await leerGps(MAICAO, 0);
    await leerGps(MAICAO, 6000);

    expect(mockEnviar).toHaveBeenCalledTimes(2);
  });

  it('si el servidor dice que ya no comparta, apaga el GPS y el servicio; al volver a la app pregunta otra vez', async () => {
    mockEnviar.mockResolvedValueOnce(false);
    await montar();

    await leerGps(MAICAO, 0);

    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(detenerServicio).toHaveBeenCalledTimes(1);
    expect(quitarAviso).toHaveBeenCalledWith(ID_AVISO_UBICACION);
    await leerGps(norte(100), 10000);
    expect(mockEnviar).toHaveBeenCalledTimes(1);

    await pasarA('active');
    expect(watch).toHaveBeenCalledTimes(2);
    expect(mostrarAviso).toHaveBeenCalledTimes(2);
  });

  it('no inicia el servicio con la app oculta (Android 14 no lo deja): espera a que vuelva', async () => {
    (AppState as { currentState: AppStateStatus }).currentState = 'background';
    await montar();

    expect(watch).toHaveBeenCalledTimes(1);
    expect(mostrarAviso).not.toHaveBeenCalled();

    await pasarA('active');
    expect(mostrarAviso).toHaveBeenCalledTimes(1);
    expect(watch).toHaveBeenCalledTimes(1);
  });

  it('al dejar de compartir (fuera de turno, cerró sesión) apaga el GPS y quita el aviso', async () => {
    await montar();

    await act(async () => raiz.unmount());

    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(detenerServicio).toHaveBeenCalledTimes(1);
  });

  it('pide la ubicación precisa junto con la aproximada (Android 12+ lo exige)', async () => {
    await montar();

    expect(mockPedir).toHaveBeenCalledWith([FINA, APROX]);
    expect(estadoVisto).toBe('buscando');
    await leerGps(MAICAO, 0);
    expect(estadoVisto).toBe('activa');
    expect(textos().join(' ')).not.toContain('Tu ubicación no se está compartiendo');
  });

  it('si ya tenía el permiso no vuelve a preguntar', async () => {
    mockCheck.mockResolvedValue(true);
    await montar();

    expect(mockPedir).not.toHaveBeenCalled();
    expect(watch).toHaveBeenCalledTimes(1);
  });
});

describe('Cuando el domiciliario no puede compartir, se lo dice fijo hasta arreglarlo', () => {
  it('dijo que no: aviso fijo, nada arranca, y el botón vuelve a pedir el permiso', async () => {
    elige(DENIED, DENIED);
    const problema = jest.fn();
    await montar(problema);

    expect(problema).toHaveBeenCalledWith('permiso');
    expect(watch).not.toHaveBeenCalled();
    expect(mostrarAviso).not.toHaveBeenCalled();
    expect(estadoVisto).toBe('sin-permiso');
    expect(textos()).toContain('Tu ubicación no se está compartiendo');

    elige(GRANTED, GRANTED);
    await act(async () => {
      raiz.root.findByProps({ accessibilityLabel: 'Permitir ubicación' }).props.onPress();
    });

    expect(mockPedir).toHaveBeenCalledTimes(2);
    expect(watch).toHaveBeenCalledTimes(1);
    expect(mostrarAviso).toHaveBeenCalledTimes(1);
    expect(textos()).not.toContain('Tu ubicación no se está compartiendo');
  });

  it('eligió «Aproximada»: no comparte y le pide la precisa', async () => {
    elige(DENIED, GRANTED);
    await montar();

    expect(estadoVisto).toBe('aproximada');
    expect(watch).not.toHaveBeenCalled();
    expect(textos()).toContain('Activa la ubicación precisa');
  });

  it('Android ya no deja preguntar: el botón abre Ajustes y al volver arranca solo', async () => {
    elige(NEVER_ASK_AGAIN, NEVER_ASK_AGAIN);
    await montar();

    expect(estadoVisto).toBe('bloqueado');
    await act(async () => {
      raiz.root.findByProps({ accessibilityLabel: 'Abrir ajustes' }).props.onPress();
    });
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);

    // Volvió de Ajustes con el permiso activado.
    mockCheck.mockImplementation(async (p: string) => p === FINA);
    await pasarA('background');
    await pasarA('active');

    expect(watch).toHaveBeenCalledTimes(1);
    expect(mostrarAviso).toHaveBeenCalledTimes(1);
    expect(estadoVisto).toBe('buscando');
  });

  it('GPS apagado: aviso con botón a los ajustes de ubicación; al volver pide el GPS otra vez', async () => {
    await montar();
    const alFallar = watch.mock.calls[0][1];
    await act(async () => alFallar({ code: 2, message: 'Location not available (FusedLocationProvider/settings).' }));

    expect(estadoVisto).toBe('gps-apagado');
    expect(textos()).toContain('No encontramos tu ubicación');
    await act(async () => {
      raiz.root.findByProps({ accessibilityLabel: 'Encender ubicación' }).props.onPress();
    });
    expect(Linking.sendIntent).toHaveBeenCalledWith('android.settings.LOCATION_SOURCE_SETTINGS');

    // Encendió la ubicación y volvió: la librería no había dejado la solicitud registrada.
    await pasarA('background');
    await pasarA('active');
    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(watch).toHaveBeenCalledTimes(2);

    await leerGps(MAICAO, 0);
    expect(estadoVisto).toBe('activa');
    expect(mockEnviar).toHaveBeenCalledTimes(1);
  });

  it('le quitan el permiso con la app abierta: apaga todo y lo avisa', async () => {
    await montar();
    const alFallar = watch.mock.calls[0][1];
    await act(async () => alFallar({ code: 1, message: 'Location permission was not granted.' }));

    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(detenerServicio).toHaveBeenCalledTimes(1);
    expect(estadoVisto).toBe('sin-permiso');
  });

  it('si ya no le toca compartir, no hay aviso', async () => {
    elige(DENIED, DENIED);
    await montar();
    expect(estadoVisto).toBe('sin-permiso');

    await act(async () => raiz.update(<Compartir activo={false} />));

    expect(estadoVisto).toBeNull();
    expect(textos()).toHaveLength(0);
  });
});

describe('Botón «actualizar» del mapa de seguimiento', () => {
  const domiciliario = { ...MAICAO, hace_segundos: 5 };
  const boton = () =>
    raiz.root.findAll(n => n.props.accessibilityLabel === 'Actualizar ubicación del domiciliario' && !!n.props.onPress);

  it('pide la posición más reciente y muestra que está cargando', async () => {
    let terminar = () => {};
    const onRefrescar = jest.fn(() => new Promise<void>(r => (terminar = r)));
    await act(async () => {
      raiz = ReactTestRenderer.create(<MapaSeguimiento domiciliario={domiciliario} onRefrescar={onRefrescar} />);
    });

    await act(async () => {
      boton()[0].props.onPress();
    });
    expect(onRefrescar).toHaveBeenCalledTimes(1);
    expect(raiz.root.findAllByType(ActivityIndicator)).toHaveLength(1);

    // Mientras carga, otro toque no repite la consulta.
    await act(async () => {
      boton()[0].props.onPress();
    });
    expect(onRefrescar).toHaveBeenCalledTimes(1);

    await act(async () => terminar());
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(raiz.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('sin onRefrescar no hay botón', async () => {
    await act(async () => {
      raiz = ReactTestRenderer.create(<MapaSeguimiento domiciliario={domiciliario} />);
    });
    expect(boton()).toHaveLength(0);
  });

  it('la nota cambia de color cuando la posición está vieja', async () => {
    const colorDelPunto = () =>
      raiz.root
        .findAllByType(View)
        .map(v => StyleSheet.flatten(v.props.style)?.backgroundColor)
        .find(Boolean);

    await act(async () => {
      raiz = ReactTestRenderer.create(<NotaEnVivo texto="Ubicación del domiciliario ahora mismo" />);
    });
    const fresca = colorDelPunto();
    await act(async () => {
      raiz.update(<NotaEnVivo texto="Ubicación del domiciliario hace 3 min" vieja />);
    });

    expect(fresca).toBeTruthy();
    expect(colorDelPunto()).not.toBe(fresca);
  });
});
