/**
 * Clave de 4 números: las reglas (iguales a las del backend, App\Rules\ClaveCuatro).
 * @format
 */

import { erroresClaveNueva, problemaClave } from '../src/clave';

describe('reglas de la clave', () => {
  test.each(['0000', '7777', '1234', '6789', '0123', '4321', '9876', '1212', '9090', '1004', '2000'])('%s es fácil de adivinar', clave => {
    expect(problemaClave(clave)).not.toBeNull();
  });

  test.each(['2468', '1357', '8024', '5193', '0472'])('%s sirve', clave => {
    expect(problemaClave(clave)).toBeNull();
  });

  test('pide 4 números y que las dos coincidan', () => {
    expect(problemaClave('123')).toBe('La clave debe tener exactamente 4 números.');
    expect(problemaClave('12a4')).toBe('La clave debe tener exactamente 4 números.');
    expect(erroresClaveNueva('2468', '2469')).toEqual({ confirmar: 'Las dos claves no coinciden.' });
    expect(erroresClaveNueva('2468', '2468')).toEqual({});
  });
});
