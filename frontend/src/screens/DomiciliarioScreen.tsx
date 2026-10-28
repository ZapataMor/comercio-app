import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  avanzarPedido,
  getDisponibles,
  getHistorialEntregas,
  getMiReputacion,
  getMisEntregas,
  Pedido,
  ReputacionDetalle,
  reportarNovedad,
  tomarPedido,
} from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import BotonesContacto from '../components/BotonesContacto';
import Icon, { IconName } from '../components/Icon';
import { NivelBadge, TarjetaReputacion } from '../components/Reputacion';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function DomiciliarioScreen() {
  const { c, estadoColor } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [disponibles, setDisponibles] = useState<Pedido[]>([]);
  const [entregas, setEntregas] = useState<Pedido[]>([]);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  // Mi nivel de confiabilidad; vetado = no puedo tomar pedidos nuevos.
  const [reputacion, setReputacion] = useState<ReputacionDetalle | null>(null);
  const [vetado, setVetado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(
    (refresco = false, silencioso = false) => {
      if (refresco) {
        setRefrescando(true);
      } else if (!silencioso) {
        setCargando(true);
      }

      Promise.all([getDisponibles(token), getMisEntregas(token), getHistorialEntregas(token), getMiReputacion(token)])
        .then(([d, e, h, r]) => {
          setDisponibles(d.pedidos);
          setVetado(d.vetado);
          setEntregas(e);
          setHistorial(h);
          setReputacion(r);
        })
        .catch(err => toast.error('Error', err.message))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token],
  );

  useEffect(() => {
    cargar();
    const timer = setInterval(() => cargar(false, true), 5000);
    return () => clearInterval(timer);
  }, [cargar]);

  async function onTomar(id: number, minutos: number) {
    try {
      await tomarPedido(token, id, minutos);
      cargar();
    } catch (e) {
      toast.error('No se pudo tomar', e instanceof Error ? e.message : 'Error');
    }
  }

  async function onAvanzar(id: number, accion: string) {
    try {
      await avanzarPedido(token, id, accion);
      cargar();
    } catch (e) {
      toast.error('No se pudo actualizar', e instanceof Error ? e.message : 'Error');
    }
  }

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />
      }>
      {!!reputacion && (
        <View style={styles.miNivel}>
          <Icon name="escudo" size={16} color={c.accent} />
          <Text style={styles.miNivelTxt}>Tu nivel de confiabilidad</Text>
          <NivelBadge reputacion={reputacion.reputacion} />
        </View>
      )}

      <Text style={styles.seccion}>Pedidos disponibles</Text>
      {vetado ? (
        <View style={styles.vetado}>
          <Icon name="alerta" size={18} color={c.danger} />
          <Text style={styles.vetadoTxt}>
            Tu cuenta de domiciliario está suspendida por baja confiabilidad, así que no puedes tomar pedidos nuevos.
            Termina las entregas que llevas; un administrador revisará tu caso.
          </Text>
        </View>
      ) : disponibles.length === 0 ? (
        <Text style={styles.vacio}>No hay pedidos disponibles ahora.</Text>
      ) : (
        disponibles.map((p, i) => (
          <FadeInView key={p.id} delay={i * 50}>
            <DisponibleCard pedido={p} onTomar={onTomar} />
          </FadeInView>
        ))
      )}

      <Text style={styles.seccion}>Mis entregas en curso</Text>
      {entregas.length === 0 ? (
        <Text style={styles.vacio}>No tienes entregas en curso.</Text>
      ) : (
        entregas.map((p, i) => {
          const ec = estadoColor(p.estado);
          return (
            <FadeInView key={p.id} delay={i * 50}>
              <View style={[styles.card, styles.bordeAzul]}>
                <View style={styles.cardHead}>
                  <Text style={styles.pedidoId}>Pedido #{p.id}</Text>
                  <Text style={[styles.badge, { backgroundColor: ec.bg, color: ec.fg }]}>{p.estado_label}</Text>
                </View>
                <View style={[styles.linea, styles.fila]}>
                  <Icon name="tienda" size={14} color={c.text} />
                  <Text style={[styles.linea, { flex: 1 }]}>
                    Recoger: {p.negocio?.nombre} — {p.negocio?.direccion ?? 's/d'}
                  </Text>
                </View>
                <View style={[styles.linea, styles.fila]}>
                  <Icon name="casa" size={14} color={c.text} />
                  <Text style={[styles.linea, { flex: 1 }]}>
                    Entregar: {p.cliente?.name} — {p.direccion_entrega}
                  </Text>
                </View>
                <View style={[styles.linea, styles.fila]}>
                  <Icon name="tarjeta" size={14} color={c.text} />
                  <Text style={styles.linea}>
                    {p.cobrar > 0
                      ? `Cobrar al cliente: ${cop(p.cobrar)} en efectivo`
                      : 'Pagado por transferencia: no cobres nada'}
                  </Text>
                </View>
                <Text style={styles.lineaSub}>
                  Productos {cop(p.subtotal ?? p.total)} · Domicilio {cop(p.costo_domicilio ?? 0)}
                </Text>
                {/* Antes de recoger se coordina con el negocio; después, con el cliente. */}
                {p.estado === 'tomado' ? (
                  <BotonesContacto
                    telefono={p.negocio?.telefono}
                    mensaje={`Hola, soy el domiciliario de Vitrina que va por el pedido #${p.id}.`}
                    etiquetaLlamar="Llamar al negocio"
                  />
                ) : (
                  <BotonesContacto
                    telefono={p.telefono_contacto}
                    mensaje={`Hola, soy tu domiciliario de Vitrina con el pedido #${p.id}.`}
                    etiquetaLlamar="Llamar al cliente"
                  />
                )}
                <Novedad pedido={p} onReportada={() => cargar(false, true)} />
                {p.estado === 'tomado' && (
                  <Boton icon="caja" texto="Marcar recogido" onPress={() => onAvanzar(p.id, 'recogido')} />
                )}
                {p.estado === 'recogido' && (
                  <Boton icon="moto" texto="Salir / En camino" onPress={() => onAvanzar(p.id, 'en-camino')} />
                )}
                {p.estado === 'en_camino' && (
                  <Boton icon="check" texto="Marcar entregado" color={c.success} onPress={() => onAvanzar(p.id, 'entregado')} />
                )}
              </View>
            </FadeInView>
          );
        })
      )}

      <Text style={styles.seccion}>Historial</Text>
      {historial.length === 0 ? (
        <Text style={styles.vacio}>Aún no has completado entregas.</Text>
      ) : (
        historial.map(p => (
          <View key={p.id} style={styles.histItem}>
            <Text style={styles.linea}>Pedido #{p.id} · {p.negocio?.nombre}</Text>
            <Text style={styles.histOk}>Entregado · {cop(p.total)}</Text>
          </View>
        ))
      )}

      {!!reputacion && (
        <View style={{ marginTop: 18 }}>
          <TarjetaReputacion
            reputacion={reputacion.reputacion}
            eventos={reputacion.eventos}
            explicacion={
              'Sube cuando el cliente queda conforme y cuando entregas el dinero completo al negocio. ' +
              'Baja si recoges después de lo que prometiste, si llegas tarde sin avisar o si hay quejas. ' +
              'Con menos de 30 puntos, o 2 faltas graves (pedido que no llegó, dinero no entregado) en 30 días, ' +
              'la cuenta se suspende. ¿Te vas a demorar? Reporta una novedad y la demora no te resta.'
            }
          />
        </View>
      )}
    </ScrollView>
  );
}

