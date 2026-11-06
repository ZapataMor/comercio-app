/**
 * Reseñas públicas de tiendas y productos (estrellas de 1 a 5 y comentario).
 *
 *   <PuntajeResenas resenas={r} />                ← "★ 4,6 (23)", para listados
 *   <SelectorEstrellas valor={n} onChange={…} />  ← para escribir una reseña
 *   <TarjetaResena resena={r} />                  ← una reseña publicada, con su
 *                                                   respuesta y el botón de reportar
 *   <ResponderResena … />                         ← el propietario contesta una vez
 *   <ResenasDeProducto … />                       ← bloque del detalle del producto
 *
 * No confundir con el nivel de confiabilidad (Reputacion.tsx): ese mide si
 * cumplieron con el pedido; las reseñas, si le gustó al cliente.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleProp, Text, TextInput, View, ViewStyle } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import {
  getResenas,
  MotivoReporte,
  PaginaResenas,
  reportarResena,
  ResenaPublica,
  responderResena,
  RespuestaResena,
  ResumenResenas,
} from '../api';
import { useAuth } from '../AuthContext';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { PressableScale } from './anim';
import Icon from './Icon';

const ESTRELLA = 'M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.09 6.33L12 17.31l-5.69 2.99 1.09-6.33-4.6-4.49 6.36-.92z';

const NOTAS = [1, 2, 3, 4, 5];

/** Qué significa cada número de estrellas. */
export const SIGNIFICADO_ESTRELLAS = ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

/** 4.5 → "4,5". */
export function promedioTexto(promedio: number) {
  return promedio.toFixed(1).replace('.', ',');
}

export function Estrella({ llena, size }: { llena: boolean; size: number }) {
  const { c } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={ESTRELLA}
        fill={llena ? c.accent : 'none'}
        stroke={llena ? c.accent : c.borderStrong}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Fila de cinco estrellas para mostrar una nota (no se puede tocar). */
export function Estrellas({ nota, size = 14 }: { nota: number; size?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.fila} accessible accessibilityLabel={`${nota} de 5 estrellas`}>
      {NOTAS.map(n => (
        <Estrella key={n} llena={n <= Math.round(nota)} size={size} />
      ))}
    </View>
  );
}

/**
 * Promedio y número de reseñas. Sin reseñas no pinta nada, salvo con
 * `conVacio`, donde invita a mirar (el negocio y el detalle del producto).
 */
