/**
 * Los avisos temporales se leen completos: usan todo el ancho, no cortan el
 * texto con «...» y los largos se quedan más tiempo en pantalla.
 * @format
 */
import React, { useEffect } from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DURACION_TOAST, duracionToast, ToastProvider, useToast } from '../src/Toast';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

const LARGO = 'Llámalo o escríbele. Si en 5 minutos no sale, podrás marcar «Cliente no encontrado».';

function Mostrar() {
  const toast = useToast();
  useEffect(() => {
    toast.info('Le avisamos al cliente que llegaste', LARGO);
  }, [toast]);
  return null;
}

test('los avisos cortos duran lo de siempre y los largos más, sin pasar de 9 s', () => {
  expect(duracionToast('Listo')).toBe(DURACION_TOAST);
  expect(duracionToast('Le avisamos al cliente que llegaste', LARGO)).toBeGreaterThan(DURACION_TOAST);
  expect(duracionToast('x'.repeat(400))).toBe(9000);
});

test('el mensaje largo no se corta en una o dos líneas', async () => {
  let raiz!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    raiz = ReactTestRenderer.create(<ToastProvider><Mostrar /></ToastProvider>);
  });
  const mensaje = raiz.root.findAllByType(Text).find(t => t.props.children === LARGO)!;
  expect(mensaje.props.numberOfLines).toBeGreaterThanOrEqual(4);
  const titulo = raiz.root.findAllByType(Text).find(t => t.props.children === 'Le avisamos al cliente que llegaste')!;
  expect(titulo.props.numberOfLines).toBeGreaterThan(1);
  act(() => raiz.unmount());
});
