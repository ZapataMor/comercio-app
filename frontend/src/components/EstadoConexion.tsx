import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { iniciarMonitorRed, observarRed } from '../red';
import { font, makeStyles, useTheme } from '../theme';
import Icon from './Icon';

export default function EstadoConexion() {
  const [estado, setEstado] = useState({ sinInternet: false, aviso: '' });
  const [cerrado, setCerrado] = useState(false);
  const styles = useStyles();
  const { c } = useTheme();
  useEffect(() => {
    const unsubscribe = observarRed(value => { setEstado(value); setCerrado(false); });
    const stop = iniciarMonitorRed();
    return () => { unsubscribe(); stop(); };
  }, []);
  if (!estado.sinInternet && (!estado.aviso || cerrado)) return null;
  return <SafeAreaView edges={['top']} style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
    <Icon name={estado.sinInternet ? 'sin-internet' : 'reloj'} color={c.danger} size={24} />
    <Text style={styles.texto}>{estado.aviso}</Text>
    {!estado.sinInternet && <TouchableOpacity accessibilityLabel="Cerrar aviso" onPress={() => setCerrado(true)}><Icon name="cerrar" color={c.text} size={20} /></TouchableOpacity>}
  </SafeAreaView>;
}
const useStyles = makeStyles(c => ({
  banner: { backgroundColor: c.bg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: c.danger },
  texto: { color: c.text, fontFamily: font.semibold, flex: 1 },
}));
