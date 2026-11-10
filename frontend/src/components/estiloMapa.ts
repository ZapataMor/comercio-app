/**
 * Estilo del mapa de Vitrina: calles de OpenStreetMap pintadas con la paleta
 * de la app (día crema / noche índigo).
 *
 * Los datos son las teselas vectoriales de OpenFreeMap (gratis, sin clave ni
 * registro; esquema OpenMapTiles). Para servir el mapa desde un archivo o un
 * servidor propio basta con cambiar FUENTE y LETRAS: las capas no cambian.
 *
 * A propósito NO se dibujan los comercios del mapa base: en el mapa solo
 * resaltan los negocios de Vitrina.
 */
import type { StyleSpecification } from '@maplibre/maplibre-react-native';
import { Colores, paletas } from '../theme';
import type { ModoVitrina } from './Logo';

const FUENTE = 'https://tiles.openfreemap.org/planet';
const LETRAS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

type Capas = StyleSpecification['layers'];
type Capa = Capas[number];
type Filtro = Exclude<Extract<Capa, { type: 'line' }>['filter'], undefined>;

/**
 * Colores que la paleta de la app no trae: verde, agua, avenidas y el tono de
 * las calles vistas de lejos (un hilo fino necesita más contraste con el suelo).
 */
const EXTRA: Record<ModoVitrina, { verde: string; agua: string; avenida: string; lejos: string }> = {
  dia: { verde: '#DDE8CF', agua: '#BCD9E6', avenida: '#FBE7BD', lejos: '#CDC2B0' },
  noche: { verde: '#1E2A45', agua: '#141833', avenida: '#3E4675', lejos: '#3E4675' },
};

/** Ancho de vía que crece con el zoom: [zoom, ancho] de menor a mayor. */
function ancho(...paradas: [number, number][]) {
  return ['interpolate', ['exponential', 1.5], ['zoom'], ...paradas.flat()] as unknown as number;
}

/** Solo las líneas de esas clases (las vías también traen plazas como polígonos). */
function vias(...clases: string[]): Filtro {
  return [
    'all',
    ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
    ['match', ['get', 'class'], clases, true, false],
  ] as unknown as Filtro;
}

const NOMBRE = ['coalesce', ['get', 'name:es'], ['get', 'name']] as unknown as string;

