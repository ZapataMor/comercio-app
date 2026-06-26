import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getCatalogo, Negocio, Producto } from '../api';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { RootStackParamList } from '../navTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'Negocio'>;

function precioCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function NegocioScreen({ route, navigation }: Props) {
  const { auth } = useAuth();
  const cart = useCart();
  const { id, nombre } = route.params;
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalogo(auth!.token, id)
      .then(({ negocio: n, productos: p }) => {
        setNegocio(n);
        setProductos(p);
      })
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, [auth, id]);

  function onAgregar(p: Producto) {
    const ok = cart.agregar(id, nombre, p);
    if (!ok) {
      Alert.alert(
        'Tienes otra tienda en el carrito',
        `Tu carrito tiene productos de "${cart.negocioNombre}". Vacíalo para pedir de "${nombre}".`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Vaciar y agregar',
            onPress: () => {
              cart.vaciar();
              cart.agregar(id, nombre, p);
            },
          },
        ],
      );
    }
  }

  if (cargando) {
    return <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <FlatList
      style={styles.container}
      data={productos}
      keyExtractor={p => String(p.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
      ListHeaderComponent={
        negocio ? (
          <View style={styles.cabecera}>
            {!!negocio.descripcion && <Text style={styles.desc}>{negocio.descripcion}</Text>}
            {!!negocio.direccion && <Text style={styles.dato}>📍 {negocio.direccion}</Text>}
          </View>
        ) : null
      }
      ListEmptyComponent={<Text style={styles.vacio}>Este negocio no tiene productos disponibles.</Text>}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <View style={styles.itemTexto}>
            <View style={styles.tituloRow}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              {item.categoria && <Text style={styles.cat}>{item.categoria.nombre}</Text>}
            </View>
            <Text style={styles.precio}>{item.precio_formateado ?? precioCOP(item.precio)}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => onAgregar(item)}>
            <Text style={styles.addTxt}>+ Pedir</Text>
          </TouchableOpacity>
        </View>
      )}
      ListFooterComponent={
        cart.count > 0 ? (
          <TouchableOpacity style={styles.verCarrito} onPress={() => navigation.navigate('Carrito')}>
            <Text style={styles.verCarritoTxt}>🛒 Ver carrito ({cart.count})</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  cabecera: { marginBottom: 12 },
  desc: { color: '#475569', fontSize: 15 },
  dato: { color: '#94a3b8', fontSize: 13, marginTop: 6 },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  itemTexto: { flex: 1, marginRight: 10 },
  tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cat: {
    fontSize: 11, color: '#64748b', backgroundColor: '#f1f5f9',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  precio: { color: '#4f46e5', fontWeight: '700', fontSize: 15, marginTop: 4 },
  addBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addTxt: { color: '#fff', fontWeight: '700' },
  verCarrito: {
    backgroundColor: '#16a34a', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  verCarritoTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, margin: 16 },
});
