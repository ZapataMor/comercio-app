import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import {
  descartarReportesResena,
  FiltroResenas,
  getAdminResenas,
  ocultarResena,
  ResenaAdmin,
  restaurarResena,
} from '../api';
import { useAuth } from '../AuthContext';
import { animarDespliegue, Desplegable, FadeInView, PressableScale } from '../components/anim';
import { useConfirmar } from '../components/Confirmacion';
import { Estrellas } from '../components/Resenas';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

const ACCIONES: Record<ResenaAdmin['historial'][number]['accion'], string> = {
  ocultar: 'Oculta',
  restaurar: 'Restaurada',
  descartar: 'Reportes descartados',
};

/**
 * ADMIN: reseñas públicas. Primero las reportadas, con más reportes arriba. Al
 * tocar una se puede ocultar o restaurar con su motivo, o dejarla publicada y
 * descartar los reportes.
 */
export default function AdminResenasScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [filtro, setFiltro] = useState<FiltroResenas>('reportadas');
  const [resenas, setResenas] = useState<ResenaAdmin[]>([]);
  const [conteos, setConteos] = useState({ reportadas: 0, ocultas: 0 });
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);

  const cargar = useCallback(
    (refresco = false) => {
      if (refresco) setRefrescando(true);
      return getAdminResenas(token, filtro)
        .then(r => {
          setResenas(r.resenas);
          setConteos({ reportadas: r.reportadas, ocultas: r.ocultas });
          setPagina(1);
          setHayMas(r.pagina < r.ultima_pagina);
        })
        .catch(e => toast.error('No se pudo cargar', e instanceof Error ? e.message : 'Error'))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token, filtro, toast],
  );

  useEffect(() => {
    setCargando(true);
    setAbierta(null);
    cargar();
  }, [cargar]);

  async function cargarMas() {
    if (!hayMas || cargandoMas || cargando) return;
    setCargandoMas(true);
    try {
      const r = await getAdminResenas(token, filtro, pagina + 1);
      setResenas(prev => [...prev, ...r.resenas.filter(x => !prev.some(y => y.id === x.id))]);
      setPagina(r.pagina);
      setHayMas(r.pagina < r.ultima_pagina);
    } catch {
      // Se reintenta al volver a llegar al final.
    } finally {
      setCargandoMas(false);
    }
  }

  const tabs: { filtro: FiltroResenas; label: string }[] = [
    { filtro: 'reportadas', label: `Reportadas (${conteos.reportadas})` },
    { filtro: 'ocultas', label: `Ocultas (${conteos.ocultas})` },
    { filtro: 'todas', label: 'Todas' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {tabs.map(t => (
          <PressableScale
            key={t.filtro}
            style={[styles.tab, t.filtro === filtro && styles.tabOn]}
            onPress={() => setFiltro(t.filtro)}>
            <Text style={[styles.tabTxt, t.filtro === filtro && styles.tabTxtOn]}>{t.label}</Text>
          </PressableScale>
        ))}
      </View>

      {cargando ? (
        <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={resenas}
          keyExtractor={r => `${filtro}-${r.id}`}
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />
          }
          ListEmptyComponent={<Text style={styles.vacio}>No hay reseñas en esta lista.</Text>}
          renderItem={({ item, index }) => (
            <FadeInView delay={Math.min(index, 8) * 40}>
              <Tarjeta
                resena={item}
                abierta={abierta === item.id}
                onToggle={() => {
                  animarDespliegue();
                  setAbierta(a => (a === item.id ? null : item.id));
                }}
                onCambio={() => {
                  setAbierta(null);
                  cargar();
                }}
              />
            </FadeInView>
          )}
          onEndReached={cargarMas}
          onEndReachedThreshold={0.4}
          ListFooterComponent={cargandoMas ? <ActivityIndicator color={c.accent} style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </View>
  );
}

function Tarjeta({
  resena,
  abierta,
  onToggle,
  onCambio,
}: {
  resena: ResenaAdmin;
  abierta: boolean;
  onToggle: () => void;
  onCambio: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const confirmar = useConfirmar();
  const [motivo, setMotivo] = useState('');

  async function ejecutar(accion: () => Promise<unknown>, exito: string) {
    try {
      await accion();
      toast.exito(exito);
      setMotivo('');
      onCambio();
    } catch (e) {
      toast.error('No se pudo', e instanceof Error ? e.message : 'Error');
    }
  }

  function onOcultar() {
    if (!motivo.trim()) {
      toast.error('Falta el motivo', 'Escribe por qué la ocultas.');
      return;
    }
    confirmar({
      icono: 'alerta',
      titulo: '¿Ocultar esta reseña?',
      texto: `Motivo: "${motivo.trim()}". Deja de verse y de contar en el promedio.`,
      textoBoton: 'Ocultar',
      textoCancelar: 'Cancelar',
      peligro: true,
      accion: () => ejecutar(() => ocultarResena(token, resena.id, motivo.trim()), 'Reseña oculta'),
    });
  }

  function onRestaurar() {
    if (!motivo.trim()) {
      toast.error('Falta el motivo', 'Escribe por qué la restauras.');
      return;
    }
    confirmar({
      icono: 'estrella',
      titulo: '¿Restaurar esta reseña?',
      texto: `Motivo: "${motivo.trim()}". Vuelve a verse y a contar en el promedio.`,
      textoBoton: 'Restaurar',
      textoCancelar: 'Cancelar',
      accion: () => ejecutar(() => restaurarResena(token, resena.id, motivo.trim()), 'Reseña restaurada'),
    });
  }

  function onDescartar() {
    confirmar({
      icono: 'estrella',
      titulo: '¿Dejar publicada esta reseña?',
      texto: 'Los reportes se descartan y la reseña sale de esta lista.',
      textoBoton: 'Dejar publicada',
      textoCancelar: 'Cancelar',
      accion: () => ejecutar(() => descartarReportesResena(token, resena.id), 'Reportes descartados'),
    });
  }

  // Fondo en una View interna para que el despliegue no se corte (ver Desplegable).
  return (
    <PressableScale style={styles.cardSeparada} onPress={onToggle} scaleTo={0.99}>
      <View style={[styles.card, resena.oculta && styles.cardOculta]}>
        <View style={styles.cabecera}>
          <Text style={styles.sujeto} numberOfLines={1}>
            {resena.producto ? `${resena.producto} · ${resena.negocio}` : resena.negocio}
          </Text>
          <Text style={styles.fecha}>{resena.fecha}</Text>
        </View>
        <Text style={styles.autor}>{resena.autor}</Text>
        <Estrellas nota={resena.estrellas} />
        {resena.comentario ? (
          <Text style={styles.comentario}>{resena.comentario}</Text>
        ) : (
          <Text style={styles.sinComentario}>Sin comentario</Text>
        )}
        {resena.reportes.map(r => (
          <Text key={r.motivo} style={styles.reporte}>{`${r.motivo}: ${r.cantidad}`}</Text>
        ))}

        <Desplegable abierto={abierta}>
          <View style={styles.cuerpo}>
            {!!resena.respuesta && <Text style={styles.detalle}>{`Respuesta de la tienda: ${resena.respuesta}`}</Text>}
            {resena.historial.map((h, i) => (
              <Text key={i} style={styles.detalle}>
                {`${ACCIONES[h.accion]} · ${h.fecha}${h.admin ? ` · ${h.admin}` : ''}${h.motivo ? `\n${h.motivo}` : ''}`}
              </Text>
            ))}
            <TextInput
              style={styles.input}
              value={motivo}
              onChangeText={setMotivo}
              placeholder={resena.oculta ? 'Motivo para restaurar…' : 'Motivo para ocultar…'}
              placeholderTextColor={c.mutedSoft}
              maxLength={200}
            />
            {resena.oculta ? (
              <PressableScale style={styles.btn} onPress={onRestaurar}>
                <Text style={styles.btnTxt}>Restaurar</Text>
              </PressableScale>
            ) : (
              <PressableScale style={[styles.btn, styles.btnPeligro]} onPress={onOcultar}>
                <Text style={[styles.btnTxt, { color: c.danger }]}>Ocultar</Text>
              </PressableScale>
            )}
            {resena.reportes.length > 0 && (
              <PressableScale style={styles.btn} onPress={onDescartar}>
                <Text style={styles.btnTxt}>Dejar publicada</Text>
              </PressableScale>
            )}
          </View>
        </Desplegable>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  tab: { backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, ...shadow.low },
  tabOn: { backgroundColor: c.brand },
  tabTxt: { color: c.muted, fontSize: 13, fontFamily: font.semibold },
  tabTxtOn: { color: c.onBrand },
  cardSeparada: { marginBottom: 10 },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: 14, gap: 4, ...shadow.low },
  cardOculta: { borderLeftWidth: 4, borderLeftColor: c.danger },
  cabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sujeto: { flex: 1, fontSize: 15, fontFamily: font.bold, color: c.textStrong },
  fecha: { color: c.mutedSoft, fontFamily: font.regular, fontSize: 12 },
  autor: { color: c.muted, fontSize: 13, fontFamily: font.regular },
  comentario: { color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  sinComentario: { color: c.mutedSoft, fontFamily: font.regular, fontSize: 13 },
  reporte: { color: c.danger, fontSize: 12, fontFamily: font.medium },
  cuerpo: { borderTopWidth: 1, borderTopColor: c.border, marginTop: 10, paddingTop: 10, gap: 6 },
  detalle: { color: c.muted, fontSize: 13, lineHeight: 18, fontFamily: font.regular },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm, paddingHorizontal: 12,
    paddingVertical: 10, color: c.textStrong, fontFamily: font.regular,
  },
  btn: { backgroundColor: c.brand, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  btnPeligro: { backgroundColor: c.dangerSoft },
  btnTxt: { color: c.onBrand, fontFamily: font.bold },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
}));
