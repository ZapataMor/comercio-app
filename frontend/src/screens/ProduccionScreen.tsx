/**
 * Producción (Vitrina Gestión) en la app: quien está en la fábrica o la
 * cocina elige lo que terminó y lo registra como hecho; los materiales se
 * descuentan solos del inventario. Qué gasta cada producto se define en la
 * web (Producción y materiales). Abajo, lo último que se registró.
 *
 * Solo se ve con el módulo encendido y permiso para registrar
 * (Negocio.puede_producir).
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { getProduccion, imagenUrl, ProduccionProducto, ProduccionResumen } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import ErrorCarga from '../components/ErrorCarga';
import Icon from '../components/Icon';
import { messageFromError } from '../formErrors';
import type { RootStackParamList } from '../navTypes';
import { useNegocio } from '../NegocioContext';
import { font, makeStyles, radius, useTheme } from '../theme';

/** 2,5 · 1.200 · 3 */
export function numero(n: number): string {
  const redondo = Math.round(n * 1000) / 1000;
  const [entero, decimales] = String(Math.abs(redondo)).split('.');
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (redondo < 0 ? '-' : '') + conPuntos + (decimales ? `,${decimales}` : '');
}

const DESTINO_TEXTO = { catalogo: 'Al catálogo', espera: 'En espera', pedido: 'De un encargo' } as const;

