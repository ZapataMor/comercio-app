import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCart } from '../CartContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Carrito'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function CarritoScreen({ navigation }: Props) {
  const { items, negocioNombre, total, cambiar, quitar, vaciar } = useCart();

  if (items.length === 0) {
    return (
      <View style={styles.vacioBox}>
        <Icon name="carrito" size={48} color={c.chevron} />
        <Text style={styles.vacio}>Tu carrito está vacío.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Explorar')}>
          <Text style={styles.link}>Explorar negocios →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Aire abajo: el botón flotante "Mis pedidos" queda sobre la lista,
          por encima del pie de Total/Pagar. */}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96 }}>
        {!!negocioNombre && (
          <View style={[styles.tienda, styles.fila]}>
            <Icon name="tienda" size={15} color={c.text} />
            <Text style={styles.tienda}>{negocioNombre}</Text>
          </View>
        )}
        {items.map((i, idx) => (
          <FadeInView key={i.producto_id} delay={idx * 45}>
            <View style={styles.item}>
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
                <TouchableOpacity onPress={() => quitar(i.producto_id)} hitSlop={8}>
                  <Icon name="cerrar" size={16} color={c.danger} />
                </TouchableOpacity>
              </View>
            </View>
          </FadeInView>
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
        <PressableScale style={styles.btn} onPress={() => navigation.navigate('Checkout')}>
          <Text style={styles.btnTxt}>Continuar al pago →</Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  tienda: { fontFamily: font.bold, color: c.text, marginBottom: 12 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  nombre: { fontFamily: font.semibold, color: c.textStrong },
  precio: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  qtyTxt: { fontSize: 18, color: c.goldText, fontFamily: font.bold },
  qty: { minWidth: 18, textAlign: 'center', fontFamily: font.bold, color: c.textStrong },
  vaciar: { color: c.danger, textAlign: 'center', fontFamily: font.semibold },
  footer: { padding: 16, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { color: c.muted, fontSize: 16, fontFamily: font.medium },
  totalValor: { fontSize: 22, fontFamily: font.extra, color: c.textStrong },
  btn: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', ...shadow.gold },
  btnTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
  vacioBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  vacio: { color: c.muted, marginTop: 8, fontFamily: font.regular },
  link: { color: c.goldText, marginTop: 12, fontFamily: font.semibold },
});
