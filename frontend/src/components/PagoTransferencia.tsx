/**
 * Pago por transferencia verificado por el negocio.
 *
 *  - PagarTransferencia (cliente): cuando el negocio acepta, ve sus cuentas,
 *    elige una, copia el número, paga y avisa «Ya pagué» (con foto del
 *    comprobante si quiere).
 *  - RevisarPago (negocio): ve que el cliente dice que pagó y confirma que
 *    el dinero le llegó, o avisa que no lo encuentra. Revisarlo en su banco
 *    es su responsabilidad: un comprobante se puede falsificar.
 *
 * Solo con el pago confirmado se prepara el pedido y el domiciliario no le
 * cobra nada al cliente.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { CuentaPago, imagenUrl, informarPago, PagoCliente, PagoNegocio, revisarPago } from '../api';
import { API_URL } from '../config';
import { messageFromError } from '../formErrors';
import { copiarTexto } from '../portapapeles';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { PressableScale } from './anim';
import { useConfirmar } from './Confirmacion';
import Icon from './Icon';
import SelectorImagen from './SelectorImagen';

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/** «Cuenta de ahorros», «Celular», «Llave»… lo que acompaña al número. */
function etiquetaNumero(c: CuentaPago): string {
  if (c.tipo_cuenta) return c.tipo_cuenta === 'ahorros' ? 'Cuenta de ahorros' : 'Cuenta corriente';
  if (c.tipo === 'llave') return 'Llave';
  if (c.tipo === 'nequi' || c.tipo === 'daviplata') return 'Celular';
  return 'Número';
}

/** Imagen en pantalla completa (QR o comprobante); tocar para cerrar. */
export function ImagenAmpliada({ uri, headers, onCerrar }: { uri: string | null; headers?: Record<string, string>; onCerrar: () => void }) {
  const styles = useStyles();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <Pressable style={styles.ampliadaFondo} onPress={onCerrar} accessibilityLabel="Cerrar imagen">
        {!!uri && <Image source={{ uri, headers }} style={styles.ampliadaImg} resizeMode="contain" />}
        <Text style={styles.ampliadaNota}>Toca para cerrar</Text>
      </Pressable>
    </Modal>
  );
}

