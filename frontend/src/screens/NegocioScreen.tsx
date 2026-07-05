import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  GestureResponderEvent,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getCatalogo, imagenUrl, Negocio, Producto } from '../api';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { FadeInView, PressableScale } from '../components/anim';
import { useFlyToCart } from '../components/FlyToCart';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Negocio'>;

type CatalogoFila =
  | { tipo: 'categoria'; key: string; nombre: string; cantidad: number }
  | { tipo: 'producto'; key: string; producto: Producto };

function precioCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function categoriasNegocio(negocio: Negocio) {
  return negocio.categorias?.length ? negocio.categorias : negocio.categoria ? [negocio.categoria] : [];
}

function construirCatalogo(productos: Producto[]): CatalogoFila[] {
  const grupos = new Map<string, Producto[]>();
  productos.forEach(producto => {
    const categoria = producto.categoria?.nombre?.trim() || 'Sin categoría';
    grupos.set(categoria, [...(grupos.get(categoria) ?? []), producto]);
  });

  return Array.from(grupos.entries()).flatMap(([categoria, items]) => [
    { tipo: 'categoria' as const, key: `cat-${categoria}`, nombre: categoria, cantidad: items.length },
    ...items.map(producto => ({ tipo: 'producto' as const, key: `prod-${producto.id}`, producto })),
  ]);
}

