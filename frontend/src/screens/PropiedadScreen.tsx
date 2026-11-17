import { useLectura } from '../useLectura';
/**
 * Detalle de una propiedad: fotos, precio, datos clave (habitaciones, baños,
 * área o capacidad), descripción, características, condiciones, dónde queda
 * en el mapa y, abajo y siempre a la vista, llamar o escribir por WhatsApp a
 * quien la publicó. El dueño ve además «Editar».
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPropiedad, imagenUrl, Propiedad } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import { telefonoInternacional } from '../components/BotonesContacto';
import Icon, { IconName } from '../components/Icon';
import { colorPropiedad, MapaVitrina, PinPropiedad, vistaDe, ZOOM } from '../components/Mapa';
import { comoLlegar } from '../comoLlegar';
import { messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { haceCuantoPublicada, periodoPrecio, pesos, tipoPropiedad } from '../propiedades';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'Propiedad'>;

const TITULO_CONDICIONES = {
  venta: 'Condiciones de la venta',
  alquiler: 'Requisitos para arrendar',
  eventos: 'Condiciones del alquiler',
} as const;

export default function PropiedadScreen({ navigation, route }: Props) {
  const { id } = route.params;
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const token = auth!.token;
  const [propiedad, setPropiedad] = useState<Propiedad | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    getPropiedad(token, id)
      .then(p => {
        setPropiedad(p);
        setError(null);
        navigation.setOptions({ title: tipoPropiedad(p.tipo).texto });
      })
      .catch(e => setError(messageFromError(e, 'No se pudo cargar la propiedad.')));
  }, [token, id, navigation]);

  useLectura(cargar, [cargar]);
  // Si el dueño cambia el precio o la oculta, se ve aquí.
  usePolling(cargar, 60000, ['propiedades']);

  if (!propiedad) {
    return (
      <View style={styles.centro}>
        {error ? (
          <>
            <Icon name="casa" size={32} color={c.chevron} />
            <Text style={styles.errorTxt}>{error}</Text>
            <PressableScale style={styles.reintentar} onPress={cargar}>
              <Text style={styles.reintentarTxt}>Reintentar</Text>
            </PressableScale>
          </>
        ) : (
          <ActivityIndicator size="large" color={c.accent} />
        )}
      </View>
    );
  }

  const p = propiedad;
  const tipo = tipoPropiedad(p.tipo);
  const punto = { lat: p.lat, lng: p.lng };
  const datos: { icono: IconName; valor: string; etiqueta: string }[] =
    p.tipo === 'eventos'
      ? [
          { icono: 'usuarios', valor: p.capacidad ? String(p.capacidad) : '—', etiqueta: 'Personas' },
          ...(p.area_m2 ? [{ icono: 'area' as IconName, valor: `${p.area_m2} m²`, etiqueta: 'Área' }] : []),
        ]
      : [
          { icono: 'cama', valor: String(p.habitaciones ?? '—'), etiqueta: p.habitaciones === 1 ? 'Habitación' : 'Habitaciones' },
          { icono: 'ducha', valor: String(p.banos ?? '—'), etiqueta: p.banos === 1 ? 'Baño' : 'Baños' },
          ...(p.area_m2 ? [{ icono: 'area' as IconName, valor: `${p.area_m2} m²`, etiqueta: 'Área' }] : []),
          ...(p.estrato ? [{ icono: 'escudo' as IconName, valor: String(p.estrato), etiqueta: 'Estrato' }] : []),
        ];
  const mensaje = `Hola, vi en Vitrina tu ${tipo.texto.toLowerCase()} «${p.titulo}» (${pesos(p.precio)}${periodoPrecio(p.tipo)}). ¿Sigue disponible?`;

  async function abrir(url: string, que: string) {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(`No se pudo abrir ${que}`, p.contacto_telefono);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        <Galeria fotos={p.galeria} icono={tipo.icono} />

        <View style={styles.cuerpo}>
          {p.es_mia && (
            <View style={styles.mia}>
              <Icon name="usuario" size={16} color={c.goldText} />
              <Text style={styles.miaTxt}>
                {p.disponible ? 'Es tu propiedad. Así la ven los clientes.' : 'Es tu propiedad y está oculta: los clientes no la ven.'}
              </Text>
              <PressableScale onPress={() => navigation.navigate('EditarPropiedad', { id: p.id })} hitSlop={8}>
                <Text style={styles.miaAccion}>Editar</Text>
              </PressableScale>
            </View>
          )}

          <View style={styles.filaTipo}>
            <View style={[styles.tipo, { borderColor: colorPropiedad(c, p.tipo) }]}>
              <Icon name={tipo.icono} size={13} color={colorPropiedad(c, p.tipo)} strokeWidth={2.4} />
              <Text style={styles.tipoTxt}>{tipo.texto}</Text>
            </View>
            {!!p.publicada_at && <Text style={styles.publicada}>Publicada {haceCuantoPublicada(p.publicada_at)}</Text>}
          </View>

          <Text style={styles.precio}>
            {pesos(p.precio)}
            <Text style={styles.periodo}>{periodoPrecio(p.tipo)}</Text>
          </Text>
          {p.negociable && <Text style={styles.negociable}>Precio negociable</Text>}
          <Text style={styles.titulo}>{p.titulo}</Text>
          <View style={styles.direccion}>
            <Icon name="ubicacion" size={15} color={c.muted} />
            <Text style={styles.direccionTxt}>{[p.direccion, p.barrio].join(' · ')}</Text>
          </View>

          <View style={styles.datos}>
            {datos.map(d => (
              <View key={d.etiqueta} style={styles.dato}>
                <Icon name={d.icono} size={20} color={c.accent} strokeWidth={1.9} />
                <Text style={styles.datoValor}>{d.valor}</Text>
                <Text style={styles.datoEtiqueta}>{d.etiqueta}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.seccion}>Descripción</Text>
          <Text style={styles.texto}>{p.descripcion}</Text>

          {p.caracteristicas.length > 0 && (
            <>
              <Text style={styles.seccion}>{p.tipo === 'eventos' ? 'Qué incluye' : 'Características'}</Text>
              <View style={styles.chips}>
                {p.caracteristicas.map(car => (
                  <View key={car} style={styles.chip}>
                    <Icon name="check" size={13} color={c.success} strokeWidth={2.6} />
                    <Text style={styles.chipTxt}>{car}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {!!p.condiciones && (
            <>
              <Text style={styles.seccion}>{TITULO_CONDICIONES[p.tipo]}</Text>
              <Text style={styles.texto}>{p.condiciones}</Text>
            </>
          )}

          <Text style={styles.seccion}>Ubicación</Text>
          <View style={styles.mapa} pointerEvents="none">
            <MapaVitrina style={styles.lleno} vistaInicial={vistaDe(punto, ZOOM.barrio)} vista={vistaDe(punto, ZOOM.barrio)} quieto recortado>
              <PinPropiedad punto={punto} tipo={p.tipo} precio={p.precio} nombre={p.titulo} seleccionado />
            </MapaVitrina>
          </View>
          <View style={styles.botonesMapa}>
            <PressableScale
              style={styles.secundario}
              onPress={() =>
                comoLlegar(
                  { punto, nombre: p.titulo, tipo: 'propiedad', detalle: [p.direccion, p.barrio].filter(Boolean).join(' · ') },
                  { elegirModo: true },
                )
              }>
              <Icon name="ubicacion" size={15} color={c.text} />
              <Text style={styles.secundarioTxt}>Cómo llegar</Text>
            </PressableScale>
            <PressableScale style={styles.secundario} onPress={() => navigation.navigate('MapaPropiedades')}>
              <Icon name="mapa" size={15} color={c.text} />
              <Text style={styles.secundarioTxt}>Ver otras cerca</Text>
            </PressableScale>
          </View>

          <Text style={styles.seccion}>Publicado por</Text>
          <View style={styles.contacto}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{p.contacto_nombre.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.lleno}>
              <Text style={styles.contactoNombre}>{p.contacto_nombre}</Text>
              <Text style={styles.contactoTel}>{p.contacto_telefono}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Contacto siempre a la vista. */}
      <View style={[styles.barra, { paddingBottom: insets.bottom + 12 }]}>
        <PressableScale
          style={styles.llamar}
          onPress={() => abrir(`tel:${p.contacto_telefono}`, 'el marcador')}
          accessibilityLabel={`Llamar a ${p.contacto_nombre}`}>
          <Icon name="telefono" size={18} color={c.textStrong} />
          <Text style={styles.llamarTxt}>Llamar</Text>
        </PressableScale>
        <PressableScale
          style={styles.whatsapp}
          onPress={() => abrir(`https://wa.me/${telefonoInternacional(p.contacto_telefono)}?text=${encodeURIComponent(mensaje)}`, 'WhatsApp')}
          accessibilityLabel={`Escribir por WhatsApp a ${p.contacto_nombre}`}>
          <Icon name="whatsapp" size={18} color={c.onBrand} />
          <Text style={styles.whatsappTxt}>Escribir por WhatsApp</Text>
        </PressableScale>
      </View>
    </View>
  );
}