/** Una cuenta del negocio: a nombre de quién, el número para copiar y el QR. */
function TarjetaCuenta({ cuenta, elegida, onElegir, onVerQr }: {
  cuenta: CuentaPago; elegida?: boolean; onElegir?: () => void; onVerQr: (uri: string) => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();

  async function copiar() {
    if (!cuenta.numero) return;
    // Si copia el número es porque va a pagar ahí.
    onElegir?.();
    // Sin espacios: así lo pide la app del banco.
    if (await copiarTexto(cuenta.numero.replace(/\s/g, ''))) toast.exito('Copiado', `${cuenta.nombre}: ${cuenta.numero}`);
  }

  return (
    <TouchableOpacity
      activeOpacity={onElegir ? 0.8 : 1}
      onPress={onElegir}
      disabled={!onElegir}
      accessibilityRole={onElegir ? 'radio' : undefined}
      accessibilityState={onElegir ? { checked: !!elegida } : undefined}
      style={[styles.cuenta, elegida && styles.cuentaOn]}>
      <View style={styles.cuentaHead}>
        {onElegir && <View style={[styles.radio, elegida && styles.radioOn]}>{elegida && <View style={styles.radioPunto} />}</View>}
        <Icon name={cuenta.tipo === 'qr' ? 'imagen' : 'banco'} size={18} color={elegida ? c.goldText : c.muted} />
        <Text style={styles.cuentaNombre}>{cuenta.nombre}</Text>
      </View>
      <Text style={styles.cuentaTitular}>A nombre de {cuenta.titular}</Text>
      {!!cuenta.numero && (
        <View style={styles.numeroFila}>
          <View style={{ flex: 1 }}>
            <Text style={styles.numeroEtiqueta}>{etiquetaNumero(cuenta)}</Text>
            <Text style={styles.numero} selectable>{cuenta.numero}</Text>
          </View>
          <TouchableOpacity onPress={copiar} style={styles.copiar} accessibilityRole="button" accessibilityLabel={`Copiar ${cuenta.numero}`}>
            <Text style={styles.copiarTxt}>Copiar</Text>
          </TouchableOpacity>
        </View>
      )}
      {!!cuenta.qr && (
        <TouchableOpacity style={styles.qrFila} onPress={() => onVerQr(imagenUrl(cuenta.qr)!)} accessibilityRole="button">
          <Image source={{ uri: imagenUrl(cuenta.qr) }} style={styles.qrMini} />
          <Text style={styles.qrTxt}>Ver código QR para escanear</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

type PagarProps = {
  token: string;
  pedidoId: number;
  estado: string;
  total: number;
  negocio: string | null;
  pago: PagoCliente;
  /** Hay un producto agotado por resolver: no se paga todavía. */
  faltante?: boolean;
  onEnviado: () => void;
};

/** Lo que ve el cliente de su pago por transferencia mientras el pedido no sale. */
export function PagarTransferencia({ token, pedidoId, estado, total, negocio, pago, faltante, onEnviado }: PagarProps) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const [elegida, setElegida] = useState<number | null>(pago.cuentas.length === 1 ? pago.cuentas[0].id : null);
  const [comprobante, setComprobante] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [ampliadaAuth, setAmpliadaAuth] = useState(false);
  const elNegocio = negocio ?? 'el negocio';
  const auth = { Authorization: `Bearer ${token}` };

  async function avisar() {
    if (!elegida) {
      toast.info('Elige la cuenta', 'Toca la cuenta en la que hiciste la transferencia.');
      return;
    }
    setEnviando(true);
    try {
      const msg = await informarPago(token, pedidoId, elegida, comprobante);
      toast.exito('Le avisamos al negocio', msg);
      setComprobante(null);
      onEnviado();
    } catch (e) {
      toast.error('No se pudo avisar', messageFromError(e));
    } finally {
      setEnviando(false);
    }
  }

  const verQr = (uri: string) => { setAmpliadaAuth(false); setAmpliada(uri); };
  const imagen = <ImagenAmpliada uri={ampliada} headers={ampliadaAuth ? auth : undefined} onCerrar={() => setAmpliada(null)} />;

  if (pago.estado === 'confirmado') {
    return (
      <View style={[styles.card, styles.cardOk]}>
        <View style={styles.fila}>
          <Icon name="check" size={18} color={c.success} />
          <Text style={[styles.titulo, { color: c.success }]}>Pago confirmado</Text>
        </View>
        <Text style={styles.texto}>{elNegocio} recibió tu transferencia de {cop(total)}{pago.cuenta ? ` por ${pago.cuenta.nombre}` : ''}. Al domiciliario no le pagas nada.</Text>
      </View>
    );
  }

  if (estado === 'pendiente') {
    return (
      <View style={styles.card}>
        <View style={styles.fila}>
          <Icon name="banco" size={18} color={c.goldText} />
          <Text style={styles.titulo}>Pagas por transferencia</Text>
        </View>
        <Text style={styles.texto}>Cuando {elNegocio} acepte tu pedido, aquí verás sus cuentas para pagar {cop(total)}. No transfieras antes.</Text>
      </View>
    );
  }

  if (estado !== 'aceptado') return null;

  if (pago.estado === 'informado') {
    return (
      <View style={[styles.card, styles.cardEspera]}>
        <View style={styles.fila}>
          <Icon name="reloj" size={18} color={c.goldText} />
          <Text style={styles.titulo}>Avisaste que ya pagaste</Text>
        </View>
        <Text style={styles.texto}>
          {elNegocio} está revisando que le hayan llegado {cop(total)}{pago.cuenta ? ` en ${pago.cuenta.nombre}` : ''}. Te avisaremos cuando lo confirme y empiece a preparar tu pedido.
        </Text>
        {!!pago.comprobante && (
          <TouchableOpacity style={styles.qrFila} onPress={() => { setAmpliadaAuth(true); setAmpliada(`${API_URL}${pago.comprobante}`); }}>
            <Image source={{ uri: `${API_URL}${pago.comprobante}`, headers: auth }} style={styles.qrMini} />
            <Text style={styles.qrTxt}>Ver el comprobante que enviaste</Text>
          </TouchableOpacity>
        )}
        {imagen}
      </View>
    );
  }

  if (faltante || !pago.puede_informar) {
    return (
      <View style={styles.card}>
        <Text style={styles.titulo}>Pago por transferencia</Text>
        <Text style={styles.texto}>Primero elige qué hacer con el producto agotado. Luego verás aquí las cuentas para pagar.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.cardAccion]}>
      <View style={styles.fila}>
        <Icon name="banco" size={18} color={c.goldText} />
        <Text style={styles.titulo}>Paga {cop(total)} por transferencia</Text>
      </View>
      {pago.estado === 'no_llego' && (
        <View style={styles.alerta}>
          <Icon name="alerta" size={15} color={c.warning} />
          <Text style={styles.alertaTxt}>
            {elNegocio} aún no ve tu transferencia. Revisa que la hiciste por {cop(total)} a la cuenta correcta y vuelve a avisar. Si ya pagaste, escríbele al negocio.
          </Text>
        </View>
      )}
      <Text style={styles.texto}>{elNegocio} aceptó tu pedido. Elige dónde vas a pagar, copia el número y transfiere desde la app de tu banco. Revisa que el nombre que te muestre tu banco coincida.</Text>

      <View style={styles.valorFila}>
        <Text style={styles.valorEtiqueta}>Valor exacto</Text>
        <Text style={styles.valor} selectable>{cop(total)}</Text>
        <TouchableOpacity
          onPress={async () => { if (await copiarTexto(String(Math.round(total)))) toast.exito('Copiado', `Valor: ${cop(total)}`); }}
          style={styles.copiar} accessibilityRole="button" accessibilityLabel="Copiar el valor">
          <Text style={styles.copiarTxt}>Copiar</Text>
        </TouchableOpacity>
      </View>

      {pago.cuentas.map(cuenta => (
        <TarjetaCuenta key={cuenta.id} cuenta={cuenta} elegida={elegida === cuenta.id} onElegir={() => setElegida(cuenta.id)} onVerQr={verQr} />
      ))}

      <View style={{ marginTop: 12 }}>
        <SelectorImagen uri={comprobante ?? undefined} onSelect={setComprobante} label="Foto del comprobante (opcional, ayuda al negocio)" disabled={enviando} />
      </View>

      <PressableScale style={[styles.btn, !elegida && styles.btnApagado]} onPress={avisar} disabled={enviando}>
        {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.btnTxt}>Ya pagué</Text>}
      </PressableScale>
      <Text style={styles.nota}>Avisa solo cuando hayas hecho la transferencia. El negocio revisará que le llegó antes de preparar tu pedido.</Text>
      {imagen}
    </View>
  );
}

type RevisarProps = {
  token: string;
  negocioId: number;
  pedidoId: number;
  estado: string;
  total: number;
  pago: PagoNegocio;
  onRevisado: () => void;
};

/** Lo que ve el equipo del negocio del pago por transferencia. */
export function RevisarPago({ token, negocioId, pedidoId, estado, total, pago, onRevisado }: RevisarProps) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const auth = { Authorization: `Bearer ${token}` };

  async function enviar(nuevo: 'confirmado' | 'no_llego') {
    setEnviando(true);
    try {
      const msg = await revisarPago(token, negocioId, pedidoId, nuevo);
      toast.exito(nuevo === 'confirmado' ? 'Pago confirmado' : 'Cliente avisado', msg);
      onRevisado();
    } catch (e) {
      toast.error('No se pudo', messageFromError(e));
      onRevisado();
    } finally {
      setEnviando(false);
    }
  }

  function onConfirmar() {
    confirmar({
      icono: 'banco',
      titulo: `¿Te llegaron ${cop(total)}?`,
      texto: 'Confírmalo solo si viste el dinero en tu app del banco. Desde aquí preparas el pedido y el domiciliario no le cobrará nada al cliente.',
      textoBoton: 'Sí, me llegó',
      accion: () => enviar('confirmado'),
    });
  }

  if (pago.estado === 'confirmado') {
    return (
      <View style={styles.filaNota}>
        <Icon name="check" size={16} color={c.success} />
        <Text style={[styles.texto, { color: c.success, marginTop: 0 }]}>Pago por transferencia confirmado{pago.cuenta ? ` (${pago.cuenta.nombre})` : ''}</Text>
      </View>
    );
  }

  if (estado === 'pendiente') {
    return (
      <View style={styles.card}>
        <View style={styles.fila}>
          <Icon name="banco" size={18} color={c.goldText} />
          <Text style={styles.titulo}>Pago por transferencia</Text>
        </View>
        <Text style={styles.texto}>Cuando aceptes, el cliente verá tus cuentas de pago y te avisará al pagar. No prepares el pedido hasta confirmar que te llegó el dinero.</Text>
      </View>
    );
  }

  if (!pago.puede_confirmar) return null;

  const informado = pago.estado === 'informado';
  return (
    <View style={[styles.card, informado ? styles.cardAccion : styles.cardEspera]}>
      <View style={styles.fila}>
        <Icon name={informado ? 'banco' : 'reloj'} size={18} color={c.goldText} />
        <Text style={styles.titulo}>
          {informado ? 'El cliente dice que ya pagó' : pago.estado === 'no_llego' ? 'Le avisaste que no te ha llegado' : 'Esperando el pago del cliente'}
        </Text>
      </View>
      <Text style={styles.texto}>
        {informado
          ? `Revisa en ${pago.cuenta?.nombre ?? 'tu cuenta'}${pago.cuenta?.numero ? ` (${pago.cuenta.numero})` : ''} que te llegaron ${cop(total)}.`
          : pago.estado === 'no_llego'
            ? `El cliente revisará su transferencia y volverá a avisar. Si ves los ${cop(total)} en tu cuenta, confírmalo.`
            : `El cliente ya ve tus cuentas y debe transferirte ${cop(total)}. No prepares el pedido hasta confirmar el pago.`}
      </Text>

      {!!pago.comprobante && (
        <TouchableOpacity style={styles.qrFila} onPress={() => setAmpliada(`${API_URL}${pago.comprobante}`)}>
          <Image source={{ uri: `${API_URL}${pago.comprobante}`, headers: auth }} style={styles.qrMini} />
          <Text style={styles.qrTxt}>Ver el comprobante del cliente</Text>
        </TouchableOpacity>
      )}

      {informado && (
        <View style={styles.alertaFuerte}>
          <Icon name="alerta" size={16} color={c.danger} />
          <Text style={styles.alertaFuerteTxt}>
            Es tu responsabilidad revisar en tu app del banco que el dinero llegó completo antes de confirmar. Un comprobante se puede falsificar: no confíes solo en la foto.
          </Text>
        </View>
      )}

      <PressableScale style={[styles.btn, { backgroundColor: c.success }]} onPress={onConfirmar} disabled={enviando}>
        {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.btnTxt}>{informado ? `Sí, me llegaron ${cop(total)}` : 'Ya me llegó el pago'}</Text>}
      </PressableScale>
      {informado && (
        <PressableScale style={styles.btnBorde} onPress={() => enviar('no_llego')} disabled={enviando}>
          <Text style={[styles.btnBordeTxt, { color: c.danger }]}>No me ha llegado</Text>
        </PressableScale>
      )}
      <ImagenAmpliada uri={ampliada} headers={auth} onCerrar={() => setAmpliada(null)} />
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  card: { backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 14, ...shadow.soft },
  cardAccion: { borderWidth: 1.5, borderColor: c.accent },
  cardEspera: { borderLeftWidth: 4, borderLeftColor: c.accent },
  cardOk: { borderLeftWidth: 4, borderLeftColor: c.success },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filaNota: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  titulo: { flex: 1, fontFamily: font.bold, color: c.textStrong, fontSize: 16 },
  texto: { color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginTop: 8 },
  nota: { color: c.muted, fontFamily: font.regular, fontSize: 12, lineHeight: 17, marginTop: 8, textAlign: 'center' },
  alerta: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: c.warningSoft,
    borderRadius: radius.sm, padding: 10, marginTop: 10,
  },
  alertaTxt: { flex: 1, color: c.warning, fontSize: 13, lineHeight: 18, fontFamily: font.medium },
  alertaFuerte: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: c.dangerSoft,
    borderRadius: radius.sm, padding: 10, marginTop: 12,
  },
  alertaFuerteTxt: { flex: 1, color: c.danger, fontSize: 13, lineHeight: 18, fontFamily: font.semibold },
  valorFila: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12,
    borderRadius: radius.sm, backgroundColor: c.accentSoft,
  },
  valorEtiqueta: { color: c.goldText, fontFamily: font.semibold, fontSize: 13 },
  valor: { flex: 1, color: c.textStrong, fontFamily: font.extra, fontSize: 18 },
  cuenta: { marginTop: 10, padding: 12, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  cuentaOn: { borderColor: c.accent, borderWidth: 1.5, backgroundColor: c.accentSoft },
  cuentaHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cuentaNombre: { flex: 1, fontFamily: font.bold, color: c.textStrong, fontSize: 15 },
  cuentaTitular: { color: c.muted, fontFamily: font.regular, fontSize: 13, marginTop: 4 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: c.accent },
  radioPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
  numeroFila: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  numeroEtiqueta: { color: c.mutedSoft, fontFamily: font.semibold, fontSize: 11, textTransform: 'uppercase' },
  numero: { color: c.textStrong, fontFamily: font.bold, fontSize: 17, letterSpacing: 0.5 },
  copiar: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: c.accent, backgroundColor: c.surface },
  copiarTxt: { color: c.goldText, fontFamily: font.bold, fontSize: 13 },
  qrFila: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  qrMini: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: c.surface2 },
  qrTxt: { flex: 1, color: c.goldText, fontFamily: font.semibold, fontSize: 14 },
  btn: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 14, ...shadow.soft },
  btnApagado: { opacity: 0.55 },
  btnTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
  btnBorde: { borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: c.borderStrong },
  btnBordeTxt: { fontFamily: font.bold, fontSize: 15 },
  ampliadaFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  ampliadaImg: { width: '100%', height: '80%' },
  ampliadaNota: { color: '#FFFFFF', fontFamily: font.medium, marginTop: 14, opacity: 0.8 },
}));
