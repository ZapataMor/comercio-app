/**
 * Mapa de Propiedades: solo casas en venta, casas en alquiler y patios para
 * eventos (nada de negocios), cada una con su precio en el pin. Arriba, sus
 * propios filtros: tipo, precio (los topes cambian con el tipo) y
 * habitaciones (solo para casas). Tocar un pin muestra su tarjeta.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPropiedadesMapa, imagenUrl, PropiedadResumen, TipoPropiedad } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { abrirComoLlegar, MapaRef, MapaVitrina, PinPropiedad, ZOOM } from '../components/Mapa';
import MenuDesplegable, { OpcionMenu } from '../components/MenuDesplegable';
import { RootStackParamList } from '../navTypes';
import {
  datosClave,
  FILTRO_TIPOS,
  filtrarPropiedades,
  HABITACIONES,
  periodoPrecio,
  pesos,
  precioCorto,
  rangosPrecio,
  tipoPropiedad,
} from '../propiedades';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { miUbicacion, pedirPermisoUbicacion } from '../ubicacion';
import { usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'MapaPropiedades'>;

/** Alto de la tarjeta de abajo: los botones flotantes suben por encima. */
const ALTO_TARJETA = 190;

export default function MapaPropiedadesScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const token = auth!.token;
  const mapa = useRef<MapaRef>(null);
  const [propiedades, setPropiedades] = useState<PropiedadResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tipo, setTipo] = useState<TipoPropiedad | null>(null);
  const [precioMax, setPrecioMax] = useState<number | null>(null);
  const [habitaciones, setHabitaciones] = useState(0);
  const [seleccion, setSeleccion] = useState<PropiedadResumen | null>(null);
  const [conPermiso, setConPermiso] = useState(false);
  const [ubicando, setUbicando] = useState(false);

  useEffect(() => {
    getPropiedadesMapa(token)
      .then(setPropiedades)
      .catch(e => toast.error('No se pudo cargar el mapa', e instanceof Error ? e.message : 'Error'))
      .finally(() => setCargando(false));
  }, [token, toast]);

  // Alguien publicó o vendió una: el pin aparece o se va.
  usePolling(() => {
    getPropiedadesMapa(token)
      .then(lista => {
        setPropiedades(lista);
        setSeleccion(s => (s ? lista.find(p => p.id === s.id) ?? null : s));
      })
      .catch(() => {});
  }, 30000, ['propiedades']);

  // El punto azul de la persona, si ya dio el permiso.
  useEffect(() => {
    pedirPermisoUbicacion().then(si => si && setConPermiso(true)).catch(() => {});
  }, []);

  const visibles = useMemo(
    () => filtrarPropiedades(propiedades, { tipo, precioMax, habitaciones }),
    [propiedades, tipo, precioMax, habitaciones],
  );

  // Si la de la tarjeta queda fuera del filtro, se cierra la tarjeta.
  useEffect(() => {
    setSeleccion(s => (s && !visibles.some(p => p.id === s.id) ? null : s));
  }, [visibles]);

  function elegirTipo(nuevo: TipoPropiedad | null) {
    setTipo(nuevo);
    // Los topes de precio son de cada tipo, y a un patio no se le piden habitaciones.
    setPrecioMax(null);
    if (nuevo === 'eventos') setHabitaciones(0);
  }

  async function centrarEnMi() {
    setUbicando(true);
    try {
      if (!(await pedirPermisoUbicacion())) {
        toast.error('Sin permiso', 'Activa la ubicación de Vitrina en los ajustes del celular.');
        return;
      }
      setConPermiso(true);
      mapa.current?.irA(await miUbicacion(), ZOOM.zona);
    } catch (e) {
      toast.error('No se pudo ubicar', e instanceof Error ? e.message : 'Error');
    } finally {
      setUbicando(false);
    }
  }

  const abajo = insets.bottom + 20;
  const tipoActual = FILTRO_TIPOS.find(t => t.valor === tipo)!;
  const rangos = tipo ? rangosPrecio(tipo) : [];
  const filtrando = tipo != null || precioMax != null || habitaciones > 0;

  return (
    <View style={styles.container}>
      <MapaVitrina
        ref={mapa}
        style={styles.lleno}
        miUbicacion={conPermiso}
        creditos={{ bottom: abajo + (seleccion ? ALTO_TARJETA : 0), left: 12 }}
        onPress={() => setSeleccion(null)}>
        {visibles.map(p => (
          <PinPropiedad
            key={p.id}
            punto={p}
            tipo={p.tipo}
            precio={p.precio}
            nombre={p.titulo}
            seleccionado={seleccion?.id === p.id}
            onPress={() => setSeleccion(p)}
          />
        ))}
      </MapaVitrina>

      <View style={styles.arriba} pointerEvents="box-none">
        <View style={styles.filaArriba} pointerEvents="box-none">
          <MenuDesplegable
            icono={tipoActual.icono}
            texto={tipo ? tipoActual.texto : 'Tipo'}
            etiqueta="Filtrar por tipo de propiedad"
            alinear="izquierda"
            ancho={210}
            renglones={elegir =>
              FILTRO_TIPOS.map(t => (
                <OpcionMenu
                  key={t.texto}
                  icono={t.icono}
                  titulo={t.valor ? tipoPropiedad(t.valor).texto : 'Todas'}
                  activa={tipo === t.valor}
                  onPress={() => elegir(() => elegirTipo(t.valor))}
                />
              ))
            }
          />
          {!!tipo && (
            <MenuDesplegable
              key={`precio-${tipo}`}
              icono="efectivo"
              texto={precioMax ? `Hasta ${precioCorto(precioMax)}` : 'Precio'}
              etiqueta="Filtrar por precio"
              alinear="izquierda"
              ancho={210}
              renglones={elegir =>
                rangos.map(r => (
                  <OpcionMenu
                    key={r.texto}
                    icono="efectivo"
                    titulo={r.texto}
                    activa={precioMax === r.max}
                    onPress={() => elegir(() => setPrecioMax(r.max))}
                  />
                ))
              }
            />
          )}
          {tipo !== 'eventos' && (
            <MenuDesplegable
              icono="cama"
              texto={habitaciones ? `${habitaciones}+ hab` : 'Habitaciones'}
              etiqueta="Filtrar por habitaciones"
              alinear="izquierda"
              ancho={190}
              renglones={elegir =>
                HABITACIONES.map(h => (
                  <OpcionMenu
                    key={h.valor}
                    icono="cama"
                    titulo={h.texto}
                    activa={habitaciones === h.valor}
                    onPress={() => elegir(() => setHabitaciones(h.valor))}
                  />
                ))
              }
            />
          )}
          {cargando && <ActivityIndicator size="small" color={c.accent} />}
        </View>
        {!cargando && propiedades.length === 0 && (
          <View style={styles.vacio}>
            <Icon name="casa" size={20} color={c.muted} />
            <Text style={styles.vacioTxt}>Aún no hay propiedades publicadas. Publica la tuya desde «Mis propiedades».</Text>
          </View>
        )}
        {!cargando && propiedades.length > 0 && visibles.length === 0 && (
          <View style={styles.vacio}>
            <Icon name="casa" size={20} color={c.muted} />
            <Text style={styles.vacioTxt}>Ninguna propiedad cumple esos filtros.</Text>
            {filtrando && (
              <TouchableOpacity hitSlop={8} onPress={() => { elegirTipo(null); setHabitaciones(0); }}>
                <Text style={styles.vacioAccion}>Quitar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.miUbicacion, { bottom: abajo + (seleccion ? ALTO_TARJETA : 0) }]}
        onPress={centrarEnMi}
        disabled={ubicando}
        accessibilityLabel="Ir a mi ubicación">
        {ubicando ? <ActivityIndicator color={c.accent} /> : <Icon name="ubicacion" size={20} color={c.accent} />}
      </TouchableOpacity>

      {!!seleccion && (
        <FadeInView key={seleccion.id} style={[styles.tarjeta, { bottom: abajo }]}>
          <TarjetaMapa
            propiedad={seleccion}
            onVer={() => navigation.navigate('Propiedad', { id: seleccion.id, titulo: seleccion.titulo })}
          />
        </FadeInView>
      )}
    </View>
  );
}

function TarjetaMapa({ propiedad: p, onVer }: { propiedad: PropiedadResumen; onVer: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const uri = imagenUrl(p.foto);
  const tipo = tipoPropiedad(p.tipo);
  return (
    <>
      <PressableScale style={styles.fila} scaleTo={0.98} onPress={onVer}>
        {uri ? (
          <Image source={{ uri }} style={styles.foto} />
        ) : (
          <View style={[styles.foto, styles.fotoVacia]}>
            <Icon name={tipo.icono} size={24} color={c.muted} />
          </View>
        )}
        <View style={styles.lleno}>
          <Text style={styles.tipoTxt}>{tipo.texto}</Text>
          <Text style={styles.precio}>
            {pesos(p.precio)}
            <Text style={styles.periodo}>{periodoPrecio(p.tipo)}</Text>
          </Text>
          <Text style={styles.nombre} numberOfLines={1}>{p.titulo}</Text>
          <Text style={styles.sub} numberOfLines={1}>{[datosClave(p), p.barrio].filter(Boolean).join(' · ')}</Text>
        </View>
      </PressableScale>
      <View style={styles.botones}>
        <PressableScale style={styles.secundario} onPress={() => abrirComoLlegar(p)}>
          <Icon name="ubicacion" size={15} color={c.text} />
          <Text style={styles.secundarioTxt}>Cómo llegar</Text>
        </PressableScale>
        <PressableScale style={styles.primario} onPress={onVer}>
          <Icon name={tipo.icono} size={15} color={c.onBrand} />
          <Text style={styles.primarioTxt}>Ver detalles</Text>
        </PressableScale>
      </View>
    </>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  lleno: { flex: 1 },
  arriba: { position: 'absolute', top: 12, left: 0, right: 0, gap: 8 },
  filaArriba: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  vacio: {
    marginHorizontal: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10,
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, ...shadow.card,
  },
  vacioTxt: { flex: 1, color: c.text, fontFamily: font.regular, fontSize: 13 },
  vacioAccion: { color: c.goldText, fontFamily: font.semibold, fontSize: 13 },
  miUbicacion: {
    position: 'absolute', right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: c.surface,
    alignItems: 'center', justifyContent: 'center', ...shadow.card,
  },
  tarjeta: {
    position: 'absolute', left: 12, right: 12, backgroundColor: c.surface, borderRadius: radius.lg,
    padding: 14, ...shadow.card,
  },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foto: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: c.surface2 },
  fotoVacia: { alignItems: 'center', justifyContent: 'center' },
  tipoTxt: { color: c.muted, fontFamily: font.semibold, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  precio: { color: c.textStrong, fontFamily: font.display, fontSize: 18, marginTop: 1 },
  periodo: { color: c.muted, fontFamily: font.medium, fontSize: 12.5 },
  nombre: { color: c.textStrong, fontFamily: font.semibold, fontSize: 14, marginTop: 1 },
  sub: { color: c.muted, fontFamily: font.regular, fontSize: 12, marginTop: 2 },
  botones: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secundario: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingVertical: 11,
  },
  secundarioTxt: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  primario: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 11,
  },
  primarioTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 14 },
}));
