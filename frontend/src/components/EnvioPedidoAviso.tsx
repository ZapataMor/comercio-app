import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { usePedidoPendiente } from '../PedidoPendienteContext';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles } from '../theme';

export default function EnvioPedidoAviso() {
  const { pendiente } = usePedidoPendiente();
  const styles = useStyles();
  if (!pendiente) return null;
  return <TouchableOpacity style={styles.aviso} onPress={() => { if (navigationRef.isReady()) navigationRef.navigate('Checkout'); }}>
    <Text style={styles.texto}>{pendiente.error ? 'Tu pedido necesita revisión. Toca para verlo.' : 'Pedido en proceso de envío. Toca para ver el estado.'}</Text>
  </TouchableOpacity>;
}
const useStyles = makeStyles(c => ({ aviso: { padding: 12, backgroundColor: c.accent }, texto: { color: c.onAccent, textAlign: 'center', fontFamily: font.semibold } }));
