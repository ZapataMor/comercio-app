import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCart } from '../CartContext';
import { RootStackParamList } from '../navTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'Carrito'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function CarritoScreen({ navigation }: Props) {
  const { items, negocioNombre, total, cambiar, quitar, vaciar } = useCart();

  if (items.length === 0) {
    return (
      <View style={styles.vacioBox}>
        <Text style={styles.emoji}>🛒</Text>
        <Text style={styles.vacio}>Tu carrito está vacío.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Explorar')}>
          <Text style={styles.link}>Explorar negocios →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {!!negocioNombre && <Text style={styles.tienda}>🏪 {negocioNombre}</Text>}
        {items.map(i => (
          <View key={i.producto_id} style={styles.item}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{i.nombre}</Text>
              <Text style={styles.precio}>{cop(i.precio)} c/u</Text>
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => cambiar(i.producto_id, -1)}>
                <Text style={styles.qtyTxt}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qty}>{i.cantidad}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => cambiar(i.producto_id, 1)}>
                <Text style={styles.qtyTxt}>+</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => quitar(i.producto_id)}>
                <Text style={styles.quitar}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <TouchableOpacity onPress={vaciar} style={{ marginTop: 8 }}>
          <Text style={styles.vaciar}>Vaciar carrito</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValor}>{cop(total)}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Checkout')}>
          <Text style={styles.btnTxt}>Continuar al pago →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  tienda: { fontWeight: '700', color: '#334155', marginBottom: 12 },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 12, marginBottom: 10,
  },
  nombre: { fontWeight: '600', color: '#0f172a' },
  precio: { color: '#64748b', fontSize: 13, marginTop: 2 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  qtyTxt: { fontSize: 18, color: '#4f46e5', fontWeight: '700' },
  qty: { minWidth: 18, textAlign: 'center', fontWeight: '700' },
  quitar: { color: '#ef4444', fontSize: 16, marginLeft: 4 },
  vaciar: { color: '#ef4444', textAlign: 'center' },
  footer: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { color: '#64748b', fontSize: 16 },
  totalValor: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  btn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  vacioBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9' },
  emoji: { fontSize: 44 },
  vacio: { color: '#64748b', marginTop: 8 },
  link: { color: '#4f46e5', marginTop: 12, fontWeight: '600' },
});
