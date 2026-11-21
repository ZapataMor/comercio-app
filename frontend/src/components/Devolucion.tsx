/**
 * Devolución de una transferencia cuando el pedido se cancela.
 *
 *  - DevolucionCliente: pedirla e indicar a dónde, ver si el negocio la
 *    devolvió y confirmar si llegó (o decir que no).
 *  - DevolucionNegocio: ver a dónde devolver y cuánto, marcarla devuelta con
 *    foto del comprobante opcional, o decir que nunca recibió ese pago.
 *
 * Estados: solicitado → devuelto → recibido; no_recibido vuelve al negocio;
 * rechazado si el negocio no recibió el pago (y no lo había confirmado).
 */
import React, { useState } from 'react';
import { ActivityIndicator, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PagoEstado, ReembolsoPedido, responderReembolso, responderReembolsoNegocio, solicitarReembolso } from '../api';
import { API_URL } from '../config';
import { messageFromError } from '../formErrors';
import { copiarTexto } from '../portapapeles';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { PressableScale } from './anim';
import { useConfirmar } from './Confirmacion';
import Icon from './Icon';
import MotivoCancelacion from './MotivoCancelacion';
import { ImagenAmpliada } from './PagoTransferencia';
import SelectorImagen from './SelectorImagen';

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function fecha(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Miniatura del comprobante de la devolución; tocar para verlo grande. */
function Comprobante({ ruta, token, texto }: { ruta: string; token: string; texto: string }) {
  const styles = useStyles();
  const [abierto, setAbierto] = useState(false);
  const fuente = { uri: `${API_URL}${ruta}`, headers: { Authorization: `Bearer ${token}` } };
  return (
    <>
      <TouchableOpacity style={styles.comprobante} onPress={() => setAbierto(true)} accessibilityRole="button">
        <Image source={fuente} style={styles.comprobanteImg} />
        <Text style={styles.enlace}>{texto}</Text>
      </TouchableOpacity>
      <ImagenAmpliada uri={abierto ? fuente.uri : null} headers={fuente.headers} onCerrar={() => setAbierto(false)} />
    </>
  );
}

type ClienteProps = {
  token: string;
  pedidoId: number;
  negocio: string | null;
  pagoEstado?: PagoEstado | null;
  reembolso: ReembolsoPedido;
  onCambio: () => void;
};

/** En el pedido cancelado del cliente. */
export function DevolucionCliente({ token, pedidoId, negocio, pagoEstado, reembolso: r, onCambio }: ClienteProps) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const [cuenta, setCuenta] = useState(r.cuenta ?? '');
  const [editando, setEditando] = useState(false);
  // Si no alcanzó a pagar, el formulario se abre solo si dice que sí pagó.
  const [quierePedir, setQuierePedir] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const elNegocio = negocio ?? 'El negocio';
  const monto = r.monto ?? r.monto_sugerido;

  async function enviarCuenta() {
    setEnviando(true);
    try {
      await solicitarReembolso(token, pedidoId, cuenta);
      toast.exito(r.estado ? 'Cuenta guardada' : 'Devolución solicitada', 'Te avisaremos cuando el negocio la marque como devuelta.');
      setEditando(false);
      onCambio();
    } catch (e) {
      toast.error('No se pudo enviar', messageFromError(e));
    } finally {
      setEnviando(false);
    }
  }

  async function responder(recibido: boolean) {
    setEnviando(true);
    try {
      toast.exito(recibido ? 'Devolución recibida' : 'Negocio avisado', await responderReembolso(token, pedidoId, recibido));
      onCambio();
    } catch (e) {
      toast.error('No se pudo enviar', messageFromError(e));
    } finally {
      setEnviando(false);
    }
  }

  const formulario = (
    <View>
      <Text style={styles.label}>¿A dónde te devuelven el dinero?</Text>
      <TextInput
        style={styles.input}
        value={cuenta}
        onChangeText={setCuenta}
        placeholder="Ej.: Nequi 3001234567 a nombre de Ana Pérez"
        placeholderTextColor={c.mutedSoft}
        maxLength={150}
      />
      <PressableScale style={styles.btn} onPress={enviarCuenta} disabled={enviando || cuenta.trim().length < 5}>
        {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.btnTxt}>{r.estado ? 'Guardar' : 'Solicitar devolución'}</Text>}
      </PressableScale>
    </View>
  );

  if (!r.estado) {
    if (!r.puede_solicitar) return null;
    if (pagoEstado === 'por_pagar' && !quierePedir) {
      return (
        <View style={styles.bloque}>
          <Text style={styles.nota}>No alcanzaste a pagar: no se te cobra nada.</Text>
          <TouchableOpacity onPress={() => setQuierePedir(true)}><Text style={styles.enlace}>¿Sí transferiste? Pide la devolución</Text></TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.bloque}>
        <Text style={styles.titulo}>¿Ya pagaste? Pide que te devuelvan {cop(r.monto_sugerido)}</Text>
        <Text style={styles.texto}>{elNegocio} verá tu solicitud y te avisaremos cuando marque la devolución.</Text>
        {formulario}
      </View>
    );
  }

  return (
    <View style={styles.bloque}>
      {(r.estado === 'solicitado' || r.estado === 'no_recibido') && (
        <>
          <Estado icono="reloj" color={c.goldText} titulo={r.estado === 'no_recibido' ? 'Le avisaste que no te ha llegado' : 'Devolución solicitada'} />
          <Text style={styles.texto}>
            {r.estado === 'no_recibido'
              ? `${elNegocio} revisará la transferencia y te avisaremos cuando la marque de nuevo.`
              : `${elNegocio} debe devolverte ${cop(r.monto_sugerido)}.`}
            {r.regla_mitad ? ' Como no fue posible encontrarte, se devuelve la mitad de los productos; el domicilio es del domiciliario.' : ''}
          </Text>
          {r.cuenta && !editando ? (
            <>
              <Text style={styles.texto}>A: <Text style={styles.fuerte}>{r.cuenta}</Text></Text>
              {r.puede_cambiar_cuenta && <TouchableOpacity onPress={() => setEditando(true)}><Text style={styles.enlace}>Cambiar a dónde</Text></TouchableOpacity>}
            </>
          ) : r.puede_cambiar_cuenta ? formulario : null}
        </>
      )}

      {r.estado === 'devuelto' && (
        <>
          <Estado icono="banco" color={c.goldText} titulo={`${elNegocio} dice que te devolvió ${cop(monto)}`} />
          <Text style={styles.texto}>El {fecha(r.devuelto_at)}{r.cuenta ? ` a ${r.cuenta}` : ''}. ¿Te llegó?</Text>
          {!!r.comprobante && <Comprobante ruta={r.comprobante} token={token} texto="Ver el comprobante del negocio" />}
          <View style={styles.fila2}>
            <PressableScale style={[styles.btnMitad, { backgroundColor: c.success }]} onPress={() => responder(true)} disabled={enviando}>
              <Text style={styles.btnTxt}>Sí, me llegó</Text>
            </PressableScale>
            <PressableScale style={[styles.btnMitad, styles.btnBorde]} onPress={() => responder(false)} disabled={enviando}>
              <Text style={[styles.btnTxt, { color: c.danger }]}>No me ha llegado</Text>
            </PressableScale>
          </View>
        </>
      )}

      {r.estado === 'recibido' && (
        <Estado icono="check" color={c.success} titulo={`Devolución recibida: ${cop(monto)}`} />
      )}

      {r.estado === 'rechazado' && (
        <>
          <Estado icono="alerta" color={c.danger} titulo={`${elNegocio} dice que no recibió tu pago`} />
          {!!r.motivo && <Text style={styles.texto}>«{r.motivo}»</Text>}
          <Text style={styles.nota}>Si sí pagaste, escríbele al negocio o repórtalo en «¿Problemas con tu pedido?», más abajo, con tu comprobante.</Text>
        </>
      )}
    </View>
  );
}