/** «hace 5 min», «hoy 3:20 p. m.», «24 nov» */
function cuando(fecha: string, ahora = new Date()): string {
  const d = new Date(fecha);
  const minutos = Math.round((ahora.getTime() - d.getTime()) / 60000);
  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `hace ${minutos} min`;
  const mismoDia = d.toDateString() === ahora.toDateString();
  const hora = `${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'a. m.' : 'p. m.'}`;
  if (mismoDia) return `hoy ${hora}`;
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d.getDate()} ${meses[d.getMonth()]}`;
}

export default function ProduccionScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { auth } = useAuth();
  const token = auth!.token;
  const { negocio } = useNegocio();
  const [datos, setDatos] = useState<ProduccionResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!negocio) return;
    try {
      setDatos(await getProduccion(token, negocio.id));
      setError(null);
    } catch (e) {
      setError(messageFromError(e));
    } finally {
      setRecargando(false);
    }
  }, [negocio, token]);

  // Al volver de registrar algo, la lista ya muestra lo que queda.
  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  if (error && !datos) return <ErrorCarga mensaje={error} reintentar={cargar} />;
  if (!datos) return <ActivityIndicator style={styles.cargando} size="large" color={c.accent} accessibilityLabel="Cargando producción" />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={() => { setRecargando(true); cargar(); }} />}>
      <Text style={styles.intro}>
        Elige lo que terminaste y regístralo. Los materiales se descuentan solos del inventario.
      </Text>

      {datos.en_espera > 0 && (
        <View style={styles.aviso}>
          <Icon name="reloj" size={16} color={c.goldText} />
          <Text style={styles.avisoTxt}>
            {datos.en_espera === 1 ? 'Hay 1 producto' : `Hay ${datos.en_espera} productos`} en espera de sus datos. Se completan en la web: Catálogo › En espera.
          </Text>
        </View>
      )}

      <Text style={styles.seccion} accessibilityRole="header">¿Qué terminaste?</Text>
      {datos.productos.length === 0 ? (
        <View style={styles.vacio}>
          <Text style={styles.vacioTxt}>Ningún producto tiene materiales todavía. Defínelos en la web, en «Producción y materiales».</Text>
        </View>
      ) : (
        datos.productos.map(p => <TarjetaProducto key={p.id} producto={p} onPress={() => navigation.navigate('RegistrarHecho', { producto: p })} />)
      )}

      {datos.recientes.length > 0 && (
        <>
          <Text style={styles.seccion} accessibilityRole="header">Lo último que se hizo</Text>
          <View style={styles.recientes}>
            {datos.recientes.map(r => (
              <View key={r.id} style={[styles.reciente, r.anulada && styles.anulada]}>
                <View style={styles.recienteIcono}>
                  <Icon name={r.origen === 'pedido' ? 'moto' : 'check'} size={15} color={c.success} />
                </View>
                <View style={styles.recienteCuerpo}>
                  <Text style={[styles.recienteTitulo, r.anulada && styles.tachado]}>{r.texto}</Text>
                  <Text style={styles.recienteDetalle}>
                    {cuando(r.fecha)}{r.quien ? ` · ${r.quien}` : ''}{r.anulada ? ' · anulada' : ''}{r.falto ? ' · faltó material' : ''}
                  </Text>
                </View>
                {!!r.destino && r.origen !== 'pedido' && <Text style={styles.chip}>{DESTINO_TEXTO[r.destino]}</Text>}
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function TarjetaProducto({ producto: p, onPress }: { producto: ProduccionProducto; onPress: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const foto = imagenUrl(p.imagen);
  const noAlcanza = p.alcanza === 0;
  return (
    <PressableScale
      style={styles.tarjeta}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Registrar ${p.nombre} como hecho`}>
      <View style={styles.foto}>
        {foto ? <Image source={{ uri: foto }} style={styles.fotoImg} /> : <Text style={styles.inicial}>{p.nombre.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.tarjetaCuerpo}>
        <Text style={styles.nombre} numberOfLines={2}>{p.nombre}</Text>
        <View style={styles.chips}>
          <Text style={[styles.chip, noAlcanza ? styles.chipPeligro : styles.chipExito]}>
            {noAlcanza ? 'No alcanza el material' : `Alcanza para ${numero(p.alcanza ?? 0)}`}
          </Text>
          {p.existencias !== null && <Text style={[styles.chip, styles.chipAcento]}>{numero(p.existencias)} en stock</Text>}
          {p.modo === 'pedido' && <Text style={styles.chip}>Se descuenta con cada pedido</Text>}
        </View>
        <Text style={styles.materiales} numberOfLines={1}>
          {p.materiales.length} {p.materiales.length === 1 ? 'material' : 'materiales'}: {p.materiales.map(m => m.nombre).join(', ')}
        </Text>
      </View>
      <Icon name="chevron" size={18} color={c.muted} />
    </PressableScale>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 40 },
  cargando: { marginTop: 60 },
  intro: { color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: c.accentSoft,
    borderRadius: radius.md, padding: 12, marginBottom: 14,
  },
  avisoTxt: { flex: 1, color: c.goldText, fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 8, marginBottom: 10 },
  vacio: { backgroundColor: c.surface, borderRadius: radius.md, padding: 18, alignItems: 'center', ...shadow.low },
  vacioTxt: { color: c.muted, fontSize: 14, fontFamily: font.regular, textAlign: 'center', lineHeight: 20 },
  tarjeta: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface,
    borderRadius: radius.md, padding: 12, marginBottom: 10, ...shadow.low,
  },
  foto: {
    width: 64, height: 64, borderRadius: 14, backgroundColor: c.surface2, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  fotoImg: { width: '100%', height: '100%' },
  inicial: { fontFamily: font.display, fontSize: 24, color: c.muted },
  tarjetaCuerpo: { flex: 1, gap: 5 },
  nombre: { fontFamily: font.bold, fontSize: 15, color: c.textStrong, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontFamily: font.semibold, fontSize: 12, color: c.muted, backgroundColor: c.bg,
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden',
  },
  chipExito: { color: c.success, backgroundColor: c.successSoft },
  chipPeligro: { color: c.danger, backgroundColor: c.dangerSoft },
  chipAcento: { color: c.goldText, backgroundColor: c.accentSoft },
  materiales: { fontFamily: font.regular, fontSize: 12, color: c.muted },
  recientes: { backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: 14, ...shadow.low },
  reciente: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  anulada: { opacity: 0.6 },
  recienteIcono: { width: 30, height: 30, borderRadius: 10, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' },
  recienteCuerpo: { flex: 1 },
  recienteTitulo: { fontFamily: font.semibold, fontSize: 14, color: c.textStrong },
  tachado: { textDecorationLine: 'line-through' },
  recienteDetalle: { fontFamily: font.regular, fontSize: 12, color: c.muted, marginTop: 2 },
}));
