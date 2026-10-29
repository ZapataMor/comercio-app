/**
 * Nivel de confiabilidad (reputación) de negocios y domiciliarios.
 *
 *   <NivelBadge reputacion={r} />            ← pastilla "Confiable · 86"
 *   <TarjetaReputacion reputacion={r} eventos={e} explicacion="…" />
 *
 * El puntaje va de 0 a 100: sube cuando cumplen y baja cuando fallan. Por
 * debajo de 50 se muestra "En riesgo" y por debajo de 30 queda vetado.
 */
import React, { useState } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { EventoReputacion, NivelReputacion, Reputacion } from '../api';
import { Colores, font, makeStyles, radius, useTheme } from '../theme';
import { FadeInView, PressableScale } from './anim';
import Icon from './Icon';

/** Umbrales (coinciden con backend/config/reputacion.php). */
const UMBRAL_VETO = 30;
const UMBRAL_RIESGO = 50;

export function colorNivel(c: Colores, nivel: NivelReputacion): { fg: string; bg: string } {
  switch (nivel) {
    case 'excelente':
      return { fg: c.success, bg: c.successSoft };
    case 'confiable':
      return { fg: c.info, bg: c.infoSoft };
    case 'regular':
      return { fg: c.warning, bg: c.warningSoft };
    case 'riesgo':
      return { fg: c.danger, bg: c.dangerSoft };
    case 'vetado':
      return { fg: c.onBrand, bg: c.danger };
    default:
      return { fg: c.goldText, bg: c.accentSoft };
  }
}

/** Pastilla con el nivel; el puntaje se omite mientras es "Nuevo". */
export function NivelBadge({ reputacion, sinPuntaje }: { reputacion?: Reputacion | null; sinPuntaje?: boolean }) {
  const { c } = useTheme();
  const styles = useStyles();
  if (!reputacion) return null;
  const col = colorNivel(c, reputacion.nivel);
  const conPuntaje = !sinPuntaje && reputacion.nivel !== 'nuevo';
  return (
    <View style={[styles.badge, { backgroundColor: col.bg }]}>
      <Icon name="escudo" size={12} color={col.fg} strokeWidth={2} />
      <Text style={[styles.badgeTxt, { color: col.fg }]}>
        {reputacion.nivel_label}
        {conPuntaje ? ` · ${reputacion.puntaje}` : ''}
      </Text>
    </View>
  );
}

const EVENTOS_VISIBLES = 5;

/**
 * Tarjeta con el puntaje, una barra con los umbrales de riesgo y veto, el
 * aviso si está vetado y el historial de lo que lo subió o bajó.
 */
