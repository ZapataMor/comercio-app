import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { font, makeStyles, radius, useTheme } from '../theme';
import { reintentarRed } from '../red';
import Icon from './Icon';

/**
 * Lo que se ve cuando algo no cargó: qué pasó, en palabras simples, y un
 * botón claro para intentarlo otra vez.
 */
export default function ErrorCarga({ mensaje, reintentar, titulo = 'No pudimos cargar esto' }: {
  mensaje: string;
  reintentar?: () => void;
  titulo?: string;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return <View style={styles.box} accessibilityRole="alert">
    <View style={styles.icono}>
      <Icon name="sin-internet" size={28} color={c.danger} />
    </View>
    <Text style={styles.titulo}>{titulo}</Text>
    <Text style={styles.texto}>{mensaje}</Text>
    <TouchableOpacity style={styles.boton} accessibilityRole="button" onPress={() => { if (reintentar) reintentar(); else return reintentarRed(); }}>
      <Icon name="refrescar" size={17} color={c.onAccent} />
      <Text style={styles.botonTxt}>Intentar de nuevo</Text>
    </TouchableOpacity>
  </View>;
}
const useStyles = makeStyles(c => ({
  box: {
    margin: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  icono: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.dangerSoft,
  },
  titulo: { color: c.textStrong, textAlign: 'center', fontFamily: font.bold, fontSize: 17 },
  texto: { color: c.text, textAlign: 'center', fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 22,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.accent,
  },
  botonTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 15 },
}));
