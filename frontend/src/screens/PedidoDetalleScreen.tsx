import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { cancelarMiPedido, getPedido, SeguimientoPedido } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView } from '../components/anim';
import BotonesContacto from '../components/BotonesContacto';
import CalificarPedido, { ResumenCalificacion } from '../components/CalificarPedido';
import Icon from '../components/Icon';
import MotivoCancelacion from '../components/MotivoCancelacion';
import { NivelBadge } from '../components/Reputacion';
import { messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'PedidoDetalle'>;

const LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  listo: 'Listo para recoger',
  tomado: 'Domiciliario asignado',
  recogido: 'Recogido',
  en_camino: 'En camino',
  entregado: 'Entregado',
};

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/** Un paso de la línea de tiempo; el paso "actual" late suavemente. */
function Paso({ texto, hecho, actual }: { texto: string; hecho: boolean; actual: boolean }) {
  const { c } = useTheme();
  const styles = useStyles();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!actual) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [actual, pulse]);

  return (
    <View style={styles.paso}>
      <Animated.View
        style={[
          styles.bolita,
          hecho || actual ? styles.bolitaOn : styles.bolitaOff,
          actual && styles.bolitaActual,
          actual && { transform: [{ scale: pulse }] },
        ]}>
        {hecho ? (
          <Icon name="check" size={14} color={c.onAccent} />
        ) : (
          <Text style={[styles.bolitaTxt, !(hecho || actual) && styles.bolitaTxtOff]}>•</Text>
        )}
      </Animated.View>
      <Text style={[styles.pasoTxt, hecho || actual ? styles.pasoOn : styles.pasoOff]}>
        {texto}
        {actual ? '  · ahora' : ''}
      </Text>
    </View>
  );
}

