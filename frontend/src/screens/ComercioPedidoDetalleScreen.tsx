import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import {
  cancelarPedidoNegocio,
  ComercioPedido,
  confirmarDinero,
  DineroEstado,
  getPedidoNegocio,
  marcarPedidoListo,
} from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import BotonesContacto from '../components/BotonesContacto';
import Icon from '../components/Icon';
import MotivoCancelacion from '../components/MotivoCancelacion';
import { NivelBadge } from '../components/Reputacion';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'ComercioPedidoDetalle'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function ComercioPedidoDetalleScreen({ route, navigation }: Props) {
  const { c, estadoColor } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const { negocio } = useNegocio();
  // Desde un push el pedido puede ser de un negocio que no es el activo.
  const negocioId = route.params.negocioId ?? negocio?.id ?? null;
  const [pedido, setPedido] = useState<ComercioPedido | null>(route.params.pedido ?? null);
  const [cargando, setCargando] = useState(!route.params.pedido);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (pedido || !route.params.pedidoId || !negocioId) {
      setCargando(false);
      return;
    }

    getPedidoNegocio(token, negocioId, route.params.pedidoId)
      .then(setPedido)
      .catch(e => toast.error('No se pudo cargar', e instanceof Error ? e.message : 'Error'))
      .finally(() => setCargando(false));
  }, [pedido, route.params.pedidoId, negocioId, toast, token]);

  // Rechazar (pendiente) o cancelar (listo y nadie lo tomó), con motivo.
  const [cancelando, setCancelando] = useState(false);
  const [enviandoCancelacion, setEnviandoCancelacion] = useState(false);

  async function confirmarCancelacion(motivo: string) {
    if (!pedido || !negocioId) return;
    setEnviandoCancelacion(true);
    try {
      await cancelarPedidoNegocio(token, negocioId, pedido.id, motivo);
      setCancelando(false);
      toast.exito('Pedido cancelado', 'Le avisamos al cliente.');
      navigation.goBack();
    } catch (e) {
      setCancelando(false);
      toast.error('No se pudo cancelar', e instanceof Error ? e.message : 'Error');
    } finally {
      setEnviandoCancelacion(false);
    }
  }

  async function onListo() {
    if (!pedido || !negocioId) {
      return;
    }
    setEnviando(true);
    try {
      await marcarPedidoListo(token, negocioId, pedido.id);
      toast.exito('Pedido listo', 'Los domiciliarios ya pueden recogerlo.');
      navigation.goBack();
    } catch (e) {
      toast.error('No se pudo', e instanceof Error ? e.message : 'Error');
      setEnviando(false);
    }
  }

  async function enviarDinero(estado: DineroEstado) {
    if (!pedido || !negocioId) {
      return;
    }
    try {
      const msg = await confirmarDinero(token, negocioId, pedido.id, estado);
      setPedido({ ...pedido, dinero_estado: estado, puede_confirmar_dinero: false });
      toast.exito('Registrado', msg);
    } catch (e) {
      toast.error('No se pudo', e instanceof Error ? e.message : 'Error');
    }
  }

  function onDinero(estado: DineroEstado) {
    if (estado === 'recibido') {
      enviarDinero(estado);
      return;
    }
    // Acusar al domiciliario le baja mucho la confiabilidad: se confirma.
    Alert.alert(
      estado === 'no_recibido' ? '¿No te entregó el dinero?' : '¿Te entregó menos dinero?',
      estado === 'no_recibido'
        ? 'Es una falta grave: le baja mucho el nivel al domiciliario y, si se repite, queda vetado.'
        : 'Le bajará el nivel de confiabilidad al domiciliario.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, reportar', style: 'destructive', onPress: () => enviarDinero(estado) },
      ],
    );
  }

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!pedido) {
    return (
      <View style={styles.centro}>
        <Text style={styles.nota}>No se pudo abrir este pedido.</Text>
      </View>
    );
  }

  const ec = estadoColor(pedido.estado);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <FadeInView style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.pid}>Pedido #{pedido.id}</Text>
          <Text style={[styles.badge, { backgroundColor: ec.bg, color: ec.fg }]}>
            {pedido.estado_label}
          </Text>
        </View>

        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Cliente</Text>
          <View style={styles.filaInfo}>
            <Icon name="usuario" size={15} color={c.textStrong} />
            <Text style={styles.cliente}>{pedido.cliente ?? 'Cliente'}</Text>
          </View>
          <View style={styles.filaInfo}>
            <Icon name="ubicacion" size={15} color={c.text} />
            <Text style={styles.linea}>{pedido.direccion_entrega}</Text>
          </View>
          {!!pedido.telefono_contacto && (
            <View style={styles.filaInfo}>
              <Icon name="telefono" size={15} color={c.text} />
              <Text style={styles.linea}>{pedido.telefono_contacto}</Text>
            </View>
          )}
          {pedido.estado !== 'cancelado' && pedido.estado !== 'entregado' && (
            <BotonesContacto
              telefono={pedido.telefono_contacto}
              mensaje={`Hola, te escribimos de ${negocio?.nombre ?? 'tu tienda'} por tu pedido #${pedido.id} de Vitrina.`}
              etiquetaLlamar="Llamar al cliente"
            />
          )}
          <View style={styles.filaInfo}>
            <Icon name="tarjeta" size={15} color={c.text} />
            <Text style={styles.linea}>Pago: {pedido.metodo_pago}</Text>
          </View>
          {!!pedido.domiciliario && (
            <View style={styles.filaInfo}>
              <Icon name="moto" size={15} color={c.text} />
              <Text style={styles.linea}>Domiciliario: {pedido.domiciliario}</Text>
              <NivelBadge reputacion={pedido.domiciliario_reputacion} />
            </View>
          )}
          <BotonesContacto
            telefono={pedido.domiciliario_telefono}
            mensaje={`Hola, te escribimos de ${negocio?.nombre ?? 'la tienda'} por el pedido #${pedido.id}.`}
            etiquetaLlamar="Llamar al domiciliario"
          />
          {pedido.estado === 'cancelado' && (
            <View style={styles.novedad}>
              <Icon name="cerrar" size={15} color={c.danger} />
              <Text style={[styles.novedadTxt, { color: c.danger }]}>
                {pedido.cancelado_por === 'cliente' ? 'El cliente lo canceló' : 'Lo cancelaron ustedes'}
                {pedido.motivo_cancelacion ? `: ${pedido.motivo_cancelacion}` : '.'}
              </Text>
            </View>
          )}
          {!!pedido.novedad && pedido.estado !== 'entregado' && (
            <View style={styles.novedad}>
              <Icon name="alerta" size={15} color={c.warning} />
              <Text style={styles.novedadTxt}>Novedad del domiciliario: {pedido.novedad}</Text>
            </View>
          )}
        </View>

        <View style={styles.bloque}>
          <Text style={styles.bloqueTitulo}>Productos</Text>
          {pedido.items.map((it, idx) => (
            <View key={idx} style={styles.itemRow}>
              <Text style={styles.itemCant}>{it.cantidad}×</Text>
              <Text style={styles.itemNombre}>{it.nombre}</Text>
            </View>
          ))}
        </View>

        {pedido.subtotal != null && (
          <View style={styles.desglose}>
            <Text style={styles.linea}>Productos (para el negocio): {cop(pedido.subtotal)}</Text>
            <Text style={styles.linea}>Domicilio: {cop(pedido.costo_domicilio ?? 0)}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total que paga el cliente</Text>
          <Text style={styles.totalValor}>{cop(pedido.total)}</Text>
        </View>
      </FadeInView>

      <MotivoCancelacion
        visible={cancelando}
        titulo={pedido.estado === 'pendiente' ? 'Rechazar pedido' : 'Cancelar pedido'}
        explicacion="El cliente verá el motivo y recibirá un aviso. No se le cobra nada."
        motivos={pedido.motivos_cancelacion ?? []}
        textoBoton={pedido.estado === 'pendiente' ? 'Rechazar pedido' : 'Cancelar pedido'}
        enviando={enviandoCancelacion}
        onCerrar={() => setCancelando(false)}
        onConfirmar={confirmarCancelacion}
      />

      {/* Efectivo: el negocio dice si el domiciliario le entregó el dinero
          (sube o baja su nivel de confiabilidad). */}
      {pedido.puede_confirmar_dinero ? (
        <FadeInView delay={60} style={[styles.card, styles.dineroCard]}>
          <View style={styles.filaInfo}>
            <Icon name="efectivo" size={18} color={c.accent} />
            <Text style={styles.dineroTitulo}>¿{pedido.domiciliario} te entregó los {cop(pedido.total)}?</Text>
          </View>
          <Text style={styles.dineroSub}>Respóndelo cuando te pague. Afecta su nivel de confiabilidad.</Text>
          <View style={styles.dineroFila}>
            <PressableScale style={[styles.dineroBtn, { backgroundColor: c.success }]} onPress={() => onDinero('recibido')}>
              <Text style={styles.dineroBtnTxt}>Sí, completo</Text>
            </PressableScale>
          </View>
          <View style={styles.dineroFila}>
            <PressableScale style={[styles.dineroBtn, styles.dineroBtnBorde]} onPress={() => onDinero('incompleto')}>
              <Text style={[styles.dineroBtnTxt, { color: c.warning }]}>Incompleto</Text>
            </PressableScale>
            <PressableScale style={[styles.dineroBtn, styles.dineroBtnBorde]} onPress={() => onDinero('no_recibido')}>
              <Text style={[styles.dineroBtnTxt, { color: c.danger }]}>No me lo entregó</Text>
            </PressableScale>
          </View>
        </FadeInView>
      ) : pedido.dinero_estado ? (
        <View style={styles.filaNota}>
          <Icon
            name={pedido.dinero_estado === 'recibido' ? 'check' : 'alerta'}
            size={16}
            color={pedido.dinero_estado === 'recibido' ? c.success : c.danger}
          />
          <Text style={[styles.nota, styles.notaInline]}>
            {pedido.dinero_estado === 'recibido'
              ? 'Dinero recibido completo'
              : pedido.dinero_estado === 'incompleto'
                ? 'Reportaste dinero incompleto'
                : 'Reportaste que no te entregó el dinero'}
          </Text>
        </View>
      ) : null}

      {pedido.estado === 'pendiente' ? (
        <PressableScale style={styles.btn} onPress={onListo} disabled={enviando}>
          {enviando ? (
            <ActivityIndicator color={c.onBrand} />
          ) : (
            <Text style={styles.btnTxt}>Marcar listo para recoger</Text>
          )}
        </PressableScale>
      ) : pedido.estado === 'listo' ? (
        <View style={styles.filaNota}>
          <Icon name="reloj" size={16} color={c.muted} />
          <Text style={[styles.nota, styles.notaInline]}>Esperando que un domiciliario lo tome…</Text>
        </View>
      ) : pedido.estado === 'entregado' ? (
        <View style={styles.filaNota}>
          <Icon name="check" size={16} color={c.success} />
          <Text style={[styles.nota, styles.notaInline, { color: c.success }]}>Entregado al cliente</Text>
        </View>
      ) : pedido.estado === 'cancelado' ? null : (
        <View style={styles.filaNota}>
          <Icon name="moto" size={16} color={c.muted} />
          <Text style={[styles.nota, styles.notaInline]}>{pedido.estado_label}</Text>
        </View>
      )}

      {pedido.puede_cancelar && (
        <PressableScale style={styles.btnRechazar} onPress={() => setCancelando(true)}>
          <Text style={styles.btnRechazarTxt}>
            {pedido.estado === 'pendiente' ? 'Rechazar pedido' : 'Cancelar (nadie lo ha tomado)'}
          </Text>
        </PressableScale>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, padding: 20 },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 18, ...shadow.soft },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  pid: { fontFamily: font.extra, color: c.textStrong, fontSize: 18 },
  badge: { fontSize: 11, fontFamily: font.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  bloque: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12, marginTop: 12 },
  bloqueTitulo: { fontSize: 12, fontFamily: font.bold, color: c.mutedSoft, marginBottom: 6, textTransform: 'uppercase' },
  cliente: { fontFamily: font.bold, color: c.textStrong, fontSize: 15 },
  linea: { color: c.text, fontSize: 14, flex: 1, fontFamily: font.regular },
  filaInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  filaNota: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 },
  notaInline: { marginTop: 0 },
  itemRow: { flexDirection: 'row', marginTop: 4 },
  itemCant: { fontFamily: font.bold, color: c.goldText, width: 36 },
  itemNombre: { color: c.text, fontSize: 15, flex: 1, fontFamily: font.regular },
  desglose: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, marginTop: 12, gap: 2 },
  btnRechazar: {
    marginTop: 14, borderWidth: 1, borderColor: c.danger, borderRadius: radius.md,
    paddingVertical: 13, alignItems: 'center',
  },
  btnRechazarTxt: { color: c.danger, fontFamily: font.bold, fontSize: 15 },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: c.border, paddingTop: 14, marginTop: 14,
  },
  totalLabel: { fontFamily: font.bold, color: c.textStrong, fontSize: 16 },
  totalValor: { fontFamily: font.extra, color: c.textStrong, fontSize: 18 },
  btn: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', marginTop: 16, ...shadow.soft },
  btnTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
  nota: { textAlign: 'center', color: c.muted, marginTop: 16, fontSize: 14, fontFamily: font.regular },
  novedad: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: c.warningSoft,
    borderRadius: radius.sm, padding: 10, marginTop: 10,
  },
  novedadTxt: { flex: 1, color: c.warning, fontSize: 13, fontFamily: font.medium },
  dineroCard: { marginTop: 14, borderWidth: 1, borderColor: c.accentSoft },
  dineroTitulo: { flex: 1, fontFamily: font.bold, color: c.textStrong, fontSize: 15 },
  dineroSub: { color: c.muted, fontSize: 13, marginTop: 6, fontFamily: font.regular },
  dineroFila: { flexDirection: 'row', gap: 8, marginTop: 10 },
  dineroBtn: { flex: 1, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  dineroBtnBorde: { borderWidth: 1, borderColor: c.borderStrong },
  dineroBtnTxt: { color: c.onBrand, fontFamily: font.bold },
}));
