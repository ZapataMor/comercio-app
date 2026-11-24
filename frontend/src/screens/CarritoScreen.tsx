import { useConfirmar } from '../components/Confirmacion';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { imagenUrl } from '../api';
import { CartItem, DURACION_RETIRO, useCart } from '../CartContext';
import { FadeInView, PressableScale } from '../components/anim';
import CantidadPeso from '../components/CantidadPeso';
import { esPorPeso } from '../cantidades';
import Icon from '../components/Icon';
import PersonalizarLinea, { ModoHoja } from '../components/PersonalizarLinea';
import { RootStackParamList } from '../navTypes';
import { detalleOpciones, precioLinea } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { Objetivo } from '../tutorial/Objetivo';
import { useTarifaDomicilio } from '../useTarifaDomicilio';

type Props = NativeStackScreenProps<RootStackParamList, 'Carrito'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/** Texto del enlace para ajustar la línea, según lo que se pueda cambiar. */
function textoAjuste(i: CartItem): string | null {
  if ((i.ingredientes?.length ?? 0) > (i.ingredientesFijos?.length ?? 0) || i.extrasDisponibles?.length) return 'Personalizar';
  const cambiaTalla = (i.tallas?.length ?? 0) > 1;
  const cambiaColor = (i.colores?.length ?? 0) > 1;
  if (cambiaTalla && cambiaColor) return 'Cambiar talla o color';
  if (cambiaTalla) return 'Cambiar talla';
  if (cambiaColor) return 'Cambiar color';
  return null;
}

/**
 * Relleno de la tarjeta que se vacía de derecha a izquierda, como una barra de
 * carga al revés: cuando llega al final la línea sale del carrito. Calcula lo
 * que falta con `saleEn`, así sigue en su punto si el cliente sale y vuelve.
 */
