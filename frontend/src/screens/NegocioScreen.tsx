import { useLectura } from '../useLectura';
import ErrorCarga from '../components/ErrorCarga';
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
  registrarVisita,
  Servicio,
} from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import FichaProducto from '../components/FichaProducto';
import { useFlyToCart } from '../components/FlyToCart';
import Icon from '../components/Icon';
import BotonesContacto from '../components/BotonesContacto';
import RecetasPreferidas from '../components/RecetasPreferidas';
import { PuntajeResenas } from '../components/Resenas';
import { avisarDesplazamiento } from '../encogerAlDesplazar';
import { RootStackParamList } from '../navTypes';
import { cop, precioDe, sePersonaliza } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { messageFromError } from '../formErrors';
import { Objetivo } from '../tutorial/Objetivo';
import { useAgregarAlCarrito } from '../useAgregarAlCarrito';
import { useTarifaDomicilio } from '../useTarifaDomicilio';
import { REFRESCO_NEGOCIOS, temasDelNegocio, useEnVivo, usePolling } from '../usePolling';
import { EspacioTecladoModal } from '../components/EspacioTeclado';

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
  /** La tienda está abierta: si no, el botón dice `textoCerrado`. */
  abierto: boolean;
  /** «Cerrado» o «Almorzando». */
  textoCerrado: string;
  /** Abre la ficha: ahí se ve todo y se elige lo que tenga. */
  onVer: () => void;
  /** «Agregar»: directo al carrito, o a la ficha si hay algo que elegir. */
  onAgregar: (e: GestureResponderEvent) => void;
};

