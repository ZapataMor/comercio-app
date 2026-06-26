import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function DomiciliarioScreen() {
  const { auth } = useAuth();
  const token = auth!.token;
  const [disponibles, setDisponibles] = useState<Pedido[]>([]);
  const [entregas, setEntregas] = useState<Pedido[]>([]);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    setCargando(true);
    Promise.all([getDisponibles(token), getMisEntregas(token), getHistorialEntregas(token)])
      .then(([d, e, h]) => {
        setDisponibles(d);
        setEntregas(e);
        setHistorial(h);
      })
      .catch(err => Alert.alert('Error', err.message))
      .finally(() => setCargando(false));
  }, [token]);

  useEffect(() => cargar(), [cargar]);

  async function onTomar(id: number, minutos: number) {
    try {
      await tomarPedido(token, id, minutos);
      cargar();
    } catch (e) {
      Alert.alert('No se pudo tomar', e instanceof Error ? e.message : 'Error');
    }
  }

  async function onAvanzar(id: number, accion: string) {
    try {
      await avanzarPedido(token, id, accion);
      cargar();
    } catch (e) {
      Alert.alert('No se pudo actualizar', e instanceof Error ? e.message : 'Error');
    }
  }

  if (cargando) {
    return <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.seccion}>Pedidos disponibles</Text>
      {disponibles.length === 0 ? (
        <Text style={styles.vacio}>No hay pedidos disponibles ahora.</Text>
      ) : (
        disponibles.map(p => <DisponibleCard key={p.id} pedido={p} onTomar={onTomar} />)
      )}

      <Text style={styles.seccion}>Mis entregas en curso</Text>
      {entregas.length === 0 ? (
        <Text style={styles.vacio}>No tienes entregas en curso.</Text>
      ) : (
        entregas.map(p => (
          <View key={p.id} style={[styles.card, styles.bordeAzul]}>
            <View style={styles.cardHead}>
              <Text style={styles.pedidoId}>Pedido #{p.id}</Text>
              <Text style={styles.badge}>{p.estado_label}</Text>
            </View>
            <Text style={styles.linea}>🏪 Recoger: {p.negocio?.nombre} — {p.negocio?.direccion ?? 's/d'}</Text>
            <Text style={styles.linea}>🏠 Entregar: {p.cliente?.name} — {p.direccion_entrega}</Text>
            <Text style={styles.linea}>📞 {p.telefono_contacto} · 💳 {p.metodo_pago}</Text>
            {p.estado === 'tomado' && (
              <Boton texto="📦 Marcar recogido" onPress={() => onAvanzar(p.id, 'recogido')} />
            )}
            {p.estado === 'recogido' && (
              <Boton texto="🛵 Salir / En camino" onPress={() => onAvanzar(p.id, 'en-camino')} />
            )}
            {p.estado === 'en_camino' && (
              <Boton texto="✓ Marcar entregado" color="#16a34a" onPress={() => onAvanzar(p.id, 'entregado')} />
            )}
          </View>
        ))
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

function Boton({ texto, onPress, color = '#4f46e5' }: { texto: string; onPress: () => void; color?: string }) {
  return (
    <TouchableOpacity style={[styles.btn, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.btnTxt}>{texto}</Text>
    </TouchableOpacity>
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
      <Text style={styles.linea}>🏪 {pedido.negocio?.nombre}</Text>
      <Text style={styles.lineaSub}>📍 {pedido.negocio?.direccion ?? 'Sin dirección'}</Text>
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
        <TouchableOpacity
          style={styles.tomarBtn}
          onPress={() => onTomar(pedido.id, parseInt(min, 10) || 15)}>
          <Text style={styles.btnTxt}>Tomar pedido</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  seccion: { fontSize: 16, fontWeight: '700', color: '#334155', marginTop: 18, marginBottom: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  bordeAmbar: { borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  bordeAzul: { borderLeftWidth: 4, borderLeftColor: '#4f46e5' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pedidoId: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  total: { fontWeight: '700', color: '#0f172a' },
  badge: {
    fontSize: 11, fontWeight: '700', backgroundColor: '#e0e7ff', color: '#4338ca',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  linea: { color: '#334155', marginTop: 4, fontSize: 14 },
  lineaSub: { color: '#94a3b8', marginTop: 4, fontSize: 13 },
  tomarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 12 },
  minLabel: { fontSize: 11, color: '#64748b', marginBottom: 4 },
  minInput: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, width: 90, textAlign: 'center',
  },
  tomarBtn: { flex: 1, backgroundColor: '#4f46e5', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btn: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  btnTxt: { color: '#fff', fontWeight: '700' },
  histItem: {
    flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 8,
  },
  histOk: { color: '#16a34a', fontWeight: '600' },
  vacio: { color: '#64748b', fontSize: 14 },
});
