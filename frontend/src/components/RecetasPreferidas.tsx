/**
 * Lo que el cliente ya pidió varias veces en esta tienda con los mismos ajustes
 * ("Sin tomate · Extra queso"). Un toque lo agrega al carrito tal cual.
 */
import React from 'react';
import { GestureResponderEvent, Image, ScrollView, Text, View } from 'react-native';
import { imagenUrl, RecetaPreferida } from '../api';
import { detalleOpciones, precioDe } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import Icon from './Icon';

type Props = {
  recetas: RecetaPreferida[];
  /** Con el negocio cerrado la receta se ve, pero no se puede agregar. */
  abierto: boolean;
  onAgregar: (receta: RecetaPreferida, e: GestureResponderEvent) => void;
};

export default function RecetasPreferidas({ recetas, abierto, onAgregar }: Props) {
  const { c } = useTheme();
  const styles = useStyles();

  if (recetas.length === 0) {
    return null;
  }

  return (
    <View style={styles.bloque}>
      <View style={styles.titulo}>
        <Icon name="estrella" size={16} color={c.goldText} />
        <Text style={styles.tituloTxt}>Tus recetas preferidas</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lista}>
        {recetas.map(receta => {
          const { producto, opciones, veces } = receta;
          const detalle = detalleOpciones(opciones);
          const uri = imagenUrl(producto.imagen);
          return (
            <PressableScale
              key={`${producto.id}-${detalle}`}
              style={styles.tarjeta}
              scaleTo={0.98}
              accessibilityRole="button"
              accessibilityLabel={`Agregar ${producto.nombre}: ${detalle}`}
              onPress={e => onAgregar(receta, e)}>
              <View style={styles.foto}>
                {uri ? (
                  <Image source={{ uri }} style={styles.fotoImagen} resizeMode="cover" />
                ) : (
                  <Icon name="caja" size={24} color={c.mutedSoft} />
                )}
              </View>
              <View style={styles.datos}>
                <Text style={styles.nombre} numberOfLines={1}>{producto.nombre}</Text>
                <Text style={styles.detalle} numberOfLines={2}>{detalle}</Text>
                <Text style={styles.veces} numberOfLines={1}>
                  {precioDe(producto)} · Pedida {veces} veces
                </Text>
              </View>
              {abierto && (
                <View style={styles.agregar}>
                  <Icon name="mas" size={16} color={c.onBrand} strokeWidth={2.4} />
                </View>
              )}
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  bloque: { marginTop: 18 },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 10 },
  tituloTxt: { color: c.textStrong, fontSize: 17, fontFamily: font.displaySemi },
  lista: { gap: 12, paddingHorizontal: 20, paddingBottom: 4 },
  tarjeta: {
    width: 280,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  foto: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  fotoImagen: { width: '100%', height: '100%' },
  datos: { flex: 1, gap: 2 },
  nombre: { color: c.textStrong, fontSize: 14, fontFamily: font.semibold },
  detalle: { color: c.goldText, fontSize: 13, lineHeight: 17, fontFamily: font.medium },
  veces: { color: c.muted, fontSize: 12, fontFamily: font.regular },
  agregar: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.brand,
    ...shadow.soft,
  },
}));
