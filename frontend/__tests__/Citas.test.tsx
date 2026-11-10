import React from 'react';
import { Text, TextInput } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  actualizarCita,
  cancelarCita,
  getCitas,
  getDisponibilidadCitas,
  solicitarCita,
  registrarLlegadaCita,
} from '../src/api';
import { errorHorario } from '../src/components/EditorHorario';
import AgendarCitaScreen from '../src/screens/AgendarCitaScreen';
import CitasScreen from '../src/screens/CitasScreen';

jest.mock('../src/AuthContext', () => ({
  useAuth: () => ({ auth: { token: 'token', user: { id: 4 } } }),
}));
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getDisponibilidadCitas: jest.fn(),
  solicitarCita: jest.fn(),
  getCitas: jest.fn(),
  actualizarCita: jest.fn(),
  cancelarCita: jest.fn(),
  registrarLlegadaCita: jest.fn(),
}));
jest.mock('../src/NegocioContext', () => ({
  useNegocio: () => ({
    negocio: { id: 1, nombre: 'Salón' },
    negocios: [{ id: 1, nombre: 'Salón' }],
  }),
}));
const mockConfirmar = jest.fn();
jest.mock('../src/components/Confirmacion', () => ({
  useConfirmar: () => mockConfirmar,
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: (callback: () => void) => {
    require('react').useEffect(callback, [callback]);
  },
}));
jest.mock('../src/Toast', () => ({
  useToast: () => ({ exito: jest.fn(), error: jest.fn() }),
}));
jest.mock('../src/usePolling', () => ({ usePolling: () => {} }));
jest.mock('../src/citas', () => ({
  ...jest.requireActual('../src/citas'),
  hoyColombia: () => '2026-11-09',
}));

const disponible = {
  fecha: '2026-11-09',
  profesional_id: 2,
  profesionales: [
    { id: 2, nombre: 'Ana' },
    { id: 3, nombre: 'Luis' },
  ],
  horas: ['14:00', '15:00'],
  duracion_minutos: 60,
  mensaje: null,
};

test('volver a tocar la fecha seleccionada conserva sus horas disponibles', async () => {
  await montar();
  await tocarEtiqueta('Elegir 2026-11-09');
  expect(textos()).toContain('2:00 p. m.');
  expect(mockDisponibilidad).toHaveBeenCalledTimes(1);
});
const mockDisponibilidad = getDisponibilidadCitas as jest.Mock;
const mockSolicitar = solicitarCita as jest.Mock;
let raiz: ReactTestRenderer.ReactTestRenderer;
let navigation: { replace: jest.Mock };
async function montar(presencial = false) {
  navigation = { replace: jest.fn() };
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <AgendarCitaScreen
        {...({
          navigation,
          route: {
            params: {
              negocioId: 1,
              negocioNombre: 'Salón',
              servicio: { id: 8, nombre: 'Corte', duracion_minutos: 60 },
              presencial,
            },
          },
        } as any)}
      />,
    );
  });
}
const textos = () =>
  raiz.root
    .findAllByType(Text)
    .map(t => [t.props.children].flat(Infinity).join(''));
async function tocarEtiqueta(etiqueta: string) {
  const nodo = raiz.root.findAll(
    n =>
      n.props.accessibilityLabel === etiqueta &&
      typeof n.props.onPress === 'function',
  )[0];
  await act(async () => {
    await nodo.props.onPress();
  });
}
async function tocarTexto(texto: string) {
  const nodo = raiz.root.findAll(
    n =>
      typeof n.props.onPress === 'function' &&
      n.findAll(h => h.children.includes(texto)).length > 0,
  )[0];
  await act(async () => {
    await nodo.props.onPress();
  });
}
beforeEach(() => {
  jest.clearAllMocks();
  mockDisponibilidad.mockResolvedValue(disponible);
  mockSolicitar.mockResolvedValue({ estado: 'pendiente' });
});
afterEach(() => {
  if (raiz) act(() => raiz.unmount());
});

