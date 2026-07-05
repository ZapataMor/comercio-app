import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { CardSkeletons, Desplegable, FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Explorar'>;

function precioCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function categoriasNegocio(item: { categorias?: string[]; categoria?: string | null }) {
  return item.categorias?.length ? item.categorias : item.categoria ? [item.categoria] : [];
}

export default function ExplorarScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const [negocios, setNegocios] = useState<NegocioLista[]>([]);
  const [productos, setProductos] = useState<ProductoConNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  // Paginación del listado de negocios (50 por página).
  const [pagina, setPagina] = useState(1);
  const [ultimaPagina, setUltimaPagina] = useState(1);
  const cargandoMasRef = useRef(false);

  // Id del negocio con la card extendida (imagen + botón). Solo puede haber
  // una a la vez: tocar otra card recoge la anterior.
  const [expandidaId, setExpandidaId] = useState<number | null>(null);

  // Estable entre renders para que React.memo de CardNegocio surta efecto:
  // al tocar, solo se redibujan la card que se abre y la que se cierra.
  const alternarCard = useCallback((id: number) => {
    setExpandidaId(prev => (prev === id ? null : id));
  }, []);

  // Con texto buscamos PRODUCTOS; sin texto mostramos todos los negocios.
  const buscando = busqueda.trim().length > 0;

  const cargar = useCallback(
    (texto: string, refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      setError(null);
      const t = texto.trim();
      const peticion = t
        ? buscarProductos(auth!.token, t).then(setProductos)
        : getNegocios(auth!.token).then(p => {
            setNegocios(p.negocios);
            setPagina(p.pagina);
            setUltimaPagina(p.ultimaPagina);
          });
      peticion
        .catch(e => setError(e.message))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [auth],
  );

  // Carga la siguiente página de negocios al llegar al final de la lista.
  const cargarMas = useCallback(() => {
    if (buscando || cargando || refrescando) return;
    if (cargandoMasRef.current || pagina >= ultimaPagina) return;
    cargandoMasRef.current = true;
    setCargandoMas(true);
    getNegocios(auth!.token, undefined, pagina + 1)
      .then(p => {
        setNegocios(prev => {
          // Evita duplicados si una página se repite (p. ej. tras un refresco).
          const vistos = new Set(prev.map(n => n.id));
          return [...prev, ...p.negocios.filter(n => !vistos.has(n.id))];
        });
        setPagina(p.pagina);
        setUltimaPagina(p.ultimaPagina);
      })
      .catch(e => setError(e.message))
      .finally(() => {
        cargandoMasRef.current = false;
        setCargandoMas(false);
      });
  }, [auth, buscando, cargando, refrescando, pagina, ultimaPagina]);

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
      extraData={expandidaId}
      // Aire abajo para la barra flotante fija (Carrito / Mis pedidos).
      contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
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
          {/* Carrito y Mis pedidos viven ahora en la barra flotante inferior;
              salir de la cuenta se hace desde "Mi perfil" (topbar). */}
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
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListFooterComponent={
        cargandoMas ? (
          <ActivityIndicator color={c.accent} style={styles.pieCarga} />
        ) : null
      }
      ListEmptyComponent={
        !cargando ? (
          <Text style={styles.vacio}>
            {buscando ? `Sin resultados para "${busqueda}".` : 'Aún no hay negocios registrados.'}
          </Text>
        ) : null
      }
      renderItem={({ item, index }) =>
        buscando ? (
          renderProducto(item as ProductoConNegocio, navigation, index)
        ) : (
          <CardNegocio
            item={item as NegocioLista}
            index={index}
            navigation={navigation}
            expandida={expandidaId === item.id}
            onToggle={alternarCard}
          />
        )
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
              <Text style={item.negocio.abierto ? styles.abiertoMini : styles.cerradoMini}>
                {item.negocio.abierto ? 'Abierto' : 'Cerrado'}
              </Text>
            </View>
          </View>
          <Icon name="chevron" size={18} color={c.chevron} />
        </View>
      </PressableScale>
    </FadeInView>
  );
}

/**
 * Tarjeta de negocio (vista por defecto, sin búsqueda).
 *
 * Recogida muestra nombre, categoría, dirección y si está abierto. Al tocarla
 * se extiende: aparece la imagen del negocio arriba y el botón "Entrar a la
 * tienda". Solo una card puede estar extendida a la vez (lo controla el padre
 * con `expandida`/`onToggle`).
 */
const CardNegocio = React.memo(function CardNegocio({
  item,
  navigation,
  index,
  expandida,
  onToggle,
}: {
  item: NegocioLista;
  navigation: Props['navigation'];
  index: number;
  expandida: boolean;
  onToggle: (id: number) => void;
}) {
  const img = imagenUrl(item.imagen);
  return (
    <FadeInView delay={Math.min(index, 8) * 45}>
      <PressableScale
        style={[styles.card, !item.abierto && styles.cardCerrada]}
        onPress={() => onToggle(item.id)}>
        <Desplegable abierto={expandida}>
          {img ? (
            <Image source={{ uri: img }} style={styles.portada} resizeMode="cover" />
          ) : (
            <View style={[styles.portada, styles.portadaVacia]}>
              <Icon name="tienda" size={40} color={c.mutedSoft} />
            </View>
          )}
        </Desplegable>

        <View style={styles.cardHead}>
          <Text style={styles.nombre}>{item.nombre}</Text>
          <Text style={item.abierto ? styles.abierto : styles.cerrado}>
            {item.abierto ? 'Abierto' : 'Cerrado'}
          </Text>
        </View>

        {!expandida && !!item.categoria && (
          <View style={[styles.categoriaFila, styles.filaAccion]}>
            <Icon name="tienda" size={13} color={c.accent} />
            <Text style={styles.categoriaTxt}>{item.categoria}</Text>
          </View>
        )}
        {!!item.direccion && (
          <View style={[styles.dir, styles.filaAccion]}>
            <Icon name="ubicacion" size={13} color={c.mutedSoft} />
            <Text style={styles.dir}>{item.direccion}</Text>
          </View>
        )}

        <Desplegable abierto={expandida}>
          {categoriasNegocio(item).length > 0 && (
            <View style={styles.categoriasChips}>
              {categoriasNegocio(item).map(categoria => (
                <View key={categoria} style={styles.categoriaChip}>
                  <Text style={styles.categoriaChipTxt}>{categoria}</Text>
                </View>
              ))}
            </View>
          )}
          {!!item.descripcion && (
            <Text style={styles.desc} numberOfLines={3}>{item.descripcion}</Text>
          )}
          <TouchableOpacity
            style={[styles.botonEntrar, !item.abierto && styles.botonEntrarOff]}
            disabled={!item.abierto || !expandida}
            onPress={() =>
              navigation.navigate('Negocio', { id: item.id, nombre: item.nombre })
            }>
            <Text style={[styles.botonEntrarTxt, !item.abierto && styles.botonEntrarTxtOff]}>
              {item.abierto ? 'Entrar a la tienda' : 'Tienda cerrada'}
            </Text>
          </TouchableOpacity>
        </Desplegable>
      </PressableScale>
    </FadeInView>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
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
  portadaVacia: { alignItems: 'center', justifyContent: 'center' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombre: { fontSize: 17, fontFamily: font.bold, color: c.textStrong, flex: 1 },
  abierto: {
    fontSize: 11, fontFamily: font.bold, backgroundColor: c.successSoft, color: c.success,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden',
  },
  cerrado: {
    fontSize: 11, fontFamily: font.bold, backgroundColor: c.dangerSoft, color: c.danger,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden',
  },
  cardCerrada: { opacity: 0.55 },
  pieCarga: { marginVertical: 16 },
  desc: { color: c.muted, marginTop: 10, fontFamily: font.regular },
  dir: { color: c.mutedSoft, fontSize: 12, marginTop: 8, fontFamily: font.regular },
  categoriaFila: { marginTop: 7 },
  categoriaTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 13 },
  categoriasChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  categoriaChip: {
    backgroundColor: c.accentSoft,
    borderColor: c.accent,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  categoriaChipTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 12 },
  // Botón minimalista "Entrar a la tienda" de la card extendida.
  botonEntrar: {
    marginTop: 14, paddingVertical: 11, borderRadius: radius.md, alignItems: 'center',
    borderWidth: 1.2, borderColor: c.accent, backgroundColor: 'transparent',
  },
  botonEntrarOff: { borderColor: c.border },
  botonEntrarTxt: { color: c.goldText, fontFamily: font.bold, fontSize: 14 },
  botonEntrarTxtOff: { color: c.mutedSoft },
  // --- Tarjeta de producto (búsqueda) ---
  prodFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prodThumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: c.surface2 },
  prodThumbVacio: { alignItems: 'center', justifyContent: 'center' },
  prodTexto: { flex: 1 },
  prodDesc: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  precio: { color: c.goldText, fontFamily: font.extra, fontSize: 15, marginTop: 2 },
  negocioFila: { marginTop: 8 },
  negocioTxt: { color: c.goldText, fontFamily: font.semibold, fontSize: 13, flexShrink: 1 },
  abiertoMini: {
    fontSize: 10, fontFamily: font.bold, backgroundColor: c.successSoft, color: c.success,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden',
  },
  cerradoMini: {
    fontSize: 10, fontFamily: font.bold, backgroundColor: c.dangerSoft, color: c.danger,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden',
  },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, marginBottom: 12, fontFamily: font.medium },
});
