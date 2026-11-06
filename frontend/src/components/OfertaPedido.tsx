/**
 * Oferta de pedido para el domiciliario en turno, encima de cualquier pantalla
 * (también las de cliente) mientras la app está abierta. Se cierra al aceptar o
 * rechazar, o si deja de estar disponible porque otro lo tomó.
 *
 * Aceptar sigue el proceso normal: pregunta en cuánto lo recoge (MinutosRecogida)
 * y, ya tomado, lleva a "Mis entregas". Es lo mismo que pasa al tocar Aceptar en
 * la notificación con la app cerrada (ver ofertasPedidos.ts).
 *
 * Mientras se ve, los Toast quedan detrás del Modal.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Modal, Text, View } from 'react-native';
import { getDisponibles, Pedido, tomarPedido } from '../api';
import { useAuth } from '../AuthContext';
import { alAceptarOferta, ofertasRechazadas, quitarOferta, rechazarOferta } from '../ofertasPedidos';
import { abrirEntregas, navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { alCambiarDesdePush, avisarCambioDesdePush } from '../usePolling';
import { PressableScale } from './anim';
import Icon from './Icon';
import MinutosRecogida from './MinutosRecogida';

/** Cada cuánto se pregunta al servidor con la app abierta, por si un push no llegó. */
const CADA_MS = 10000;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function OfertaPedido() {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [ofertas, setOfertas] = useState<Pedido[]>([]);
  const [descartados, setDescartados] = useState<number[]>([]);
  // Pedido aceptado: se está preguntando en cuántos minutos lo recoge.
  const [porTomar, setPorTomar] = useState<Pedido | null>(null);
  const [tomando, setTomando] = useState(false);

  const revisar = useCallback(async () => {
    const [{ pedidos, en_turno: enTurno, vetado }, rechazados] = await Promise.all([
      getDisponibles(token),
      ofertasRechazadas(),
    ]);
    setDescartados(rechazados);
    // Del más viejo al más nuevo: el que lleva más tiempo esperando va primero.
    setOfertas(enTurno && !vetado ? [...pedidos].sort((a, b) => a.id - b.id) : []);
    return pedidos;
  }, [token]);

  // Sin red no se toca nada: lo que se está viendo sigue ahí.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const consultar = () => {
      revisar().catch(() => {});
    };
    const iniciar = () => {
      consultar();
      if (!timer) timer = setInterval(consultar, CADA_MS);
    };
    const detener = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (AppState.currentState === 'active') iniciar();
    const sub = AppState.addEventListener('change', estado => (estado === 'active' ? iniciar() : detener()));
    const quitarOyente = alCambiarDesdePush(consultar);

    return () => {
      detener();
      sub.remove();
      quitarOyente();
    };
  }, [revisar]);

  // Aceptó en la notificación: se trae el pedido y se pregunta el tiempo.
  useEffect(
    () =>
      alAceptarOferta(pedidoId => {
        revisar()
          .then(pedidos => {
            const pedido = pedidos.find(p => p.id === pedidoId);
            if (pedido) {
              setPorTomar(pedido);
            } else {
              toast.info('Ese pedido ya no está disponible', 'Otro domiciliario lo tomó primero.');
            }
          })
          .catch(e => toast.error('No se pudo abrir el pedido', e instanceof Error ? e.message : 'Error'));
      }),
    [revisar, toast],
  );

  const pedido = ofertas.find(p => !descartados.includes(p.id)) ?? null;
  const pedidoId = pedido?.id ?? null;

  // Ya se está viendo aquí: la notificación de ese pedido sobra.
  useEffect(() => {
    if (pedidoId != null) quitarOferta(pedidoId).catch(() => {});
  }, [pedidoId]);

  function rechazar() {
    if (pedidoId == null) return;
    setDescartados(lista => [...lista, pedidoId]);
    rechazarOferta(pedidoId).catch(() => {});
  }

  async function tomar(minutos: number) {
    if (!porTomar) return;
    setTomando(true);
    try {
      await tomarPedido(token, porTomar.id, minutos);
      setDescartados(lista => [...lista, porTomar.id]);
      if (navigationRef.isReady()) abrirEntregas();
      toast.exito('Pedido tomado', `Pasa a recogerlo en ${minutos} min.`);
    } catch (e) {
      // Puede que otro lo haya tomado.
      toast.error('No se pudo tomar', e instanceof Error ? e.message : 'Error');
    } finally {
      setTomando(false);
      setPorTomar(null);
      avisarCambioDesdePush();
    }
  }

  return (
    <>
      <Modal
        visible={!!pedido && !porTomar}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {}}>
        {pedido && (
          <View style={styles.fondo}>
            <View style={styles.tarjeta} accessibilityViewIsModal>
              <View style={styles.icono}>
                <Icon name="moto" size={28} color={c.goldText} />
              </View>
              <Text style={styles.titulo}>¡Pedido disponible!</Text>
              <Text style={styles.ganancia}>Domicilio {cop(pedido.costo_domicilio)}</Text>

              <View style={styles.fila}>
                <Icon name="tienda" size={15} color={c.text} />
                <Text style={styles.linea}>
                  Recoger: {pedido.negocio?.nombre} — {pedido.negocio?.direccion ?? 's/d'}
                </Text>
              </View>
              <View style={styles.fila}>
                <Icon name="casa" size={15} color={c.text} />
                <Text style={styles.linea}>Entregar: {pedido.direccion_entrega}</Text>
              </View>
              <View style={styles.fila}>
                <Icon name="tarjeta" size={15} color={c.text} />
                <Text style={styles.linea}>
                  {pedido.cobrar > 0 ? `Cobrar ${cop(pedido.cobrar)} en efectivo` : 'Pagado: no cobres nada'}
                </Text>
              </View>

              <PressableScale style={styles.aceptar} onPress={() => setPorTomar(pedido)}>
                <Text style={styles.aceptarTxt}>Aceptar</Text>
              </PressableScale>
              <PressableScale style={styles.rechazar} onPress={rechazar}>
                <Text style={styles.rechazarTxt}>Rechazar</Text>
              </PressableScale>
            </View>
          </View>
        )}
      </Modal>

      <MinutosRecogida pedido={porTomar} enviando={tomando} onCerrar={() => setPorTomar(null)} onAceptar={tomar} />
    </>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  tarjeta: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 24, ...shadow.card },
  icono: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentSoft,
    marginBottom: 14,
  },
  titulo: { color: c.textStrong, fontFamily: font.display, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  ganancia: { color: c.goldText, fontFamily: font.extra, fontSize: 20, textAlign: 'center', marginTop: 6, marginBottom: 12 },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  linea: { flex: 1, color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  aceptar: {
    backgroundColor: c.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
    ...shadow.gold,
  },
  aceptarTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
  rechazar: { paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  rechazarTxt: { color: c.danger, fontFamily: font.semibold, fontSize: 15 },
}));
