/**
 * Piezas de la búsqueda del cliente: los botones de filtro, la fila compacta de
 * un resultado (negocio o producto) y el aviso cuando no hay nada. Las usan la
 * pantalla Buscar y Explorar.
 */
import React from 'react';
import { Image, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { imagenUrl, NegocioLista, ResumenResenas } from '../api';
import { font, makeStyles, radius, useTheme } from '../theme';
import { FadeInView, PressableScale } from './anim';
import Icon, { IconName } from './Icon';
import { PuntajeResenas } from './Resenas';

/** Sin tildes ni mayúsculas: "rincon" encuentra "El Rincón Paisa". */
export const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Lo esencial de un negocio en una sola línea. */
export function metaNegocio(n: NegocioLista, mostrarPreparacion = true) {
  return [n.categoria, mostrarPreparacion && n.tiempo_preparacion ? `Preparación ~${n.tiempo_preparacion} min` : null, n.barrio]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Botón de filtro. El fondo va en una vista siempre montada que solo cambia de
 * opacidad: Android dibuja sin esquinas un fondo que se le agrega a una vista
 * ya en pantalla.
 */
export function FiltroChip({
  texto,
  activo,
  icono,
  ayuda,
  onPress,
}: {
  texto: string;
  activo: boolean;
  icono?: IconName;
  ayuda?: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      style={[styles.chip, { borderColor: activo ? c.brand : c.borderStrong }]}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={ayuda ? `${texto}: ${ayuda}` : texto}
      onPress={onPress}>
      <View pointerEvents="none" style={[styles.chipFondo, { opacity: activo ? 1 : 0 }]} />
      {!!icono && <Icon name={icono} size={15} color={activo ? c.onBrand : c.muted} />}
      <Text style={[styles.chipTxt, { color: activo ? c.onBrand : c.text }]}>{texto}</Text>
    </Pressable>
  );
}

/** Resultado de búsqueda, compacto: negocio o producto. */
export function FilaResultado({
  imagen,
  icono,
  nombre,
  linea,
  lineaResaltada,
  detalle,
  resenas,
  index,
  onPress,
}: {
  imagen?: string | null;
  icono: IconName;
  nombre: string;
  linea: string;
  lineaResaltada?: boolean;
  detalle?: string | null;
  resenas?: ResumenResenas;
  index: number;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const uri = imagenUrl(imagen);

  return (
    <FadeInView delay={Math.min(index, 6) * 35} offset={8}>
      <PressableScale style={styles.resultado} scaleTo={0.98} accessibilityRole="button" onPress={onPress}>
        <View style={styles.resultadoFoto}>
          {uri ? (
            <Image source={{ uri }} style={styles.foto} resizeMode="cover" />
          ) : (
            <Icon name={icono} size={24} color={c.mutedSoft} />
          )}
        </View>
        <View style={styles.resultadoTexto}>
          <Text style={styles.resultadoNombre} numberOfLines={1}>{nombre}</Text>
          {!!linea && (
            <Text style={lineaResaltada ? styles.resultadoPrecio : styles.meta} numberOfLines={1}>
              {linea}
            </Text>
          )}
          {!!detalle && <Text style={styles.meta} numberOfLines={1}>{detalle}</Text>}
          <PuntajeResenas resenas={resenas} size={12} style={styles.puntaje} />
        </View>
      </PressableScale>
    </FadeInView>
  );
}

/** Aviso de lista vacía, con una acción opcional («Quitar filtros»). */
export function SinResultados({
  titulo,
  detalle,
  accion,
  onAccion,
}: {
  titulo: string;
  detalle?: string | null;
  accion?: string | null;
  onAccion?: () => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.vacio}>
      <Icon name="lupa" size={30} color={c.chevron} />
      <Text style={styles.vacioTitulo}>{titulo}</Text>
      {!!detalle && <Text style={styles.vacioDetalle}>{detalle}</Text>}
      {!!accion && (
        <TouchableOpacity hitSlop={8} onPress={onAccion}>
          <Text style={styles.vacioAccion}>{accion}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  // Alto fijo y radio de la mitad: ver FiltroChip.
  chip: {
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  chipFondo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 18,
    backgroundColor: c.brand,
  },
  chipTxt: { fontFamily: font.medium, fontSize: 14 },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginBottom: 16 },
  resultadoFoto: {
    width: 68,
    height: 68,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  foto: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  resultadoTexto: { flex: 1 },
  resultadoNombre: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  resultadoPrecio: { color: c.text, fontFamily: font.bold, fontSize: 14, lineHeight: 20 },
  meta: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginTop: 1 },
  puntaje: { marginTop: 3 },
  vacio: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 56 },
  vacioTitulo: {
    color: c.textStrong,
    fontFamily: font.semibold,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
  },
  vacioDetalle: { color: c.muted, fontFamily: font.regular, fontSize: 14, marginTop: 4, textAlign: 'center' },
  vacioAccion: { color: c.goldText, fontFamily: font.semibold, fontSize: 14, marginTop: 14 },
}));
