import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function CheckoutScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pago, setPago] = useState('efectivo');
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!direccion.trim() || !telefono.trim()) {
      toast.error('Faltan datos', 'Escribe la dirección y el teléfono.');
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
      toast.exito('¡Pedido confirmado!', 'El negocio ya recibió tu pedido.');
      navigation.navigate('MisPedidos');
    } catch (e) {
      toast.error('No se pudo confirmar', e instanceof Error ? e.message : 'Error');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      // Aire abajo para la barra flotante fija (Carrito / Mis pedidos).
      contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
      <FadeInView style={styles.resumen}>
        <View style={[styles.resumenTitulo, styles.fila]}>
          <Icon name="tienda" size={15} color={c.text} />
          <Text style={styles.resumenTitulo}>{cart.negocioNombre}</Text>
        </View>
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
      </FadeInView>

      <Text style={styles.label}>Dirección de entrega</Text>
      <TextInput style={styles.input} value={direccion} onChangeText={setDireccion} placeholder="Calle, número, barrio…" placeholderTextColor={c.mutedSoft} />

      <Text style={styles.label}>Teléfono de contacto</Text>
      <TextInput style={styles.input} value={telefono} onChangeText={setTelefono} placeholder="300 123 4567" placeholderTextColor={c.mutedSoft} keyboardType="phone-pad" />

      <Text style={styles.label}>Forma de pago</Text>
      <View style={styles.pagos}>
        {[
          { v: 'efectivo', t: 'Efectivo', icon: 'efectivo' as const },
          { v: 'transferencia', t: 'Transferencia', icon: 'banco' as const },
        ].map(op => (
          <TouchableOpacity
            key={op.v}
            style={[styles.pago, pago === op.v && styles.pagoOn]}
            onPress={() => setPago(op.v)}>
            <Icon name={op.icon} size={20} color={pago === op.v ? c.onAccent : c.muted} />
            <Text style={[styles.pagoTxt, pago === op.v && styles.pagoTxtOn]}>{op.t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <PressableScale style={styles.btn} onPress={confirmar} disabled={enviando}>
        {enviando ? (
          <ActivityIndicator color={c.onAccent} />
        ) : (
          <Text style={styles.btnTxt}>Confirmar pedido · {cop(cart.total)}</Text>
        )}
      </PressableScale>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  resumen: { backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 16, ...shadow.soft },
  resumenTitulo: { fontFamily: font.bold, color: c.text, marginBottom: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  lineaTxt: { color: c.text, fontFamily: font.regular },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  totalLabel: { fontFamily: font.bold, color: c.textStrong },
  totalValor: { fontFamily: font.extra, color: c.textStrong },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6, marginTop: 6 },
  input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, color: c.textStrong, fontFamily: font.regular },
  pagos: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  pago: { flex: 1, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', gap: 4, backgroundColor: c.surface },
  pagoOn: { borderColor: c.accent, backgroundColor: c.accentSoft },
  pagoTxt: { color: c.muted, fontFamily: font.semibold },
  pagoTxtOn: { color: c.onAccent },
  btn: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', ...shadow.gold },
  btnTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
});
