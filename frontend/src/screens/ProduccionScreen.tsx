/**
 * Producción (Materiales y producción de Vitrina Gestión) en la app: quien
 * está en el taller ve lo que está por hacer, empieza una producción de un
 * modelo (sus materiales salen ya puestos) o sin modelo, y la abre para
 * ajustar sus materiales y marcarla terminada. Ponerle nombre y llevarla al
 * catálogo se hace en la web. Abajo, lo último que se terminó.
 *
 * Solo se ve con el módulo encendido y permiso para producir
 * (Negocio.puede_producir).
 */
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { crearProduccion, getProduccion, ModeloProduccion, ProduccionPorHacer, ProduccionResumen } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import ErrorCarga from '../components/ErrorCarga';
import Icon from '../components/Icon';
import { messageFromError } from '../formErrors';
import type { RootStackParamList } from '../navTypes';
import { useNegocio } from '../NegocioContext';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

/** 2,5 · 1.200 · 3 */
export function numero(n: number): string {
  const redondo = Math.round(n * 1000) / 1000;
  const [entero, decimales] = String(Math.abs(redondo)).split('.');
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (redondo < 0 ? '-' : '') + conPuntos + (decimales ? `,${decimales}` : '');
}

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
  const toast = useToast();
  const [datos, setDatos] = useState<ProduccionResumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);
  const [creando, setCreando] = useState<number | 'sin' | null>(null);
  const [nombre, setNombre] = useState('');

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

  // Al volver de una producción, la lista ya muestra lo que queda.
  useEffect(() => navigation.addListener('focus', cargar), [navigation, cargar]);

  function abrir(p: ProduccionPorHacer) {
    navigation.navigate('ProduccionEtapa', { produccion: p, materiales: datos?.materiales ?? [] });
  }

  async function empezar(modelo: ModeloProduccion | null) {
    if (!negocio || creando !== null) return;
    if (!modelo && !nombre.trim()) { toast.error('Falta el nombre', 'Escribe qué se va a hacer.'); return; }
    setCreando(modelo ? modelo.id : 'sin');
    try {
      const r = await crearProduccion(token, negocio.id, modelo ? { modeloId: modelo.id } : { nombre: nombre.trim() });
      setNombre('');
      abrir(r.produccion);
    } catch (e) {
      toast.error('No se pudo anotar', messageFromError(e));
    } finally {
      setCreando(null);
    }
  }

  if (error && !datos) return <ErrorCarga mensaje={error} reintentar={cargar} />;
  if (!datos) return <ActivityIndicator style={styles.cargando} size="large" color={c.accent} accessibilityLabel="Cargando producción" />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={recargando} onRefresh={() => { setRecargando(true); cargar(); }} />}>
      <Text style={styles.intro}>
        Anota lo que se va a hacer y ajusta sus materiales con − y +. Al marcarla terminada se descuentan del inventario.
      </Text>

      {datos.para_nombrar > 0 && (
        <View style={styles.aviso}>
          <Icon name="etiqueta" size={16} color={c.goldText} />
          <Text style={styles.avisoTxt}>
            {datos.para_nombrar === 1 ? 'Hay 1 terminada' : `Hay ${datos.para_nombrar} terminadas`} esperando su nombre para ir al catálogo. Se les pone en la web: Materiales y producción › Producción.
          </Text>
        </View>
      )}

      <Text style={styles.seccion} accessibilityRole="header">Por hacer</Text>
      {datos.por_hacer.length === 0 ? (
        <View style={styles.vacio}><Text style={styles.vacioTxt}>No hay nada por hacer. Empieza una abajo.</Text></View>
      ) : (
        datos.por_hacer.map(p => {
          const falta = p.materiales.some(m => m.cantidad > m.hay + 0.0005);
          return (
            <PressableScale key={p.id} style={styles.tarjeta} onPress={() => abrir(p)} accessibilityRole="button" accessibilityLabel={`Abrir ${p.texto}`}>
              <View style={styles.inicialCaja}><Text style={styles.inicial}>{p.nombre.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.tarjetaCuerpo}>
                <Text style={styles.nombre} numberOfLines={2}>{p.texto}</Text>
                <View style={styles.chips}>
                  <Text style={styles.chip}>{p.modelo ? `Modelo: ${p.modelo.nombre}` : 'Sin modelo'}</Text>
                  {falta && <Text style={[styles.chip, styles.chipPeligro]}>Falta material</Text>}
                </View>
                <Text style={styles.detalle}>
                  {p.materiales.length} {p.materiales.length === 1 ? 'material' : 'materiales'} · {cuando(p.fecha)}{p.quien ? ` · ${p.quien}` : ''}
                </Text>
              </View>
              <Icon name="chevron" size={18} color={c.muted} />
            </PressableScale>
          );
        })
      )}

      <Text style={styles.seccion} accessibilityRole="header">Empezar una producción</Text>
      {datos.modelos.length === 0 && (
        <Text style={styles.ayuda}>Todavía no hay modelos. Créalos en la web para que sus materiales salgan solos.</Text>
      )}
      {datos.modelos.map(m => (
        <PressableScale key={m.id} style={styles.tarjeta} onPress={() => empezar(m)} disabled={creando !== null} accessibilityRole="button" accessibilityLabel={`Empezar ${m.nombre}`}>
          <View style={[styles.inicialCaja, styles.inicialModelo]}><Icon name="herramientas" size={22} color={c.goldText} /></View>
          <View style={styles.tarjetaCuerpo}>
            <Text style={styles.nombre} numberOfLines={2}>{m.nombre}</Text>
            {m.alcanza !== null && (
              <View style={styles.chips}>
                <Text style={[styles.chip, m.alcanza === 0 ? styles.chipPeligro : styles.chipExito]}>{m.alcanza === 0 ? 'No alcanza el material' : `Alcanza para ${numero(m.alcanza)}`}</Text>
              </View>
            )}
            <Text style={styles.detalle} numberOfLines={2}>{m.materiales.length ? m.materiales.join(', ') : 'Sin materiales predeterminados'}</Text>
          </View>
          {creando === m.id ? <ActivityIndicator color={c.accent} /> : <Icon name="mas" size={18} color={c.accent} />}
        </PressableScale>
      ))}
      <View style={styles.sinModelo}>
        <TextInput
          style={styles.sinModeloInput}
          value={nombre}
          onChangeText={setNombre}
          maxLength={255}
          placeholder="Otra cosa: escribe qué es"
          placeholderTextColor={c.muted}
          accessibilityLabel="Qué se va a hacer, sin modelo"
          returnKeyType="done"
          onSubmitEditing={() => empezar(null)}
        />
        <PressableScale style={styles.sinModeloBoton} onPress={() => empezar(null)} disabled={creando !== null} accessibilityRole="button" accessibilityLabel="Anotar sin modelo">
          {creando === 'sin' ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.sinModeloTxt}>Anotar</Text>}
        </PressableScale>
      </View>

      {datos.recientes.length > 0 && (
        <>
          <Text style={styles.seccion} accessibilityRole="header">Lo último que se terminó</Text>
          <View style={styles.recientes}>
            {datos.recientes.map(r => (
              <View key={r.id} style={[styles.reciente, r.anulada && styles.anulada]}>
                <View style={styles.recienteIcono}>
                  <Icon name={r.origen === 'pedido' ? 'moto' : 'check'} size={15} color={c.success} />
                </View>
                <View style={styles.recienteCuerpo}>
                  <Text style={[styles.recienteTitulo, r.anulada && styles.tachado]}>{r.texto}</Text>
                  <Text style={styles.recienteDetalle}>
                    {cuando(r.fecha)}{r.quien ? ` · ${r.quien}` : ''}{r.falto ? ' · faltó material' : ''}
                  </Text>
                </View>
                <Text style={styles.chip}>{r.estado_texto}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 40 },
  cargando: { marginTop: 60 },
  intro: { color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: c.accentSoft,
    borderRadius: radius.md, padding: 12, marginBottom: 14,
  },
  avisoTxt: { flex: 1, color: c.goldText, fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 10, marginBottom: 10 },
  vacio: { backgroundColor: c.surface, borderRadius: radius.md, padding: 18, alignItems: 'center', ...shadow.low },
  vacioTxt: { color: c.muted, fontSize: 14, fontFamily: font.regular, textAlign: 'center', lineHeight: 20 },
  tarjeta: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface,
    borderRadius: radius.md, padding: 12, marginBottom: 10, ...shadow.low,
  },
  inicialCaja: { width: 52, height: 52, borderRadius: 14, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center' },
  inicialModelo: { backgroundColor: c.accentSoft },
  inicial: { fontFamily: font.display, fontSize: 22, color: c.muted },
  tarjetaCuerpo: { flex: 1, gap: 5 },
  nombre: { fontFamily: font.bold, fontSize: 15, color: c.textStrong, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    fontFamily: font.semibold, fontSize: 12, color: c.muted, backgroundColor: c.bg,
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden',
  },
  chipExito: { color: c.success, backgroundColor: c.successSoft },
  chipPeligro: { color: c.danger, backgroundColor: c.dangerSoft },
  detalle: { fontFamily: font.regular, fontSize: 12, color: c.muted, lineHeight: 17 },
  sinModelo: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  sinModeloInput: {
    flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface,
    paddingHorizontal: 14, fontFamily: font.regular, fontSize: 15, color: c.textStrong,
  },
  sinModeloBoton: { height: 48, paddingHorizontal: 18, borderRadius: radius.md, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' },
  sinModeloTxt: { fontFamily: font.bold, fontSize: 15, color: c.onBrand },
  recientes: { backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: 14, ...shadow.low },
  reciente: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  anulada: { opacity: 0.6 },
  recienteIcono: { width: 30, height: 30, borderRadius: 10, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' },
  recienteCuerpo: { flex: 1 },
  recienteTitulo: { fontFamily: font.semibold, fontSize: 14, color: c.textStrong },
  tachado: { textDecorationLine: 'line-through' },
  recienteDetalle: { fontFamily: font.regular, fontSize: 12, color: c.muted, marginTop: 2 },
}));