function Estado({ icono, color, titulo }: { icono: 'reloj' | 'banco' | 'check' | 'alerta'; color: string; titulo: string }) {
  const styles = useStyles();
  return (
    <View style={styles.fila}>
      <Icon name={icono} size={17} color={color} />
      <Text style={[styles.titulo, { color }]}>{titulo}</Text>
    </View>
  );
}

type NegocioProps = {
  token: string;
  negocioId: number;
  pedidoId: number;
  reembolso: ReembolsoPedido;
  onCambio: () => void;
};

/** En el pedido cancelado del negocio. */
export function DevolucionNegocio({ token, negocioId, pedidoId, reembolso: r, onCambio }: NegocioProps) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [monto, setMonto] = useState(String(Math.round(r.monto ?? r.monto_sugerido)));
  const [comprobante, setComprobante] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (!r.estado) return null;
  const pendiente = r.estado === 'solicitado' || r.estado === 'no_recibido';
  const valor = Number(monto.replace(/\D/g, ''));

  async function enviar(datos: Parameters<typeof responderReembolsoNegocio>[3]) {
    setEnviando(true);
    try {
      toast.exito(datos.estado === 'devuelto' ? 'Devolución marcada' : 'Cliente avisado', await responderReembolsoNegocio(token, negocioId, pedidoId, datos));
      setRechazando(false);
      onCambio();
    } catch (e) {
      toast.error('No se pudo enviar', messageFromError(e));
    } finally {
      setEnviando(false);
    }
  }

  function onDevuelto() {
    if (!valor) {
      toast.info('Falta el monto', 'Escribe cuánto le devolviste.');
      return;
    }
    confirmar({
      icono: 'banco',
      titulo: `¿Ya le devolviste ${cop(valor)}?`,
      texto: 'Márcalo solo cuando hayas hecho la transferencia. El cliente confirmará si le llegó.',
      textoBoton: 'Sí, ya lo devolví',
      accion: () => enviar({ estado: 'devuelto', monto: valor, comprobanteUri: comprobante }),
    });
  }

  return (
    <View style={[styles.card, pendiente && styles.cardAccion]}>
      {pendiente ? (
        <>
          <Estado
            icono={r.estado === 'no_recibido' ? 'alerta' : 'banco'}
            color={r.estado === 'no_recibido' ? c.danger : c.goldText}
            titulo={r.estado === 'no_recibido' ? 'El cliente dice que no le ha llegado la devolución' : 'Debes devolverle el dinero al cliente'}
          />
          <Text style={styles.texto}>
            {r.regla_mitad
              ? `El cliente no apareció: devuélvele la mitad de los productos, ${cop(r.monto_sugerido)}. El domicilio es del domiciliario.`
              : `El pedido se canceló y el cliente pagó por transferencia: devuélvele ${cop(r.monto_sugerido)}.`}
          </Text>
          {r.cuenta ? (
            <View style={styles.cuentaFila}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>A dónde</Text>
                <Text style={styles.fuerte} selectable>{r.cuenta}</Text>
              </View>
              <TouchableOpacity style={styles.copiar} onPress={async () => { if (await copiarTexto(r.cuenta!)) toast.exito('Copiado', r.cuenta!); }}>
                <Text style={styles.copiarTxt}>Copiar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.nota}>El cliente aún no dice a dónde: devuélvelo a la cuenta desde la que te pagó o escríbele.</Text>
          )}
          <Text style={styles.label}>Cuánto le devolviste</Text>
          <TextInput style={styles.input} value={monto} onChangeText={v => setMonto(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={9} />
          <SelectorImagen uri={comprobante ?? undefined} onSelect={setComprobante} label="Foto del comprobante (opcional)" disabled={enviando} />
          <PressableScale style={styles.btn} onPress={onDevuelto} disabled={enviando}>
            {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.btnTxt}>Marcar como devuelto</Text>}
          </PressableScale>
          {r.puede_rechazar && (
            <TouchableOpacity onPress={() => setRechazando(true)} style={styles.rechazar}>
              <Text style={[styles.enlace, { color: c.danger }]}>No recibí ese pago</Text>
            </TouchableOpacity>
          )}
          <MotivoCancelacion
            visible={rechazando}
            obligatorio
            titulo="No recibí ese pago"
            explicacion="Úsalo solo si revisaste tu cuenta y la transferencia nunca llegó. El cliente verá el motivo y podrá reportarlo a Vitrina."
            motivos={['No aparece en mi cuenta', 'Llegó un valor distinto']}
            textoBoton="Avisar al cliente"
            enviando={enviando}
            onCerrar={() => setRechazando(false)}
            onConfirmar={motivo => enviar({ estado: 'rechazado', motivo })}
          />
        </>
      ) : r.estado === 'devuelto' ? (
        <>
          <Estado icono="reloj" color={c.goldText} titulo={`Devolviste ${cop(r.monto ?? 0)}`} />
          <Text style={styles.texto}>El {fecha(r.devuelto_at)}. Esperamos que el cliente confirme que le llegó.</Text>
          {!!r.comprobante && <Comprobante ruta={r.comprobante} token={token} texto="Ver tu comprobante" />}
        </>
      ) : r.estado === 'recibido' ? (
        <Estado icono="check" color={c.success} titulo={`El cliente recibió la devolución (${cop(r.monto ?? 0)})`} />
      ) : (
        <>
          <Estado icono="alerta" color={c.danger} titulo="Dijiste que no recibiste ese pago" />
          {!!r.motivo && <Text style={styles.texto}>«{r.motivo}»</Text>}
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  bloque: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 18, marginBottom: 14, ...shadow.soft },
  cardAccion: { borderWidth: 1.5, borderColor: c.accent },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fila2: { flexDirection: 'row', gap: 8, marginTop: 12 },
  titulo: { flex: 1, fontFamily: font.bold, color: c.textStrong, fontSize: 15 },
  texto: { color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginTop: 6 },
  fuerte: { fontFamily: font.bold, color: c.textStrong },
  nota: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 6 },
  enlace: { color: c.goldText, fontFamily: font.semibold, fontSize: 14, marginTop: 8 },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 11,
    color: c.textStrong, fontFamily: font.regular, fontSize: 15, backgroundColor: c.surface, marginBottom: 10,
  },
  btn: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnMitad: { flex: 1, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  btnBorde: { borderWidth: 1, borderColor: c.borderStrong },
  btnTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
  rechazar: { alignItems: 'center', paddingVertical: 4 },
  cuentaFila: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  copiar: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: c.accent },
  copiarTxt: { color: c.goldText, fontFamily: font.bold, fontSize: 13 },
  comprobante: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  comprobanteImg: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: c.surface2 },
}));
