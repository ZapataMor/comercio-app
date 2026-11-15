/** Las fotos se achican en el teléfono antes de subirlas; si falla, va la original. */
import ImageResizer from '@bam.tech/react-native-image-resizer';
import { guardarServicio } from '../src/api';
import { comprimirFoto, LADO_MAXIMO_FOTO } from '../src/fotos';

const achicar = ImageResizer.createResizedImage as jest.Mock;
const fetchOriginal = globalThis.fetch;
afterEach(() => { globalThis.fetch = fetchOriginal; });

test('achica a 1600 px en JPEG sin agrandar las pequeñas', async () => {
  achicar.mockResolvedValueOnce({ uri: 'file:///cache/chica.jpg' });
  expect(await comprimirFoto('content://fotos/1')).toBe('file:///cache/chica.jpg');
  expect(achicar).toHaveBeenLastCalledWith('content://fotos/1', LADO_MAXIMO_FOTO, LADO_MAXIMO_FOTO, 'JPEG', 80, 0, null, false, {
    mode: 'contain',
    onlyScaleDown: true,
  });
});

test('si no se puede achicar, sube la original', async () => {
  achicar.mockRejectedValueOnce(new Error('formato no soportado'));
  expect(await comprimirFoto('content://fotos/raro')).toBe('content://fotos/raro');
});

test('toda subida de fotos de la app va achicada', async () => {
  achicar.mockImplementation(async (uri: string) => ({ uri: `${uri}-chica.jpg` }));
  globalThis.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ servicio: { id: 1 } }) })) as unknown as typeof fetch;
  // En Node el FormData convierte el {uri, name, type} de React Native en texto: se mira lo que se adjunta.
  const adjuntar = jest.spyOn(FormData.prototype, 'append');

  await guardarServicio('t', 3, { nombre: 'Corte', descripcion: 'x', galeria: [] }, undefined, ['content://a', 'content://b']);

  const uris = adjuntar.mock.calls.map(([, valor]) => valor as any).filter(v => v && typeof v === 'object' && 'uri' in v).map(v => v.uri);
  expect(uris).toEqual(['content://a-chica.jpg', 'content://b-chica.jpg']);
  adjuntar.mockRestore();
  achicar.mockReset();
});