export function TarjetaReputacion({
  reputacion,
  eventos,
  titulo = 'Nivel de confiabilidad',
  explicacion,
  style,
}: {
  reputacion: Reputacion;
  eventos?: EventoReputacion[];
  titulo?: string;
  explicacion?: string;
  /** Ajustes del contenedor (p. ej. sin marco de tarjeta dentro de un modal). */
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const [verTodo, setVerTodo] = useState(false);
  // El badge de "vetado" es sólido (texto claro); la barra va en rojo.
  const colorBarra = reputacion.vetado ? c.danger : colorNivel(c, reputacion.nivel).fg;
  const lista = eventos ?? [];
  const visibles = verTodo ? lista : lista.slice(0, EVENTOS_VISIBLES);

  return (
    <FadeInView style={[styles.card, style]}>
      <View style={styles.cabecera}>
        <Icon name="escudo" size={18} color={c.accent} />
        <Text style={styles.titulo}>{titulo}</Text>
        <NivelBadge reputacion={reputacion} sinPuntaje />
      </View>

      <View style={styles.puntajeFila}>
        <Text style={[styles.puntaje, { color: reputacion.vetado ? c.danger : c.textStrong }]}>
          {reputacion.puntaje}
        </Text>
        <Text style={styles.sobre}>/100</Text>
        <Text style={styles.pedidos}>
          {reputacion.pedidos === 1 ? '1 pedido evaluado' : `${reputacion.pedidos} pedidos evaluados`}
        </Text>
      </View>

      {/* Barra 0–100 con las marcas de veto (30) y riesgo (50). */}
      <View style={styles.barra}>
        <View style={[styles.relleno, { width: `${reputacion.puntaje}%`, backgroundColor: colorBarra }]} />
        <View style={[styles.marca, { left: `${UMBRAL_VETO}%` }]} />
        <View style={[styles.marca, { left: `${UMBRAL_RIESGO}%` }]} />
      </View>
      <View style={styles.leyenda}>
        <Text style={[styles.leyendaTxt, { left: `${UMBRAL_VETO}%` }]}>veto</Text>
        <Text style={[styles.leyendaTxt, { left: `${UMBRAL_RIESGO}%` }]}>riesgo</Text>
      </View>

      {reputacion.vetado ? (
        <View style={styles.aviso}>
          <Icon name="alerta" size={16} color={c.danger} />
          <Text style={styles.avisoTxt}>
            Suspendido{reputacion.motivo_veto ? `: ${reputacion.motivo_veto}` : ''}. Un administrador debe revisar el
            caso.
          </Text>
        </View>
      ) : reputacion.nivel === 'riesgo' ? (
        <View style={styles.aviso}>
          <Icon name="alerta" size={16} color={c.danger} />
          <Text style={styles.avisoTxt}>Cuidado: por debajo de {UMBRAL_VETO} puntos la cuenta se suspende.</Text>
        </View>
      ) : null}

      {!!explicacion && <Text style={styles.explicacion}>{explicacion}</Text>}

      {lista.length > 0 && (
        <View style={styles.historial}>
          <Text style={styles.histTitulo}>Últimos movimientos</Text>
          {visibles.map(e => (
            <FilaEvento key={e.id} evento={e} />
          ))}
          {lista.length > EVENTOS_VISIBLES && (
            <PressableScale onPress={() => setVerTodo(v => !v)} style={styles.verMas}>
              <Text style={styles.verMasTxt}>{verTodo ? 'Ver menos' : `Ver los ${lista.length}`}</Text>
            </PressableScale>
          )}
        </View>
      )}
    </FadeInView>
  );
}

/** Un movimiento: qué pasó, cuándo, y cuántos puntos sumó o restó. */
export function FilaEvento({ evento, accion }: { evento: EventoReputacion; accion?: React.ReactNode }) {
  const { c } = useTheme();
  const styles = useStyles();
  const color = evento.anulado ? c.mutedSoft : evento.puntos > 0 ? c.success : evento.puntos < 0 ? c.danger : c.muted;
  return (
    <View style={styles.evento}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.eventoTxt, evento.anulado && styles.tachado]}>
          {evento.grave ? '⚠ ' : ''}
          {evento.descripcion}
        </Text>
        <Text style={styles.eventoSub}>
          {evento.fecha}
          {evento.pedido_id ? ` · pedido #${evento.pedido_id}` : ''}
          {evento.anulado ? ' · anulado' : ''}
        </Text>
        {!!evento.comentario && <Text style={styles.eventoComentario}>“{evento.comentario}”</Text>}
        {accion}
      </View>
      <Text style={[styles.eventoPuntos, { color }]}>
        {evento.puntos > 0 ? `+${evento.puntos}` : evento.puntos}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  badgeTxt: { fontSize: 11, fontFamily: font.bold },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 14, ...shadow.soft },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1, fontFamily: font.bold, color: c.text },
  puntajeFila: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  puntaje: { fontSize: 36, fontFamily: font.displayExtra },
  sobre: { fontSize: 15, fontFamily: font.semibold, color: c.muted, marginLeft: 2 },
  pedidos: { flex: 1, textAlign: 'right', color: c.muted, fontSize: 12, fontFamily: font.regular },
  barra: { height: 8, borderRadius: radius.pill, backgroundColor: c.surface2, marginTop: 8, overflow: 'hidden' },
  relleno: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: radius.pill },
  marca: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: c.surface },
  leyenda: { height: 16, marginTop: 2 },
  leyendaTxt: { position: 'absolute', fontSize: 10, color: c.mutedSoft, fontFamily: font.medium, marginLeft: -10 },
  aviso: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: c.dangerSoft,
    borderRadius: radius.sm, padding: 10, marginTop: 8,
  },
  avisoTxt: { flex: 1, color: c.danger, fontSize: 13, fontFamily: font.medium },
  explicacion: { color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 10, fontFamily: font.regular },
  historial: { borderTopWidth: 1, borderTopColor: c.border, marginTop: 12, paddingTop: 10 },
  histTitulo: { fontSize: 12, fontFamily: font.bold, color: c.mutedSoft, marginBottom: 4, textTransform: 'uppercase' },
  evento: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 },
  eventoTxt: { color: c.text, fontSize: 14, fontFamily: font.medium },
  tachado: { textDecorationLine: 'line-through', color: c.mutedSoft },
  eventoSub: { color: c.mutedSoft, fontSize: 12, marginTop: 1, fontFamily: font.regular },
  eventoComentario: { color: c.muted, fontSize: 12, marginTop: 3, fontStyle: 'italic', fontFamily: font.regular },
  eventoPuntos: { fontFamily: font.extra, fontSize: 15, minWidth: 34, textAlign: 'right' },
  verMas: { alignSelf: 'flex-start', paddingVertical: 6 },
  verMasTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 13 },
}));
