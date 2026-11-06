/**
 * La oferta de pedido al domiciliario: se ve en cualquier pantalla si está en
 * turno, aceptar pregunta el tiempo y rechazar no vuelve a ofrecerlo. También
 * la notificación con Aceptar y Rechazar para la app cerrada.
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import React from 'react';
import { AppState, Modal, Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { getDisponibles, Pedido, tomarPedido } from '../src/api';
import MinutosRecogida from '../src/components/MinutosRecogida';
import OfertaPedido from '../src/components/OfertaPedido';
import {
  ACCION_ACEPTAR,
  ACCION_RECHAZAR,
  aceptarOferta,
  mostrarOferta,
  ofertasRechazadas,
  rechazarOferta,
} from '../src/ofertasPedidos';
import { abrirEntregas } from '../src/RootNavigation';

jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }) }));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getDisponibles: jest.fn(),
  tomarPedido: jest.fn(),
}));

jest.mock('../src/RootNavigation', () => ({
  abrirEntregas: jest.fn(),
  navigationRef: { isReady: () => true },
}));

const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));

const mockDisponibles = getDisponibles as jest.Mock;
const mockTomar = tomarPedido as jest.Mock;

const pedido = (id: number): Pedido =>
  ({
    id,
    codigo: `K7M2X9Q${id}`,
    estado: 'listo',
    estado_label: 'Listo',
    subtotal: 20000,
    costo_domicilio: 4000,
    total: 24000,
    cobrar: 24000,
    metodo_pago: 'efectivo',
    minutos_recogida: null,
    direccion_entrega: 'Calle 5 # 1-2',
    telefono_contacto: null,
    negocio: { nombre: 'Arepas Ana', direccion: 'Calle 9' },
    cliente: null,
    items: [],
  }) as Pedido;

const lista = (pedidos: Pedido[], en_turno = true, vetado = false) => ({ pedidos, en_turno, vetado });

let raiz: ReactTestRenderer.ReactTestRenderer;

async function montar() {
  await act(async () => {
    raiz = ReactTestRenderer.create(<OfertaPedido />);
  });
  await act(async () => {});
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));
const ofertaVisible = () => raiz.root.findAllByType(Modal)[0].props.visible;
const preguntaTiempo = () => raiz.root.findByType(MinutosRecogida).props.pedido;

async function tocar(texto: string) {
  const nodo = raiz.root.findAll(
    n => typeof n.props.onPress === 'function' && n.findAll(h => h.children.includes(texto)).length > 0,
  )[0];
  await act(async () => {
    nodo.props.onPress();
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  AppState.currentState = 'active';
  mockTomar.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => raiz?.unmount());
});

describe('modal', () => {
  test('en turno muestra de dónde a dónde va y cuánto se gana', async () => {
    mockDisponibles.mockResolvedValue(lista([pedido(12)]));
    await montar();

    expect(ofertaVisible()).toBe(true);
    expect(textos()).toEqual(
      expect.arrayContaining([
        '¡Pedido disponible!',
        'Domicilio $4.000',
        'Recoger: Arepas Ana — Calle 9',
        'Entregar: Calle 5 # 1-2',
        'Cobrar $24.000 en efectivo',
      ]),
    );
  });

  test('fuera de turno o vetado no se ofrece nada', async () => {
    mockDisponibles.mockResolvedValue(lista([pedido(12)], false));
    await montar();
    expect(ofertaVisible()).toBe(false);
    act(() => raiz.unmount());

    mockDisponibles.mockResolvedValue(lista([pedido(12)], true, true));
    await montar();
    expect(ofertaVisible()).toBe(false);
  });

  test('el botón atrás no lo cierra', async () => {
    mockDisponibles.mockResolvedValue(lista([pedido(12)]));
    await montar();

    act(() => raiz.root.findAllByType(Modal)[0].props.onRequestClose());

    expect(ofertaVisible()).toBe(true);
  });

  test('aceptar pregunta el tiempo y al confirmar toma el pedido y abre Mis entregas', async () => {
    mockDisponibles.mockResolvedValue(lista([pedido(12)]));
    await montar();

    await tocar('Aceptar');
    expect(preguntaTiempo()?.id).toBe(12);
    expect(mockTomar).not.toHaveBeenCalled();

    mockDisponibles.mockResolvedValue(lista([]));
    await act(async () => {
      raiz.root.findByType(MinutosRecogida).props.onAceptar(8);
    });

    expect(mockTomar).toHaveBeenCalledWith('t', 12, 8);
    expect(abrirEntregas).toHaveBeenCalled();
    expect(preguntaTiempo()).toBeNull();
    expect(ofertaVisible()).toBe(false);
  });

  test('si otro lo tomó primero avisa y no abre Mis entregas', async () => {
    mockDisponibles.mockResolvedValue(lista([pedido(12)]));
    mockTomar.mockRejectedValue(new Error('Ya lo tomó otro.'));
    await montar();

    await tocar('Aceptar');
    await act(async () => {
      raiz.root.findByType(MinutosRecogida).props.onAceptar(8);
    });

    expect(mockToast.error).toHaveBeenCalledWith('No se pudo tomar', 'Ya lo tomó otro.');
    expect(abrirEntregas).not.toHaveBeenCalled();
  });

  test('cancelar el tiempo vuelve a la oferta', async () => {
    mockDisponibles.mockResolvedValue(lista([pedido(12)]));
    await montar();

    await tocar('Aceptar');
    await act(async () => {
      raiz.root.findByType(MinutosRecogida).props.onCerrar();
    });

    expect(mockTomar).not.toHaveBeenCalled();
    expect(ofertaVisible()).toBe(true);
  });

  test('rechazar pasa al siguiente y no lo vuelve a ofrecer', async () => {
    mockDisponibles.mockResolvedValue(lista([pedido(13), pedido(12)]));
    await montar();
    expect(textos()).toContain('Domicilio $4.000');

    await tocar('Rechazar');
    expect(ofertaVisible()).toBe(true);
    await tocar('Rechazar');
    await act(async () => {});

    expect(ofertaVisible()).toBe(false);
    expect(await ofertasRechazadas()).toEqual([12, 13]);
    expect(mockTomar).not.toHaveBeenCalled();

    act(() => raiz.unmount());
    await montar();
    expect(ofertaVisible()).toBe(false);
  });

  test('sale solo si el pedido deja de estar disponible', async () => {
    mockDisponibles.mockResolvedValue(lista([pedido(12)]));
    await montar();

    mockDisponibles.mockResolvedValue(lista([]));
    const { avisarCambioDesdePush } = jest.requireActual('../src/usePolling');
    await act(async () => {
      avisarCambioDesdePush();
    });

    expect(ofertaVisible()).toBe(false);
  });
});

describe('aceptar desde la notificación', () => {
  test('la app abre preguntando el tiempo, aunque el modal aún no existiera', async () => {
    mockDisponibles.mockResolvedValue(lista([pedido(20)]));
    aceptarOferta(20);

    await montar();
    await act(async () => {});

    expect(preguntaTiempo()?.id).toBe(20);
  });

  test('si ya no está disponible lo dice', async () => {
    mockDisponibles.mockResolvedValue(lista([]));
    await montar();

    await act(async () => {
      aceptarOferta(21);
    });
    await act(async () => {});

    expect(mockToast.info).toHaveBeenCalledWith('Ese pedido ya no está disponible', expect.any(String));
    expect(preguntaTiempo()).toBeNull();
  });
});

describe('notificación', () => {
  test('trae Aceptar, que abre la app, y Rechazar, que no', async () => {
    await mostrarOferta(30, 'Pedido listo', 'Arepas Ana');

    const { data, android } = (notifee.displayNotification as jest.Mock).mock.calls[0][0];
    expect(data).toEqual({ tipo: 'pedido_disponible', pedido_id: '30' });
    expect(android.actions).toEqual([
      { title: 'Aceptar', pressAction: { id: ACCION_ACEPTAR, launchActivity: 'default' } },
      { title: 'Rechazar', pressAction: { id: ACCION_RECHAZAR } },
    ]);
  });

  test('rechazar la quita y recuerda el pedido', async () => {
    await rechazarOferta(30);

    expect(notifee.cancelNotification).toHaveBeenCalledWith('oferta-pedido-30');
    expect(await ofertasRechazadas()).toEqual([30]);
  });
});
