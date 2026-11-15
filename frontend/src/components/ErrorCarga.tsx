import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { font, makeStyles, useTheme } from '../theme';
import { reintentarRed } from '../red';
import Icon from './Icon';

export default function ErrorCarga({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  return <View style={styles.box} accessibilityRole="alert">
    <Icon name="sin-internet" size={32} color={c.danger} />
    <Text style={styles.texto}>{mensaje}</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => { if (reintentar) reintentar(); else return reintentarRed(); }}>
      <Text style={styles.boton}>Reintentar</Text>
    </TouchableOpacity>
  </View>;
}
const useStyles = makeStyles(c => ({
  box: { padding: 24, alignItems: 'center', gap: 12 },
  texto: { color: c.text, textAlign: 'center', fontFamily: font.regular },
  boton: { color: c.goldText, fontFamily: font.bold, padding: 12 },
}));
