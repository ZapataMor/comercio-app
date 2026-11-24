/**
 * Ficha de un producto, en un modal sobre el catálogo de la tienda. Muestra lo
 * mismo que antes la pantalla del producto y en el mismo orden: foto, nombre y
 * precio, lo que se elige (talla y color, o ingredientes y extras) y reseñas.
 *
 * No es un <Modal> nativo: es una capa de la pantalla que termina un poco por
 * encima de los botones Carrito y Mis pedidos, que siguen en su sitio. Así el
 * paquetito que vuela al carrito al agregar se ve pasar por ese hueco.
 *
 * Varias versiones del mismo plato (APAGADO, ver VERSIONES_ACTIVAS): al tocar
 * + con el producto ya modificado, se pregunta si la siguiente unidad va igual.
 * Si no, la actual queda guardada (con sus cambios y su cantidad) en una
 * pestaña numerada a la izquierda del modal y se arma la nueva desde cero.
 * Cada versión se agrega o se cancela por separado; al agregarla, su pestaña
 * desaparece. Con la última, el modal se cierra.
 */
import { HeaderHeightContext } from '@react-navigation/elements';
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  GestureResponderEvent,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { imagenUrl, Producto } from '../api';
import { esPorPeso } from '../cantidades';
import {
  coloresDe,
  cop,
  costoExtras,
  detalleOpciones,
  estaModificado,
  ExtraElegido,
  extrasDe,
  informacionDe,
  ingredientesDe,
  ingredientesFijosDe,
  OpcionesLinea,
  precioDe,
  tallasDe,
} from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useAgregarAlCarrito } from '../useAgregarAlCarrito';
import { animarDespliegue, FadeInView, PressableScale } from './anim';
import { ALTO_PILA_CLIENTE, MARGEN_BARRA_CLIENTE } from './BarraCliente';
import CantidadPeso from './CantidadPeso';
import ChipsEleccion from './ChipsEleccion';
import { useConfirmar } from './Confirmacion';
import { useFlyToCart } from './FlyToCart';
import Icon from './Icon';
import PersonalizarComida from './PersonalizarComida';
import { PuntajeResenas, ResenasDeProducto } from './Resenas';

/** Margen del modal con los bordes de la pantalla. */
const MARGEN = 12;
/** Hueco entre el borde inferior del modal y los botones Carrito / Mis pedidos. */
const HUECO_BARRA = 12;
/** Ancho de las pestañas numeradas, que quedan fuera del borde izquierdo. */
const ANCHO_PESTANA = 40;
const MAX_UNIDADES = 99;
/** Alto de la franja con el nombre que queda arriba al desplazar. */
const ALTO_FRANJA = 58;
/**
 * Las versiones numeradas resultaban difíciles para quien no se maneja bien
 * con el celular: están apagadas, no borradas. Apagadas, + suma otra unidad
 * con los mismos cambios (para otra distinta, se agrega y se vuelve a abrir).
 */
export const VERSIONES_ACTIVAS = false;

type Variante = {
  /** Número de la pestaña; también la identifica. */
  numero: number;
  talla?: string;
  color?: string;
  sin: string[];
  extras: ExtraElegido[];
  cantidad: number;
};

type Props = {
  /** El producto como está ahora en el catálogo (cambia en vivo). */
  producto: Producto;
  /** El negocio lo retiró o lo agotó mientras se miraba. */
  retirado: boolean;
  /** El negocio está abierto: si no, se ve pero no se agrega. */
  abierto: boolean;
  negocioId: number;
  negocioNombre: string;
  /** Se llama al terminar la animación de salida. */
  onCerrar: () => void;
  onVerResenas: () => void;
  /** Versiones numeradas del mismo plato (por defecto, VERSIONES_ACTIVAS). */
  conVersiones?: boolean;
};

