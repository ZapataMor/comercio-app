import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCatalogo, imagenUrl, Negocio, Producto } from '../api';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Negocio'>;

function precioCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function NegocioScreen({ route, navigation }: Props) {
  const { auth } = useAuth();
  const cart = useCart();
  const { id, nombre, productoId } = route.params;
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listaRef = useRef<FlatList<Producto>>(null);

  useEffect(() => {
    getCatalogo(auth!.token, id)
      .then(({ negocio: n, productos: p }) => {
        setNegocio(n);
        setProductos(p);
      })
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, [auth, id]);

  // Si llegamos desde una búsqueda de producto, hacemos scroll hasta él una vez
  // que el catálogo cargó, para mostrarlo resaltado dentro de la lista.
  useEffect(() => {
    if (productoId == null || productos.length === 0) return;
    const indice = productos.findIndex(p => p.id === productoId);
    if (indice < 0) return;
    const t = setTimeout(() => {
      listaRef.current?.scrollToIndex({ index: indice, viewPosition: 0.3, animated: true });
    }, 350);
    return () => clearTimeout(t);
  }, [productoId, productos]);

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
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <FlatList
      ref={listaRef}
      style={styles.container}
      data={productos}
      keyExtractor={p => String(p.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
      // El scroll a un índice puede fallar si aún no se midió: reintentamos por
      // offset aproximado y luego al índice exacto.
      onScrollToIndexFailed={info => {
        listaRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: true,
        });
        setTimeout(() => {
          listaRef.current?.scrollToIndex({
            index: info.index,
            viewPosition: 0.3,
            animated: true,
          });
        }, 300);
      }}
      ListHeaderComponent={
        negocio ? (
          <View style={styles.cabecera}>
            {!!imagenUrl(negocio.imagen) && (
              <Image source={{ uri: imagenUrl(negocio.imagen) }} style={styles.portada} resizeMode="cover" />
            )}
            {!!negocio.descripcion && <Text style={styles.desc}>{negocio.descripcion}</Text>}
            {!!negocio.direccion && (
              <View style={[styles.dato, styles.fila]}>
                <Icon name="ubicacion" size={13} color={c.mutedSoft} />
                <Text style={styles.dato}>{negocio.direccion}</Text>
              </View>
            )}
          </View>
        ) : null
      }
      ListEmptyComponent={<Text style={styles.vacio}>Este negocio no tiene productos disponibles.</Text>}
      renderItem={({ item, index }) => (
        <FadeInView delay={Math.min(index, 8) * 45}>
          <View style={[styles.item, item.id === productoId && styles.itemDestacado]}>
            {imagenUrl(item.imagen) ? (
              <Image source={{ uri: imagenUrl(item.imagen) }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbVacio]}>
                <Icon name="caja" size={22} color={c.muted} />
              </View>
            )}
            <View style={styles.itemTexto}>
              <View style={styles.tituloRow}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                {item.categoria && <Text style={styles.cat}>{item.categoria.nombre}</Text>}
              </View>
              <Text style={styles.precio}>{item.precio_formateado ?? precioCOP(item.precio)}</Text>
            </View>
            <PressableScale style={styles.addBtn} onPress={() => onAgregar(item)}>
              <Text style={styles.addTxt}>+ Pedir</Text>
            </PressableScale>
          </View>
        </FadeInView>
      )}
      ListFooterComponent={
        cart.count > 0 ? (
          <PressableScale
            style={[styles.verCarrito, styles.filaCentro]}
            onPress={() => navigation.navigate('Carrito')}>
            <Icon name="carrito" size={18} color={c.onAccent} />
            <Text style={styles.verCarritoTxt}>Ver carrito ({cart.count})</Text>
          </PressableScale>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  cabecera: { marginBottom: 12 },
  portada: { width: '100%', height: 160, borderRadius: radius.md, marginBottom: 12, backgroundColor: c.surface2 },
  desc: { color: c.text, fontSize: 15, fontFamily: font.regular },
  dato: { color: c.mutedSoft, fontSize: 13, marginTop: 6, fontFamily: font.regular },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filaCentro: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  itemDestacado: { borderWidth: 2, borderColor: c.accent, backgroundColor: c.accentSoft },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, marginRight: 12, backgroundColor: c.surface2 },
  thumbVacio: { alignItems: 'center', justifyContent: 'center' },
  itemTexto: { flex: 1, marginRight: 10 },
  tituloRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { fontSize: 15, fontFamily: font.semibold, color: c.textStrong },
  cat: {
    fontSize: 11, color: c.muted, backgroundColor: c.surface2,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden', fontFamily: font.medium,
  },
  precio: { color: c.goldText, fontFamily: font.extra, fontSize: 15, marginTop: 4 },
  addBtn: { backgroundColor: c.accent, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 9, ...shadow.gold },
  addTxt: { color: c.onAccent, fontFamily: font.bold },
  verCarrito: {
    backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 8, ...shadow.gold,
  },
  verCarritoTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
});
