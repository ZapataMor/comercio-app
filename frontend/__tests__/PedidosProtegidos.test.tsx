import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { AppState } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { crearPedido, getPedido, NuevoPedido, Producto } from '../src/api';
import { CartProvider, DURACION_CARRITO, useCart } from '../src/CartContext';
import { PedidoPendienteProvider, usePedidoPendiente } from '../src/PedidoPendienteContext';

jest.mock('../src/AuthContext', () => ({ useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }) }));
const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));
jest.mock('../src/api', () => ({ ...jest.requireActual('../src/api'), crearPedido: jest.fn(), getPedido: jest.fn() }));

const crear = crearPedido as jest.Mock;
const producto: Producto = { id: 4, nombre: 'Arepa', descripcion: null, precio: 21000, disponible: true, categoria: null, precio_token: 'reserva' };
const cuerpo: NuevoPedido = { negocio_id: 3, items: [{ producto_id: 4, cantidad: 1, precio_token: 'reserva' }], metodo_pago: 'efectivo', direccion_entrega: 'Calle 1', telefono_contacto: '300', clave_intento: 'intento-persistente-1', total_esperado: 25000 };
let raiz: ReactTestRenderer.ReactTestRenderer | null;
async function montar() {
  const api = { cart: null as unknown as ReturnType<typeof useCart>, envio: null as unknown as ReturnType<typeof usePedidoPendiente> };
  function Sonda() { api.cart = useCart(); api.envio = usePedidoPendiente(); return null; }
  await act(async () => { raiz = ReactTestRenderer.create(<CartProvider><PedidoPendienteProvider><Sonda /></PedidoPendienteProvider></CartProvider>); });
  return api;
}
beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-09T18:00:00-05:00'));
  Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => 'active' });
  await AsyncStorage.clear();
  jest.clearAllMocks();
  crear.mockResolvedValue(77);
  (getPedido as jest.Mock).mockResolvedValue({ estado: 'pendiente' });
});
afterEach(() => { act(() => raiz?.unmount()); raiz = null; jest.useRealTimers(); });

test('el carrito vence a la hora aunque se agreguen unidades y sigue vacío al reabrir', async () => {
  const api = await montar();
  await act(async () => { api.cart.agregar(3, 'Tienda', producto); });
  const vence = api.cart.venceEn;
  jest.setSystemTime(Date.now() + DURACION_CARRITO - 1000);
  await act(async () => { api.cart.agregar(3, 'Tienda', producto); });
  expect(api.cart.venceEn).toBe(vence);
  expect(api.cart.count).toBe(2);
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(api.cart.count).toBe(0);
  act(() => raiz!.unmount());
  const reabierto = await montar();
  expect(reabierto.cart.count).toBe(0);
});

test('un cambio de precio pide una decisión y conserva el precio reservado al conservar el producto', async () => {
  const api = await montar();
  await act(async () => { api.cart.agregar(3, 'Tienda', producto); });
  act(() => api.cart.revisarPrecios([{ ...producto, precio: 99000 }]));
  expect(api.cart.total).toBe(21000);
  expect(api.cart.cambiosPrecio[0].nombre).toBe('Arepa');
  act(() => api.cart.resolverCambioPrecio(4, true));
  expect(api.cart.total).toBe(21000);
  expect(api.cart.items[0].precio_token).toBe('reserva');
  expect(api.cart.cambiosPrecio).toHaveLength(0);
  act(() => api.cart.revisarPrecios([{ ...producto, precio: 100000 }]));
  expect(api.cart.cambiosPrecio).toHaveLength(1);
  act(() => api.cart.resolverCambioPrecio(4, false));
  expect(api.cart.count).toBe(0);
});

test('sin red guarda el envío y reintenta exactamente el mismo cuerpo sin admitir otro pedido', async () => {
  crear.mockRejectedValueOnce(new Error('Sin conexión'));
  const api = await montar();
  await act(async () => { api.cart.agregar(3, 'Tienda', producto); });
  await act(async () => { await api.envio.enviar(cuerpo, 'Tienda'); });
  expect(api.envio.pendiente?.body).toEqual(cuerpo);
  expect(JSON.parse((await AsyncStorage.getItem('pedido-pendiente:7'))!).body).toEqual(cuerpo);
  await expect(api.envio.enviar({ ...cuerpo, clave_intento: 'otro-intento' }, 'Tienda')).rejects.toThrow('Ya tienes un pedido');
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(crear).toHaveBeenCalledTimes(2);
  expect(crear.mock.calls[0]).toEqual(crear.mock.calls[1]);
  expect(api.envio.confirmado?.id).toBe(77);
  expect(api.envio.pendiente).toBeNull();
  expect(await AsyncStorage.getItem('pedido-pendiente:7')).toBeNull();
  expect(api.cart.count).toBe(0);
});

test('agregar otra variante de un producto conserva la misma reserva de precio', async () => {
  const api = await montar();
  await act(async () => { api.cart.agregar(3, 'Tienda', producto); });
  await act(async () => { api.cart.agregar(3, 'Tienda', { ...producto, precio: 99000, precio_token: 'reserva-nueva' }, { sin: ['Queso'] }); });
  expect(api.cart.items).toHaveLength(2);
  expect(api.cart.total).toBe(42000);
  expect(api.cart.items.map(i => i.precio_token)).toEqual(['reserva', 'reserva']);
});

test('el envío sobrevive al cierre de la app y recupera el pedido con la misma clave', async () => {
  crear.mockRejectedValueOnce(new Error('Se perdió la respuesta'));
  const api = await montar();
  await act(async () => { await api.envio.enviar(cuerpo, 'Tienda'); });
  act(() => raiz!.unmount());
  const reabierto = await montar();
  expect(crear).toHaveBeenCalledTimes(2);
  expect(crear.mock.calls[1][1].clave_intento).toBe(cuerpo.clave_intento);
  expect(reabierto.envio.confirmado?.id).toBe(77);
});

test('después de confirmar permite otro pedido con un intento nuevo sin esperar la consulta de seguimiento', async () => {
  (getPedido as jest.Mock).mockReturnValue(new Promise(() => {}));
  const api = await montar();
  await act(async () => { await api.envio.enviar(cuerpo, 'Tienda'); });
  expect(api.envio.confirmado?.id).toBe(77);
  act(() => api.envio.consumirConfirmado());
  expect(api.envio.confirmado).toBeNull();
  crear.mockResolvedValueOnce(78);
  await act(async () => { await api.envio.enviar({ ...cuerpo, clave_intento: 'intento-persistente-2' }, 'Tienda'); });
  expect(crear).toHaveBeenCalledTimes(2);
  expect(api.envio.confirmado?.id).toBe(78);
});

test('no admite un nuevo pedido si no puede leer el envío guardado', async () => {
  const obtener = (AsyncStorage.getItem as jest.Mock).getMockImplementation()!;
  (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => key.startsWith('pedido-pendiente:') ? Promise.reject(new Error('Fallo de almacenamiento')) : obtener(key));
  try {
    const api = await montar();
    expect(api.envio.cargando).toBe(true);
    expect(api.envio.errorCarga).toBe('Fallo de almacenamiento');
    await expect(api.envio.enviar(cuerpo, 'Tienda')).rejects.toThrow();
    expect(crear).not.toHaveBeenCalled();
    (AsyncStorage.getItem as jest.Mock).mockImplementation(obtener);
    await act(async () => { api.envio.recargar(); });
    expect(api.envio.cargando).toBe(false);
  } finally { (AsyncStorage.getItem as jest.Mock).mockImplementation(obtener); }
});