/** Motivos rápidos para justificar una demora. */
const NOVEDADES = ['Lluvia fuerte', 'Tráfico o vía cerrada', 'Problema con la moto', 'El negocio no lo tenía listo', 'No encuentro la dirección'];

/**
 * Reportar una novedad de una entrega en curso: el cliente y el negocio la
 * ven, y una demora justificada no resta confiabilidad.
 */
function Novedad({ pedido, onReportada }: { pedido: Pedido; onReportada: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [otra, setOtra] = useState('');

  async function enviar(texto: string) {
    if (!texto.trim()) return;
    try {
      await reportarNovedad(auth!.token, pedido.id, texto.trim());
      toast.exito('Novedad reportada', 'El cliente ya la puede ver.');
      setAbierto(false);
      setOtra('');
      onReportada();
    } catch (e) {
      toast.error('No se pudo reportar', e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <View>
      {!!pedido.novedad && (
        <View style={styles.novedadActual}>
          <Icon name="alerta" size={14} color={c.warning} />
          <Text style={styles.novedadActualTxt}>Novedad: {pedido.novedad}</Text>
        </View>
      )}
      {abierto ? (
        <View style={styles.novedadCaja}>
          <Text style={styles.minLabel}>¿Qué está pasando?</Text>
          <View style={styles.chips}>
            {NOVEDADES.map(n => (
              <PressableScale key={n} style={styles.chip} onPress={() => enviar(n)}>
                <Text style={styles.chipTxt}>{n}</Text>
              </PressableScale>
            ))}
          </View>
          <View style={styles.otraFila}>
            <TextInput
              style={styles.otraInput}
              value={otra}
              onChangeText={setOtra}
              placeholder="Otra cosa…"
              placeholderTextColor={c.mutedSoft}
              maxLength={255}
            />
            <PressableScale style={styles.otraBtn} onPress={() => enviar(otra)}>
              <Text style={styles.otraBtnTxt}>Enviar</Text>
            </PressableScale>
          </View>
          <PressableScale onPress={() => setAbierto(false)}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </PressableScale>
        </View>
      ) : (
        <PressableScale style={styles.novedadLink} onPress={() => setAbierto(true)}>
          <Icon name="reloj" size={14} color={c.goldText} />
          <Text style={styles.novedadLinkTxt}>{pedido.novedad ? 'Cambiar novedad' : '¿Te vas a demorar? Reporta una novedad'}</Text>
        </PressableScale>
      )}
    </View>
  );
}

function Boton({
  texto,
  onPress,
  icon,
  color,
}: {
  texto: string;
  onPress: () => void;
  icon?: IconName;
  color?: string;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <PressableScale style={[styles.btn, styles.btnFila, { backgroundColor: color ?? c.brand }]} onPress={onPress}>
      {icon && <Icon name={icon} size={16} color={c.onBrand} />}
      <Text style={styles.btnTxt}>{texto}</Text>
    </PressableScale>
  );
}

function DisponibleCard({ pedido, onTomar }: { pedido: Pedido; onTomar: (id: number, min: number) => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const [min, setMin] = useState('15');
  return (
    <View style={[styles.card, styles.bordeAmbar]}>
      <View style={styles.cardHead}>
        <Text style={styles.pedidoId}>Pedido #{pedido.id}</Text>
        <Text style={styles.total}>{cop(pedido.total)}</Text>
      </View>
      <View style={[styles.linea, styles.fila]}>
        <Icon name="tienda" size={14} color={c.text} />
        <Text style={[styles.linea, { flex: 1 }]}>{pedido.negocio?.nombre}</Text>
      </View>
      <View style={[styles.lineaSub, styles.fila]}>
        <Icon name="ubicacion" size={13} color={c.mutedSoft} />
        <Text style={[styles.lineaSub, { flex: 1 }]}>{pedido.negocio?.direccion ?? 'Sin dirección'}</Text>
      </View>
      <Text style={styles.lineaSub}>
        {pedido.items.reduce((s, i) => s + i.cantidad, 0)} producto(s) · Domicilio {cop(pedido.costo_domicilio ?? 0)} ·{' '}
        {pedido.metodo_pago === 'efectivo' ? `cobras ${cop(pedido.cobrar)}` : 'ya pagado'}
      </Text>
      <View style={styles.tomarRow}>
        <View>
          <Text style={styles.minLabel}>Recojo en (min)</Text>
          <TextInput
            style={styles.minInput}
            value={min}
            onChangeText={setMin}
            keyboardType="number-pad"
          />
        </View>
        <PressableScale
          style={styles.tomarBtn}
          onPress={() => onTomar(pedido.id, parseInt(min, 10) || 15)}>
          <Text style={styles.tomarTxt}>Tomar pedido</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 18, marginBottom: 8 },
  card: {
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  bordeAmbar: { borderLeftWidth: 4, borderLeftColor: c.accent },
  bordeAzul: { borderLeftWidth: 4, borderLeftColor: c.info },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pedidoId: { fontSize: 15, fontFamily: font.bold, color: c.textStrong },
  total: { fontFamily: font.bold, color: c.textStrong },
  badge: {
    fontSize: 11, fontFamily: font.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden',
  },
  linea: { color: c.text, marginTop: 4, fontSize: 14, fontFamily: font.regular },
  lineaSub: { color: c.mutedSoft, marginTop: 4, fontSize: 13, fontFamily: font.regular },
  tomarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12 },
  minLabel: { fontSize: 11, color: c.muted, marginBottom: 4, fontFamily: font.regular },
  minInput: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 9, width: 90, textAlign: 'center', color: c.textStrong, fontFamily: font.semibold,
  },
  tomarBtn: { flex: 1, backgroundColor: c.accent, borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center', ...shadow.gold },
  tomarTxt: { color: c.onAccent, fontFamily: font.bold },
  btn: { borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  btnFila: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnTxt: { color: c.onBrand, fontFamily: font.bold },
  histItem: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: c.surface,
    borderRadius: radius.md, padding: 14, marginBottom: 8, ...shadow.low,
  },
  histOk: { color: c.success, fontFamily: font.semibold },
  vacio: { color: c.muted, fontSize: 14, fontFamily: font.regular },
  miNivel: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface,
    borderRadius: radius.md, padding: 12, ...shadow.low,
  },
  miNivelTxt: { flex: 1, color: c.text, fontFamily: font.semibold },
  vetado: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: c.dangerSoft,
    borderRadius: radius.md, padding: 14,
  },
  vetadoTxt: { flex: 1, color: c.danger, fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  novedadActual: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.warningSoft,
    borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10,
  },
  novedadActualTxt: { flex: 1, color: c.warning, fontSize: 13, fontFamily: font.medium },
  novedadLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 4 },
  novedadLinkTxt: { color: c.goldText, fontSize: 13, fontFamily: font.semibold },
  novedadCaja: { marginTop: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipTxt: { color: c.text, fontSize: 13, fontFamily: font.medium },
  otraFila: { flexDirection: 'row', gap: 8, marginTop: 10 },
  otraInput: {
    flex: 1, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 8, color: c.textStrong, fontFamily: font.regular,
  },
  otraBtn: { backgroundColor: c.brand, borderRadius: radius.sm, paddingHorizontal: 16, justifyContent: 'center' },
  otraBtnTxt: { color: c.onBrand, fontFamily: font.bold },
  cancelar: { color: c.muted, fontSize: 13, marginTop: 10, fontFamily: font.medium },
}));
