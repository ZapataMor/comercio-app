import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { GestureResponderEvent, Image, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { imagenUrl } from '../api';
import { FadeInView, PressableScale } from '../components/anim';
import ChipsEleccion from '../components/ChipsEleccion';
import { useFlyToCart } from '../components/FlyToCart';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { coloresDe, informacionDe, ingredientesDe, precioDe, tallasDe } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useAgregarAlCarrito } from '../useAgregarAlCarrito';

type Props = NativeStackScreenProps<RootStackParamList, 'Producto'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/** Espera a que el catálogo aparezca (y su botón Carrito) para lanzar el paquete. */
const ESPERA_VUELO = 350;

/**
 * Detalle de un producto del catálogo. Lo que se ve depende de su tipo: la ropa
 * muestra tallas y colores para elegir, la comida sus ingredientes (se ajustan
 * en el carrito) y los demás tipos su información.
 */
export default function ProductoScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { volar } = useFlyToCart();
  const { negocioId, negocioNombre, abierto, producto } = route.params;
  const agregar = useAgregarAlCarrito(negocioId, negocioNombre);

  const tallas = tallasDe(producto);
  const colores = coloresDe(producto);
  const ingredientes = ingredientesDe(producto);
  const informacion = informacionDe(producto);
  const uri = imagenUrl(producto.imagen);

  // Si solo hay una opción no hay nada que preguntar.
  const [talla, setTalla] = useState(tallas.length === 1 ? tallas[0] : undefined);
  const [color, setColor] = useState(colores.length === 1 ? colores[0] : undefined);
  const [cantidad, setCantidad] = useState(1);
  const [avisarFaltantes, setAvisarFaltantes] = useState(false);

  const faltaTalla = tallas.length > 0 && !talla;
  const faltaColor = colores.length > 0 && !color;

  function onAgregar(e: GestureResponderEvent) {
    if (faltaTalla || faltaColor) {
      setAvisarFaltantes(true);
      return;
    }
    const desde = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    agregar(producto, {
      opciones: { talla, color },
      cantidad,
      alAgregar: () => {
        navigation.goBack();
        setTimeout(() => volar(desde), ESPERA_VUELO);
      },
    });
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.foto}>
          {uri ? (
            <Image source={{ uri }} style={styles.fotoImagen} resizeMode="cover" />
          ) : (
            <Icon name="caja" size={56} color={c.mutedSoft} />
          )}
        </View>

        <FadeInView style={styles.cuerpo}>
          <Text style={styles.nombre}>{producto.nombre}</Text>
          <Text style={styles.precio}>{precioDe(producto)}</Text>
          {!!producto.descripcion && <Text style={styles.descripcion}>{producto.descripcion}</Text>}

          {tallas.length > 0 && (
            <ChipsEleccion
              titulo="Talla"
              opciones={tallas}
              valor={talla}
              onChange={setTalla}
              error={avisarFaltantes && faltaTalla ? 'Elige una talla' : null}
            />
          )}
          {colores.length > 0 && (
            <ChipsEleccion
              titulo="Color"
              opciones={colores}
              valor={color}
              onChange={setColor}
              conMuestra
              error={avisarFaltantes && faltaColor ? 'Elige un color' : null}
            />
          )}

          {ingredientes.length > 0 && (
            <View style={styles.seccion}>
              <Text style={styles.seccionTitulo}>Ingredientes</Text>
              <Text style={styles.lista}>{ingredientes.join(' · ')}</Text>
              <Text style={styles.nota}>En el carrito puedes quitar los que no quieras o pedir más.</Text>
            </View>
          )}

          {informacion.length > 0 && (
            <View style={styles.seccion}>
              <Text style={styles.seccionTitulo}>
                {producto.tipo_producto?.atributo_label ?? 'Información'}
              </Text>
              <Text style={styles.lista}>{informacion.join(' · ')}</Text>
            </View>
          )}
        </FadeInView>
      </ScrollView>

      <View style={[styles.barra, { paddingBottom: insets.bottom + 12 }]}>
        {abierto ? (
          <>
            <View style={styles.cantidad}>
              <PressableScale
                style={[styles.cantidadBtn, cantidad === 1 && styles.cantidadBtnOff]}
                disabled={cantidad === 1}
                hitSlop={6}
                accessibilityLabel="Quitar una unidad"
                onPress={() => setCantidad(n => n - 1)}>
                <Icon name="menos" size={16} color={c.textStrong} strokeWidth={2.2} />
              </PressableScale>
              <Text style={styles.cantidadTxt}>{cantidad}</Text>
              <PressableScale
                style={styles.cantidadBtn}
                hitSlop={6}
                accessibilityLabel="Agregar una unidad"
                onPress={() => setCantidad(n => n + 1)}>
                <Icon name="mas" size={16} color={c.textStrong} strokeWidth={2.2} />
              </PressableScale>
            </View>
            <PressableScale style={styles.boton} onPress={onAgregar}>
              <Text style={styles.botonTxt}>Agregar · {cop(producto.precio * cantidad)}</Text>
            </PressableScale>
          </>
        ) : (
          <View style={[styles.boton, styles.botonOff]}>
            <Text style={styles.botonOffTxt}>Negocio cerrado</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  contenido: { paddingBottom: 28 },
  foto: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface2 },
  fotoImagen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  cuerpo: { paddingHorizontal: 20, paddingTop: 20 },
  nombre: { color: c.textStrong, fontFamily: font.display, fontSize: 24, lineHeight: 30 },
  precio: { color: c.goldText, fontFamily: font.extra, fontSize: 20, marginTop: 6 },
  descripcion: { color: c.text, fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: 12 },
  seccion: { marginTop: 22 },
  seccionTitulo: { color: c.textStrong, fontFamily: font.semibold, fontSize: 14, marginBottom: 8 },
  lista: { color: c.text, fontFamily: font.regular, fontSize: 15, lineHeight: 24 },
  nota: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 8 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  cantidad: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cantidadBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  cantidadBtnOff: { opacity: 0.4 },
  cantidadTxt: { minWidth: 24, textAlign: 'center', color: c.textStrong, fontFamily: font.bold, fontSize: 16 },
  boton: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
    ...shadow.gold,
  },
  botonTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
  botonOff: { backgroundColor: c.surface2, shadowOpacity: 0, elevation: 0 },
  botonOffTxt: { color: c.muted, fontFamily: font.bold, fontSize: 15 },
}));
