import { direccionValida, limpiarCampoDireccion, limpiarTextoDireccion, normalizarDireccion, textoDireccionValido } from '../src/direccion';

test.each(['.', 'Calle . #1', 'Calle 1 Carrera . #2', 'Calle 1 #.', 'Calle 1 #2_3', 'Calle 1/2 #3'])('rechaza %s', value => {
  expect(direccionValida(value)).toBe(false);
});
test.each(['Calle 12A #30-15', 'Carrera 8 #4', 'Calle 12 Carrera 8 #30-15', 'Calle San Martín #4', 'Carrera Primera #2', 'Calle San Martín Carrera Primera #3-1'])('acepta %s', value => {
  expect(direccionValida(value)).toBe(true);
});
test('quita puntuación al escribir o pegar', () => {
  expect(limpiarCampoDireccion('12.A/#$ 30-15')).toBe('12A30-15');
});
test('calle, carrera y nombre admiten varias palabras', () => {
  expect(limpiarTextoDireccion(' Mi  casa.')).toBe('Mi casa');
  expect(textoDireccionValido('Mi casa')).toBe(true);
  expect(textoDireccionValido('Mi casa!')).toBe(false);
  expect(direccionValida('Calle 1 #2 3')).toBe(false);
  expect(normalizarDireccion('Calle San  Carrera 8  #3')).toBe('Calle San Carrera 8 #3');
});
