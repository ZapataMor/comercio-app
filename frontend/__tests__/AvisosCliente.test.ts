/**
 * Avisos al cliente: el carrito por vencer (10 minutos antes) y la
 * información que le falta para poder pedir.
 */
import { AVISO_ANTES_DE_VENCER, momentoAviso } from '../src/avisoCarrito';
import { faltantesCliente } from '../src/components/AvisoCompletarInfo';
import { Usuario } from '../src/api';

const ahora = 1_000_000_000;

test('el aviso del carrito es 10 minutos antes de que venza', () => {
  const vence = ahora + 60 * 60 * 1000;
  expect(momentoAviso(vence, ahora)).toBe(vence - AVISO_ANTES_DE_VENCER);
});

test('si ya faltan menos de 10 minutos, o no hay carrito, no se programa', () => {
  expect(momentoAviso(ahora + 5 * 60 * 1000, ahora)).toBeNull();
  expect(momentoAviso(null, ahora)).toBeNull();
});

const cliente = (direccion: string | null) => ({ id: 1, name: 'Ana', roles: ['usuario'], direccion } as unknown as Usuario);

test('al cliente sin dirección se le pide completarla', () => {
  expect(faltantesCliente(cliente(null)).map(f => f.icono)).toEqual(['ubicacion']);
  expect(faltantesCliente(cliente('  '))).toHaveLength(1);
});

test('con dirección no le falta nada', () => {
  expect(faltantesCliente(cliente('Calle 10 # 20-30'))).toEqual([]);
});
