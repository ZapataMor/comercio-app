import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { font, makeStyles, radius } from '../theme';
import HeaderPerfil from './HeaderPerfil';

export default function HeaderCatalogo({ seccion, onCambiar }: { seccion: 'productos' | 'servicios'; onCambiar: () => void }) {
  const styles = useStyles();
  const destino = seccion === 'productos' ? 'Servicios' : 'Productos';
  return <View style={styles.fila}>
    <TouchableOpacity style={styles.boton} accessibilityRole="button" accessibilityLabel={`Ver ${destino.toLowerCase()}`} onPress={onCambiar}>
      <Text style={styles.texto}>{destino}</Text>
    </TouchableOpacity>
    <HeaderPerfil />
  </View>;
}
const useStyles = makeStyles(c => ({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boton: { borderWidth: 1, borderColor: c.onHeader, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  texto: { color: c.onHeader, fontFamily: font.semibold, fontSize: 13 },
}));