test('solicita la fecha, profesional y hora elegidos y abre Mis citas', async () => {
  await montar();
  expect(mockDisponibilidad).toHaveBeenCalledWith(
    'token',
    1,
    8,
    '2026-11-09',
    undefined,
  );
  await tocarEtiqueta('Elegir hora 14:00');
  await tocarTexto('Solicitar cita');
  expect(mockSolicitar).toHaveBeenCalledWith(
    'token',
    1,
    expect.objectContaining({
      servicio_id: 8,
      profesional_id: 2,
      hora: '14:00',
      fecha: '2026-11-09',
    }),
    false,
  );
  expect(navigation.replace).toHaveBeenCalledWith('MisCitas');
});

test('muestra un calendario alternativo cuando no hay horas y vuelve a consultar la fecha elegida', async () => {
  mockDisponibilidad.mockResolvedValue({ ...disponible, horas: [] });
  await montar();
  expect(textos().some(t => t.includes('No hay horas disponibles'))).toBe(true);
  await tocarEtiqueta('Elegir 2026-11-10');
  expect(mockDisponibilidad).toHaveBeenLastCalledWith(
    'token',
    1,
    8,
    '2026-11-10',
    undefined,
  );
  expect(mockSolicitar).not.toHaveBeenCalled();
});

test('cambiar de profesional borra la selección de hora anterior', async () => {
  await montar();
  await tocarEtiqueta('Elegir hora 14:00');
  mockDisponibilidad.mockResolvedValue({
    ...disponible,
    profesional_id: 3,
    horas: ['16:00'],
  });
  await tocarTexto('Luis');
  expect(mockDisponibilidad).toHaveBeenLastCalledWith(
    'token',
    1,
    8,
    '2026-11-09',
    3,
  );
  expect(textos()).not.toContain('2:00 p. m.');
  expect(mockSolicitar).not.toHaveBeenCalled();
});

test('un conflicto refresca las horas y conserva el mensaje para elegir otra', async () => {
  await montar();
  await tocarEtiqueta('Elegir hora 14:00');
  mockSolicitar.mockRejectedValueOnce(
    new Error('Ese horario ya está ocupado.'),
  );
  mockDisponibilidad.mockResolvedValue({ ...disponible, horas: ['15:00'] });
  await tocarTexto('Solicitar cita');
  expect(textos()).toContain('Ese horario ya está ocupado.');
  expect(navigation.replace).not.toHaveBeenCalled();
  expect(mockDisponibilidad).toHaveBeenCalledTimes(2);
});

test('una cita presencial exige el nombre y se registra como tal en la agenda del negocio', async () => {
  await montar(true);
  await tocarEtiqueta('Elegir hora 14:00');
  await tocarTexto('Registrar cita presencial');
  expect(textos()).toContain('Escribe el nombre del cliente.');
  expect(mockSolicitar).not.toHaveBeenCalled();
  await act(async () => {
    raiz.root
      .findAllByType(TextInput)
      .find(n => n.props.accessibilityLabel === 'Nombre del cliente')!
      .props.onChangeText('Cliente de mostrador');
  });
  await tocarTexto('Registrar cita presencial');
  expect(mockSolicitar).toHaveBeenCalledWith(
    'token',
    1,
    expect.objectContaining({ cliente_nombre: 'Cliente de mostrador' }),
    true,
  );
  expect(navigation.replace).toHaveBeenCalledWith('AgendaNegocio', {
    negocioId: 1,
  });
});

test('valida el almuerzo dentro del turno y admite descansos después de medianoche', () => {
  const horario = (abre: string, cierra: string, inicio: string, fin: string) =>
    ({ lun: { abre, cierra, almuerzo: { inicio, fin } } } as any);
  expect(errorHorario(horario('09:00', '18:00', '12:00', '13:00'))).toBeNull();
  expect(errorHorario(horario('09:00', '18:00', '12:00', '19:00'))).toContain(
    'dentro del horario',
  );
  expect(errorHorario(horario('09:00', '18:00', '14:00', '13:00'))).toContain(
    'en ese orden',
  );
  expect(errorHorario(horario('18:00', '03:00', '23:30', '00:30'))).toBeNull();
});

