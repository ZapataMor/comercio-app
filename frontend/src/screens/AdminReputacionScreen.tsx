import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import {
  anularEventoReputacion,
  getAdminReputacion,
  getAdminReputacionDetalle,
  levantarVeto,
  ReputacionDetalle,
  SujetoReputacion,
  suspenderSujeto,
  TipoReputacion,
} from '../api';
import { useAuth } from '../AuthContext';
import { Desplegable, FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { FilaEvento, NivelBadge } from '../components/Reputacion';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

const TABS: { tipo: TipoReputacion; label: string }[] = [
  { tipo: 'domiciliario', label: 'Domiciliarios' },
  { tipo: 'negocio', label: 'Negocios' },
];

/**
 * ADMIN: confiabilidad de domiciliarios y negocios. Primero los vetados y
 * luego del peor al mejor. Al tocar uno se ve su historial: se puede anular
 * un evento injusto, suspender a mano o dar una segunda oportunidad.
 */
export default function AdminReputacionScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoReputacion>('domiciliario');
  const [sujetos, setSujetos] = useState<SujetoReputacion[]>([]);
  const [resumen, setResumen] = useState({ vetados: 0, en_riesgo: 0 });
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [abierto, setAbierto] = useState<number | null>(null);

  const cargar = useCallback(
    (refresco = false) => {
      if (refresco) setRefrescando(true);
      return getAdminReputacion(token, tipo)
        .then(r => {
          setSujetos(r.sujetos);
          setResumen({ vetados: r.vetados, en_riesgo: r.en_riesgo });
        })
        .catch(e => toast.error('No se pudo cargar', e instanceof Error ? e.message : 'Error'))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token, tipo, toast],
  );

  useEffect(() => {
    setCargando(true);
    setAbierto(null);
    cargar();
  }, [cargar]);

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {TABS.map(t => (
          <PressableScale
            key={t.tipo}
            style={[styles.tab, t.tipo === tipo && styles.tabOn]}
            onPress={() => setTipo(t.tipo)}>
            <Text style={[styles.tabTxt, t.tipo === tipo && styles.tabTxtOn]}>{t.label}</Text>
          </PressableScale>
        ))}
      </View>
      <View style={styles.resumen}>
        <Icon name="alerta" size={14} color={resumen.vetados ? c.danger : c.muted} />
        <Text style={styles.resumenTxt}>
          {resumen.vetados} vetado(s) · {resumen.en_riesgo} en riesgo
        </Text>
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={sujetos}
          keyExtractor={s => `${tipo}-${s.id}`}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />
          }
          ListEmptyComponent={<Text style={styles.vacio}>No hay nadie en esta lista.</Text>}
          renderItem={({ item, index }) => (
            <FadeInView delay={Math.min(index, 8) * 40}>
              <Sujeto
                tipo={tipo}
                sujeto={item}
                abierto={abierto === item.id}
                onToggle={() => setAbierto(a => (a === item.id ? null : item.id))}
                onCambio={() => cargar()}
              />
            </FadeInView>
          )}
        />
      )}
    </View>
  );
}