export function PuntajeResenas({
  resenas,
  size = 13,
  conVacio,
  style,
}: {
  resenas?: ResumenResenas | null;
  size?: number;
  conVacio?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  if (!resenas || resenas.promedio === null) {
    return conVacio ? <Text style={[styles.sinResenas, { fontSize: size }]}>Sin reseñas todavía</Text> : null;
  }
  return (
    <View
      style={[styles.puntaje, style]}
      accessible
      accessibilityLabel={`${promedioTexto(resenas.promedio)} de 5 estrellas, ${resenas.total} ${resenas.total === 1 ? 'reseña' : 'reseñas'}`}>
      <Estrella llena size={size + 1} />
      <Text style={[styles.puntajeNota, { fontSize: size }]}>{promedioTexto(resenas.promedio)}</Text>
      <Text style={[styles.puntajeTotal, { fontSize: size }]}>({resenas.total})</Text>
    </View>
  );
}

/** Cinco estrellas para tocar; al lado dice lo que significa la elegida. */
export function SelectorEstrellas({
  valor,
  onChange,
  etiqueta,
  size = 30,
}: {
  valor: number | null;
  onChange: (n: number) => void;
  /** Qué se está calificando, para los lectores de pantalla. */
  etiqueta: string;
  size?: number;
}) {
  const styles = useStyles();
  return (
    <View style={styles.selector} accessibilityRole="radiogroup" accessibilityLabel={etiqueta}>
      {NOTAS.map(n => (
        <PressableScale
          key={n}
          scaleTo={0.85}
          hitSlop={4}
          onPress={() => onChange(n)}
          accessibilityRole="radio"
          accessibilityState={{ selected: valor === n }}
          accessibilityLabel={`${etiqueta}: ${n} de 5, ${SIGNIFICADO_ESTRELLAS[n - 1]}`}>
          <Estrella llena={valor !== null && n <= valor} size={size} />
        </PressableScale>
      ))}
      {valor !== null && <Text style={styles.significado}>{SIGNIFICADO_ESTRELLAS[valor - 1]}</Text>}
    </View>
  );
}

export function TarjetaResena({ resena }: { resena: ResenaPublica }) {
  const styles = useStyles();
  return (
    <View style={styles.tarjeta}>
      <View style={styles.tarjetaCabecera}>
        <Text style={styles.autor} numberOfLines={1}>{resena.autor}</Text>
        <Text style={styles.fecha}>{resena.fecha}</Text>
      </View>
      <Estrellas nota={resena.estrellas} />
      {!!resena.comentario && <Text style={styles.comentario}>{resena.comentario}</Text>}
      {!!resena.respuesta && (
        <View style={styles.respuesta}>
          <Text style={styles.respuestaTitulo}>{`Respuesta de la tienda · ${resena.respuesta.fecha}`}</Text>
          <Text style={styles.comentario}>{resena.respuesta.texto}</Text>
        </View>
      )}
      {!resena.propia && <ReportarResena resenaId={resena.id} yaReportada={resena.reportada} />}
    </View>
  );
}

const MOTIVOS_REPORTE: { motivo: MotivoReporte; label: string }[] = [
  { motivo: 'ofensiva', label: 'Ofensiva' },
  { motivo: 'falsa', label: 'Falsa' },
  { motivo: 'spam', label: 'Publicidad' },
  { motivo: 'otro', label: 'Otro' },
];

/** "Reportar" abre los motivos; al tocar uno se envía al admin. */
function ReportarResena({ resenaId, yaReportada }: { resenaId: number; yaReportada: boolean }) {
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [reportada, setReportada] = useState(yaReportada);

  async function enviar(motivo: MotivoReporte) {
    setEnviando(true);
    try {
      toast.exito(await reportarResena(auth!.token, resenaId, motivo));
      setReportada(true);
      setAbierto(false);
    } catch (e) {
      toast.error('No se pudo reportar', e instanceof Error ? e.message : 'Error');
    } finally {
      setEnviando(false);
    }
  }

  if (reportada) {
    return <Text style={styles.reportada}>Reportada</Text>;
  }
  if (!abierto) {
    return (
      <PressableScale
        style={styles.accion}
        hitSlop={8}
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel="Reportar esta reseña">
        <Text style={styles.accionTxt}>Reportar</Text>
      </PressableScale>
    );
  }
  return (
    <View style={styles.motivos}>
      <Text style={styles.motivosTitulo}>¿Qué tiene de malo esta reseña?</Text>
      <View style={styles.chips}>
        {MOTIVOS_REPORTE.map(m => (
          <PressableScale
            key={m.motivo}
            style={styles.chip}
            disabled={enviando}
            onPress={() => enviar(m.motivo)}
            accessibilityRole="button"
            accessibilityLabel={`Reportar: ${m.label}`}>
            <Text style={styles.chipTxt}>{m.label}</Text>
          </PressableScale>
        ))}
        <PressableScale style={styles.accion} hitSlop={8} onPress={() => setAbierto(false)} accessibilityRole="button">
          <Text style={styles.accionTxt}>Cancelar</Text>
        </PressableScale>
      </View>
    </View>
  );
}

/** El propietario contesta una reseña. Solo una vez: lo publicado no se cambia. */
export function ResponderResena({
  resenaId,
  onRespondida,
}: {
  resenaId: number;
  onRespondida: (respuesta: RespuestaResena) => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function publicar() {
    setEnviando(true);
    try {
      onRespondida(await responderResena(auth!.token, resenaId, texto.trim()));
      toast.exito('Respuesta publicada');
    } catch (e) {
      toast.error('No se pudo responder', e instanceof Error ? e.message : 'Error');
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <PressableScale style={styles.accion} hitSlop={8} onPress={() => setAbierto(true)} accessibilityRole="button">
        <Text style={styles.responderTxt}>Responder</Text>
      </PressableScale>
    );
  }
  return (
    <View style={styles.responder}>
      <TextInput
        style={styles.input}
        value={texto}
        onChangeText={setTexto}
        placeholder="Tu respuesta es pública…"
        placeholderTextColor={c.mutedSoft}
        maxLength={500}
        multiline
        autoFocus
      />
      <Text style={styles.responderNota}>Solo puedes responder una vez, y luego no se puede cambiar.</Text>
      <View style={styles.responderBotones}>
        <PressableScale style={styles.accion} hitSlop={8} onPress={() => setAbierto(false)} accessibilityRole="button">
          <Text style={styles.accionTxt}>Cancelar</Text>
        </PressableScale>
        <PressableScale
          style={[styles.publicar, (!texto.trim() || enviando) && styles.publicarOff]}
          disabled={!texto.trim() || enviando}
          onPress={publicar}
          accessibilityRole="button">
          <Text style={styles.publicarTxt}>Publicar respuesta</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const EN_DETALLE = 3;

/** Reseñas en el detalle del producto: promedio, las últimas y "Ver todas". */
export function ResenasDeProducto({
  negocioId,
  productoId,
  onVerTodas,
}: {
  negocioId: number;
  productoId: number;
  onVerTodas: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const [datos, setDatos] = useState<PaginaResenas | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    getResenas(token, negocioId, { productoId })
      .then(setDatos)
      .catch(() => setFallo(true));
  }, [token, negocioId, productoId]);

  // Las reseñas acompañan al producto: si fallan, no estorban la compra.
  if (fallo) return null;

  return (
    <View style={styles.bloque}>
      <Text style={styles.bloqueTitulo}>Reseñas</Text>
      {!datos ? (
        <ActivityIndicator color={c.accent} style={styles.bloqueCarga} />
      ) : datos.resumen.total === 0 ? (
        <Text style={styles.bloqueVacio}>Aún no tiene reseñas. Las escriben quienes lo compraron.</Text>
      ) : (
        <>
          {datos.items.slice(0, EN_DETALLE).map(r => (
            <TarjetaResena key={r.id} resena={r} />
          ))}
          {datos.resumen.total > EN_DETALLE && (
            <PressableScale style={styles.verTodas} onPress={onVerTodas} accessibilityRole="button">
              <Text style={styles.verTodasTxt}>{`Ver las ${datos.resumen.total} reseñas`}</Text>
              <Icon name="chevron" size={14} color={c.goldText} />
            </PressableScale>
          )}
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  fila: { flexDirection: 'row', gap: 2 },
  puntaje: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  puntajeNota: { color: c.textStrong, fontFamily: font.bold },
  puntajeTotal: { color: c.muted, fontFamily: font.regular },
  sinResenas: { color: c.muted, fontFamily: font.regular },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  significado: { color: c.goldText, fontFamily: font.semibold, fontSize: 13, marginLeft: 4 },
  tarjeta: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border, gap: 5 },
  tarjetaCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  autor: { flex: 1, color: c.textStrong, fontFamily: font.semibold, fontSize: 14 },
  fecha: { color: c.mutedSoft, fontFamily: font.regular, fontSize: 12 },
  comentario: { color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  respuesta: {
    marginTop: 4, paddingLeft: 12, gap: 2, borderLeftWidth: 2, borderLeftColor: c.accent,
  },
  respuestaTitulo: { color: c.muted, fontFamily: font.semibold, fontSize: 12 },
  accion: { alignSelf: 'flex-start', paddingVertical: 4 },
  accionTxt: { color: c.muted, fontFamily: font.medium, fontSize: 12 },
  reportada: { color: c.mutedSoft, fontFamily: font.regular, fontSize: 12, paddingVertical: 4 },
  motivos: { gap: 6, marginTop: 2 },
  motivosTitulo: { color: c.muted, fontFamily: font.medium, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  chipTxt: { color: c.text, fontFamily: font.medium, fontSize: 13 },
  responderTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 13 },
  responder: { gap: 6, paddingBottom: 12 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm, paddingHorizontal: 12,
    paddingVertical: 10, minHeight: 72, textAlignVertical: 'top', color: c.textStrong, fontFamily: font.regular,
  },
  responderNota: { color: c.muted, fontFamily: font.regular, fontSize: 12 },
  responderBotones: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  publicar: { backgroundColor: c.brand, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 10 },
  publicarOff: { opacity: 0.5 },
  publicarTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 13 },
  bloque: { marginTop: 22, gap: 10 },
  bloqueTitulo: { color: c.textStrong, fontFamily: font.semibold, fontSize: 14 },
  bloqueCarga: { alignSelf: 'flex-start' },
  bloqueVacio: { color: c.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  verTodas: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4,
    paddingVertical: 8, borderRadius: radius.sm,
  },
  verTodasTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 14 },
}));
