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
import { ActivityIndicator, Modal, ScrollView, Text, View } from 'react-native';
import { detenerAlarma, PedidoEnEspera } from '../alarmaPedidos';
import { aceptarPedido, cancelarPedidoNegocio, ComercioPedido, getPedidoNegocio } from '../api';
import { textoCantidad } from '../cantidades';
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
  // Lo que pidieron y a dónde va: se trae al aparecer cada pedido.
  const [detalle, setDetalle] = useState<ComercioPedido | null>(null);

  const vigentes = pedidos.filter(p => p.vence > ahora && !atendidos.includes(p.id));
  const pedido = vigentes[0] ?? null;
  const pedidoId = pedido?.id ?? null;

  const negocioDelPedido = pedido?.negocio_id ?? null;
  const token = auth?.token;
  useEffect(() => {
    setDetalle(null);
    if (pedidoId == null || negocioDelPedido == null || !token) return;
    let vigente = true;
    getPedidoNegocio(token, negocioDelPedido, pedidoId)
      .then(d => vigente && setDetalle(d))
      // Sin el detalle igual se puede aceptar: se ve en el pedido después.
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [pedidoId, negocioDelPedido, token]);

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
              Pedido #{pedido.codigo}{pedido.negocio ? ` · ${pedido.negocio}` : ''}
            </Text>
            <Text style={styles.total}>{cop(pedido.total)}</Text>

            {/* Qué pidieron y a dónde va, para decidir sin abrir el pedido. */}
            {detalle ? (
              <View style={styles.resumen}>
                <ScrollView style={styles.items} nestedScrollEnabled>
                  {(detalle.items ?? []).map((it, idx) => (
                    <View key={idx} style={styles.item}>
                      <Text style={styles.itemCant}>{textoCantidad(it)}</Text>
                      <View style={styles.itemTexto}>
                        <Text style={styles.itemNombre}>{it.nombre}</Text>
                        {!!it.detalle && <Text style={styles.itemDetalle}>{it.detalle}</Text>}
                      </View>
                    </View>
                  ))}
                </ScrollView>
                {!!detalle.direccion_entrega && (
                  <View style={styles.direccion}>
                    <Icon name="ubicacion" size={15} color={c.text} />
                    <Text style={styles.direccionTxt}>{detalle.direccion_entrega}</Text>
                  </View>
                )}
                {detalle.metodo_pago === 'efectivo' ? (
                  <View style={styles.direccion}>
                    <Icon name="efectivo" size={15} color={c.text} />
                    <Text style={styles.direccionTxt}>
                      Efectivo{detalle.paga_con ? `, paga con ${cop(detalle.paga_con)}` : ', valor exacto'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.direccion}>
                    <Icon name="banco" size={15} color={c.text} />
                    <Text style={styles.direccionTxt}>Transferencia</Text>
                  </View>
                )}
              </View>
            ) : (
              <ActivityIndicator style={styles.cargando} color={c.accent} accessibilityLabel="Cargando lo que pidieron" />
            )}

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
  resumen: {
    alignSelf: 'stretch',
    marginTop: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: c.bg,
    gap: 8,
  },
  items: { maxHeight: 190 },
  item: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  itemCant: { color: c.goldText, fontFamily: font.bold, fontSize: 15, minWidth: 30 },
  itemTexto: { flex: 1 },
  itemNombre: { color: c.textStrong, fontFamily: font.semibold, fontSize: 15 },
  itemDetalle: { color: c.muted, fontFamily: font.regular, fontSize: 13 },
  direccion: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  direccionTxt: { flex: 1, color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 19 },
  cargando: { marginTop: 14 },
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