export function estiloMapa(c: Colores, modo: ModoVitrina): StyleSpecification {
  const x = EXTRA[modo];
  const dia = modo === 'dia';
  const suelo = dia ? c.surface2 : c.bg;
  const calle = dia ? c.surface : c.surface2;
  const borde = dia ? c.borderStrong : c.header;
  const edificio = dia ? c.border : c.surface;
  const halo = dia ? c.bg : c.header;
  const s = 'vitrina';

  // De lejos la calle es un hilo de color `lejos`; de cerca, una banda `calle` con borde.
  const calleSegunZoom = ['interpolate', ['linear'], ['zoom'], 13.2, x.lejos, 14.4, calle] as unknown as string;

  const linea = (
    id: string,
    filter: Filtro,
    color: string,
    width: number,
    minzoom = 0,
    extra: Record<string, unknown> = {},
  ): Capa => ({
    id,
    type: 'line',
    source: s,
    'source-layer': 'transportation',
    filter,
    minzoom,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': width, ...extra },
  });

  const texto = (
    id: string,
    capa: string,
    filter: Filtro | undefined,
    minzoom: number,
    color: string,
    layout: Record<string, unknown>,
  ): Capa =>
    ({
      id,
      type: 'symbol',
      source: s,
      'source-layer': capa,
      ...(filter ? { filter } : {}),
      minzoom,
      layout: { 'text-field': NOMBRE, 'text-font': ['Noto Sans Regular'], ...layout },
      paint: { 'text-color': color, 'text-halo-color': halo, 'text-halo-width': 1.4 },
    } as Capa);

  const layers: Capas = [
    { id: 'suelo', type: 'background', paint: { 'background-color': suelo } },
    // Solo parques y canchas de ciudad. La capa `park` no sirve aquí: trae el
    // resguardo indígena de la Guajira, que pinta de verde toda la región.
    {
      id: 'parque',
      type: 'fill',
      source: s,
      'source-layer': 'landcover',
      filter: ['match', ['get', 'subclass'], ['park', 'garden', 'village_green', 'recreation_ground'], true, false],
      paint: { 'fill-color': x.verde },
    },
    {
      id: 'cancha',
      type: 'fill',
      source: s,
      'source-layer': 'landuse',
      filter: ['match', ['get', 'class'], ['pitch', 'stadium', 'playground', 'cemetery'], true, false],
      paint: { 'fill-color': x.verde },
    },
    {
      id: 'agua',
      type: 'fill',
      source: s,
      'source-layer': 'water',
      paint: { 'fill-color': x.agua },
    },
    {
      id: 'arroyo',
      type: 'line',
      source: s,
      'source-layer': 'waterway',
      paint: { 'line-color': x.agua, 'line-width': ancho([11, 0.8], [18, 6]) },
    },
    {
      id: 'pista',
      type: 'line',
      source: s,
      'source-layer': 'aeroway',
      minzoom: 11,
      filter: vias('runway', 'taxiway'),
      paint: { 'line-color': edificio, 'line-width': ancho([11, 2], [17, 40]) },
    },
    {
      id: 'edificio',
      type: 'fill',
      source: s,
      'source-layer': 'building',
      minzoom: 14.5,
      paint: { 'fill-color': edificio, 'fill-opacity': dia ? 0.8 : 0.9 },
    },

    // Vías: primero todos los bordes, encima los rellenos (cruces limpios).
    linea('sendero', vias('path', 'track'), borde, ancho([14, 0.6], [18, 2.5]), 14, {
      'line-dasharray': [2, 2],
    }),
    linea('calle-borde', vias('minor', 'service'), borde, ancho([13.5, 1.6], [15, 6], [18, 24]), 13.5),
    linea('via-borde', vias('secondary', 'tertiary'), borde, ancho([10, 1.2], [15, 9], [18, 32]), 10),
    linea('avenida-borde', vias('primary', 'trunk', 'motorway'), borde, ancho([7, 1.4], [15, 11], [18, 36]), 7),
    linea('calle', vias('minor', 'service'), calleSegunZoom, ancho([11, 0.4], [13, 0.9], [15, 4.4], [18, 21]), 11),
    linea('via', vias('secondary', 'tertiary'), calle, ancho([10, 0.7], [15, 7], [18, 28]), 10),
    linea('avenida', vias('primary', 'trunk', 'motorway'), x.avenida, ancho([7, 0.8], [15, 9], [18, 32]), 7),
    linea('tren', vias('rail'), c.mutedSoft, ancho([12, 0.6], [18, 2]), 12, { 'line-dasharray': [4, 3] }),

    // La frontera con Venezuela pasa cerca de Maicao.
    {
      id: 'frontera',
      type: 'line',
      source: s,
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': c.mutedSoft, 'line-width': 1.2, 'line-dasharray': [3, 2] },
    },

    texto('numero', 'housenumber', undefined, 17, c.mutedSoft, {
      'text-field': ['get', 'housenumber'],
      'text-size': 10,
    }),
    texto('nombre-calle', 'transportation_name', vias('minor', 'service', 'path', 'track'), 14.5, c.muted, {
      'symbol-placement': 'line',
      'text-size': ['interpolate', ['linear'], ['zoom'], 14.5, 10, 18, 13],
      'symbol-spacing': 260,
    }),
    texto(
      'nombre-via',
      'transportation_name',
      vias('secondary', 'tertiary', 'primary', 'trunk', 'motorway'),
      12,
      c.text,
      {
        'symbol-placement': 'line',
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 18, 14],
        'symbol-spacing': 300,
      },
    ),
    texto(
      'barrio',
      'place',
      ['match', ['get', 'class'], ['suburb', 'neighbourhood', 'quarter', 'hamlet'], true, false],
      13,
      c.muted,
      { 'text-size': 11, 'text-transform': 'uppercase', 'text-letter-spacing': 0.08, 'text-max-width': 7 },
    ),
    texto('pueblo', 'place', ['match', ['get', 'class'], ['town', 'village'], true, false], 8, c.text, {
      'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 15],
      'text-max-width': 8,
    }),
    texto('ciudad', 'place', ['==', ['get', 'class'], 'city'], 4, c.textStrong, {
      'text-font': ['Noto Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 12, 17],
      'text-max-width': 8,
    }),
  ];

  return {
    version: 8,
    name: `Vitrina ${modo}`,
    glyphs: LETRAS,
    sources: { [s]: { type: 'vector', url: FUENTE } },
    layers,
  };
}

/** Ya serializados: el mapa nativo recibe el JSON tal cual, sin rehacerlo en cada render. */
export const ESTILOS_MAPA: Record<ModoVitrina, string> = {
  dia: JSON.stringify(estiloMapa(paletas.dia, 'dia')),
  noche: JSON.stringify(estiloMapa(paletas.noche, 'noche')),
};
