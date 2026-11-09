import React from 'react';
import { Text, View } from 'react-native';
import { font, makeStyles, radius } from '../theme';
import HeaderPerfil from './HeaderPerfil';
import { PressableScale } from './anim';

export default function HeaderCatalogo({ seccion, onCambiar }: { seccion: 'productos' | 'servicios'; onCambiar: () => void }) {
  const styles = useStyles();
  const destino = seccion === 'productos' ? 'Servicios' : 'Productos';
  return <View style={styles.fila}>
    <PressableScale scaleTo={0.9} hitSlop={6} style={styles.boton} accessibilityRole="button" accessibilityLabel={`Ver ${destino.toLowerCase()}`} onPress={onCambiar}>
      <Text style={styles.texto}>{destino}</Text>
    </PressableScale>
    <HeaderPerfil />
  </View>;
}
const useStyles = makeStyles(c => ({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boton: { height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.14)' },
  texto: { color: c.onHeader, fontFamily: font.semibold, fontSize: 13 },
}));
