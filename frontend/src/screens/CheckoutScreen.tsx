import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
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
import { crearPedido } from '../api';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { RootStackParamList } from '../navTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function CheckoutScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const cart = useCart();
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pago, setPago] = useState('efectivo');
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!direccion.trim() || !telefono.trim()) {
      Alert.alert('Faltan datos', 'Escribe la dirección y el teléfono.');
      return;
    }
    setEnviando(true);
    try {
      await crearPedido(auth!.token, {
        negocio_id: cart.negocioId!,
        items: cart.items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        metodo_pago: pago,
        direccion_entrega: direccion,
        telefono_contacto: telefono,
      });
      cart.vaciar();
      Alert.alert('¡Pedido confirmado!', 'El negocio ya recibió tu pedido.');
      navigation.navigate('MisPedidos');
    } catch (e) {
      Alert.alert('No se pudo confirmar', e instanceof Error ? e.message : 'Error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.resumen}>
        <Text style={styles.resumenTitulo}>🏪 {cart.negocioNombre}</Text>
        {cart.items.map(i => (
          <View key={i.producto_id} style={styles.linea}>
            <Text style={styles.lineaTxt}>{i.cantidad}× {i.nombre}</Text>
            <Text style={styles.lineaTxt}>{cop(i.precio * i.cantidad)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValor}>{cop(cart.total)}</Text>
        </View>
      </View>

      <Text style={styles.label}>Dirección de entrega</Text>
      <TextInput style={styles.input} value={direccion} onChangeText={setDireccion} placeholder="Calle, número, barrio…" />

      <Text style={styles.label}>Teléfono de contacto</Text>
      <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="300 123 4567" keyboardType="phone-pad" />

      <Text style={styles.label}>Forma de pago</Text>
      <View style={styles.pagos}>
        {[
          { v: 'efectivo', t: '💵 Efectivo' },
          { v: 'transferencia', t: '🏦 Transferencia' },
        ].map(op => (
          <TouchableOpacity
            key={op.v}
            style={[styles.pago, pago === op.v && styles.pagoOn]}
            onPress={() => setPago(op.v)}>
            <Text style={[styles.pagoTxt, pago === op.v && styles.pagoTxtOn]}>{op.t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.btn} onPress={confirmar} disabled={enviando}>
        {enviando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnTxt}>Confirmar pedido · {cop(cart.total)}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  resumen: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16 },
  resumenTitulo: { fontWeight: '700', color: '#334155', marginBottom: 8 },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  lineaTxt: { color: '#475569' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalLabel: { fontWeight: '700' },
  totalValor: { fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
  pagos: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  pago: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#fff' },
  pagoOn: { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
  pagoTxt: { color: '#475569', fontWeight: '600' },
  pagoTxtOn: { color: '#4338ca' },
  btn: { backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
