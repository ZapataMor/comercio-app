import { direccionValida, limpiarCampoDireccion } from '../src/direccion';

test.each(['.', 'Calle . #1', 'Calle 1 Carrera . #2', 'Calle 1 #.', 'Calle 1 #2_3', 'Calle 1/2 #3'])('rechaza %s', value => {
  expect(direccionValida(value)).toBe(false);
});
test.each(['Calle 12A #30-15', 'Carrera 8 #4', 'Calle 12 Carrera 8 #30-15'])('acepta %s', value => {
  expect(direccionValida(value)).toBe(true);
});
test('quita puntuación al escribir o pegar', () => {
  expect(limpiarCampoDireccion('12.A/#$ 30-15')).toBe('12A30-15');
});
