import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { iniciarMonitorRed, observarRed, reintentarRed } from '../red';
import { font, makeStyles, useTheme } from '../theme';
import Icon from './Icon';

export default function EstadoConexion() {
  const [estado, setEstado] = useState({ sinInternet: false, aviso: '' });
  const [reintentando, setReintentando] = useState(false);
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
    <Icon name="sin-internet" color={c.danger} size={24} />
    <Text style={styles.texto}>{estado.aviso}</Text>
    <TouchableOpacity accessibilityRole="button" disabled={reintentando} onPress={async () => {
      setReintentando(true);
      try { await reintentarRed(); } finally { setReintentando(false); }
    }}><Text style={styles.boton}>{reintentando ? 'Comprobando…' : 'Reintentar'}</Text></TouchableOpacity>
    {!estado.sinInternet && <TouchableOpacity accessibilityLabel="Cerrar aviso" onPress={() => setCerrado(true)}><Icon name="cerrar" color={c.text} size={20} /></TouchableOpacity>}
  </SafeAreaView>;
}
const useStyles = makeStyles(c => ({
  banner: { backgroundColor: c.bg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: c.danger },
  boton: { color: c.goldText, fontFamily: font.bold, paddingVertical: 8 },
  texto: { color: c.text, fontFamily: font.semibold, flex: 1 },
}));
