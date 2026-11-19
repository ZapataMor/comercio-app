import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  caminoFlecha,
  Lienzo,
  trazarFlecha,
  ubicar,
} from '../src/tutorial/geometria';
import { DetectorTropiezos, REGLAS } from '../src/tutorial/tropiezos';
import { seQuita } from '../src/components/AvisoTemporal';
import { GUIAS, TUTORIALES } from '../src/tutorial/guias';

const mockRuta: { name: string; params?: Record<string, unknown> } = { name: 'Carrito' };
const mockNavigate = jest.fn();
jest.mock('../src/RootNavigation', () => ({
  navigationRef: {
    isReady: () => true,
    getCurrentRoute: () => mockRuta,
    addListener: () => () => {},
    navigate: (...args: unknown[]) => mockNavigate(...args),
  },
  abrirEntregas: jest.fn(),
  esComerciante: () => false,
}));
jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: { id: 7, name: 'Ana', roles: ['usuario'], negocios: [] } } }),
}));

const lienzo: Lienzo = { ancho: 400, alto: 800, arriba: 24, abajo: 24 };

describe('geometría de la flecha', () => {
  it('pone la tarjeta debajo del elemento y traza una flecha vertical si están alineados', () => {
    const u = ubicar({ x: 150, y: 100, ancho: 100, alto: 40 }, 150, lienzo);
    expect(u.lado).toBe('abajo');
    expect(u.tarjeta.y).toBeGreaterThan(146);
    expect(u.flecha).toHaveLength(2);
    expect(u.flecha[0].x).toBe(u.flecha[1].x);
    expect(u.punta).toBe('arriba');
  });

  it('pone la tarjeta encima si el elemento está abajo', () => {
    const u = ubicar({ x: 20, y: 700, ancho: 160, alto: 54 }, 150, lienzo);
    expect(u.lado).toBe('arriba');
    expect(u.tarjeta.y + u.tarjeta.alto).toBeLessThan(700);
    expect(u.punta).toBe('abajo');
  });

  it('dobla solo en ángulo recto: cada tramo es vertical u horizontal', () => {
    // Un ícono en la esquina: la tarjeta no puede centrarse debajo de él.
    const u = ubicar({ x: 360, y: 30, ancho: 30, alto: 30 }, 150, lienzo);
    expect(u.flecha.length).toBe(4);
    for (let i = 1; i < u.flecha.length; i++) {
      const a = u.flecha[i - 1];
      const b = u.flecha[i];
      expect(a.x === b.x || a.y === b.y).toBe(true);
    }
    expect(caminoFlecha(u.flecha)).toMatch(/^M[\d.]+ [\d.]+ V[\d.]+ H[\d.]+ V[\d.]+$/);
  });

  it('el último tramo deja lugar para la punta', () => {
    const p = trazarFlecha({ x: 16, y: 200, ancho: 300, alto: 150 }, { x: 350, y: 100, ancho: 40, alto: 40 }, 'abajo');
    expect(p).toHaveLength(4);
    expect(p[2].y - p[3].y).toBeGreaterThanOrEqual(22);
  });

  it('sin elemento visible, la tarjeta va al centro y sin flecha', () => {
    const u = ubicar({ x: 10, y: 2000, ancho: 100, alto: 40 }, 150, lienzo);
    expect(u.lado).toBe('centro');
    expect(u.recuadro).toBeNull();
    expect(u.flecha).toEqual([]);
  });
});