export default function NegocioScreen({ route }: Props) {
  const { auth } = useAuth();
  const cart = useCart();
  const { volar } = useFlyToCart();
  const { id, nombre, productoId } = route.params;
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const catalogo = useMemo(() => construirCatalogo(productos), [productos]);
  const listaRef = useRef<FlatList<CatalogoFila>>(null);
  const negocioAbierto = negocio?.activo !== false;

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
    if (productoId == null || catalogo.length === 0) return;
    const indice = catalogo.findIndex(fila => fila.tipo === 'producto' && fila.producto.id === productoId);
    if (indice < 0) return;
    const t = setTimeout(() => {
      listaRef.current?.scrollToIndex({ index: indice, viewPosition: 0.3, animated: true });
    }, 350);
    return () => clearTimeout(t);
  }, [productoId, catalogo]);

  function onAgregar(p: Producto, e: GestureResponderEvent) {
    if (!negocioAbierto) {
      Alert.alert('Negocio cerrado', 'Este negocio está cerrado ahora. Puedes revisar el catálogo, pero no hacer pedidos.');
      return;
    }

    // Punto exacto del toque sobre "Pedir": desde ahí salta el paquetito
    // que vuela hasta el botón flotante de Carrito.
    const desde = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    const ok = cart.agregar(id, nombre, p);
    if (ok) {
      volar(desde);
      return;
    }
    Alert.alert(
      'Tienes otra tienda en el carrito',
      `Tu carrito tiene productos de "${cart.negocioNombre}". Vacíalo para pedir de "${nombre}".`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Vaciar y agregar',
          onPress: () => {
            cart.reemplazar(id, nombre, p);
            volar(desde);
          },
        },
      ],
    );
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
      data={catalogo}
      keyExtractor={fila => fila.key}
      // Aire abajo para la barra flotante fija (Carrito / Mis pedidos).
      contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
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
            <View style={styles.hero}>
              {imagenUrl(negocio.imagen) ? (
                <Image
                  source={{ uri: imagenUrl(negocio.imagen) }}
                  style={styles.heroImagen}
                  resizeMode="cover"
                  blurRadius={6}
                />
              ) : (
                <View style={[styles.heroImagen, styles.heroVacio]}>
                  <Icon name="tienda" size={52} color={c.mutedSoft} />
                </View>
              )}
              <View style={styles.heroScrim} />
              <View style={styles.heroContenido}>
                {!!negocio.categoria && <Text style={styles.heroCategoria}>{negocio.categoria}</Text>}
                <Text style={styles.heroNombre} numberOfLines={2}>{negocio.nombre}</Text>
                <Text style={negocio.activo ? styles.heroEstadoAbierto : styles.heroEstadoCerrado}>
                  {negocio.activo ? 'Abierto' : 'Cerrado'}
                </Text>
                {!!negocio.direccion && (
                  <View style={styles.heroDato}>
                    <Icon name="ubicacion" size={13} color="rgba(255,255,255,0.78)" />
                    <Text style={styles.heroDatoTxt} numberOfLines={1}>{negocio.direccion}</Text>
                  </View>
                )}
              </View>
            </View>
            {!!negocio.descripcion && <Text style={styles.desc}>{negocio.descripcion}</Text>}
            {categoriasNegocio(negocio).length > 0 && (
              <View style={styles.categoriasChips}>
                {categoriasNegocio(negocio).map(categoria => (
                  <View key={categoria} style={styles.categoriaChip}>
                    <Text style={styles.categoriaChipTxt}>{categoria}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.catalogoTitulo}>Catálogo</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={<Text style={styles.vacio}>Este negocio no tiene productos disponibles.</Text>}
      renderItem={({ item, index }) =>
        item.tipo === 'categoria' ? (
          <View style={styles.seccionHead}>
            <Text style={styles.seccionTitulo}>{item.nombre}</Text>
            <Text style={styles.seccionConteo}>{item.cantidad} {item.cantidad === 1 ? 'producto' : 'productos'}</Text>
          </View>
        ) : (
        <FadeInView delay={Math.min(index, 8) * 45}>
          <View style={[styles.item, item.producto.id === productoId && styles.itemDestacado]}>
            {imagenUrl(item.producto.imagen) ? (
              <Image source={{ uri: imagenUrl(item.producto.imagen) }} style={styles.thumb} resizeMode="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbVacio]}>
                <Icon name="caja" size={22} color={c.muted} />
              </View>
            )}
            <View style={styles.itemTexto}>
              <Text style={styles.nombre}>{item.producto.nombre}</Text>
              {!!item.producto.descripcion && (
                <Text style={styles.productoDesc} numberOfLines={2}>{item.producto.descripcion}</Text>
              )}
              <Text style={styles.precio}>
                {item.producto.precio_formateado ?? precioCOP(item.producto.precio)}
              </Text>
            </View>
            <PressableScale
              style={[styles.addBtn, !negocioAbierto && styles.addBtnOff]}
              disabled={!negocioAbierto}
              onPress={e => onAgregar(item.producto, e)}>
              <Text style={[styles.addTxt, !negocioAbierto && styles.addTxtOff]}>
                {negocioAbierto ? '+ Pedir' : 'Cerrado'}
              </Text>
            </PressableScale>
          </View>
        </FadeInView>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  cabecera: { marginBottom: 6 },
  hero: {
    height: 220,
    borderRadius: radius.lg,
    marginBottom: 14,
    overflow: 'hidden',
    backgroundColor: c.surface2,
    ...shadow.card,
  },
  heroImagen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  heroVacio: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
  heroScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(31,27,22,0.42)' },
  heroContenido: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  heroCategoria: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
    fontFamily: font.semibold,
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  heroNombre: {
    color: '#FFFFFF',
    fontFamily: font.displayExtra,
    fontSize: 31,
    lineHeight: 38,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.34)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroEstadoAbierto: {
    marginTop: 12, color: c.success, backgroundColor: c.successSoft, fontFamily: font.bold,
    fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden',
  },
  heroEstadoCerrado: {
    marginTop: 12, color: c.danger, backgroundColor: c.dangerSoft, fontFamily: font.bold,
    fontSize: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden',
  },
  heroDato: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, maxWidth: '92%' },
  heroDatoTxt: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontFamily: font.medium, flexShrink: 1 },
  desc: { color: c.text, fontSize: 15, lineHeight: 21, fontFamily: font.regular, marginBottom: 14 },
  categoriasChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  categoriaChip: {
    backgroundColor: c.accentSoft,
    borderColor: c.accent,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoriaChipTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 12 },
  catalogoTitulo: { color: c.textStrong, fontSize: 22, fontFamily: font.display, marginBottom: 2 },
  seccionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 14,
    marginBottom: 8,
  },
  seccionTitulo: { color: c.textStrong, fontSize: 18, fontFamily: font.displaySemi, flex: 1 },
  seccionConteo: { color: c.muted, fontSize: 12, fontFamily: font.medium, marginLeft: 10 },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  itemDestacado: { borderWidth: 2, borderColor: c.accent, backgroundColor: c.accentSoft },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, marginRight: 12, backgroundColor: c.surface2 },
  thumbVacio: { alignItems: 'center', justifyContent: 'center' },
  itemTexto: { flex: 1, marginRight: 10 },
  nombre: { fontSize: 15, fontFamily: font.semibold, color: c.textStrong },
  productoDesc: { color: c.muted, fontSize: 12, lineHeight: 16, marginTop: 2, fontFamily: font.regular },
  precio: { color: c.goldText, fontFamily: font.extra, fontSize: 15, marginTop: 4 },
  addBtn: { backgroundColor: c.accent, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 9, ...shadow.gold },
  addTxt: { color: c.onAccent, fontFamily: font.bold },
  addBtnOff: { backgroundColor: c.surface2, shadowOpacity: 0, elevation: 0 },
  addTxtOff: { color: c.mutedSoft },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
});