/** Fotos de lado a lado, una por pantalla, con el contador. */
function Galeria({ fotos, icono }: { fotos: string[]; icono: IconName }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [actual, setActual] = useState(0);
  const alto = Math.round(width * 0.72);

  if (fotos.length === 0) {
    return (
      <View style={[styles.galeriaVacia, { height: alto }]}>
        <Icon name={icono} size={48} color={c.mutedSoft} />
      </View>
    );
  }

  function alDeslizar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setActual(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <View>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={alDeslizar}>
        {fotos.map((f, i) => (
          <Image
            key={`${f}-${i}`}
            source={{ uri: imagenUrl(f) }}
            style={{ width, height: alto, backgroundColor: c.surface2 }}
            resizeMode="cover"
            accessibilityLabel={`Foto ${i + 1} de ${fotos.length}`}
          />
        ))}
      </ScrollView>
      {fotos.length > 1 && (
        <>
          <View style={styles.contador}>
            <Text style={styles.contadorTxt}>{actual + 1}/{fotos.length}</Text>
          </View>
          <View style={styles.puntos}>
            {fotos.map((f, i) => (
              <View key={`${f}-p${i}`} style={[styles.punto, i === actual && styles.puntoActivo]} />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: c.bg },
  errorTxt: { color: c.text, fontFamily: font.medium, fontSize: 15, textAlign: 'center' },
  reintentar: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: c.brand },
  reintentarTxt: { color: c.onBrand, fontFamily: font.bold },
  lleno: { flex: 1 },
  galeriaVacia: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
  contador: {
    position: 'absolute', right: 14, top: 14, backgroundColor: 'rgba(15,13,10,0.62)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  contadorTxt: { color: '#FFFFFF', fontFamily: font.semibold, fontSize: 12 },
  puntos: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  punto: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.55)' },
  puntoActivo: { backgroundColor: '#FFFFFF', width: 18 },
  cuerpo: { padding: 20 },
  mia: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.accentSoft,
    borderRadius: radius.md, padding: 12, marginBottom: 16,
  },
  miaTxt: { flex: 1, color: c.text, fontFamily: font.medium, fontSize: 13 },
  miaAccion: { color: c.goldText, fontFamily: font.bold, fontSize: 14 },
  filaTipo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  tipo: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tipoTxt: { color: c.textStrong, fontFamily: font.semibold, fontSize: 12 },
  publicada: { color: c.muted, fontFamily: font.regular, fontSize: 12 },
  precio: { color: c.textStrong, fontFamily: font.displayExtra, fontSize: 28, marginTop: 12 },
  periodo: { color: c.muted, fontFamily: font.medium, fontSize: 15 },
  negociable: { color: c.goldText, fontFamily: font.semibold, fontSize: 13, marginTop: 2 },
  titulo: { color: c.textStrong, fontFamily: font.displaySemi, fontSize: 19, lineHeight: 25, marginTop: 8 },
  direccion: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  direccionTxt: { flex: 1, color: c.muted, fontFamily: font.regular, fontSize: 14 },
  datos: { flexDirection: 'row', gap: 10, marginTop: 18 },
  dato: {
    flex: 1, alignItems: 'center', gap: 3, paddingVertical: 12, borderRadius: radius.lg,
    backgroundColor: c.surface, ...shadow.soft,
  },
  datoValor: { color: c.textStrong, fontFamily: font.display, fontSize: 16, marginTop: 2 },
  datoEtiqueta: { color: c.muted, fontFamily: font.regular, fontSize: 11.5 },
  seccion: { color: c.textStrong, fontFamily: font.displaySemi, fontSize: 16, marginTop: 24, marginBottom: 8 },
  texto: { color: c.text, fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: radius.pill, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  chipTxt: { color: c.text, fontFamily: font.medium, fontSize: 13 },
  mapa: { height: 170, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface2 },
  botonesMapa: { flexDirection: 'row', gap: 10, marginTop: 10 },
  secundario: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingVertical: 11,
  },
  secundarioTxt: { color: c.text, fontFamily: font.semibold, fontSize: 14 },
  contacto: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg,
    backgroundColor: c.surface, ...shadow.soft,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: c.onAccent, fontFamily: font.displayExtra, fontSize: 17 },
  contactoNombre: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15 },
  contactoTel: { color: c.muted, fontFamily: font.regular, fontSize: 13, marginTop: 1 },
  barra: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, ...shadow.card,
  },
  llamar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, paddingVertical: 14,
  },
  llamarTxt: { color: c.textStrong, fontFamily: font.bold, fontSize: 15 },
  whatsapp: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: radius.md, backgroundColor: c.brand, paddingVertical: 14,
  },
  whatsappTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
}));
