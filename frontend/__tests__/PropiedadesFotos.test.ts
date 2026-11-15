/**
 * Las fotos de una propiedad se suben de a una: varias fotos del celular en
 * una sola petición pasan del límite del servidor (413).
 */
import { ApiError, DatosPropiedad, guardarPropiedad } from '../src/api';

const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

const datos: DatosPropiedad = {
  tipo: 'venta', titulo: 'Casa', descripcion: 'x', precio: 1000, negociable: false, direccion: 'Calle 1 # 2-3',
  barrio: 'Centro', lat: 11.38, lng: -72.24, habitaciones: 2, banos: 1, area_m2: null, estrato: null, capacidad: null,
  caracteristicas: [], condiciones: null, contacto_nombre: 'Ana', contacto_telefono: '3001234567', galeria: [], disponible: true,
};

const respuesta = (status: number, cuerpo: unknown) =>
  Promise.resolve({ ok: status < 400, status, json: async () => cuerpo } as Response);

/** Qué campos lleva cada petición multipart. */
function campos(llamada: unknown[]): string[] {
  // FormData de React Native (getParts) o el de Node (keys).
  const form = (llamada[1] as RequestInit).body as unknown as { getParts?: () => { fieldName: string }[]; keys?: () => Iterable<string> };
  return form.getParts ? form.getParts().map(p => p.fieldName) : Array.from(form.keys!());
}

test('publica con la primera foto y sube las demás una por una', async () => {
  const propiedad = (n: number) => ({ propiedad: { id: 5, titulo: 'Casa', galeria: Array(n).fill('/storage/f.jpg') } });
  const fetchMock = jest.fn()
    .mockReturnValueOnce(respuesta(201, propiedad(1)))
    .mockReturnValueOnce(respuesta(200, propiedad(2)))
    .mockReturnValueOnce(respuesta(200, propiedad(3)));
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const avance = jest.fn();
  const r = await guardarPropiedad('t', datos, undefined, ['file:///a.jpg', 'file:///b.jpg', 'file:///c.jpg'], avance);

  expect(avance.mock.calls).toEqual([[0, 3], [1, 3], [2, 3]]);

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/propiedades$/);
  expect(campos(fetchMock.mock.calls[0]).filter(c => c.startsWith('imagenes'))).toEqual(['imagenes[0]']);
  expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/propiedades\/5\/fotos$/);
  expect(campos(fetchMock.mock.calls[1])).toEqual(['foto']);
  expect(r).toEqual({ propiedad: propiedad(3).propiedad, fotosFallidas: 0 });
});

test('al editar con fotos guardadas, los datos van sin fotos; una foto que falla no tumba lo guardado', async () => {
  const fetchMock = jest.fn()
    .mockReturnValueOnce(respuesta(200, { propiedad: { id: 9, galeria: ['/storage/vieja.jpg'] } }))
    .mockReturnValueOnce(respuesta(413, {}))
    .mockReturnValueOnce(respuesta(200, { propiedad: { id: 9, galeria: ['/storage/vieja.jpg', '/storage/n.jpg'] } }));
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  const r = await guardarPropiedad('t', { ...datos, galeria: ['/storage/vieja.jpg'] }, 9, ['file:///x.jpg', 'file:///y.jpg']);

  expect(campos(fetchMock.mock.calls[0])).toContain('_method');
  expect(campos(fetchMock.mock.calls[0]).some(c => c.startsWith('imagenes'))).toBe(false);
  expect(r.fotosFallidas).toBe(1);
  expect(r.propiedad.galeria).toHaveLength(2);
});

test('si el servidor corta la petición por tamaño, el mensaje lo explica', async () => {
  globalThis.fetch = jest.fn(() => respuesta(413, null)) as unknown as typeof fetch;
  const error = await guardarPropiedad('t', datos, undefined, ['file:///a.jpg']).catch(e => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.message).toContain('pesan demasiado');
});