const cita = {
  id: 12,
  negocio_id: 1,
  negocio_nombre: 'Salón',
  servicio_nombre: 'Corte',
  profesional_nombre: 'Ana',
  cliente_nombre: 'Cliente',
  estado: 'pendiente',
  origen: 'app',
  fecha: '2026-11-10',
  fecha_fin: '2026-11-10',
  hora: '14:00',
  hora_fin: '15:00',
};
async function montarAgenda(gestion: boolean, cambios = {}) {
  (getCitas as jest.Mock).mockResolvedValue({
    citas: [{ ...cita, ...cambios }],
    pagina: 1,
    ultima_pagina: 1,
  });
  await act(async () => {
    raiz = ReactTestRenderer.create(
      <CitasScreen
        {...({
          navigation: { navigate: jest.fn() },
          route: {
            name: gestion ? 'AgendaNegocio' : 'MisCitas',
            params: gestion ? { negocioId: 1 } : undefined,
          },
        } as any)}
      />,
    );
  });
}

test('el negocio recibe la solicitud y confirma después del aviso sobre su agenda presencial', async () => {
  await montarAgenda(true);
  expect(getCitas).toHaveBeenCalledWith('token', 1, 1);
  expect(textos()).toContain('Pendiente de confirmación');
  await tocarTexto('Confirmar');
  const opciones = mockConfirmar.mock.calls[0][0];
  expect(opciones.texto).toContain('Revisa tu agenda presencial');
  await act(async () => {
    await opciones.accion();
  });
  expect(actualizarCita).toHaveBeenCalledWith(
    'token',
    1,
    12,
    'confirmada',
    undefined,
  );
});

test('el negocio comunica el motivo al rechazar', async () => {
  await montarAgenda(true);
  await tocarTexto('Rechazar');
  await act(async () => {
    raiz.root
      .findAllByType(TextInput)
      .find(n => n.props.accessibilityLabel === 'Motivo de la decisión')!
      .props.onChangeText('Ya tengo una cita presencial.');
  });
  await tocarTexto('Guardar decisión');
  expect(actualizarCita).toHaveBeenCalledWith(
    'token',
    1,
    12,
    'rechazada',
    'Ya tengo una cita presencial.',
  );
});

test('el cliente consulta y cancela su cita sin usar las acciones del negocio', async () => {
  await montarAgenda(false);
  expect(getCitas).toHaveBeenCalledWith('token', undefined, 1);
  await tocarTexto('Cancelar cita');
  await act(async () => {
    await mockConfirmar.mock.calls[0][0].accion();
  });
  expect(cancelarCita).toHaveBeenCalledWith('token', 12);
  expect(actualizarCita).not.toHaveBeenCalled();
});

test('el negocio registra la llegada de una cita confirmada', async () => {
  await montarAgenda(true, { estado: 'confirmada', llegada_at: null });
  await tocarTexto('Registrar llegada');
  await act(async () => { await mockConfirmar.mock.calls[0][0].accion(); });
  expect(registrarLlegadaCita).toHaveBeenCalledWith('token', 1, 12);
});

test('muestra No asistió y permite al cliente volver a los servicios para renovar', async () => {
  await montarAgenda(false, { estado: 'no_asistio', motivo: 'Cita cancelada automáticamente.' });
  expect(textos()).toContain('No asistió');
  expect(textos()).toContain('Solicitar nueva cita');
  expect(textos()).not.toContain('Cancelar cita');
  await tocarTexto('Solicitar nueva cita');
  const pantalla = raiz.root.findByType(CitasScreen);
  expect(pantalla.props.navigation.navigate).toHaveBeenCalledWith('Negocio', { id: 1, nombre: 'Salón', seccion: 'servicios' });
});
