/**
 * La alarma de pedidos: suena cada 10 segundos hasta que alguien acepta, y con
 * varios pedidos esperando nunca queda callada.
 * @format
 */

import notifee from '@notifee/react-native';
import { detenerAlarma, detenerTodasLasAlarmas, sincronizarAlarmas, sonarAlarma } from '../src/alarmaPedidos';
import { PedidoPorAceptar } from '../src/api';

const mostrar = notifee.displayNotification as jest.Mock;
const cancelar = notifee.cancelNotification as jest.Mock;
const mostradas = notifee.getDisplayedNotifications as jest.Mock;
const crearCanal = notifee.createChannel as jest.Mock;

const alarma = { pedidoId: 7, negocioId: 3, titulo: 'Nuevo', cuerpo: 'Acéptalo', segundos: 300 };

/** Una alarma ya en pantalla, como la devuelve Notifee. */
function sonando(pedidoId: number) {
  return {
    id: `alarma-pedido-${pedidoId}`,
    notification: {
      title: `Pedido ${pedidoId}`,
      body: 'Acéptalo',
      data: { pedido_id: String(pedidoId), negocio_id: '3', vence: String(Date.now() + 120000) },
    },
  };
}

function porAceptar(id: number, segundos = 200): PedidoPorAceptar {
  return { id, negocio_id: 3, negocio: 'Tienda', total: 10000, segundos };
}

// Cada test empieza mucho después del anterior: la espera entre avisos no se cruza.
let ahora = Date.now();

beforeEach(() => {
  jest.clearAllMocks();
  mostradas.mockResolvedValue([]);
  ahora += 3600000;
  jest.spyOn(Date, 'now').mockImplementation(() => ahora);
});

test('la notificación repite el sonido y se calla sola cuando el pedido vence', async () => {
  await sonarAlarma(alarma);

  expect(crearCanal).toHaveBeenCalledWith(expect.objectContaining({ id: 'pedidos-alarma', sound: 'alarma_pedido' }));
  expect(mostrar).toHaveBeenCalledWith(
    expect.objectContaining({
      id: 'alarma-pedido-7',
      android: expect.objectContaining({ loopSound: true, ongoing: true, timeoutAfter: 300000 }),
    }),
  );
});

test('un pedido sin tiempo no hace sonar nada', async () => {
  await sonarAlarma({ ...alarma, segundos: 0 });

  expect(mostrar).not.toHaveBeenCalled();
});

test('el push y el servidor no publican la misma alarma dos veces: Android la dejaría muda', async () => {
  await Promise.all([sonarAlarma(alarma), sonarAlarma(alarma)]);
  await sincronizarAlarmas([porAceptar(alarma.pedidoId)]);

  expect(mostrar).toHaveBeenCalledTimes(1);
});

test('si la alarma se quitó y el pedido sigue esperando, vuelve a sonar pasado un rato', async () => {
  await sonarAlarma(alarma);
  ahora += 20000;
  await sincronizarAlarmas([porAceptar(alarma.pedidoId)]);

  expect(mostrar).toHaveBeenCalledTimes(2);
});

test('el sonido dura 10 segundos: por eso la alarma suena cada 10 segundos', () => {
  const wav = jest.requireActual('fs').readFileSync('android/app/src/main/res/raw/alarma_pedido.wav');

  const bytesPorSegundo = wav.readUInt32LE(28);
  const bytesDeAudio = wav.readUInt32LE(40);

  expect(bytesDeAudio / bytesPorSegundo).toBe(10);
});

test('la vibración sigue el mismo ritmo de 10 segundos', async () => {
  await sonarAlarma(alarma);

  const { vibrationPattern } = crearCanal.mock.calls[0][0];
  expect(vibrationPattern.reduce((total: number, ms: number) => total + ms, 0)).toBe(10000);
});

test('aceptar un pedido calla su alarma', async () => {
  mostradas.mockResolvedValue([sonando(7)]);

  await detenerAlarma(7);

  expect(cancelar).toHaveBeenCalledWith('alarma-pedido-7');
  expect(mostrar).not.toHaveBeenCalled();
});

test('si otro pedido sigue esperando, la alarma vuelve a sonar con ese', async () => {
  mostradas.mockResolvedValue([sonando(5), sonando(7)]);

  await detenerAlarma(7);

  expect(cancelar).toHaveBeenCalledWith('alarma-pedido-7');
  expect(mostrar).toHaveBeenCalledTimes(1);
  expect(mostrar).toHaveBeenCalledWith(expect.objectContaining({ id: 'alarma-pedido-5' }));
});

test('callar un pedido que no estaba sonando no interrumpe a los demás', async () => {
  mostradas.mockResolvedValue([sonando(5)]);

  await detenerAlarma(7);

  expect(mostrar).not.toHaveBeenCalled();
});

test('sincronizar arranca lo que falta sin reiniciar lo que ya suena', async () => {
  mostradas.mockResolvedValue([sonando(5)]);

  await sincronizarAlarmas([porAceptar(5), porAceptar(9)]);

  expect(cancelar).not.toHaveBeenCalled();
  expect(mostrar).toHaveBeenCalledTimes(1);
  expect(mostrar).toHaveBeenCalledWith(expect.objectContaining({ id: 'alarma-pedido-9' }));
});

test('sincronizar calla lo que ya se atendió y mantiene sonando lo que espera', async () => {
  mostradas.mockResolvedValue([sonando(5), sonando(7)]);

  await sincronizarAlarmas([porAceptar(5)]);

  expect(cancelar).toHaveBeenCalledWith('alarma-pedido-7');
  expect(mostrar).toHaveBeenCalledWith(expect.objectContaining({ id: 'alarma-pedido-5' }));
});

test('al volver a la app la alarma se reanuda: Android la calla al bajar la cortina', async () => {
  mostradas.mockResolvedValue([sonando(5)]);

  await sincronizarAlarmas([porAceptar(5)], true);

  expect(mostrar).toHaveBeenCalledTimes(1);
  expect(mostrar).toHaveBeenCalledWith(expect.objectContaining({ id: 'alarma-pedido-5' }));
});

test('al volver a la app sin pedidos esperando no suena nada', async () => {
  await sincronizarAlarmas([], true);

  expect(mostrar).not.toHaveBeenCalled();
});

test('sincronizar con la lista vacía deja todo en silencio', async () => {
  mostradas.mockResolvedValue([sonando(5), sonando(7)]);

  await sincronizarAlarmas([]);

  expect(cancelar).toHaveBeenCalledTimes(2);
  expect(mostrar).not.toHaveBeenCalled();
});

test('no toca otras notificaciones de la app', async () => {
  mostradas.mockResolvedValue([sonando(5), { id: 'otra', notification: {} }]);

  await detenerTodasLasAlarmas();

  expect(cancelar).toHaveBeenCalledTimes(1);
  expect(cancelar).toHaveBeenCalledWith('alarma-pedido-5');
});