function TarjetaProducto({ producto, destacado, abierto, textoCerrado, onVer, onAgregar }: TarjetaProps) {
  const { c } = useTheme();
  const styles = useStyles();
  const uri = imagenUrl(producto.imagen);

  return (
    <View style={styles.tarjeta}>
      <PressableScale scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`Ver ${producto.nombre}`} onPress={onVer}>
        <View style={[styles.foto, destacado && styles.fotoDestacada]}>
          {uri ? (
            <Image source={{ uri }} style={styles.fotoImagen} resizeMode="cover" />
          ) : (
            <Icon name="caja" size={30} color={c.mutedSoft} />
          )}
        </View>
        <Text style={styles.nombre} numberOfLines={2}>{producto.nombre}</Text>
        <Text style={styles.precio}>{precioDe(producto)}</Text>
        <PuntajeResenas resenas={producto.resenas} size={12} style={styles.puntaje} />
      </PressableScale>
      <PressableScale
        style={[styles.agregar, !abierto && styles.agregarCerrado]}
        scaleTo={0.95}
        accessibilityRole="button"
        accessibilityLabel={abierto ? `Agregar ${producto.nombre} al carrito` : `${producto.nombre}: ${textoCerrado.toLowerCase()}`}
        onPress={onAgregar}>
        {abierto ? (
          <>
            <Icon name="mas" size={16} color={c.onAccent} strokeWidth={2.4} />
            <Text style={styles.agregarTxt}>Agregar</Text>
          </>
        ) : (
          <Text style={styles.agregarCerradoTxt}>{textoCerrado}</Text>
        )}
      </PressableScale>
    </View>
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
  const domicilio = useTarifaDomicilio();
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<Servicio | null>(null);
  const [recetas, setRecetas] = useState<RecetaPreferida[]>([]);
  // Producto abierto en la ficha (modal). La ficha sigue al catálogo en vivo:
  // si el producto ya no está, se queda con lo último que se vio y lo dice.
  const [ficha, setFicha] = useState<Producto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const catalogo = useMemo<CatalogoFila[]>(() => seccion === 'servicios'
    ? Array.from({ length: Math.ceil(servicios.length / COLUMNAS) }, (_, i) => ({
        tipo: 'servicios',
        key: `servicios-${servicios[i * COLUMNAS].id}`,
        servicios: servicios.slice(i * COLUMNAS, (i + 1) * COLUMNAS),
      }))
    : construirCatalogo(productos), [productos, servicios, seccion]);
  // El tutorial señala la primera fila del catálogo.
  const primeraFila = catalogo.findIndex(f => f.tipo !== 'categoria');
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

  // Entrar a la tienda cuenta como una visita (la ve su administrador en
  // «Mi tienda»). Una sola vez por entrada: refrescar el catálogo no suma.
  useEffect(() => {
    registrarVisita(token, id).catch(() => {});
  }, [token, id]);

  useLectura(() => {
    cargarCatalogo()
      .catch(e => setError(messageFromError(e)))
      .finally(() => setCargando(false));
    cargarRecetas();
  }, [cargarCatalogo, cargarRecetas]);

  // Si el negocio abre o cierra se nota aquí mismo (al instante con el aviso en
  // vivo; si no, con el respaldo): solo se toca su estado. Si la primera carga
  // falló no hay nada que actualizar: se reintenta hasta lograrla.
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
  }, REFRESCO_NEGOCIOS, temasDelNegocio(['negocio'], id));

  // El negocio cambia un precio, agota un producto o le llega una reseña: el
  // catálogo que mira el cliente se pone al día solo.
  useEnVivo(temasDelNegocio(['catalogo', 'resenas'], id), () => {
    cargarCatalogo().catch(() => {});
  });

  // Si llegamos desde una búsqueda de producto, hacemos scroll hasta él una vez
  // que el catálogo cargó, para mostrarlo resaltado dentro de la lista. Solo la
  // primera vez: si el catálogo se actualiza en vivo, la lista no salta.
  const yaResaltado = useRef(false);
  useEffect(() => {
    if (productoId == null || catalogo.length === 0 || yaResaltado.current) return;
    const indice = catalogo.findIndex(
      fila => fila.tipo === 'productos' && fila.productos.some(p => p.id === productoId),
    );
    if (indice < 0) return;
    const t = setTimeout(() => {
      yaResaltado.current = true;
      listaRef.current?.scrollToIndex({ index: indice, viewPosition: 0.3, animated: true });
    }, 350);
    return () => clearTimeout(t);
  }, [productoId, catalogo]);

  function verProducto(p: Producto) {
    setFicha(p);
  }

  /** Lo que se le dice al cliente si quiere pedir con la tienda cerrada. */
  function avisarCerrado() {
    toast.info(
      negocio?.estado_texto === 'Almorzando' ? 'La tienda está almorzando' : 'La tienda está cerrada',
      `${negocio?.abre_texto ? `${negocio.abre_texto}. ` : ''}Puedes mirar los productos, pero aún no puedes pedir.`,
    );
  }

  /**
   * «Agregar» desde la tarjeta: si el producto no tiene nada que elegir entra
   * directo (con el paquetito que vuela al carrito); si tiene (talla, peso,
   * ingredientes, extras), se abre su ficha para elegir.
   */
  function agregarDesdeTarjeta(p: Producto, e: GestureResponderEvent) {
    if (!negocioAbierto) {
      avisarCerrado();
      return;
    }
    if (sePersonaliza(p)) {
      setFicha(p);
      return;
    }
    const desde = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    agregar(p, { alAgregar: () => volar(desde) });
  }

  /**
   * Una receta preferida ya trae lo suyo elegido y entra directo al carrito.
   * Los productos del catálogo se agregan desde su ficha.
   */
  function agregarReceta(receta: RecetaPreferida, e: GestureResponderEvent) {
    if (!negocioAbierto) {
      avisarCerrado();
      return;
    }
    // Desde el punto del toque salta el paquetito que vuela hasta Carrito.
    const desde = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    agregar(receta.producto, { opciones: receta.opciones, alAgregar: () => volar(desde) });
  }

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <ErrorCarga titulo="No pudimos abrir la tienda" mensaje={error} />;
  }

  const portada = imagenUrl(negocio?.imagen);
  const fichaVigente = ficha ? productos.find(p => p.id === ficha.id) : undefined;
  const etiquetas = negocio ? categoriasNegocio(negocio).join(' · ') : '';

  return (
    <>
    <FlatList
      ref={listaRef}
      style={styles.container}
      data={catalogo}
      keyExtractor={fila => fila.key}
      // Aire abajo para los botones flotantes (Carrito / Mis pedidos), que
      // se encogen mientras la lista se desplaza.
      contentContainerStyle={styles.contenido}
      onScroll={avisarDesplazamiento}
      scrollEventThrottle={16}
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
            {!negocio.activo && (
              <View style={styles.cerrado} accessibilityRole="alert">
                <View style={styles.cerradoIcono}>
                  <Icon name="reloj" size={22} color={c.danger} />
                </View>
                <View style={styles.cerradoTextos}>
                  <Text style={styles.cerradoTitulo}>
                    {negocio.estado_texto === 'Almorzando' ? 'La tienda está almorzando' : 'Esta tienda está cerrada'}
                  </Text>
                  <Text style={styles.cerradoAbre}>{negocio.abre_texto ?? 'Vuelve a abrir más tarde'}</Text>
                  <Text style={styles.cerradoTexto}>Puedes mirar los productos, pero aún no puedes pedir.</Text>
                </View>
              </View>
            )}
            <View style={styles.cabecera}>
              {!!etiquetas && <Text style={styles.etiquetas} numberOfLines={1}>{etiquetas}</Text>}
              <Text style={styles.titulo} numberOfLines={2}>{negocio.nombre}</Text>
              <Objetivo id="negocio.estado" style={styles.estadoFila}>
                <View style={[styles.punto, negocio.activo ? styles.puntoAbierto : styles.puntoCerrado]} />
                <Text style={[styles.estado, !negocio.activo && styles.estadoCerrado]}>
                  {negocio.estado_texto ?? (negocio.activo ? 'Abierto' : 'Cerrado')}
                </Text>
              </Objetivo>
              {seccion === 'productos' && (!!negocio.tiempo_preparacion || domicilio != null) && (
                <View style={styles.datosPedido}>
                  {!!negocio.tiempo_preparacion && (
                    <View style={styles.datoPedido}>
                      <Icon name="reloj" size={16} color={c.goldText} />
                      <Text style={styles.datoPedidoTxt}>Preparación: ~{negocio.tiempo_preparacion} min</Text>
                    </View>
                  )}
                  {domicilio != null && (
                    <View style={styles.datoPedido}>
                      <Icon name="moto" size={16} color={c.goldText} />
                      <Text style={styles.datoPedidoTxt}>Domicilio: {domicilio === 0 ? 'gratis' : cop(domicilio)}</Text>
                    </View>
                  )}
                </View>
              )}
              <Objetivo id="negocio.resenas" style={styles.resenasMarca}>
              <PressableScale
                style={styles.resenas}
                accessibilityRole="button"
                accessibilityLabel="Ver las reseñas de la tienda"
                onPress={() => navigation.navigate('Resenas', { negocioId: id, titulo: negocio.nombre })}>
                <PuntajeResenas resenas={negocio.resenas} size={14} conVacio />
                <Icon name="chevron" size={13} color={c.muted} />
              </PressableScale>
              </Objetivo>
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
              onAgregar={agregarReceta}
            />}
          </View>
        ) : null
      }
      ListEmptyComponent={<Text style={styles.vacio}>{seccion === 'servicios' ? 'Este negocio no tiene servicios disponibles.' : 'Este negocio no tiene productos disponibles.'}</Text>}
      renderItem={({ item, index }) =>
        item.tipo === 'servicios' ? (
          <Objetivo id="negocio.producto" activo={index === primeraFila}>
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
          </Objetivo>
        ) : item.tipo === 'categoria' ? (
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>{item.nombre}</Text>
            <Text style={styles.seccionConteo}>{item.cantidad}</Text>
          </View>
        ) : (
          <Objetivo id="negocio.producto" activo={index === primeraFila}>
          <FadeInView delay={Math.min(index, 6) * 45} style={styles.fila}>
            {item.productos.map(p => (
              <TarjetaProducto
                key={p.id}
                producto={p}
                destacado={p.id === productoId}
                abierto={negocioAbierto}
                textoCerrado={negocio?.estado_texto === 'Almorzando' ? 'Almorzando' : 'Cerrado'}
                onVer={() => verProducto(p)}
                onAgregar={e => agregarDesdeTarjeta(p, e)}
              />
            ))}
            {/* Fila incompleta: el hueco conserva el ancho de la columna. */}
            {item.productos.length < COLUMNAS && <View style={styles.tarjeta} />}
          </FadeInView>
          </Objetivo>
        )
      }
    />
    {ficha && (
      <FichaProducto
        key={ficha.id}
        producto={fichaVigente ?? ficha}
        retirado={!fichaVigente}
        abierto={negocioAbierto}
        negocioId={id}
        negocioNombre={nombre}
        onCerrar={() => setFicha(null)}
        onVerResenas={() => navigation.navigate('Resenas', { negocioId: id, productoId: ficha.id, titulo: ficha.nombre })}
      />
    )}
    <Modal visible={!!servicioSeleccionado} transparent animationType="slide" onRequestClose={() => setServicioSeleccionado(null)}>
      <EspacioTecladoModal style={styles.fondoDetalle}>
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
      </EspacioTecladoModal>
    </Modal>
    </>
  );
}

