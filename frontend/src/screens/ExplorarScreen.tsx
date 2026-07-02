import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  buscarProductos,
  getNegocios,
  imagenUrl,
  NegocioLista,
  ProductoConNegocio,
} from '../api';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { CardSkeletons, FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Explorar'>;

function precioCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function ExplorarScreen({ navigation }: Props) {
  const { auth, salir } = useAuth();
  const cart = useCart();
  const [negocios, setNegocios] = useState<NegocioLista[]>([]);
  const [productos, setProductos] = useState<ProductoConNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  // Con texto buscamos PRODUCTOS; sin texto mostramos los negocios abiertos.
  const buscando = busqueda.trim().length > 0;

  const cargar = useCallback(
    (texto: string, refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      setError(null);
      const t = texto.trim();
      const peticion = t
        ? buscarProductos(auth!.token, t).then(setProductos)
        : getNegocios(auth!.token).then(setNegocios);
      peticion
        .catch(e => setError(e.message))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [auth],
  );

  // Búsqueda con "debounce": espera 350 ms tras dejar de teclear.
  useEffect(() => {
    const t = setTimeout(() => cargar(busqueda), 350);
    return () => clearTimeout(t);
  }, [busqueda, cargar]);

  return (
    <FlatList<NegocioLista | ProductoConNegocio>
      style={styles.container}
      data={cargando ? [] : buscando ? productos : negocios}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={() => cargar(busqueda, true)}
          colors={[c.accent]}
          tintColor={c.accent}
        />
      }
      ListHeaderComponent={
        <View>
          <View style={styles.barra}>
            <TouchableOpacity
              style={[styles.accion, styles.filaAccion]}
              onPress={() => navigation.navigate('Carrito')}>
              <Icon name="carrito" size={15} color={c.accent} />
              <Text style={styles.accionTxt}>Carrito{cart.count > 0 ? ` (${cart.count})` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.accion, styles.filaAccion]}
              onPress={() => navigation.navigate('MisPedidos')}>
              <Icon name="lista" size={15} color={c.accent} />
              <Text style={styles.accionTxt}>Mis pedidos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.accion} onPress={salir}>
              <Text style={[styles.accionTxt, { color: c.danger }]}>Salir</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buscadorBox}>
            <Icon name="lupa" size={16} color={c.muted} style={styles.lupa} />
            <TextInput
              style={styles.buscador}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar negocio o producto…"
              placeholderTextColor={c.mutedSoft}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {busqueda.length > 0 && (
              <TouchableOpacity onPress={() => setBusqueda('')} hitSlop={8}>
                <Icon name="cerrar" size={16} color={c.muted} />
              </TouchableOpacity>
            )}
          </View>

          {cargando && <CardSkeletons count={4} />}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        !cargando ? (
          <Text style={styles.vacio}>
            {buscando ? `Sin resultados para "${busqueda}".` : 'No hay negocios abiertos ahora.'}
          </Text>
        ) : null
      }
      renderItem={({ item, index }) =>
        buscando
          ? renderProducto(item as ProductoConNegocio, navigation, index)
          : renderNegocio(item as NegocioLista, navigation, index)
      }
    />
  );
}

/** Tarjeta de producto (resultado de búsqueda): imagen, info y negocio. */
function renderProducto(
  item: ProductoConNegocio,
  navigation: Props['navigation'],
  index: number,
) {
  const img = imagenUrl(item.imagen);
  return (
    <FadeInView delay={Math.min(index, 8) * 45}>
      <PressableScale
        style={styles.card}
        onPress={() =>
          navigation.navigate('Negocio', {
            id: item.negocio.id,
            nombre: item.negocio.nombre,
            productoId: item.id,
          })
        }>
        <View style={styles.prodFila}>
          {img ? (
            <Image source={{ uri: img }} style={styles.prodThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.prodThumb, styles.prodThumbVacio]}>
              <Icon name="caja" size={26} color={c.muted} />
            </View>
          )}
          <View style={styles.prodTexto}>
            <Text style={styles.nombre} numberOfLines={1}>{item.nombre}</Text>
            <Text style={styles.precio}>{item.precio_formateado ?? precioCOP(item.precio)}</Text>
            {!!item.descripcion && (
              <Text style={styles.prodDesc} numberOfLines={2}>{item.descripcion}</Text>
            )}
            <View style={[styles.negocioFila, styles.filaAccion]}>
              <Icon name="tienda" size={13} color={c.accent} />
              <Text style={styles.negocioTxt} numberOfLines={1}>{item.negocio.nombre}</Text>
            </View>
          </View>
          <Icon name="chevron" size={18} color={c.chevron} />
        </View>
      </PressableScale>
    </FadeInView>
  );
}

/** Tarjeta de negocio abierto (vista por defecto, sin búsqueda). */
function renderNegocio(item: NegocioLista, navigation: Props['navigation'], index: number) {
  return (
    <FadeInView delay={Math.min(index, 8) * 45}>
      <PressableScale
        style={styles.card}
        onPress={() => navigation.navigate('Negocio', { id: item.id, nombre: item.nombre })}>
        {!!imagenUrl(item.imagen) && (
          <Image source={{ uri: imagenUrl(item.imagen) }} style={styles.portada} resizeMode="cover" />
        )}
        <View style={styles.cardHead}>
          <Text style={styles.nombre}>{item.nombre}</Text>
          <Text style={styles.abierto}>Abierto</Text>
        </View>
        {!!item.descripcion && <Text style={styles.desc} numberOfLines={2}>{item.descripcion}</Text>}
        {!!item.direccion && (
          <View style={[styles.dir, styles.filaAccion]}>
            <Icon name="ubicacion" size={13} color={c.mutedSoft} />
            <Text style={styles.dir}>{item.direccion}</Text>
          </View>
        )}
        <Text style={styles.cont}>{item.productos} producto(s) →</Text>
      </PressableScale>
    </FadeInView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  barra: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  accion: { backgroundColor: c.surface, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8, ...shadow.low },
  accionTxt: { fontFamily: font.semibold, color: c.goldText, fontSize: 13 },
  filaAccion: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  buscadorBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.md, paddingHorizontal: 12, marginBottom: 12, ...shadow.low,
  },
  lupa: { fontSize: 15, marginRight: 6 },
  buscador: { flex: 1, paddingVertical: 11, fontSize: 15, color: c.textStrong, fontFamily: font.regular },
  card: {
    backgroundColor: c.surface, borderRadius: radius.lg, padding: 16, marginBottom: 12, ...shadow.soft,
  },
  portada: { width: '100%', height: 140, borderRadius: radius.md, marginBottom: 10, backgroundColor: c.surface2 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombre: { fontSize: 17, fontFamily: font.bold, color: c.textStrong, flex: 1 },
  abierto: {
    fontSize: 11, fontFamily: font.bold, backgroundColor: c.successSoft, color: c.success,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden',
  },
  desc: { color: c.muted, marginTop: 6, fontFamily: font.regular },
  dir: { color: c.mutedSoft, fontSize: 12, marginTop: 8, fontFamily: font.regular },
  cont: { color: c.goldText, fontFamily: font.bold, marginTop: 10 },
  // --- Tarjeta de producto (búsqueda) ---
  prodFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prodThumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: c.surface2 },
  prodThumbVacio: { alignItems: 'center', justifyContent: 'center' },
  prodTexto: { flex: 1 },
  prodDesc: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  precio: { color: c.goldText, fontFamily: font.extra, fontSize: 15, marginTop: 2 },
  negocioFila: { marginTop: 8 },
  negocioTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 13, flexShrink: 1 },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, marginBottom: 12, fontFamily: font.medium },
});
