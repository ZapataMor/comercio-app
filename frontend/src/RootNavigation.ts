import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './navTypes';
import { Usuario } from './api';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type PushData = {
  tipo?: string;
  pedido_id?: string;
  negocio_id?: string;
};

let pendingData: PushData | null = null;

function navigateFromData(data: PushData, user: Usuario) {
  const roles = user.roles ?? [];
  const pedidoId = Number(data.pedido_id);

  if (data.tipo === 'estado_pedido' && roles.includes('usuario') && Number.isFinite(pedidoId)) {
    navigationRef.navigate('PedidoDetalle', { id: pedidoId });
    return;
  }

  // Llega a todos los miembros del negocio (no depende de un rol global).
  if (data.tipo === 'nuevo_pedido' && Number.isFinite(pedidoId)) {
    const negocioId = Number(data.negocio_id);
    navigationRef.navigate('ComercioPedidoDetalle', {
      pedidoId,
      negocioId: Number.isFinite(negocioId) ? negocioId : undefined,
    });
    return;
  }

  if (data.tipo === 'invitacion_trabajo') {
    navigationRef.navigate('MisNegocios');
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
