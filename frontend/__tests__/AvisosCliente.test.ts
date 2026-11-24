/**
 * Avisos al cliente: la información que le falta para poder pedir. (El
 * carrito ya no vence, así que no hay aviso de carrito por vencer.)
 */
import { faltantesCliente } from '../src/components/AvisoCompletarInfo';
import { Usuario } from '../src/api';

const cliente = (direccion: string | null) => ({ id: 1, name: 'Ana', roles: ['usuario'], direccion } as unknown as Usuario);

test('al cliente sin dirección se le pide completarla', () => {
  expect(faltantesCliente(cliente(null)).map(f => f.icono)).toEqual(['ubicacion']);
  expect(faltantesCliente(cliente('  '))).toHaveLength(1);
});

test('con dirección no le falta nada', () => {
  expect(faltantesCliente(cliente('Calle 10 # 20-30'))).toEqual([]);
});
