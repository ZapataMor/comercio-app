import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  GestureResponderEvent,
  Image,
  Modal,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  direccionConBarrio,
  getCatalogo,
  getEstadoNegocio,
  getRecetasPreferidas,
  imagenUrl,
  Negocio,
  Producto,
  RecetaPreferida,
  Servicio,
} from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import { useFlyToCart } from '../components/FlyToCart';
import Icon from '../components/Icon';
import BotonesContacto from '../components/BotonesContacto';
import { NivelBadge } from '../components/Reputacion';
import RecetasPreferidas from '../components/RecetasPreferidas';
import { PuntajeResenas } from '../components/Resenas';
import { RootStackParamList } from '../navTypes';
import { OpcionesLinea, pideEleccion, precioDe } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { useAgregarAlCarrito } from '../useAgregarAlCarrito';
import { REFRESCO_NEGOCIOS, usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'Negocio'>;

const COLUMNAS = 2;

type CatalogoFila =
  | { tipo: 'categoria'; key: string; nombre: string; cantidad: number }
  | { tipo: 'productos'; key: string; productos: Producto[] }
  | { tipo: 'servicios'; key: string; servicios: Servicio[] };

function categoriasNegocio(negocio: Negocio) {
  return negocio.categorias?.length ? negocio.categorias : negocio.categoria ? [negocio.categoria] : [];
}

function construirCatalogo(productos: Producto[]): CatalogoFila[] {
  const grupos = new Map<string, Producto[]>();
  productos.forEach(producto => {
    const categoria = producto.categoria?.nombre?.trim() || 'Sin categoría';
    grupos.set(categoria, [...(grupos.get(categoria) ?? []), producto]);
  });
  // Un negocio sin categorías no necesita un título "Sin categoría".
  const sinTitulos = grupos.size === 1 && grupos.has('Sin categoría');

  return Array.from(grupos.entries()).flatMap(([categoria, items]) => {
    const filas: CatalogoFila[] = [];
    if (!sinTitulos) {
      filas.push({ tipo: 'categoria', key: `cat-${categoria}`, nombre: categoria, cantidad: items.length });
    }
    for (let i = 0; i < items.length; i += COLUMNAS) {
      const fila = items.slice(i, i + COLUMNAS);
      filas.push({ tipo: 'productos', key: `fila-${fila[0].id}`, productos: fila });
    }
    return filas;
  });
}

type TarjetaProps = {
  producto: Producto;
  destacado: boolean;
  /** Con el negocio cerrado el producto se puede ver, pero no agregar. */
  abierto: boolean;
  onVer: () => void;
  onAgregar: (e: GestureResponderEvent) => void;
};

function TarjetaProducto({ producto, destacado, abierto, onVer, onAgregar }: TarjetaProps) {
  const { c } = useTheme();
  const styles = useStyles();
  const uri = imagenUrl(producto.imagen);

  return (
    <PressableScale style={styles.tarjeta} scaleTo={0.98} onPress={onVer}>
      <View style={[styles.foto, destacado && styles.fotoDestacada]}>
        {uri ? (
          <Image source={{ uri }} style={styles.fotoImagen} resizeMode="cover" />
        ) : (
          <Icon name="caja" size={30} color={c.mutedSoft} />
        )}
        {abierto && (
          <PressableScale
            style={styles.agregar}
            hitSlop={8}
            scaleTo={0.88}
            accessibilityLabel={`Agregar ${producto.nombre}`}
            onPress={onAgregar}>
            <Icon name="mas" size={18} color={c.onBrand} strokeWidth={2.4} />
          </PressableScale>
        )}
      </View>
      <Text style={styles.nombre} numberOfLines={2}>{producto.nombre}</Text>
      <Text style={styles.precio}>{precioDe(producto)}</Text>
      <PuntajeResenas resenas={producto.resenas} size={12} style={styles.puntaje} />
    </PressableScale>
  );
}

export default function NegocioScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const { volar } = useFlyToCart();
  const toast = useToast();
  const token = auth!.token;
  const { id, nombre, productoId, seccion = 'productos' } = route.params;
  const agregar = useAgregarAlCarrito(id, nombre);
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<Servicio | null>(null);
  const [recetas, setRecetas] = useState<RecetaPreferida[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const catalogo = useMemo<CatalogoFila[]>(() => seccion === 'servicios'
    ? Array.from({ length: Math.ceil(servicios.length / COLUMNAS) }, (_, i) => ({
        tipo: 'servicios',
        key: `servicios-${servicios[i * COLUMNAS].id}`,
        servicios: servicios.slice(i * COLUMNAS, (i + 1) * COLUMNAS),
      }))
    : construirCatalogo(productos), [productos, servicios, seccion]);
  const listaRef = useRef<FlatList<CatalogoFila>>(null);
  const negocioAbierto = negocio?.activo !== false;

  const cargarCatalogo = useCallback(
    () =>
      getCatalogo(token, id).then(({ negocio: n, productos: p, servicios: s }) => {
        setServicios(s ?? []);
        setNegocio(n);
        setProductos(p);
        setError(null);
      }),
    [token, id],
  );

  // Es una recomendación: si no carga, el catálogo sigue igual.
  const cargarRecetas = useCallback(() => {
    if (seccion === 'servicios') { setRecetas([]); return; }
    getRecetasPreferidas(token, id)
      .then(setRecetas)
      .catch(() => {});
  }, [token, id, seccion]);

  useEffect(() => {
    cargarCatalogo()
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
    cargarRecetas();
  }, [cargarCatalogo, cargarRecetas]);

  // Si el negocio abre o cierra se nota aquí mismo: solo se toca su estado, porque
  // cambiar los productos volvería a llevar la lista al producto resaltado. Si la
  // primera carga falló no hay nada que actualizar: se reintenta hasta lograrla.
  usePolling(() => {
    if (!negocio) {
      cargarCatalogo()
        .then(cargarRecetas)
        .catch(() => {});
      return;
    }
    getEstadoNegocio(token, id)
      .then(estado => setNegocio(n => n && { ...n, ...estado }))
      .catch(() => {});
  }, REFRESCO_NEGOCIOS);

  // Si llegamos desde una búsqueda de producto, hacemos scroll hasta él una vez
  // que el catálogo cargó, para mostrarlo resaltado dentro de la lista.
  useEffect(() => {
    if (productoId == null || catalogo.length === 0) return;
    const indice = catalogo.findIndex(
      fila => fila.tipo === 'productos' && fila.productos.some(p => p.id === productoId),
    );
    if (indice < 0) return;
    const t = setTimeout(() => {
      listaRef.current?.scrollToIndex({ index: indice, viewPosition: 0.3, animated: true });
    }, 350);
    return () => clearTimeout(t);
  }, [productoId, catalogo]);

  function verProducto(p: Producto) {
    navigation.navigate('Producto', {
      negocioId: id,
      negocioNombre: nombre,
      abierto: negocioAbierto,
      producto: p,
    });
  }

  function onAgregar(p: Producto, e: GestureResponderEvent, opciones?: OpcionesLinea) {
    if (!negocioAbierto) {
      toast.info('Negocio cerrado', 'Puedes ver el catálogo, pero no hacer pedidos.');
      return;
    }
    // Hay que elegir talla o color: eso se hace en el detalle del producto.
    if (pideEleccion(p)) {
      verProducto(p);
      return;
    }

    // Punto exacto del toque sobre "+": desde ahí salta el paquetito que vuela
    // hasta el botón flotante de Carrito.
    const desde = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    agregar(p, { opciones, alAgregar: () => volar(desde) });
  }

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  const portada = imagenUrl(negocio?.imagen);
  const etiquetas = negocio ? categoriasNegocio(negocio).join(' · ') : '';

  return (
    <>
    <FlatList
      ref={listaRef}
      style={styles.container}
      data={catalogo}
      keyExtractor={fila => fila.key}
      // Aire abajo para la barra flotante fija (Carrito / Mis pedidos).
      contentContainerStyle={styles.contenido}
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
          <View>
            <View style={styles.portada}>
              {portada ? (
                <Image source={{ uri: portada }} style={styles.portadaImagen} resizeMode="cover" />
              ) : (
                <Icon name="tienda" size={44} color={c.mutedSoft} />
              )}
            </View>
            <View style={styles.cabecera}>
              {!!etiquetas && <Text style={styles.etiquetas} numberOfLines={1}>{etiquetas}</Text>}
              <Text style={styles.titulo} numberOfLines={2}>{negocio.nombre}</Text>
              <View style={styles.estadoFila}>
                <View style={[styles.punto, negocio.activo ? styles.puntoAbierto : styles.puntoCerrado]} />
                <Text style={[styles.estado, !negocio.activo && styles.estadoCerrado]}>
                  {negocio.estado_texto ?? (negocio.activo ? 'Abierto' : 'Cerrado')}
                </Text>
                {seccion === 'productos' && !!negocio.tiempo_preparacion && (
                  <Text style={styles.dato}>· ~{negocio.tiempo_preparacion} min</Text>
                )}
                <NivelBadge reputacion={negocio.reputacion} />
              </View>
              <PressableScale
                style={styles.resenas}
                accessibilityRole="button"
                accessibilityLabel="Ver las reseñas de la tienda"
                onPress={() => navigation.navigate('Resenas', { negocioId: id, titulo: negocio.nombre })}>
                <PuntajeResenas resenas={negocio.resenas} size={14} conVacio />
                <Icon name="chevron" size={13} color={c.muted} />
              </PressableScale>
              {!!negocio.horario_hoy && (
                <Text style={styles.dato}>{negocio.horario_hoy}</Text>
              )}
              {!!direccionConBarrio(negocio) && (
                <Text style={styles.dato} numberOfLines={1}>{direccionConBarrio(negocio)}</Text>
              )}
              {!!negocio.descripcion && <Text style={styles.descripcion}>{negocio.descripcion}</Text>}
            </View>
            {seccion === 'productos' && <RecetasPreferidas
              recetas={recetas}
              abierto={negocioAbierto}
              onAgregar={(receta, e) => onAgregar(receta.producto, e, receta.opciones)}
            />}
          </View>
        ) : null
      }
      ListEmptyComponent={<Text style={styles.vacio}>{seccion === 'servicios' ? 'Este negocio no tiene servicios disponibles.' : 'Este negocio no tiene productos disponibles.'}</Text>}
      renderItem={({ item, index }) =>
        item.tipo === 'servicios' ? (
          <FadeInView delay={Math.min(index, 6) * 45} style={styles.fila}>
            {item.servicios.map(servicio => (
              <PressableScale key={servicio.id} style={styles.tarjeta} scaleTo={0.98}
                accessibilityLabel={`Ver servicio ${servicio.nombre}`}
                onPress={() => setServicioSeleccionado(servicio)}>
                <View style={styles.foto}>
                  {servicio.galeria?.[0] ? (
                    <Image source={{ uri: imagenUrl(servicio.galeria[0])! }} style={styles.fotoImagen} resizeMode="cover" />
                  ) : <Icon name="tienda" size={30} color={c.mutedSoft} />}
                </View>
                <Text style={styles.nombre} numberOfLines={2}>{servicio.nombre}</Text>
                <Text style={styles.descripcion} numberOfLines={2}>{servicio.descripcion}</Text>
                <Text style={styles.precio}>{servicio.precio == null ? 'Consultar precio' : `$${servicio.precio.toLocaleString('es-CO')}`}</Text>
                <Text style={styles.dato}>{servicio.duracion_minutos ?? 30} min</Text>
              </PressableScale>
            ))}
            {item.servicios.length < COLUMNAS && <View style={styles.tarjeta} />}
          </FadeInView>
        ) : item.tipo === 'categoria' ? (
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>{item.nombre}</Text>
            <Text style={styles.seccionConteo}>{item.cantidad}</Text>
          </View>
        ) : (
          <FadeInView delay={Math.min(index, 6) * 45} style={styles.fila}>
            {item.productos.map(p => (
              <TarjetaProducto
                key={p.id}
                producto={p}
                destacado={p.id === productoId}
                abierto={negocioAbierto}
                onVer={() => verProducto(p)}
                onAgregar={e => onAgregar(p, e)}
              />
            ))}
            {/* Fila incompleta: el hueco conserva el ancho de la columna. */}
            {item.productos.length < COLUMNAS && <View style={styles.tarjeta} />}
          </FadeInView>
        )
      }
    />
    <Modal visible={!!servicioSeleccionado} transparent animationType="slide" onRequestClose={() => setServicioSeleccionado(null)}>
      <View style={styles.fondoDetalle}>
        <ScrollView style={styles.detalleServicio} contentContainerStyle={styles.detalleContenido}>
          {servicioSeleccionado && <>
            <View style={styles.cabeceraDetalle}>
              <Text style={[styles.titulo, styles.tituloDetalle]}>{servicioSeleccionado.nombre}</Text>
              <PressableScale style={styles.cerrarDetalle} accessibilityRole="button" accessibilityLabel="Cerrar detalle del servicio" onPress={() => setServicioSeleccionado(null)}>
                <Icon name="cerrar" size={24} color={c.textStrong} />
              </PressableScale>
            </View>
            {!!servicioSeleccionado.galeria?.length && <ScrollView horizontal contentContainerStyle={styles.galeriaServicio}>
              {servicioSeleccionado.galeria.map((uri, i) => <Image key={`${uri}-${i}`} accessibilityLabel={`${servicioSeleccionado.nombre}, trabajo ${i + 1}`} source={{ uri: imagenUrl(uri)! }} style={styles.fotoTrabajo} resizeMode="cover" />)}
            </ScrollView>}
            <Text style={styles.precio}>{servicioSeleccionado.precio == null ? 'Consultar precio' : `$${servicioSeleccionado.precio.toLocaleString('es-CO')}`}</Text>
            <Text style={styles.dato}>{servicioSeleccionado.duracion_minutos ?? 30} min</Text>
            <Text style={styles.descripcion}>{servicioSeleccionado.descripcion}</Text>
            {servicioSeleccionado.permite_citas !== false && <PressableScale style={styles.solicitarCita} onPress={() => {
              setServicioSeleccionado(null);
              navigation.navigate('AgendarCita', { negocioId: id, negocioNombre: nombre, servicio: servicioSeleccionado });
            }}>
              <Text style={styles.solicitarTexto}>Solicitar cita</Text>
            </PressableScale>}
            <BotonesContacto telefono={negocio?.telefono} mensaje={`Hola, quisiera información sobre ${servicioSeleccionado.nombre}.`} />
          </>}
        </ScrollView>
      </View>
    </Modal>
    </>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  solicitarCita: { backgroundColor: c.accent, borderRadius: radius.md, padding: 14, marginTop: 12, alignItems: 'center' },
  solicitarTexto: { color: c.onBrand, fontFamily: font.semibold },
  container: { flex: 1, backgroundColor: c.bg },
  contenido: { paddingBottom: 110 },
  fondoDetalle: { flex: 1, justifyContent: 'center', backgroundColor: '#0008', padding: 20 },
  detalleServicio: { flexGrow: 0, maxHeight: '90%', borderRadius: radius.lg, backgroundColor: c.bg },
  detalleContenido: { padding: 20, gap: 12 },
  cabeceraDetalle: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tituloDetalle: { flex: 1 },
  cerrarDetalle: { flexShrink: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  galeriaServicio: { gap: 10 },
  fotoTrabajo: { width: 220, height: 220, borderRadius: radius.md },
  portada: {
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  portadaImagen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  cabecera: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6, gap: 4 },
  etiquetas: { color: c.muted, fontSize: 12, fontFamily: font.medium },
  titulo: { color: c.textStrong, fontFamily: font.display, fontSize: 26, lineHeight: 32 },
  estadoFila: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 4 },
  punto: { width: 7, height: 7, borderRadius: radius.pill },
  puntoAbierto: { backgroundColor: c.success },
  puntoCerrado: { backgroundColor: c.danger },
  estado: { color: c.success, fontSize: 13, fontFamily: font.semibold },
  estadoCerrado: { color: c.danger },
  dato: { color: c.muted, fontSize: 13, lineHeight: 18, fontFamily: font.regular },
  resenas: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 2, paddingVertical: 3 },
  descripcion: { color: c.text, fontSize: 14, lineHeight: 20, fontFamily: font.regular, marginTop: 8 },
  seccion: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 26,
    marginBottom: 12,
  },
  seccionTitulo: { color: c.textStrong, fontSize: 17, fontFamily: font.displaySemi },
  seccionConteo: { color: c.mutedSoft, fontSize: 13, fontFamily: font.medium },
  fila: { flexDirection: 'row', gap: 14, paddingHorizontal: 20, marginBottom: 20 },
  tarjeta: { flex: 1 },
  foto: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  fotoDestacada: { borderWidth: 2, borderColor: c.accent },
  fotoImagen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  agregar: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.brand,
    ...shadow.soft,
  },
  nombre: { color: c.textStrong, fontSize: 14, lineHeight: 19, fontFamily: font.medium, marginTop: 10 },
  precio: { color: c.text, fontSize: 14, fontFamily: font.bold, marginTop: 3 },
  puntaje: { marginTop: 3 },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
}));
