/**
 * Aviso de pedido nuevo, encima de cualquier pantalla mientras la app está
 * abierta. No se cierra con el botón atrás ni tocando afuera: sale al aceptar o
 * rechazar el pedido, o cuando el servidor deja de traerlo porque ya no hay nada
 * que decidir (otro del equipo lo atendió, el cliente lo canceló o venció).
 *
 * Los pedidos van en orden de llegada: al atender uno aparece el siguiente.
 *
 * Mientras se ve, los Toast quedan detrás del Modal: los errores se muestran
 * dentro de la tarjeta.
 */
import { StackActions } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { detenerAlarma, PedidoEnEspera } from '../alarmaPedidos';
import { aceptarPedido, cancelarPedidoNegocio, getPedidoNegocio } from '../api';
import { useAuth } from '../AuthContext';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { avisarCambioDesdePush } from '../usePolling';
import { PressableScale } from './anim';
import Icon from './Icon';
import MotivoCancelacion from './MotivoCancelacion';

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/** 272 → "4:32". */
function tiempo(segundos: number) {
  const s = Math.max(0, segundos);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'Inténtalo de nuevo.');

export default function AvisoPedidoNuevo({ pedidos }: { pedidos: PedidoEnEspera[] }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const [ahora, setAhora] = useState(() => Date.now());
  // La respuesta de una consulta ya en camino no puede devolver lo que se atendió.
  const [atendidos, setAtendidos] = useState<number[]>([]);
  const [ocupado, setOcupado] = useState<'aceptar' | 'rechazar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rechazo, setRechazo] = useState<{ id: number; motivos: string[] } | null>(null);
  const [enviandoRechazo, setEnviandoRechazo] = useState(false);

  const vigentes = pedidos.filter(p => p.vence > ahora && !atendidos.includes(p.id));
  const pedido = vigentes[0] ?? null;
  const pedidoId = pedido?.id ?? null;

  useEffect(() => {
    if (pedidoId == null) return;
    setError(null);
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pedidoId]);

  /** Lo saca del aviso y pone al día la alarma y las pantallas que hay detrás. */
  async function terminar(id: number) {
    setAtendidos(lista => [...lista, id]);
    await detenerAlarma(id).catch(() => {});
    avisarCambioDesdePush();
  }

  async function aceptar() {
    if (!pedido || !auth) return;
    setOcupado('aceptar');
    setError(null);
    try {
      await aceptarPedido(auth.token, pedido.negocio_id, pedido.id);
      await terminar(pedido.id);
      if (navigationRef.isReady()) {
        // `push`: si ya hay otro pedido abierto, este se abre encima de él.
        navigationRef.dispatch(
          StackActions.push('ComercioPedidoDetalle', { pedidoId: pedido.id, negocioId: pedido.negocio_id }),
        );
      }
      toast.exito('Pedido aceptado', 'Ya le avisamos al cliente.');
    } catch (e) {
      setError(mensaje(e));
      avisarCambioDesdePush();
    } finally {
      setOcupado(null);
    }
  }

  async function pedirMotivo() {
    if (!pedido || !auth) return;
    setOcupado('rechazar');
    setError(null);
    try {
      const { motivos_cancelacion: motivos } = await getPedidoNegocio(auth.token, pedido.negocio_id, pedido.id);
      setRechazo({ id: pedido.id, motivos: motivos ?? [] });
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setOcupado(null);
    }
  }

  async function rechazar(motivo: string) {
    if (!pedido || !auth) return;
    setEnviandoRechazo(true);
    try {
      await cancelarPedidoNegocio(auth.token, pedido.negocio_id, pedido.id, motivo);
      await terminar(pedido.id);
      toast.exito('Pedido rechazado', 'Le avisamos al cliente.');
    } catch (e) {
      setError(mensaje(e));
      avisarCambioDesdePush();
    } finally {
      setRechazo(null);
      setEnviandoRechazo(false);
    }
  }

  const otros = vigentes.length - 1;

  return (
    <Modal visible={!!pedido} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      {pedido && (
        <View style={styles.fondo}>
          <View style={styles.tarjeta} accessibilityViewIsModal>
            <View style={styles.icono}>
              <Icon name="carrito" size={28} color={c.goldText} />
            </View>
            <Text style={styles.titulo}>¡Nuevo pedido!</Text>
            <Text style={styles.detalle}>
              Pedido #{pedido.id}{pedido.negocio ? ` · ${pedido.negocio}` : ''}
            </Text>
            <Text style={styles.total}>{cop(pedido.total)}</Text>
            <Text style={styles.vence}>
              Vence en {tiempo(Math.ceil((pedido.vence - ahora) / 1000))}
            </Text>
            {otros > 0 && (
              <Text style={styles.otros}>
                {otros === 1 ? 'Hay 1 pedido más esperando' : `Hay ${otros} pedidos más esperando`}
              </Text>
            )}
            {!!error && <Text style={styles.error}>{error}</Text>}

            <PressableScale style={styles.aceptar} disabled={!!ocupado} onPress={aceptar}>
              {ocupado === 'aceptar' ? (
                <ActivityIndicator color={c.onAccent} />
              ) : (
                <Text style={styles.aceptarTxt}>Aceptar pedido</Text>
              )}
            </PressableScale>
            <PressableScale style={styles.rechazar} disabled={!!ocupado} onPress={pedirMotivo}>
              {ocupado === 'rechazar' ? (
                <ActivityIndicator color={c.danger} />
              ) : (
                <Text style={styles.rechazarTxt}>Rechazar</Text>
              )}
            </PressableScale>
          </View>
        </View>
      )}

      <MotivoCancelacion
        visible={!!rechazo && rechazo.id === pedidoId}
        titulo="Rechazar pedido"
        explicacion="El cliente verá el motivo y recibirá un aviso. No se le cobra nada."
        motivos={rechazo?.motivos ?? []}
        textoBoton="Rechazar pedido"
        enviando={enviandoRechazo}
        onCerrar={() => setRechazo(null)}
        onConfirmar={rechazar}
      />
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  tarjeta: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 24, alignItems: 'center', ...shadow.card },
  icono: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentSoft,
    marginBottom: 14,
  },
  titulo: { color: c.textStrong, fontFamily: font.display, fontSize: 22, lineHeight: 28 },
  detalle: { color: c.text, fontFamily: font.medium, fontSize: 14, lineHeight: 20, marginTop: 6, textAlign: 'center' },
  total: { color: c.goldText, fontFamily: font.extra, fontSize: 26, marginTop: 10 },
  vence: { color: c.muted, fontFamily: font.regular, fontSize: 13, marginTop: 6 },
  otros: { color: c.text, fontFamily: font.semibold, fontSize: 13, marginTop: 8 },
  error: { color: c.danger, fontFamily: font.medium, fontSize: 13, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  aceptar: {
    alignSelf: 'stretch',
    backgroundColor: c.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
    ...shadow.gold,
  },
  aceptarTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
  rechazar: { alignSelf: 'stretch', paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  rechazarTxt: { color: c.danger, fontFamily: font.semibold, fontSize: 15 },
}));
