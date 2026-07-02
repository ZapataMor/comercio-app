import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ComercioPedido, getPedidosComercio, marcarPedidoListo } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { c, estadoColor, font, radius, shadow } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'ComercioPedidoDetalle'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function ComercioPedidoDetalleScreen({ route, navigation }: Props) {
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [pedido, setPedido] = useState<ComercioPedido | null>(route.params.pedido ?? null);
  const [cargando, setCargando] = useState(!route.params.pedido);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (pedido || !route.params.pedidoId) {
      setCargando(false);
      return;
    }

    getPedidosComercio(token)
      .then(pedidos => {
        const encontrado = pedidos.find(p => p.id === route.params.pedidoId);
        if (encontrado) {
          setPedido(encontrado);
        } else {
          toast.error('Pedido no encontrado', 'Actualiza la lista de pedidos.');
        }
      })
      .catch(e => toast.error('No se pudo cargar', e instanceof Error ? e.message : 'Error'))
      .finally(() => setCargando(false));
  }, [pedido, route.params.pedidoId, toast, token]);

  async function onListo() {
    if (!pedido) {
      return;
    }
    setEnviando(true);
    try {
      await marcarPedidoListo(token, pedido.id);
      toast.exito('Pedido listo', 'Los domiciliarios ya pueden recogerlo.');
      navigation.goBack();
    } catch (e) {
      toast.error('No se pudo', e instanceof Error ? e.message : 'Error');
      setEnviando(false);
    }
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!pedido) {
    return (
      <View style={styles.centro}>
        <Text style={styles.nota}>No se pudo abrir este pedido.</Text>
      </View>
    );
  }

  const ec = estadoColor(pedido.estado);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <FadeInView style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.pid}>Pedido #{pedido.id}</Text>
          <Text style={[styles.badge, { backgroundColor: ec.bg, color: ec.fg }]}>
            {pedido.estado_label}
          </Text>
        </View>

        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Cliente</Text>
          <View style={styles.filaInfo}>
            <Icon name="usuario" size={15} color={c.textStrong} />
            <Text style={styles.cliente}>{pedido.cliente ?? 'Cliente'}</Text>
          </View>
          <View style={styles.filaInfo}>
            <Icon name="ubicacion" size={15} color={c.text} />
            <Text style={styles.linea}>{pedido.direccion_entrega}</Text>
          </View>
          {!!pedido.telefono_contacto && (
            <View style={styles.filaInfo}>
              <Icon name="telefono" size={15} color={c.text} />
              <Text style={styles.linea}>{pedido.telefono_contacto}</Text>
            </View>
          )}
          <View style={styles.filaInfo}>
            <Icon name="tarjeta" size={15} color={c.text} />
            <Text style={styles.linea}>Pago: {pedido.metodo_pago}</Text>
          </View>
          {!!pedido.domiciliario && (
            <View style={styles.filaInfo}>
              <Icon name="moto" size={15} color={c.text} />
              <Text style={styles.linea}>Domiciliario: {pedido.domiciliario}</Text>
            </View>
          )}
        </View>

        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Productos</Text>
          {pedido.items.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemCant}>{it.cantidad}×</Text>
              <Text style={styles.itemNombre}>{it.nombre}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValor}>{cop(pedido.total)}</Text>
        </View>
      </FadeInView>

      {pedido.estado === 'pendiente' ? (
        <PressableScale style={styles.btn} onPress={onListo} disabled={enviando}>
          {enviando ? (
            <ActivityIndicator color={c.onBrand} />
          ) : (
            <Text style={styles.btnTxt}>Marcar listo para recoger</Text>
          )}
        </PressableScale>
      ) : pedido.estado === 'listo' ? (
        <View style={styles.filaNota}>
          <Icon name="reloj" size={16} color={c.muted} />
          <Text style={[styles.nota, styles.notaInline]}>Esperando que un domiciliario lo tome…</Text>
        </View>
      ) : pedido.estado === 'entregado' ? (
        <View style={styles.filaNota}>
          <Icon name="check" size={16} color={c.success} />
          <Text style={[styles.nota, styles.notaInline, { color: c.success }]}>Entregado al cliente</Text>
        </View>
      ) : (
        <View style={styles.filaNota}>
          <Icon name="moto" size={16} color={c.muted} />
          <Text style={[styles.nota, styles.notaInline]}>{pedido.estado_label}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, padding: 20 },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 18, ...shadow.soft },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pid: { fontFamily: font.extra, color: c.textStrong, fontSize: 18 },
  badge: { fontSize: 11, fontFamily: font.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  bloque: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12, marginTop: 12 },
  bloqueTitulo: { fontSize: 12, fontFamily: font.bold, color: c.mutedSoft, marginBottom: 6, textTransform: 'uppercase' },
  cliente: { fontFamily: font.bold, color: c.textStrong, fontSize: 15 },
  linea: { color: c.text, fontSize: 14, flex: 1, fontFamily: font.regular },
  filaInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  filaNota: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  notaInline: { marginTop: 0 },
  itemRow: { flexDirection: 'row', marginTop: 4 },
  itemCant: { fontFamily: font.bold, color: c.goldText, width: 36 },
  itemNombre: { color: c.text, fontSize: 15, flex: 1, fontFamily: font.regular },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14, marginTop: 14,
  },
  totalLabel: { fontFamily: font.bold, color: c.textStrong, fontSize: 16 },
  totalValor: { fontFamily: font.extra, color: c.textStrong, fontSize: 18 },
  btn: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 16, ...shadow.soft },
  btnTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
  nota: { textAlign: 'center', color: c.muted, marginTop: 16, fontSize: 14, fontFamily: font.regular },
});
