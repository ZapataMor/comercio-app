/**
 * Moderación de reseñas: reportar, responder como propietario y lo que hace
 * el admin.
 * @format
 */

import React from 'react';
import { FlatList, Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  descartarReportesResena,
  getAdminResenas,
  getResenas,
  ocultarResena,
  ResenaAdmin,
  ResenaPublica,
  reportarResena,
  responderResena,
  restaurarResena,
} from '../src/api';
import { TarjetaResena } from '../src/components/Resenas';
import AdminResenasScreen from '../src/screens/AdminResenasScreen';
import ResenasScreen from '../src/screens/ResenasScreen';

jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 't', user: { id: 7 } } }),
}));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getResenas: jest.fn(),
  reportarResena: jest.fn(async () => 'Gracias por avisar.'),
  responderResena: jest.fn(async () => ({ texto: 'Lo sentimos', fecha: '06/11/2026' })),
  getAdminResenas: jest.fn(),
  ocultarResena: jest.fn(async () => undefined),
  restaurarResena: jest.fn(async () => undefined),
  descartarReportesResena: jest.fn(async () => undefined),
}));

const mockToast = { exito: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('../src/Toast', () => ({ useToast: () => mockToast }));

// El diálogo acepta de una vez: aquí solo importa qué acción queda armada.
const mockConfirmar = jest.fn((opciones: { accion: () => unknown }) => opciones.accion());
jest.mock('../src/components/Confirmacion', () => ({ useConfirmar: () => mockConfirmar }));

const mockReportar = reportarResena as jest.Mock;
const mockResponder = responderResena as jest.Mock;
const mockGetResenas = getResenas as jest.Mock;
const mockGetAdmin = getAdminResenas as jest.Mock;

let raiz: ReactTestRenderer.ReactTestRenderer;

const resena = (cambios: Partial<ResenaPublica> = {}): ResenaPublica => ({
  id: 9,
  autor: 'Ana P.',
  estrellas: 2,
  comentario: 'Tardaron mucho',
  fecha: '01/11/2026',
  respuesta: null,
  propia: false,
  reportada: false,
  puede_responder: false,
  ...cambios,
});

const deAdmin = (cambios: Partial<ResenaAdmin> = {}): ResenaAdmin => ({
  id: 9,
  autor: 'Ana Pérez',
  estrellas: 1,
  comentario: 'Comentario grosero',
  fecha: '01/11/2026',
  negocio: 'La Espiga',
  producto: null,
  oculta: false,
  respuesta: null,
  reportes: [{ motivo: 'Ofensiva o irrespetuosa', cantidad: 2 }],
  historial: [],
  ...cambios,
});

const paginaAdmin = (resenas: ResenaAdmin[]) => ({ resenas, reportadas: 1, ocultas: 0, pagina: 1, ultima_pagina: 1 });

async function montar(el: React.ReactElement) {
  await act(async () => {
    raiz = ReactTestRenderer.create(el);
  });
}

const textos = () => raiz.root.findAllByType(Text).map(t => [t.props.children].flat(Infinity).join(''));

function boton(texto: string) {
  return raiz.root.findAll(
    h => typeof h.props.onPress === 'function' && h.findAll(x => x.children.includes(texto)).length > 0,
  )[0];
}

/** Toca el botón más interno: la tarjeta del admin también se puede tocar. */
async function tocar(texto: string) {
  const nodos = raiz.root.findAll(
    h => typeof h.props.onPress === 'function' && h.findAll(x => x.children.includes(texto)).length > 0,
  );
  await act(async () => {
    nodos[nodos.length - 1].props.onPress();
  });
}

async function escribir(texto: string) {
  await act(async () => {
    raiz.root.findByType(TextInput).props.onChangeText(texto);
  });
}

const pantallaResenas = () => {
  const props = { route: { params: { negocioId: 3, titulo: 'La Espiga' } } } as React.ComponentProps<typeof ResenasScreen>;
  return <ResenasScreen {...props} />;
};

beforeEach(() => jest.clearAllMocks());

afterEach(() => {
  act(() => raiz.unmount());
});

describe('reportar', () => {
  test('al elegir un motivo se envía y queda marcada', async () => {
    await montar(<TarjetaResena resena={resena()} />);

    await tocar('Reportar');
    await tocar('Ofensiva');

    expect(mockReportar).toHaveBeenCalledWith('t', 9, 'ofensiva');
    expect(mockToast.exito).toHaveBeenCalledWith('Gracias por avisar.');
    expect(textos()).toContain('Reportada');
    expect(textos()).not.toContain('Reportar');
  });

  test('se puede cancelar sin enviar nada', async () => {
    await montar(<TarjetaResena resena={resena()} />);

    await tocar('Reportar');
    await tocar('Cancelar');

    expect(mockReportar).not.toHaveBeenCalled();
    expect(textos()).toContain('Reportar');
  });

  test('si falla avisa y sigue dejando reportar', async () => {
    mockReportar.mockRejectedValueOnce(new Error('Sin conexión'));
    await montar(<TarjetaResena resena={resena()} />);

    await tocar('Reportar');
    await tocar('Publicidad');

    expect(mockToast.error).toHaveBeenCalledWith('No se pudo reportar', 'Sin conexión');
    expect(textos()).not.toContain('Reportada');
  });

  test('la propia no se reporta, y la ya reportada no repite el botón', async () => {
    await montar(<TarjetaResena resena={resena({ propia: true })} />);
    expect(textos()).not.toContain('Reportar');
    act(() => raiz.unmount());

    await montar(<TarjetaResena resena={resena({ reportada: true })} />);
    expect(textos()).toContain('Reportada');
    expect(textos()).not.toContain('Reportar');
  });
});

describe('respuesta del negocio', () => {
  test('se muestra bajo la reseña', async () => {
    await montar(<TarjetaResena resena={resena({ respuesta: { texto: 'Lo sentimos', fecha: '02/11/2026' } })} />);

    expect(textos()).toContain('Respuesta de la tienda · 02/11/2026');
    expect(textos()).toContain('Lo sentimos');
  });

  test('el propietario responde una vez desde la lista', async () => {
    mockGetResenas.mockResolvedValue({
      resumen: { promedio: 2, total: 1, distribucion: [] },
      items: [resena({ puede_responder: true })],
      pagina: 1,
      ultima_pagina: 1,
    });
    await montar(pantallaResenas());

    await tocar('Responder');
    expect(boton('Publicar respuesta').props.disabled).toBe(true);

    await escribir('  Lo sentimos  ');
    await tocar('Publicar respuesta');

    expect(mockResponder).toHaveBeenCalledWith('t', 9, 'Lo sentimos');
    expect(textos()).toContain('Lo sentimos');
    expect(textos()).not.toContain('Responder');
    expect(raiz.root.findAllByType(TextInput)).toHaveLength(0);
  });

  test('quien no es propietario no ve Responder', async () => {
    mockGetResenas.mockResolvedValue({
      resumen: { promedio: 2, total: 1, distribucion: [] },
      items: [resena()],
      pagina: 1,
      ultima_pagina: 1,
    });
    await montar(pantallaResenas());

    expect(textos()).not.toContain('Responder');
  });
});

describe('admin', () => {
  test('entra a las reportadas y muestra los reportes por motivo', async () => {
    mockGetAdmin.mockResolvedValue(paginaAdmin([deAdmin()]));
    await montar(<AdminResenasScreen />);

    expect(mockGetAdmin).toHaveBeenCalledWith('t', 'reportadas');
    expect(textos()).toContain('Reportadas (1)');
    expect(textos()).toContain('Comentario grosero');
    expect(textos()).toContain('Ofensiva o irrespetuosa: 2');
  });

  test('ocultar pide motivo', async () => {
    mockGetAdmin.mockResolvedValue(paginaAdmin([deAdmin()]));
    await montar(<AdminResenasScreen />);

    await tocar('Ocultar');
    expect(ocultarResena).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith('Falta el motivo', 'Escribe por qué la ocultas.');

    await escribir('  Insultos  ');
    await tocar('Ocultar');

    expect(ocultarResena).toHaveBeenCalledWith('t', 9, 'Insultos');
    expect(mockGetAdmin).toHaveBeenCalledTimes(2);
  });

  test('una oculta se restaura con motivo', async () => {
    mockGetAdmin.mockResolvedValue(
      paginaAdmin([
        deAdmin({
          oculta: true,
          reportes: [],
          historial: [{ accion: 'ocultar', motivo: 'Insultos', admin: 'Ada Admin', fecha: '02/11/2026' }],
        }),
      ]),
    );
    await montar(<AdminResenasScreen />);

    expect(textos()).toContain('Oculta · 02/11/2026 · Ada Admin\nInsultos');
    expect(textos()).not.toContain('Ocultar');
    expect(textos()).not.toContain('Dejar publicada');

    await escribir('Era válida');
    await tocar('Restaurar');

    expect(restaurarResena).toHaveBeenCalledWith('t', 9, 'Era válida');
  });

  test('una reseña reportada se puede dejar publicada', async () => {
    mockGetAdmin.mockResolvedValue(paginaAdmin([deAdmin()]));
    await montar(<AdminResenasScreen />);

    await tocar('Dejar publicada');

    expect(descartarReportesResena).toHaveBeenCalledWith('t', 9);
  });

  test('cambiar de pestaña pide esa lista', async () => {
    mockGetAdmin.mockResolvedValue(paginaAdmin([]));
    await montar(<AdminResenasScreen />);

    await tocar('Ocultas (0)');

    expect(mockGetAdmin).toHaveBeenLastCalledWith('t', 'ocultas');
    expect(raiz.root.findByType(FlatList).props.data).toEqual([]);
    expect(textos()).toContain('No hay reseñas en esta lista.');
  });
});