const useStyles = makeStyles(c => ({
  solicitarCita: { backgroundColor: c.accent, borderRadius: radius.md, padding: 14, marginTop: 12, alignItems: 'center' },
  solicitarTexto: { color: c.onBrand, fontFamily: font.semibold },
  container: { flex: 1, backgroundColor: c.bg },
  contenido: { paddingBottom: 170 },
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
  // Tienda cerrada: aviso grande arriba del catálogo.
  cerrado: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: c.danger,
    backgroundColor: c.dangerSoft,
  },
  cerradoIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
  },
  cerradoTextos: { flex: 1 },
  cerradoTitulo: { color: c.danger, fontFamily: font.bold, fontSize: 17, lineHeight: 22 },
  cerradoAbre: { color: c.textStrong, fontFamily: font.bold, fontSize: 15, lineHeight: 21, marginTop: 2 },
  cerradoTexto: { color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginTop: 2 },
  datosPedido: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 4 },
  datoPedido: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.accentSoft,
  },
  datoPedidoTxt: { color: c.textStrong, fontFamily: font.semibold, fontSize: 14 },
  dato: { color: c.muted, fontSize: 13, lineHeight: 18, fontFamily: font.regular },
  resenasMarca: { alignSelf: 'flex-start' },
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
  nombre: { color: c.textStrong, fontSize: 14, lineHeight: 19, fontFamily: font.medium, marginTop: 10 },
  precio: { color: c.text, fontSize: 14, fontFamily: font.bold, marginTop: 3 },
  puntaje: { marginTop: 3 },
  // «Agregar» de la tarjeta; cerrada, el mismo botón dice «Cerrado» (fondo siempre puesto).
  agregar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    marginTop: 8,
    borderRadius: 20,
    backgroundColor: c.accent,
  },
  agregarCerrado: { backgroundColor: c.surface2 },
  agregarTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 15 },
  agregarCerradoTxt: { color: c.muted, fontFamily: font.bold, fontSize: 14 },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
}));