function Sujeto({
  tipo,
  sujeto,
  abierto,
  onToggle,
  onCambio,
}: {
  tipo: TipoReputacion;
  sujeto: SujetoReputacion;
  abierto: boolean;
  onToggle: () => void;
  onCambio: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [detalle, setDetalle] = useState<ReputacionDetalle | null>(null);
  const [motivo, setMotivo] = useState('');

  const cargarDetalle = useCallback(() => {
    getAdminReputacionDetalle(token, tipo, sujeto.id)
      .then(setDetalle)
      .catch(e => toast.error('No se pudo cargar', e instanceof Error ? e.message : 'Error'));
  }, [token, tipo, sujeto.id, toast]);

  useEffect(() => {
    if (abierto) cargarDetalle();
  }, [abierto, cargarDetalle]);

  async function ejecutar(accion: () => Promise<unknown>, exito: string) {
    try {
      await accion();
      toast.exito(exito);
      cargarDetalle();
      onCambio();
    } catch (e) {
      toast.error('No se pudo', e instanceof Error ? e.message : 'Error');
    }
  }

  function onAnular(eventoId: number, descripcion: string) {
    Alert.alert('¿Anular este evento?', `"${descripcion}" deja de contar y el puntaje se recalcula.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Anular', style: 'destructive', onPress: () => ejecutar(() => anularEventoReputacion(token, eventoId), 'Evento anulado') },
    ]);
  }

  function onLevantar() {
    Alert.alert(
      '¿Dar una segunda oportunidad?',
      'Se quita el veto y queda "En riesgo" (50 puntos). Las faltas graves anteriores ya no cuentan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Levantar veto', onPress: () => ejecutar(() => levantarVeto(token, tipo, sujeto.id), 'Veto levantado') },
      ],
    );
  }

  function onSuspender() {
    if (!motivo.trim()) {
      toast.error('Falta el motivo', 'Escribe por qué lo suspendes.');
      return;
    }
    Alert.alert(`¿Suspender a ${sujeto.nombre}?`, motivo.trim(), [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Suspender',
        style: 'destructive',
        onPress: () =>
          ejecutar(() => suspenderSujeto(token, tipo, sujeto.id, motivo.trim()), 'Suspendido').then(() => setMotivo('')),
      },
    ]);
  }

  const r = sujeto.reputacion;

  return (
    <PressableScale style={[styles.card, r.vetado && styles.cardVetada]} onPress={onToggle} scaleTo={0.99}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nombre}>{sujeto.nombre}</Text>
          {!!sujeto.detalle && <Text style={styles.detalle}>{sujeto.detalle}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.puntaje, r.vetado && { color: c.danger }]}>{r.puntaje}</Text>
          <NivelBadge reputacion={r} sinPuntaje />
        </View>
      </View>
      {r.vetado && !!r.motivo_veto && <Text style={styles.motivo}>{r.motivo_veto}</Text>}

      <Desplegable abierto={abierto}>
        <View style={styles.cuerpo}>
          {!detalle ? (
            <ActivityIndicator color={c.accent} />
          ) : (
            <>
              <Text style={styles.subtitulo}>
                Historial · {detalle.reputacion.pedidos} pedido(s) evaluado(s)
              </Text>
              {detalle.eventos.length === 0 ? (
                <Text style={styles.detalle}>Sin movimientos todavía.</Text>
              ) : (
                detalle.eventos.map(e => (
                  <FilaEvento
                    key={e.id}
                    evento={e}
                    accion={
                      !e.anulado && (
                        <PressableScale onPress={() => onAnular(e.id, e.descripcion)} style={styles.anular}>
                          <Text style={styles.anularTxt}>Anular</Text>
                        </PressableScale>
                      )
                    }
                  />
                ))
              )}

              {detalle.reputacion.vetado ? (
                <PressableScale style={styles.btn} onPress={onLevantar}>
                  <Text style={styles.btnTxt}>Levantar veto (segunda oportunidad)</Text>
                </PressableScale>
              ) : (
                <View style={styles.suspender}>
                  <TextInput
                    style={styles.input}
                    value={motivo}
                    onChangeText={setMotivo}
                    placeholder="Motivo para suspender…"
                    placeholderTextColor={c.mutedSoft}
                    maxLength={200}
                  />
                  <PressableScale style={[styles.btn, styles.btnPeligro]} onPress={onSuspender}>
                    <Text style={[styles.btnTxt, { color: c.danger }]}>Suspender</Text>
                  </PressableScale>
                </View>
              )}
            </>
          )}
        </View>
      </Desplegable>
    </PressableScale>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  tab: { backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, ...shadow.low },
  tabOn: { backgroundColor: c.brand },
  tabTxt: { color: c.muted, fontSize: 13, fontFamily: font.semibold },
  tabTxtOn: { color: c.onBrand },
  resumen: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10 },
  resumenTxt: { color: c.muted, fontSize: 13, fontFamily: font.medium },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low },
  cardVetada: { borderLeftWidth: 4, borderLeftColor: c.danger },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nombre: { fontSize: 15, fontFamily: font.bold, color: c.textStrong },
  detalle: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  puntaje: { fontSize: 22, fontFamily: font.displayExtra, color: c.textStrong, marginBottom: 4 },
  motivo: { color: c.danger, fontSize: 12, marginTop: 8, fontFamily: font.medium },
  cuerpo: { borderTopWidth: 1, borderTopColor: c.border, marginTop: 12, paddingTop: 10 },
  subtitulo: { fontSize: 12, fontFamily: font.bold, color: c.mutedSoft, textTransform: 'uppercase', marginBottom: 4 },
  anular: { alignSelf: 'flex-start', marginTop: 4 },
  anularTxt: { color: c.goldText, fontSize: 12, fontFamily: font.bold },
  suspender: { marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm, paddingHorizontal: 12,
    paddingVertical: 10, color: c.textStrong, fontFamily: font.regular,
  },
  btn: { backgroundColor: c.brand, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  btnPeligro: { backgroundColor: c.dangerSoft },
  btnTxt: { color: c.onBrand, fontFamily: font.bold },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
}));