function RellenoRetiro({ saleEn }: { saleEn: number }) {
  const styles = useStyles();
  const escala = useRef(new Animated.Value((saleEn - Date.now()) / DURACION_RETIRO)).current;

  useEffect(() => {
    const animacion = Animated.timing(escala, {
      toValue: 0,
      duration: Math.max(0, saleEn - Date.now()),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animacion.start();
    return () => animacion.stop();
  }, [escala, saleEn]);

  return <Animated.View pointerEvents="none" style={[styles.relleno, { transform: [{ scaleX: escala }] }]} />;
}

type LineaProps = {
  item: CartItem;
  onAjustar: () => void;
  /** Pregunta cómo quiere la unidad nueva. */
  onAgregarOtra: () => void;
};

function LineaCarrito({ item, onAjustar, onAgregarOtra }: LineaProps) {
  const { c } = useTheme();
  const styles = useStyles();
  const { cambiar, quitar, fijarCantidad } = useCart();
  const saliendo = !!item.saleEn;
  const uri = imagenUrl(item.imagen);
  const detalle = detalleOpciones(item.opciones);
  const ajuste = textoAjuste(item);
  // Si hay algo que elegir, la unidad nueva se pregunta. Conservar una línea que
  // sale no suma nada: vuelve tal como estaba.
  const preguntaAlSumar = !!ajuste && !saliendo;

  return (
    <View style={styles.item}>
      {!!item.saleEn && <RellenoRetiro saleEn={item.saleEn} />}
      <View style={styles.thumb}>
        {uri ? (
          <Image source={{ uri }} style={styles.thumbImagen} resizeMode="cover" />
        ) : (
          <Icon name="caja" size={22} color={c.mutedSoft} />
        )}
      </View>

      <View style={styles.itemCuerpo}>
        <View style={styles.itemCabecera}>
          <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
          <TouchableOpacity
            style={[styles.quitar, saliendo && styles.oculto]}
            disabled={saliendo}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${item.nombre}`}
            onPress={() => quitar(item.linea)}>
            <Icon name="basura" size={15} color={c.danger} />
            <Text style={styles.quitarTxt}>Quitar</Text>
          </TouchableOpacity>
        </View>

        {!!detalle && <Text style={styles.detalle} numberOfLines={3}>{detalle}</Text>}
        {!!ajuste && (
          <TouchableOpacity
            style={[styles.ajuste, saliendo && styles.oculto]}
            disabled={saliendo}
            hitSlop={6}
            onPress={onAjustar}>
            <Text style={styles.ajusteTxt}>{ajuste}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.itemPie}>
          {saliendo ? (
            <Text style={styles.deshacer} numberOfLines={2}>Toca + si quieres conservarlo</Text>
          ) : (
            <Text style={styles.precio}>{cop(precioLinea(item))}</Text>
          )}
          <View style={styles.qtyRow}>
            {esPorPeso(item) && !saliendo ? <CantidadPeso cantidad={item.cantidad} unidad={item.unidad_medida ?? 'kg'} onChange={n => fijarCantidad(item.linea, n)} /> : <>
            <PressableScale
              style={[styles.qtyBtn, saliendo && styles.qtyBtnOff]}
              disabled={saliendo}
              hitSlop={6}
              accessibilityLabel="Quitar una unidad"
              onPress={() => cambiar(item.linea, -1)}>
              <Icon name="menos" size={15} color={c.textStrong} strokeWidth={2.2} />
            </PressableScale>
            <Text style={styles.qty}>{saliendo ? 0 : item.cantidad}</Text>
            <PressableScale
              style={styles.qtyBtn}
              hitSlop={6}
              accessibilityLabel="Agregar una unidad"
              onPress={() => (preguntaAlSumar ? onAgregarOtra() : cambiar(item.linea, 1))}>
              <Icon name="mas" size={15} color={c.textStrong} strokeWidth={2.2} />
            </PressableScale>
            </>}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function CarritoScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const confirmar = useConfirmar();
  const { items, lineas, negocioId, negocioNombre, total, personalizar, sumarUnidad, vaciar } = useCart();
  const domicilio = useTarifaDomicilio();

  /** Vuelve a la tienda del carrito para agregar más; sin tienda, a Explorar. */
  function seguirComprando() {
    if (negocioId != null) {
      navigation.navigate('Negocio', { id: negocioId, nombre: negocioNombre ?? '' });
    } else {
      navigation.navigate('Explorar');
    }
  }
  // Línea en la hoja de ajustes. Se guarda la clave y no la línea: así la hoja
  // se cierra sola si la línea sale mientras está abierta.
  const [hoja, setHoja] = useState<{ linea: string; modo: ModoHoja } | null>(null);

  if (lineas.length === 0) {
    return (
      <View style={styles.vacioBox}>
        <Icon name="carrito" size={48} color={c.chevron} />
        <Text style={styles.vacio}>Tu carrito está vacío.</Text>
        <PressableScale style={styles.btnVacio} onPress={() => navigation.navigate('Explorar')}>
          <Text style={styles.btnTxt}>Buscar qué pedir</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {!!negocioNombre && (
          <View style={[styles.fila, { marginBottom: 12 }]}>
            <Icon name="tienda" size={15} color={c.text} />
            <Text style={styles.tienda}>{negocioNombre}</Text>
          </View>
        )}
        {lineas.map((i, idx) => (
          <FadeInView key={i.linea} delay={idx * 45}>
            <Objetivo id="carrito.linea" activo={idx === 0}>
            <LineaCarrito
              item={i}
              onAjustar={() => setHoja({ linea: i.linea, modo: 'ajustar' })}
              onAgregarOtra={() => setHoja({ linea: i.linea, modo: 'agregar' })}
            />
            </Objetivo>
          </FadeInView>
        ))}
        <PressableScale style={styles.seguir} onPress={seguirComprando} accessibilityRole="button">
          <Icon name="mas" size={16} color={c.textStrong} strokeWidth={2.4} />
          <Text style={styles.seguirTxt}>Seguir comprando{negocioNombre ? ` en ${negocioNombre}` : ''}</Text>
        </PressableScale>
        <TouchableOpacity onPress={() => confirmar({ icono: 'basura', titulo: '¿Vaciar carrito?', texto: 'Se quitarán todos los productos de tu carrito.', textoBoton: 'Vaciar carrito', peligro: true, accion: vaciar })} style={styles.vaciarBoton}>
          <Text style={styles.vaciar}>Vaciar carrito</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <Objetivo id="carrito.total">
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>Productos</Text>
          <Text style={styles.subValor}>{cop(total)}</Text>
        </View>
        <View style={styles.subRow}>
          <Text style={styles.subLabel}>Domicilio</Text>
          <Text style={styles.subValor}>{domicilio == null ? 'Se calcula al pedir' : domicilio === 0 ? 'Gratis' : cop(domicilio)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValor}>{cop(total + (domicilio ?? 0))}</Text>
        </View>
        </Objetivo>
        <Objetivo id="carrito.continuar">
        <PressableScale
          style={[styles.btn, items.length === 0 && styles.btnOff]}
          disabled={items.length === 0}
          onPress={() => navigation.navigate('Checkout')}>
          <Text style={styles.btnTxt}>Revisar y pedir</Text>
        </PressableScale>
        </Objetivo>
      </View>

      <PersonalizarLinea
        item={items.find(i => i.linea === hoja?.linea) ?? null}
        modo={hoja?.modo}
        onCerrar={() => setHoja(null)}
        onGuardar={(linea, opciones, unidades) => {
          if (hoja?.modo === 'agregar') {
            sumarUnidad(linea, opciones);
          } else {
            personalizar(linea, opciones, unidades);
          }
          setHoja(null);
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  tienda: { fontFamily: font.bold, color: c.text },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  item: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: 12,
    marginBottom: 10,
    overflow: 'hidden',
    ...shadow.low,
  },
  // Cubre toda la tarjeta y se encoge hacia la izquierda.
  relleno: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    transformOrigin: 'left',
    backgroundColor: c.dangerSoft,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  thumbImagen: { width: '100%', height: '100%' },
  itemCuerpo: { flex: 1 },
  itemCabecera: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  nombre: { flex: 1, fontFamily: font.semibold, fontSize: 15, lineHeight: 20, color: c.textStrong },
  detalle: { color: c.muted, fontSize: 13, lineHeight: 18, marginTop: 3, fontFamily: font.regular },
  ajuste: { alignSelf: 'flex-start', marginTop: 4 },
  ajusteTxt: { color: c.goldText, fontSize: 13, fontFamily: font.semibold },
  // Oculto sin soltar su lugar: la tarjeta no cambia de alto al salir.
  oculto: { opacity: 0 },
  itemPie: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  precio: { color: c.textStrong, fontSize: 15, fontFamily: font.bold },
  deshacer: { color: c.danger, fontSize: 13, lineHeight: 18, fontFamily: font.medium, flex: 1, marginRight: 8 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: c.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnOff: { opacity: 0.35 },
  qty: { minWidth: 22, textAlign: 'center', fontFamily: font.bold, color: c.textStrong },
  quitar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.dangerSoft,
  },
  quitarTxt: { color: c.danger, fontFamily: font.semibold, fontSize: 13 },
  seguir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.borderStrong,
    backgroundColor: c.surface,
  },
  seguirTxt: { color: c.textStrong, fontFamily: font.bold, fontSize: 15, flexShrink: 1 },
  vaciarBoton: { marginTop: 18, paddingVertical: 8 },
  vaciar: { color: c.danger, textAlign: 'center', fontFamily: font.semibold },
  footer: { padding: 16, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border },
  subRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subLabel: { color: c.text, fontSize: 15, fontFamily: font.regular },
  subValor: { color: c.text, fontSize: 15, fontFamily: font.semibold },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4, marginBottom: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  totalLabel: { color: c.textStrong, fontSize: 17, fontFamily: font.bold },
  totalValor: { fontSize: 22, fontFamily: font.extra, color: c.textStrong },
  btn: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', ...shadow.gold },
  btnOff: { opacity: 0.5 },
  btnTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
  vacioBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
  vacio: { color: c.muted, marginTop: 8, fontFamily: font.regular },
  btnVacio: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: 28, marginTop: 18, ...shadow.gold },
}));
