import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './navTypes';
import { Usuario } from './api';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type PushData = {
  tipo?: string;
  pedido_id?: string;
};

let pendingData: PushData | null = null;

function navigateFromData(data: PushData, user: Usuario) {
  const roles = user.roles ?? [];
  const pedidoId = Number(data.pedido_id);

  if (data.tipo === 'estado_pedido' && roles.includes('usuario') && Number.isFinite(pedidoId)) {
    navigationRef.navigate('PedidoDetalle', { id: pedidoId });
    return;
  }

  if (data.tipo === 'nuevo_pedido' && roles.includes('comerciante') && Number.isFinite(pedidoId)) {
    navigationRef.navigate('ComercioPedidoDetalle', { pedidoId });
    return;
  }

  if (data.tipo === 'pedido_disponible' && roles.includes('domiciliario')) {
    navigationRef.navigate('Domiciliario');
    return;
  }

  if (roles.includes('usuario')) {
    navigationRef.navigate('MisPedidos');
  } else {
    navigationRef.navigate('Home');
  }
}

export function abrirNotificacion(data: PushData, user?: Usuario) {
  if (!user || !navigationRef.isReady()) {
    pendingData = data;
    return;
  }

  navigateFromData(data, user);
}

export function procesarNotificacionPendiente(user?: Usuario) {
  if (!pendingData || !user || !navigationRef.isReady()) {
    return;
  }

  const data = pendingData;
  pendingData = null;
  navigateFromData(data, user);
}
