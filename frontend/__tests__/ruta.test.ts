/**
 * Cuentas de «Cómo llegar»: por dónde va la persona sobre la ruta, cuál es la
 * próxima indicación y a cuánto, cuánto falta y cuándo hay que recalcular.
 */
import type { Ruta } from '../src/api';
import {
  DESVIO_M,
  ENTRE_RECALCULOS_MS,
  estadoRuta,
  hayQueRecalcular,
  metrosEntre,
  proyectar,
  textoDistancia,
  textoMinutos,
} from '../src/ruta';

// Una ruta en L por Maicao: ~300 m hacia el norte y ~300 m hacia el este.
const A = { lat: 11.38, lng: -72.24 };
const B = { lat: 11.3827, lng: -72.24 };
const C = { lat: 11.3827, lng: -72.23725 };
const LARGO_AB = metrosEntre(A, B);
const LARGO_BC = metrosEntre(B, C);

const RUTA: Ruta = {
  modo: 'moto',
  distancia_m: Math.round(LARGO_AB + LARGO_BC),
  duracion_s: 120,
  linea: [
    [A.lng, A.lat],
    [B.lng, B.lat],
    [C.lng, C.lat],
  ],
  pasos: [
    { texto: 'Arranca por la Carrera 15', icono: 'salida', calle: 'Carrera 15', en_m: 0, punto: A },
    { texto: 'Gira a la derecha por la Calle 16', icono: 'derecha', calle: 'Calle 16', en_m: Math.round(LARGO_AB), punto: B },
    { texto: 'Llegas al destino', icono: 'llegada', calle: null, en_m: Math.round(LARGO_AB + LARGO_BC), punto: C },
  ],
};

test('proyecta la posición sobre la línea: cuánto lleva y a qué distancia está', () => {
  // A mitad del primer tramo, 20 m al oeste de la calle.
  const p = { lat: (A.lat + B.lat) / 2, lng: -72.24 - 20 / (111320 * Math.cos(11.38 * (Math.PI / 180))) };
  const r = proyectar(RUTA.linea, p);

  expect(r.avance).toBeCloseTo(LARGO_AB / 2, -1);
  expect(r.desvio).toBeCloseTo(20, 0);
  expect(r.total).toBeCloseTo(LARGO_AB + LARGO_BC, 0);
});

test('al arrancar, la próxima indicación es el giro y está a lo que mide el primer tramo', () => {
  const e = estadoRuta(RUTA, A);

  expect(e.paso?.texto).toBe('Gira a la derecha por la Calle 16');
  expect(e.hastaPaso).toBeCloseTo(LARGO_AB, -1);
  expect(e.minutos).toBe(2);
  expect(e.llegado).toBe(false);
});

test('pasado el giro, lo que sigue es la llegada y el tiempo baja con lo que falta', () => {
  const pasandoB = { lat: B.lat, lng: B.lng + 0.0005 };
  const e = estadoRuta(RUTA, pasandoB);

  expect(e.paso?.icono).toBe('llegada');
  expect(e.restante).toBeLessThan(LARGO_BC);
  expect(e.minutos).toBe(1);
});

test('cerca del destino ya llegó', () => {
  const e = estadoRuta(RUTA, { lat: C.lat, lng: C.lng - 0.0001 });

  expect(e.llegado).toBe(true);
  expect(e.minutos).toBe(0);
});

test('recalcula solo si se salió del camino y ya pasó un rato desde la última ruta', () => {
  expect(hayQueRecalcular(DESVIO_M + 10, ENTRE_RECALCULOS_MS)).toBe(true);
  expect(hayQueRecalcular(DESVIO_M + 10, ENTRE_RECALCULOS_MS - 1)).toBe(false);
  expect(hayQueRecalcular(DESVIO_M - 5, ENTRE_RECALCULOS_MS * 5)).toBe(false);
});

test('distancias y tiempos como se leen en la tarjeta', () => {
  expect(textoDistancia(4)).toBe('10 m');
  expect(textoDistancia(124)).toBe('120 m');
  expect(textoDistancia(1240)).toBe('1,2 km');
  expect(textoDistancia(12400)).toBe('12 km');
  expect(textoMinutos(8)).toBe('8 min');
  expect(textoMinutos(60)).toBe('1 h');
  expect(textoMinutos(65)).toBe('1 h 5 min');
});