describe('detector de tropiezos', () => {
  function detector() {
    let ahora = 1000;
    const d = new DetectorTropiezos(() => ahora);
    const avisos = jest.fn();
    d.alTropezar = avisos;
    return { d, avisos, pasar: (ms: number) => (ahora += ms) };
  }

  it('dos errores seguidos ofrecen la ayuda', () => {
    const { d, avisos, pasar } = detector();
    d.registrar({ tipo: 'error' });
    pasar(10_000);
    d.registrar({ tipo: 'error' });
    expect(avisos).toHaveBeenCalledTimes(1);
  });

  it('errores muy separados no cuentan', () => {
    const { d, avisos, pasar } = detector();
    d.registrar({ tipo: 'error' });
    pasar(REGLAS.errores.ventana + 1);
    d.registrar({ tipo: 'error' });
    expect(avisos).not.toHaveBeenCalled();
  });

  it('ir y volver a la misma pantalla', () => {
    const { d, avisos, pasar } = detector();
    for (const nombre of ['Checkout', 'Carrito', 'Checkout', 'Carrito', 'Checkout']) {
      d.registrar({ tipo: 'pantalla', nombre });
      pasar(5000);
    }
    expect(avisos).toHaveBeenCalledTimes(1);
  });

  it('muchos toques seguidos', () => {
    const { d, avisos, pasar } = detector();
    for (let i = 0; i < REGLAS.toques.cantidad; i++) {
      d.registrar({ tipo: 'toque' });
      pasar(300);
    }
    expect(avisos).toHaveBeenCalledTimes(1);
  });

  it('quieto mucho rato, una sola vez por pantalla', () => {
    const { d, avisos, pasar } = detector();
    d.registrar({ tipo: 'pantalla', nombre: 'Explorar' });
    pasar(REGLAS.quietud + 1);
    d.revisarQuietud();
    d.revisarQuietud();
    expect(avisos).toHaveBeenCalledTimes(1);
  });
});

describe('aviso temporal', () => {
  it('se quita deslizando lo suficiente o rápido hacia la derecha', () => {
    expect(seQuita(150, 0, 300)).toBe(true);
    expect(seQuita(40, 1.2, 300)).toBe(true);
    expect(seQuita(40, 0.1, 300)).toBe(false);
    expect(seQuita(-200, 2, 300)).toBe(false);
  });
});

describe('contenido', () => {
  it('cada guía apunta a tutoriales que existen', () => {
    const ids = new Set(TUTORIALES.map(t => t.id));
    for (const g of GUIAS) for (const t of g.tutoriales) expect(ids.has(t)).toBe(true);
  });

  it('los ids de los tutoriales no se repiten', () => {
    const ids = TUTORIALES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('TutorialProvider', () => {
  // Se importan aquí para que tomen los mocks de arriba.
  const { TutorialProvider, useTutorial } = require('../src/tutorial/TutorialContext');

  let api: ReturnType<typeof useTutorial>;
  function Espia() {
    api = useTutorial();
    return <Text>{api.activo ? `${api.activo.tutorial.id}:${api.activo.paso}` : 'nada'}</Text>;
  }

  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
    mockRuta.name = 'Carrito';
    mockRuta.params = undefined;
    mockNavigate.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  async function montar() {
    let r!: Renderer.ReactTestRenderer;
    await act(async () => {
      r = Renderer.create(
        <TutorialProvider listo>
          <Espia />
        </TutorialProvider>,
      );
    });
    // Termina la espera de inicio y la del primer elemento (no hay ninguno marcado).
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    return r;
  }
  const texto = (r: Renderer.ReactTestRenderer) => r.root.findByType(Text).props.children;

  it('muestra el tutorial de la pantalla la primera vez y lo recuerda', async () => {
    const r = await montar();
    expect(texto(r)).toBe('carrito:0');
    await act(async () => api.siguiente());
    expect(texto(r)).toBe('carrito:1');
    await act(async () => {
      api.siguiente();
      api.siguiente();
    });
    expect(texto(r)).toBe('nada');
    expect(JSON.parse((await AsyncStorage.getItem('vitrina.tutoriales.v1.7'))!)).toContain('carrito');

    // Al volver a abrir la app, ya no sale.
    await act(async () => r.unmount());
    const otra = await montar();
    expect(texto(otra)).toBe('nada');
  });

  it('una guía lleva a su pantalla y muestra el tutorial aunque ya se haya visto', async () => {
    mockRuta.name = 'MisDirecciones';
    await AsyncStorage.setItem('vitrina.tutoriales.v1.7', JSON.stringify(['carrito', 'bienvenida', 'direcciones']));
    const r = await montar();
    expect(texto(r)).toBe('nada');
    await act(async () => api.iniciarGuia('direccion'));
    expect(mockNavigate).toHaveBeenCalledWith('MisDirecciones');
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(texto(r)).toBe('direcciones:0');
    expect(api.guia?.guia.id).toBe('direccion');
    // «Salir de la guía» la termina.
    await act(async () => api.saltar());
    expect(texto(r)).toBe('nada');
    expect(api.guia).toBeNull();
  });
});