export default function PedidoDetalleScreen({ route }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const { id } = route.params;
  const [pedido, setPedido] = useState<SeguimientoPedido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cancelando, setCancelando] = useState(false);
  const [enviandoCancelacion, setEnviandoCancelacion] = useState(false);

  async function confirmarCancelacion(motivo: string) {
    setEnviandoCancelacion(true);
    try {
      await cancelarMiPedido(auth!.token, id, motivo);
      setCancelando(false);
      toast.exito('Pedido cancelado', 'Le avisamos al negocio.');
      cargarPedido();
    } catch (e) {
      setCancelando(false);
      toast.error('No se pudo cancelar', messageFromError(e));
      cargarPedido();
    } finally {
      setEnviandoCancelacion(false);
    }
  }

  const cargarPedido = useCallback(
    (mostrarCarga = false) => {
      if (mostrarCarga) {
        setCargando(true);
      }

      return getPedido(auth!.token, id)
        .then(setPedido)
        .finally(() => setCargando(false));
    },
    [auth, id],
  );

  useFocusEffect(
    useCallback(() => {
      cargarPedido(true);
    }, [cargarPedido]),
  );
  // Se refresca al llegar un push (cambió el estado) y cada 15 s de respaldo.
  usePolling(() => cargarPedido());

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }
  if (!pedido) {
    return <Text style={styles.error}>No se encontró el pedido.</Text>;
  }

  return (
    <ScrollView
      style={styles.container}
      // Aire abajo para la barra flotante fija (Carrito / Mis pedidos).
      contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
      <Text style={styles.titulo}>Pedido #{pedido.id}</Text>
      <View style={[styles.sub, styles.fila]}>
        <Icon name="tienda" size={14} color={c.muted} />
        <Text style={styles.sub}>{pedido.negocio}</Text>
        <NivelBadge reputacion={pedido.negocio_reputacion} />
      </View>

      {/* Al terminar: el cliente califica al negocio y al domiciliario. */}
      {pedido.puede_calificar ? (
        <CalificarPedido pedido={pedido} onEnviado={() => cargarPedido()} />
      ) : pedido.calificacion ? (
        <ResumenCalificacion
          calificacion={pedido.calificacion}
          negocio={pedido.negocio}
          domiciliario={pedido.domiciliario}
        />
      ) : null}

      {/* Cancelado: en vez de la línea de tiempo, quién y por qué. */}
      {pedido.estado === 'cancelado' ? (
        <FadeInView style={[styles.card, styles.cancelado]}>
          <View style={styles.fila}>
            <Icon name="cerrar" size={18} color={c.danger} />
            <Text style={styles.canceladoTitulo}>Pedido cancelado</Text>
          </View>
          <Text style={styles.canceladoTxt}>
            {pedido.cancelado_por === 'negocio' ? `${pedido.negocio ?? 'El negocio'} no pudo atenderlo` : 'Lo cancelaste tú'}
            {pedido.motivo_cancelacion ? `: ${pedido.motivo_cancelacion}` : '.'}
          </Text>
          <Text style={styles.canceladoNota}>No se te cobra nada.</Text>
        </FadeInView>
      ) : (
      <FadeInView style={styles.card}>
        <Text style={styles.cardTitulo}>Seguimiento</Text>
        {pedido.estados.map((e, i) => (
          <Paso
            key={e}
            texto={LABEL[e] ?? e}
            hecho={i < pedido.estado_index}
            actual={i === pedido.estado_index}
          />
        ))}
        {pedido.estado === 'tomado' && pedido.minutos_recogida != null && (
          <View style={[styles.nota, styles.fila]}>
            <Icon name="moto" size={14} color={c.accent} />
            <Text style={styles.nota}>El domiciliario recoge en ~{pedido.minutos_recogida} min.</Text>
          </View>
        )}
        {!!pedido.domiciliario && (
          <View style={[styles.fila, styles.domiFila]}>
            <Text style={[styles.nota, styles.notaInline]}>Domiciliario: {pedido.domiciliario}</Text>
            <NivelBadge reputacion={pedido.domiciliario_reputacion} />
          </View>
        )}
        {/* Mientras lo lleva: llamar o escribirle al domiciliario. */}
        <BotonesContacto
          telefono={pedido.domiciliario_telefono}
          mensaje={`Hola, soy el cliente del pedido #${pedido.id} de Vitrina.`}
          etiquetaLlamar="Llamar al domiciliario"
        />
        {!!pedido.novedad && pedido.estado !== 'entregado' && (
          <View style={styles.novedad}>
            <Icon name="alerta" size={15} color={c.warning} />
            <Text style={styles.novedadTxt}>Novedad del domiciliario: {pedido.novedad}</Text>
          </View>
        )}
        {pedido.puede_cancelar && (
          <TouchableOpacity onPress={() => setCancelando(true)} style={styles.cancelarBtn}>
            <Text style={styles.cancelarTxt}>Cancelar pedido</Text>
          </TouchableOpacity>
        )}
      </FadeInView>
      )}

      {/* Contacto con el negocio (dudas sobre el pedido). */}
      {!!pedido.negocio_telefono && pedido.estado !== 'cancelado' && pedido.estado !== 'entregado' && (
        <FadeInView delay={40} style={styles.card}>
          <Text style={styles.cardTitulo}>¿Dudas con tu pedido?</Text>
          <Text style={styles.lineaTxt}>Comunícate con {pedido.negocio ?? 'el negocio'}.</Text>
          <BotonesContacto
            telefono={pedido.negocio_telefono}
            mensaje={`Hola, tengo una pregunta sobre mi pedido #${pedido.id} en Vitrina.`}
          />
        </FadeInView>
      )}

      <MotivoCancelacion
        visible={cancelando}
        titulo="Cancelar pedido"
        explicacion="El negocio todavía no lo ha preparado. Cuéntale por qué lo cancelas (opcional)."
        motivos={pedido.motivos_cancelacion ?? []}
        textoBoton="Cancelar pedido"
        enviando={enviandoCancelacion}
        onCerrar={() => setCancelando(false)}
        onConfirmar={confirmarCancelacion}
      />

      {/* Detalle */}
      <FadeInView delay={80} style={styles.card}>
        <Text style={styles.cardTitulo}>Detalle</Text>
        {pedido.items.map((it, idx) => (
          <View key={idx} style={styles.linea}>
            <Text style={styles.lineaTxt}>{it.cantidad}× {it.nombre}</Text>
            <Text style={styles.lineaTxt}>{cop(it.precio * it.cantidad)}</Text>
          </View>
        ))}
        <View style={styles.subtotalRow}>
          <Text style={styles.lineaTxt}>Productos</Text>
          <Text style={styles.lineaTxt}>{cop(pedido.subtotal ?? pedido.total)}</Text>
        </View>
        <View style={styles.linea}>
          <Text style={styles.lineaTxt}>Domicilio</Text>
          <Text style={styles.lineaTxt}>{cop(pedido.costo_domicilio ?? 0)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalLabel}>{cop(pedido.total)}</Text>
        </View>
        <View style={[styles.info, styles.fila]}>
          <Icon name="tarjeta" size={13} color={c.muted} />
          <Text style={styles.info}>{pedido.metodo_pago} ·</Text>
          <Icon name="ubicacion" size={13} color={c.muted} />
          <Text style={[styles.info, { flex: 1 }]}>{pedido.direccion_entrega}</Text>
        </View>
      </FadeInView>
    </ScrollView>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  titulo: { fontSize: 22, fontFamily: font.display, color: c.textStrong },
  sub: { color: c.muted, marginTop: 2, marginBottom: 16, fontFamily: font.medium },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 14, ...shadow.soft },
  cardTitulo: { fontFamily: font.bold, color: c.text, marginBottom: 12 },
  paso: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  bolita: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bolitaOn: { backgroundColor: c.accent },
  bolitaOff: { backgroundColor: c.surface2 },
  bolitaActual: { borderWidth: 3, borderColor: c.accentSoft },
  bolitaTxt: { color: c.onAccent, fontSize: 16, fontFamily: font.bold },
  bolitaTxtOff: { color: c.mutedSoft },
  pasoTxt: { fontSize: 14, fontFamily: font.medium },
  pasoOn: { color: c.textStrong, fontFamily: font.semibold },
  pasoOff: { color: c.mutedSoft },
  nota: { color: c.goldText, fontSize: 13, marginTop: 6, fontFamily: font.medium },
  notaInline: { marginTop: 0 },
  domiFila: { marginTop: 6, flexWrap: 'wrap' },
  novedad: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: c.warningSoft,
    borderRadius: radius.sm, padding: 10, marginTop: 10,
  },
  novedadTxt: { flex: 1, color: c.warning, fontSize: 13, fontFamily: font.medium },
  linea: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  lineaTxt: { color: c.text, fontFamily: font.regular },
  subtotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, paddingBottom: 3,
    borderTopWidth: 1, borderTopColor: c.border,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.border },
  cancelado: { borderLeftWidth: 4, borderLeftColor: c.danger },
  canceladoTitulo: { fontFamily: font.bold, fontSize: 16, color: c.danger },
  canceladoTxt: { color: c.text, fontFamily: font.regular, fontSize: 14, marginTop: 8, lineHeight: 20 },
  canceladoNota: { color: c.muted, fontFamily: font.regular, fontSize: 12, marginTop: 6 },
  cancelarBtn: { alignSelf: 'flex-start', marginTop: 14 },
  cancelarTxt: { color: c.danger, fontFamily: font.semibold, fontSize: 14 },
  totalLabel: { fontFamily: font.bold, color: c.textStrong },
  info: { color: c.muted, fontSize: 13, marginTop: 10, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
}));
