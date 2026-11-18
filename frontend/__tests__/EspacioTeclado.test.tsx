/**
 * Teclado y barra de navegación con la app de borde a borde (Android 15+):
 * cuánto se encoge la vista y cuánto baja el ScrollView para mostrar el botón.
 */
import React from 'react';
import { Keyboard, View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import EspacioTeclado, {
  AIRE_TECLADO,
  desplazamientoBloque,
  tramoTapado,
} from '../src/components/EspacioTeclado';

describe('tramoTapado', () => {
  it('deja libre lo que tapa el teclado, más un poco de aire', () => {
    // Vista de 0 a 800; el teclado empieza en 500.
    expect(tramoTapado(0, 800, 500)).toBe(300 + AIRE_TECLADO);
  });

  it('descuenta lo que el contenido ya deja abajo (la barra de navegación)', () => {
    expect(tramoTapado(0, 800, 500, 48)).toBe(252 + AIRE_TECLADO);
  });

  it('da 0 si el sistema ya encogió la ventana (Android 14 o anterior)', () => {
    expect(tramoTapado(0, 500, 500)).toBe(0);
    expect(tramoTapado(0, 480, 500)).toBe(0);
  });

  it('da 0 si la medida no llegó', () => {
    expect(tramoTapado(NaN, 800, 500)).toBe(0);
  });
});

describe('desplazamientoBloque', () => {
  // ScrollView de 100 a 500 en la ventana.
  it('baja lo justo para ver el botón debajo del campo', () => {
    // Campo + botón de 400 a 560: faltan 60 más el aire.
    expect(desplazamientoBloque(400, 160, 100, 400)).toBe(60 + AIRE_TECLADO);
  });

  it('no baja si el bloque ya se ve entero', () => {
    expect(desplazamientoBloque(200, 100, 100, 400)).toBe(0);
  });

  it('no saca el campo por arriba cuando el bloque no cabe', () => {
    // Bloque de 600 de alto que empieza en 300: el campo queda arriba, con aire.
    expect(desplazamientoBloque(300, 600, 100, 400)).toBe(200 - AIRE_TECLADO);
  });
});

describe('EspacioTeclado', () => {
  it('pone el margen al abrir el teclado y lo quita al cerrarlo', () => {
    const oyentes: Record<string, (e?: unknown) => void> = {};
    const espia = jest.spyOn(Keyboard, 'addListener').mockImplementation(((evento: string, fn: (e?: unknown) => void) => {
      oyentes[evento] = fn;
      return { remove: jest.fn() };
    }) as unknown as typeof Keyboard.addListener);

    let arbol!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      arbol = ReactTestRenderer.create(<EspacioTeclado descontar={48} testID="raiz" />);
    });
    const raiz = () => arbol.root.find(n => (n.type as unknown) === 'View' && n.props.testID === 'raiz');
    const margen = () => [raiz().props.style].flat(3).reduce((m, s) => (s && s.paddingBottom) || m, 0);

    expect(margen()).toBe(0);
    // En Jest, measureInWindow de View es un mock vacío: la vista ocupa de 0 a 800.
    const vista = arbol.root.findByType(View).instance as { measureInWindow: unknown };
    vista.measureInWindow = (cb: (...n: number[]) => void) => cb(0, 0, 400, 800);
    // Jest corre como iOS (keyboardWill*); en Android son keyboardDid*.
    act(() => (oyentes.keyboardWillShow ?? oyentes.keyboardDidShow)({ endCoordinates: { screenY: 500, height: 252 } }));
    expect(margen()).toBe(252 + AIRE_TECLADO);
    act(() => (oyentes.keyboardWillHide ?? oyentes.keyboardDidHide)());
    expect(margen()).toBe(0);

    espia.mockRestore();
  });
});
