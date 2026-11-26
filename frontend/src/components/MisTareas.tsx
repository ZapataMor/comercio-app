/**
 * «Mis tareas» en el Inicio del negocio: las que me asignaron desde el panel
 * web, con un check para marcarlas hechas. Las hechas de hoy siguen a la
 * vista (tachadas) para poder desmarcarlas si fue sin querer.
 *
 * Se recarga al entrar, con el aviso en vivo «tareas» del negocio (o el push
 * al asignar una) y, de respaldo, cada 30 s.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { cambiarEstadoTarea, getMisTareas, TareaAsignada } from '../api';
import { messageFromError } from '../formErrors';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { temasDelNegocio, usePolling } from '../usePolling';
import { PressableScale } from './anim';
import Icon from './Icon';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «Hoy», «Mañana», «Ayer» o «28 nov». */
export function textoFecha(fecha: string, hoy = new Date()): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(a, m - 1, d);
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const diferencia = Math.round((dia.getTime() - base.getTime()) / 86400000);
  if (diferencia === 0) return 'Hoy';
  if (diferencia === 1) return 'Mañana';
  if (diferencia === -1) return 'Ayer';
  return `${d} ${MESES[m - 1]}`;
}

type Props = {
  token: string;
  negocioId: number;
  /** Trabajador: la sección se ve aunque esté vacía. Dueño: solo si tiene tareas. */
  siempre: boolean;
};

export default function MisTareas({ token, negocioId, siempre }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const [tareas, setTareas] = useState<TareaAsignada[] | null>(null);
  const [cambiando, setCambiando] = useState<number | null>(null);
  const negocioActual = useRef(negocioId);
  negocioActual.current = negocioId;

  const cargar = useCallback(() => {
    getMisTareas(token, negocioId)
      .then(lista => { if (negocioActual.current === negocioId) setTareas(lista); })
      .catch(() => {});
  }, [token, negocioId]);

  // Al cambiar de negocio no se ven las del anterior.
  useEffect(() => { setTareas(null); cargar(); }, [cargar]);
  usePolling(cargar, 30000, temasDelNegocio(['tareas'], negocioId));

  async function marcar(tarea: TareaAsignada) {
    const estado = tarea.estado === 'hecha' ? 'pendiente' : 'hecha';
    setCambiando(tarea.id);
    // Se ve de una; si falla, vuelve como estaba.
    setTareas(lista => lista?.map(t => (t.id === tarea.id ? { ...t, estado } : t)) ?? null);
    try {
      const nueva = await cambiarEstadoTarea(token, negocioId, tarea.id, estado);
      setTareas(lista => lista?.map(t => (t.id === tarea.id ? nueva : t)) ?? null);
      if (estado === 'hecha') toast.exito('¡Tarea hecha!', tarea.titulo);
    } catch (e) {
      setTareas(lista => lista?.map(t => (t.id === tarea.id ? tarea : t)) ?? null);
      toast.error('No se pudo marcar', messageFromError(e));
    } finally {
      setCambiando(null);
    }
  }

  if (!tareas || (!siempre && tareas.length === 0)) return null;
  const porHacer = tareas.filter(t => t.estado !== 'hecha').length;

  return (
    <View style={styles.caja}>
      <Text style={styles.seccion} accessibilityRole="header">
        Mis tareas{porHacer > 0 ? ` (${porHacer})` : ''}
      </Text>
      {tareas.length === 0 ? (
        <View style={styles.vacio}>
          <Text style={styles.vacioTxt}>No tienes tareas por hacer. Cuando te asignen una te llega un aviso.</Text>
        </View>
      ) : (
        tareas.map(t => {
          const hecha = t.estado === 'hecha';
          return (
            <View key={t.id} style={[styles.tarea, t.urgente && !hecha && styles.tareaUrgente]}>
              <PressableScale
                style={styles.check}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: hecha, disabled: cambiando === t.id }}
                accessibilityLabel={hecha ? `Desmarcar «${t.titulo}»` : `Marcar hecha «${t.titulo}»`}
                hitSlop={8}
                disabled={cambiando === t.id}
                onPress={() => marcar(t)}>
                {/* El relleno siempre está montado y cambia su opacidad: en
                    Android un fondo agregado después sale sin esquinas. */}
                <View style={[styles.checkRelleno, { opacity: hecha ? 1 : 0 }]}>
                  <Icon name="check" size={16} color={c.onBrand} />
                </View>
              </PressableScale>
              <View style={styles.cuerpo}>
                <Text style={[styles.titulo, hecha && styles.tituloHecha]}>{t.titulo}</Text>
                {!!t.descripcion && !hecha && <Text style={styles.descripcion}>{t.descripcion}</Text>}
                <View style={styles.chips}>
                  {t.urgente && !hecha && <Text style={[styles.chip, styles.chipPeligro]}>Urgente</Text>}
                  {t.estado === 'en_curso' && <Text style={[styles.chip, styles.chipAcento]}>En curso</Text>}
                  {!!t.fecha && !hecha && (
                    <Text style={[styles.chip, t.atrasada && styles.chipPeligro]}>
                      {t.atrasada ? 'Atrasada · ' : ''}{textoFecha(t.fecha)}
                    </Text>
                  )}
                  {!!t.pedido && (
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel={`Ver el pedido ${t.pedido.codigo}`}
                      onPress={() => navigationRef.navigate('ComercioPedidoDetalle', { pedidoId: t.pedido!.id, negocioId })}>
                      <Text style={[styles.chip, styles.chipEnlace]}>Pedido #{t.pedido.codigo} ›</Text>
                    </PressableScale>
                  )}
                  {hecha && <Text style={styles.hechaTxt}>Hecha</Text>}
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  caja: { marginBottom: 6 },
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 4, marginBottom: 10 },
  vacio: { backgroundColor: c.surface, borderRadius: radius.md, padding: 18, marginBottom: 12, alignItems: 'center', ...shadow.low },
  vacioTxt: { color: c.muted, fontSize: 14, fontFamily: font.regular, textAlign: 'center' },
  tarea: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: c.surface,
    borderRadius: radius.md, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: c.border, ...shadow.low,
  },
  tareaUrgente: { borderLeftColor: c.danger },
  check: {
    width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: c.borderStrong,
    overflow: 'hidden', marginTop: 1,
  },
  checkRelleno: {
    position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderRadius: 9,
    backgroundColor: c.success, alignItems: 'center', justifyContent: 'center',
  },
  cuerpo: { flex: 1, gap: 4 },
  titulo: { fontFamily: font.bold, color: c.textStrong, fontSize: 15, lineHeight: 20 },
  tituloHecha: { color: c.muted, textDecorationLine: 'line-through' },
  descripcion: { color: c.text, fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  chip: {
    fontFamily: font.semibold, fontSize: 12, color: c.muted, backgroundColor: c.bg,
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden',
  },
  chipPeligro: { color: c.danger, backgroundColor: c.dangerSoft },
  chipAcento: { color: c.goldText, backgroundColor: c.accentSoft },
  chipEnlace: { color: c.goldText },
  hechaTxt: { fontFamily: font.semibold, fontSize: 12, color: c.success },
}));
