/**
 * Cuando el domiciliario avisa que llegó, el cliente deja de ver «llega en
 * unos 2 min» y ve que su pedido ya llegó.
 * @format
 */
import { fraseDelEstado } from '../src/screens/PedidoDetalleScreen';

const enCamino = (extra = {}) => ({ estado: 'en_camino', estado_label: 'En camino', minutos_estimados: 2, ...extra }) as any;

test('en camino dice en cuánto llega', () => {
  expect(fraseDelEstado(enCamino()).titulo).toBe('Tu pedido llega en unos 2 min');
});

test('con la llegada registrada dice que ya llegó', () => {
  const frase = fraseDelEstado(enCamino({ llegada_at: '2026-11-24T14:20:00-05:00' }));
  expect(frase.titulo).toBe('¡Tu pedido ya llegó!');
  expect(frase.detalle).toContain('Sal a recibirlo');
});
