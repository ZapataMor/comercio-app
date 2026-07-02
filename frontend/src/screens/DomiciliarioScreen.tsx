import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  avanzarPedido,
  getDisponibles,
  getHistorialEntregas,
  getMisEntregas,
  Pedido,
  tomarPedido,
} from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon, { IconName } from '../components/Icon';
import { c, estadoColor, font, radius, shadow } from '../theme';
import { useToast } from '../Toast';

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function DomiciliarioScreen() {
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [disponibles, setDisponibles] = useState<Pedido[]>([]);
  const [entregas, setEntregas] = useState<Pedido[]>([]);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargar = useCallback(
    (refresco = false, silencioso = false) => {
      if (refresco) {
        setRefrescando(true);
      } else if (!silencioso) {
        setCargando(true);
      }

      Promise.all([getDisponibles(token), getMisEntregas(token), getHistorialEntregas(token)])
        .then(([d, e, h]) => {
          setDisponibles(d);
          setEntregas(e);
          setHistorial(h);
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
      <Text style={styles.seccion}>Pedidos disponibles</Text>
      {disponibles.length === 0 ? (
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
                  <Icon name="telefono" size={14} color={c.text} />
                  <Text style={styles.linea}>{p.telefono_contacto} ·</Text>
                  <Icon name="tarjeta" size={14} color={c.text} />
                  <Text style={styles.linea}>{p.metodo_pago}</Text>
                </View>
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
    </ScrollView>
  );
}

function Boton({
  texto,
  onPress,
  icon,
  color = c.brand,
}: {
  texto: string;
  onPress: () => void;
  icon?: IconName;
  color?: string;
}) {
  return (
    <PressableScale style={[styles.btn, styles.btnFila, { backgroundColor: color }]} onPress={onPress}>
      {icon && <Icon name={icon} size={16} color={c.onBrand} />}
      <Text style={styles.btnTxt}>{texto}</Text>
    </PressableScale>
  );
}

function DisponibleCard({ pedido, onTomar }: { pedido: Pedido; onTomar: (id: number, min: number) => void }) {
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
      <Text style={styles.lineaSub}>{pedido.items.reduce((s, i) => s + i.cantidad, 0)} producto(s)</Text>
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

const styles = StyleSheet.create({
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
});
