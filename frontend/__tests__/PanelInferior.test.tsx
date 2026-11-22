/**
 * El panel que sube (opciones de "Mi perfil" en la barra de Explorar): abre
 * con los renglones dados y, al elegir uno, baja y luego corre la acción.
 * @format
 */
import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { CapaMenus, OpcionMenu } from '../src/components/MenuDesplegable';
import { usePanelInferior } from '../src/components/PanelInferior';

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('../src/RootNavigation', () => ({ navigationRef: { isReady: () => true } }));
jest.mock('../src/components/Desenfoque', () => ({ desenfocarApp: jest.fn() }));

let panel!: ReturnType<typeof usePanelInferior>;
function Abridor() {
  panel = usePanelInferior();
  return null;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('muestra las opciones y la elegida se abre cuando el panel termina de bajar', async () => {
  const accion = jest.fn();
  let raiz!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <CapaMenus>
        <Abridor />
      </CapaMenus>,
    );
  });
  expect(raiz.root.findAllByType(OpcionMenu)).toHaveLength(0);

  act(() => panel.abrir(elegir => [<OpcionMenu key="a" icono="usuario" titulo="Mi información" onPress={() => elegir(accion)} />], 'Mi perfil'));
  expect(panel.abierto).toBe(true);
  expect(raiz.root.findAllByType(Text).map(t => t.props.children)).toContain('Mi información');

  act(() => raiz.root.findByType(OpcionMenu).props.onPress());
  expect(accion).not.toHaveBeenCalled();
  act(() => jest.runAllTimers());
  expect(accion).toHaveBeenCalledTimes(1);
  expect(panel.abierto).toBe(false);
  expect(raiz.root.findAllByType(OpcionMenu)).toHaveLength(0);
  act(() => raiz.unmount());
});
