import { getTarifaDomicilio } from '../src/api';

const fetchAnterior = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchAnterior; });
test.each([undefined, null, '', ' ', true, false, [], {}, -1, 'no disponible'])('una tarifa inválida (%s) nunca se convierte en domicilio gratis', async tarifa => {
  globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ tarifa_domicilio: tarifa }) })) as any;
  await expect(getTarifaDomicilio('t')).rejects.toThrow('tarifa de domicilio válida');
});
test.each([0, 4000, '4000'])('una tarifa válida (%s) sí se puede mostrar', async tarifa => {
  globalThis.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ tarifa_domicilio: tarifa }) })) as any;
  await expect(getTarifaDomicilio('t')).resolves.toBe(Number(tarifa));
});