export default function FichaProducto({
  producto,
  retirado,
  abierto,
  negocioId,
  negocioNombre,
  onCerrar,
  onVerResenas,
  conVersiones = VERSIONES_ACTIVAS,
}: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { volar } = useFlyToCart();
  const confirmar = useConfirmar();
  const agregar = useAgregarAlCarrito(negocioId, negocioNombre);

  const tallas = tallasDe(producto);
  const colores = coloresDe(producto);
  const ingredientes = ingredientesDe(producto);
  const fijos = ingredientesFijosDe(producto);
  const extrasDisponibles = extrasDe(producto);
  const informacion = informacionDe(producto);
  const porPeso = esPorPeso(producto);
  const uri = imagenUrl(producto.imagen);

  // Si solo hay una talla o un color, no hay nada que preguntar.
  const nuevaVariante = (numero: number): Variante => ({
    numero,
    talla: tallas.length === 1 ? tallas[0] : undefined,
    color: colores.length === 1 ? colores[0] : undefined,
    sin: [],
    extras: [],
    cantidad: 1,
  });

  const [variantes, setVariantes] = useState<Variante[]>(() => [nuevaVariante(1)]);
  const [activaNumero, setActivaNumero] = useState(1);
  const siguienteNumero = useRef(2);
  const [preguntaIgual, setPreguntaIgual] = useState(false);
  const [avisarFaltantes, setAvisarFaltantes] = useState(false);
  const activa = variantes.find(v => v.numero === activaNumero) ?? variantes[0];
  // Desde que hay una segunda versión, las pestañas se quedan hasta el final,
  // aunque solo quede una por agregar.
  const [conPestanas, setConPestanas] = useState(false);

  /**
   * Lo elegido, contra el producto de ahora: si el negocio quitó un extra o
   * cambió su precio mientras se miraba, cuenta lo vigente.
   */
  function opcionesDe(v: Variante): OpcionesLinea {
    const vigentes = new Map(extrasDisponibles.map(e => [e.nombre, e.precio]));
    return {
      talla: v.talla,
      color: v.color,
      sin: v.sin.filter(i => ingredientes.includes(i) && !fijos.includes(i)),
      extras: v.extras
        .filter(e => vigentes.has(e.nombre))
        .map(e => ({ ...e, precio: vigentes.get(e.nombre)! })),
    };
  }

  const opciones = opcionesDe(activa);
  const extrasActiva = costoExtras(opciones);
  const precioUnidad = producto.precio + extrasActiva;
  const faltaTalla = tallas.length > 0 && !activa.talla;
  const faltaColor = colores.length > 0 && !activa.color;

  const actualizar = (cambios: Partial<Variante>) =>
    setVariantes(vs => vs.map(v => (v.numero === activa.numero ? { ...v, ...cambios } : v)));

  // --- Entrada y salida del modal ---
  const entrada = useRef(new Animated.Value(0)).current;
  const cerrando = useRef(false);
  useEffect(() => {
    Animated.timing(entrada, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [entrada]);

  function cerrar() {
    if (cerrando.current) return;
    cerrando.current = true;
    Animated.timing(entrada, { toValue: 0, duration: 190, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      .start(() => onCerrar());
  }

  /** Con versiones sin agregar, salir las descarta: se pregunta antes. */
  function intentarCerrar() {
    if (variantes.length < 2) {
      cerrar();
      return;
    }
    confirmar({
      icono: 'carrito',
      titulo: '¿Salir sin agregarlas?',
      texto: `Tienes ${variantes.length} versiones de "${producto.nombre}" sin agregar al carrito. Si sales, se descartan.`,
      textoBoton: 'Salir sin agregar',
      textoCancelar: 'Seguir eligiendo',
      peligro: true,
      accion: cerrar,
    });
  }

  // El botón atrás de Android cierra primero la pregunta y luego el modal.
  const atras = useRef<() => boolean>(() => false);
  atras.current = () => {
    if (preguntaIgual) setPreguntaIgual(false);
    else intentarCerrar();
    return true;
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => atras.current());
    return () => sub.remove();
  }, []);

  // --- El precio late cuando los extras lo cambian ---
  const latido = useRef(new Animated.Value(1)).current;
  const precioAnterior = useRef(precioUnidad);
  useEffect(() => {
    if (precioAnterior.current === precioUnidad) return;
    precioAnterior.current = precioUnidad;
    latido.setValue(1.12);
    Animated.spring(latido, { toValue: 1, speed: 24, bounciness: 12, useNativeDriver: true }).start();
  }, [precioUnidad, latido]);

  // --- Cantidad y versiones ---
  function sumar() {
    if (activa.cantidad >= MAX_UNIDADES) return;
    if (conVersiones && estaModificado(opciones, producto)) {
      setPreguntaIgual(true);
      return;
    }
    actualizar({ cantidad: activa.cantidad + 1 });
  }

  function responderIgual(igual: boolean) {
    setPreguntaIgual(false);
    if (igual) {
      actualizar({ cantidad: Math.min(MAX_UNIDADES, activa.cantidad + 1) });
      return;
    }
    // La actual se queda en su pestaña con sus cambios y su cantidad.
    const nueva = nuevaVariante(siguienteNumero.current++);
    animarDespliegue();
    setConPestanas(true);
    setVariantes(vs => [...vs, nueva]);
    setActivaNumero(nueva.numero);
    setAvisarFaltantes(false);
  }

  /** Saca la versión de la lista; sin ninguna, el modal se cierra. */
  function quitarVariante(numero: number) {
    const indice = variantes.findIndex(v => v.numero === numero);
    const restantes = variantes.filter(v => v.numero !== numero);
    if (restantes.length === 0) {
      cerrar();
      return;
    }
    animarDespliegue();
    setVariantes(restantes);
    setActivaNumero(restantes[Math.min(indice, restantes.length - 1)].numero);
    setAvisarFaltantes(false);
  }

  function onAgregar(e: GestureResponderEvent) {
    if (faltaTalla || faltaColor) {
      setAvisarFaltantes(true);
      return;
    }
    // Desde el punto del toque sale el paquetito que vuela hasta Carrito.
    const desde = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    const numero = activa.numero;
    agregar(producto, {
      opciones,
      cantidad: activa.cantidad,
      alAgregar: () => {
        volar(desde);
        quitarVariante(numero);
      },
    });
  }

  const [anchoTarjeta, setAnchoTarjeta] = useState(0);
  const desplazamiento = useRef(new Animated.Value(0)).current;
  const alDesplazar = useRef(
    Animated.event([{ nativeEvent: { contentOffset: { y: desplazamiento } } }], { useNativeDriver: true }),
  ).current;

  // Sin insets.bottom: la pantalla ya termina encima de la barra de
  // navegación del sistema (contentStyle en App.tsx), justo donde la barra del
  // cliente empieza a contar su margen.
  const bottom = MARGEN_BARRA_CLIENTE + ALTO_PILA_CLIENTE + HUECO_BARRA;
  // La capa llena toda la pantalla, también detrás de la barra superior: sin
  // este espacio, la parte de arriba de la ficha (y su X) quedaba escondida.
  const top = MARGEN + (useContext(HeaderHeightContext) ?? 0);
  const izquierda = conPestanas ? MARGEN + ANCHO_PESTANA : MARGEN;
  const translateY = entrada.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });
  // Al pasar la foto aparece una franja con el nombre bajo la X: así la X
  // nunca queda encima de un Sin / Con o de un extra.
  const altoFoto = (anchoTarjeta * 3) / 4;
  const franja = desplazamiento.interpolate({
    inputRange: [Math.max(0, altoFoto - ALTO_FRANJA - 40), Math.max(1, altoFoto - ALTO_FRANJA)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const detalleActiva = detalleOpciones(opciones);
  const puedeAgregar = abierto && !retirado;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fondo, { opacity: entrada }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Cerrar el producto" onPress={intentarCerrar} />
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[styles.marco, { top, bottom, opacity: entrada, transform: [{ translateY }] }]}>
        {conPestanas && (
          <ScrollView style={styles.pestanas} contentContainerStyle={styles.pestanasContenido} showsVerticalScrollIndicator={false}>
            {variantes.map(v => {
              const elegida = v.numero === activa.numero;
              const detalle = detalleOpciones(opcionesDe(v));
              return (
                <FadeInView key={v.numero}>
                  <Pressable
                    style={[styles.pestana, elegida && styles.pestanaElegida]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: elegida }}
                    accessibilityLabel={`Versión ${v.numero}: ${v.cantidad} ${detalle ?? 'como viene'}`}
                    onPress={() => {
                      setActivaNumero(v.numero);
                      setAvisarFaltantes(false);
                    }}>
                    <Text style={[styles.pestanaNumero, elegida && styles.pestanaNumeroElegida]}>{v.numero}</Text>
                    {!porPeso && <Text style={[styles.pestanaCantidad, elegida && styles.pestanaCantidadElegida]}>×{v.cantidad}</Text>}
                  </Pressable>
                </FadeInView>
              );
            })}
          </ScrollView>
        )}

        <View style={[styles.tarjeta, { left: izquierda }]} onLayout={e => setAnchoTarjeta(e.nativeEvent.layout.width)}>
          <Animated.ScrollView
            contentContainerStyle={styles.contenido}
            showsVerticalScrollIndicator={false}
            onScroll={alDesplazar}
            scrollEventThrottle={16}>
            <View style={styles.foto}>
              {uri ? (
                <Image source={{ uri }} style={styles.fotoImagen} resizeMode="cover" />
              ) : (
                <Icon name="caja" size={56} color={c.mutedSoft} />
              )}
            </View>

            <View style={styles.cuerpo}>
              {conPestanas && (
                <Text style={styles.version}>
                  Versión {activa.numero}{detalleActiva ? ` · ${detalleActiva}` : ' · Como viene'}
                </Text>
              )}
              <Text style={styles.nombre}>{producto.nombre}</Text>
              <View style={styles.precioFila}>
                <Animated.Text style={[styles.precio, { transform: [{ scale: latido }] }]}>
                  {extrasActiva > 0 ? cop(precioUnidad) : precioDe(producto)}
                </Animated.Text>
                {extrasActiva > 0 && (
                  <Text style={styles.precioNota}>{precioDe(producto)} + {cop(extrasActiva)} de extras</Text>
                )}
              </View>
              <PuntajeResenas resenas={producto.resenas} size={14} style={styles.puntaje} />
              {!!producto.descripcion && <Text style={styles.descripcion}>{producto.descripcion}</Text>}

              {tallas.length > 0 && (
                <ChipsEleccion
                  titulo="Talla"
                  opciones={tallas}
                  valor={activa.talla}
                  onChange={talla => actualizar({ talla })}
                  error={avisarFaltantes && faltaTalla ? 'Elige una talla' : null}
                />
              )}
              {colores.length > 0 && (
                <ChipsEleccion
                  titulo="Color"
                  opciones={colores}
                  valor={activa.color}
                  onChange={color => actualizar({ color })}
                  conMuestra
                  error={avisarFaltantes && faltaColor ? 'Elige un color' : null}
                />
              )}

              {(ingredientes.length > 0 || extrasDisponibles.length > 0) && (
                <View style={styles.seccion}>
                  <Text style={styles.seccionTitulo}>Personalízalo</Text>
                  <PersonalizarComida
                    ingredientes={ingredientes}
                    fijos={fijos}
                    extrasDisponibles={extrasDisponibles}
                    sin={opciones.sin ?? []}
                    extras={opciones.extras ?? []}
                    onChange={(sin, extras) => actualizar({ sin, extras })}
                  />
                </View>
              )}

              {informacion.length > 0 && (
                <View style={styles.seccion}>
                  <Text style={styles.seccionTitulo}>{producto.tipo_producto?.atributo_label ?? 'Información'}</Text>
                  <Text style={styles.lista}>{informacion.join(' · ')}</Text>
                </View>
              )}

              <ResenasDeProducto negocioId={negocioId} productoId={producto.id} onVerTodas={onVerResenas} />
            </View>
          </Animated.ScrollView>

          <Animated.View pointerEvents="none" style={[styles.franja, { opacity: franja }]}>
            <Text style={styles.franjaTitulo} numberOfLines={1}>{producto.nombre}</Text>
          </Animated.View>

          {/* Oscura y con borde blanco: se ve sobre cualquier foto y sobre la franja. */}
          <PressableScale
            style={styles.cerrar}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={intentarCerrar}>
            <Icon name="cerrar" size={22} color="#FFFFFF" strokeWidth={2.6} />
          </PressableScale>

          <View style={styles.pie}>
            {puedeAgregar ? (
              <>
                {conPestanas && (
                  <View style={styles.pieFila}>
                    <Text style={styles.pieVersion} numberOfLines={1}>Versión {activa.numero}</Text>
                    <PressableScale
                      style={styles.cancelar}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Cancelar la versión ${activa.numero}`}
                      onPress={() => quitarVariante(activa.numero)}>
                      <Icon name="basura" size={15} color={c.danger} />
                      <Text style={styles.cancelarTxt}>Cancelar</Text>
                    </PressableScale>
                  </View>
                )}
                <View style={styles.pieFila}>
                  <View style={styles.cantidad}>
                    {porPeso ? (
                      <CantidadPeso
                        cantidad={activa.cantidad}
                        unidad={producto.unidad_medida ?? 'kg'}
                        onChange={cantidad => actualizar({ cantidad })}
                      />
                    ) : (
                      <>
                        <PressableScale
                          style={[styles.cantidadBtn, activa.cantidad === 1 && styles.cantidadBtnOff]}
                          disabled={activa.cantidad === 1}
                          hitSlop={6}
                          accessibilityLabel="Quitar una unidad"
                          onPress={() => actualizar({ cantidad: activa.cantidad - 1 })}>
                          <Icon name="menos" size={16} color={c.textStrong} strokeWidth={2.2} />
                        </PressableScale>
                        <Text style={styles.cantidadTxt}>{activa.cantidad}</Text>
                        <PressableScale
                          style={[styles.cantidadBtn, activa.cantidad >= MAX_UNIDADES && styles.cantidadBtnOff]}
                          disabled={activa.cantidad >= MAX_UNIDADES}
                          hitSlop={6}
                          accessibilityLabel="Agregar una unidad"
                          onPress={sumar}>
                          <Icon name="mas" size={16} color={c.textStrong} strokeWidth={2.2} />
                        </PressableScale>
                      </>
                    )}
                  </View>
                  <PressableScale style={styles.boton} onPress={onAgregar}>
                    <Text style={styles.botonTxt} numberOfLines={1}>
                      Agregar · {cop(Math.round(precioUnidad * activa.cantidad * 100) / 100)}
                    </Text>
                  </PressableScale>
                </View>
              </>
            ) : (
              <View style={[styles.boton, styles.botonOff]}>
                <Text style={styles.botonOffTxt}>{retirado ? 'Ya no está disponible' : 'Negocio cerrado'}</Text>
              </View>
            )}
          </View>

          {preguntaIgual && (
            <View style={StyleSheet.absoluteFill}>
              <Pressable style={[StyleSheet.absoluteFill, styles.preguntaFondo]} accessibilityLabel="Cerrar la pregunta" onPress={() => setPreguntaIgual(false)} />
              <FadeInView style={styles.pregunta} duration={180}>
                <Text style={styles.preguntaTitulo}>¿La siguiente igual?</Text>
                <Text style={styles.preguntaTexto}>
                  {activa.cantidad === 1 ? 'Esta va con:' : `Las ${activa.cantidad} que llevas van con:`}
                </Text>
                <Text style={styles.preguntaDetalle}>{detalleActiva}</Text>
                <PressableScale style={styles.preguntaSi} onPress={() => responderIgual(true)}>
                  <Text style={styles.preguntaSiTxt}>Sí, con los mismos cambios</Text>
                </PressableScale>
                <PressableScale style={styles.preguntaNo} onPress={() => responderIgual(false)}>
                  <Text style={styles.preguntaNoTxt}>No, la armo distinta</Text>
                </PressableScale>
              </FadeInView>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { backgroundColor: c.scrim },
  marco: { position: 'absolute', top: MARGEN, left: 0, right: 0 },
  pestanas: { position: 'absolute', top: 28, bottom: 28, left: MARGEN, width: ANCHO_PESTANA },
  pestanasContenido: { gap: 8 },
  // Pegadas al borde izquierdo de la tarjeta, como separadores de una carpeta.
  pestana: {
    height: 52,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: c.border,
  },
  pestanaElegida: { backgroundColor: c.surface, borderColor: c.accent, ...shadow.low },
  pestanaNumero: { color: c.muted, fontFamily: font.extra, fontSize: 17 },
  pestanaNumeroElegida: { color: c.goldText },
  pestanaCantidad: { color: c.mutedSoft, fontFamily: font.semibold, fontSize: 11, marginTop: -1 },
  pestanaCantidadElegida: { color: c.text },
  tarjeta: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: MARGEN,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: c.surface,
    ...shadow.card,
  },
  contenido: { paddingBottom: 18 },
  foto: { aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
  fotoImagen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  franja: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ALTO_FRANJA,
    justifyContent: 'center',
    paddingLeft: 18,
    paddingRight: 64,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  franjaTitulo: { color: c.textStrong, fontFamily: font.semibold, fontSize: 16 },
  // Colores fijos: va encima de la foto del producto, que puede ser clara u oscura.
  cerrar: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(20,16,12,0.72)',
    ...shadow.soft,
  },
  cuerpo: { paddingHorizontal: 18, paddingTop: 16 },
  version: {
    alignSelf: 'flex-start',
    color: c.goldText,
    backgroundColor: c.accentSoft,
    fontFamily: font.semibold,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: 8,
  },
  nombre: { color: c.textStrong, fontFamily: font.display, fontSize: 22, lineHeight: 28 },
  precioFila: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 10, marginTop: 6 },
  precio: { color: c.goldText, fontFamily: font.extra, fontSize: 20 },
  precioNota: { color: c.muted, fontFamily: font.medium, fontSize: 12 },
  puntaje: { marginTop: 6 },
  descripcion: { color: c.text, fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: 10 },
  seccion: { marginTop: 20 },
  seccionTitulo: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15, marginBottom: 2 },
  lista: { color: c.text, fontFamily: font.regular, fontSize: 15, lineHeight: 24 },
  pie: {
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  pieFila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pieVersion: { flex: 1, color: c.muted, fontFamily: font.semibold, fontSize: 13 },
  cancelar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: c.dangerSoft,
  },
  cancelarTxt: { color: c.danger, fontFamily: font.semibold, fontSize: 13 },
  cantidad: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cantidadBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  cantidadBtnOff: { opacity: 0.4 },
  cantidadTxt: { minWidth: 22, textAlign: 'center', color: c.textStrong, fontFamily: font.bold, fontSize: 16 },
  boton: {
    flex: 1,
    height: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: c.accent,
    ...shadow.gold,
  },
  botonTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 15 },
  botonOff: { flex: 0, backgroundColor: c.surface2, shadowOpacity: 0, elevation: 0 },
  botonOffTxt: { color: c.muted, fontFamily: font.bold, fontSize: 15 },
  preguntaFondo: { backgroundColor: c.scrim },
  pregunta: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: c.surface,
    ...shadow.card,
  },
  preguntaTitulo: { color: c.textStrong, fontFamily: font.display, fontSize: 19 },
  preguntaTexto: { color: c.muted, fontFamily: font.regular, fontSize: 14, marginTop: 6 },
  preguntaDetalle: { color: c.goldText, fontFamily: font.semibold, fontSize: 15, lineHeight: 21, marginTop: 4 },
  preguntaSi: {
    marginTop: 16,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
    ...shadow.gold,
  },
  preguntaSiTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 15 },
  preguntaNo: {
    marginTop: 10,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  preguntaNoTxt: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15 },
}));
