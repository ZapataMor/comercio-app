/**
 * Tarjeta grande arriba del Inicio y de Explorar cuando el cliente tiene un
 * pedido que todavía no le llega: dice en qué va y lo lleva al seguimiento de
 * un toque. Así, si la app se cerró o la abrió desde el ícono, no tiene que
 * buscar el pedido en «Mis pedidos».
 */
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { getMisPedidos, MiPedido } from '../api';
import { useAuth } from '../AuthContext';
import { ESTADOS_EN_CURSO, PASO_CLIENTE } from '../pasosPedido';
import { font, makeStyles, radius, useTheme } from '../theme';
import { usePolling } from '../usePolling';
import { PressableScale } from './anim';
import Icon from './Icon';

export default function AvisoPedidoEnCurso() {
  const { c } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<any>();
  const { auth } = useAuth();
  const token = auth?.token;
  const [enCurso, setEnCurso] = useState<MiPedido[]>([]);

  const cargar = useCallback(() => {
    if (!token) return;
    getMisPedidos(token)
      .then(p => setEnCurso(p.items.filter(x => ESTADOS_EN_CURSO.includes(x.estado))))
      // Sin red se deja lo que había: es un atajo, no la lista de pedidos.
      .catch(() => {});
  }, [token]);

  // Al entrar a la pantalla, cada rato y apenas cambie un pedido (push o en vivo).
  useFocusEffect(cargar);
  usePolling(cargar, 30000, ['pedidos']);

  if (enCurso.length === 0) return null;
  const pedido = enCurso[0];
  const varios = enCurso.length > 1;

  return (
    <PressableScale
      style={styles.tarjeta}
      onPress={() => (varios ? navigation.navigate('MisPedidos') : navigation.navigate('PedidoDetalle', { id: pedido.id }))}
      accessibilityRole="button"
      accessibilityLabel={varios ? `Tienes ${enCurso.length} pedidos en curso. Ver mis pedidos` : `Tu pedido: ${PASO_CLIENTE[pedido.estado] ?? pedido.estado_label}. Ver mi pedido`}>
      <View style={styles.icono}>
        <Icon name="moto" size={24} color={c.onAccent} />
      </View>
      <View style={styles.texto}>
        <Text style={styles.titulo} numberOfLines={2}>
          {varios ? `Tienes ${enCurso.length} pedidos en curso` : `Tu pedido${pedido.negocio ? ` de ${pedido.negocio}` : ''}`}
        </Text>
        <Text style={styles.estado}>
          {varios ? 'Toca para ver en qué va cada uno.' : PASO_CLIENTE[pedido.estado] ?? pedido.estado_label}
        </Text>
        <Text style={styles.ver}>{varios ? 'Ver mis pedidos' : 'Ver mi pedido'} ›</Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles(c => ({
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 16,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: c.accent,
    backgroundColor: c.surface,
  },
  icono: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
  },
  texto: { flex: 1 },
  titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 17, lineHeight: 22 },
  estado: { color: c.text, fontFamily: font.regular, fontSize: 15, marginTop: 2 },
  ver: { color: c.goldText, fontFamily: font.bold, fontSize: 15, marginTop: 6 },
}));
