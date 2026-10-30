import React, { Ref, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  avanzarPedido,
  cambiarTurno,
  getDisponibles,
  getMiReputacion,
  getMisEntregas,
  Pedido,
  reportarNovedad,
  tomarPedido,
} from '../api';
import { useAuth } from '../AuthContext';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { usePolling } from '../usePolling';
import { FadeInView, PressableScale } from './anim';
import BotonesContacto from './BotonesContacto';
import { publicarMiReputacion } from './HeaderConfiabilidad';
import Icon, { IconName } from './Icon';
import MinutosRecogida from './MinutosRecogida';

/** Lo que el Inicio le pide al panel: recargar al deslizar hacia abajo. */
export type PanelDomiciliarioRef = { recargar: () => Promise<void> };

type Props = {
  ref?: Ref<PanelDomiciliarioRef>;
  /** Al tomar un pedido: el Inicio sube hasta el panel para mostrarlo en curso. */
  onTomado?: () => void;
};

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/**
 * Panel del domiciliario en su Inicio, debajo del saludo: arriba las entregas
 * que lleva (la última que tomó primero) y debajo los pedidos disponibles para
 * recoger. Al tomar uno, ese sube a "en curso" y los demás disponibles quedan
 * debajo.
 */
export default function PanelDomiciliario({ ref, onTomado }: Props) {
  const { c, estadoColor } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [disponibles, setDisponibles] = useState<Pedido[]>([]);
  const [entregas, setEntregas] = useState<Pedido[]>([]);
  // Vetado = no puedo tomar pedidos nuevos (baja confiabilidad).
  const [vetado, setVetado] = useState(false);
  const [cargando, setCargando] = useState(true);
  // En turno = me llegan los avisos de pedidos listos para recoger.
  const [enTurno, setEnTurno] = useState(false);
  const [cambiandoTurno, setCambiandoTurno] = useState(false);
  // Pedido que voy a tomar: abre el modal para elegir los minutos.
  const [porTomar, setPorTomar] = useState<Pedido | null>(null);
  const [tomando, setTomando] = useState(false);
  // Entrega cuyo estado estoy cambiando: su botón muestra que va en curso.
  const [avanzando, setAvanzando] = useState<number | null>(null);

  /** Disponibles y mis entregas en curso; de paso, mi nivel para la topbar. */
  const traer = useCallback(async () => {
    getMiReputacion(token)
      .then(r => publicarMiReputacion(token, r))
      .catch(() => {});
    const [d, e] = await Promise.all([getDisponibles(token), getMisEntregas(token)]);
    return { d, e };
  }, [token]);

  const aplicar = useCallback(({ d, e }: Listas) => {
    setDisponibles(d.pedidos);
    setVetado(d.vetado);
    setEnTurno(d.en_turno);
    setEntregas(e);
  }, []);

  // La pantalla de carga solo sale al entrar: después (acciones, push, cada
  // 15 s) las listas se actualizan en su sitio, sin taparlas.
  const cargar = useCallback(
    () =>
      traer()
        .then(aplicar)
        .catch(err => toast.error('Error', err.message))
        .finally(() => setCargando(false)),
    [traer, aplicar, toast],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);
  usePolling(() => cargar());
  useImperativeHandle(ref, () => ({ recargar: cargar }), [cargar]);

  /**
   * Trae las listas tras una acción y aplica el cambio con una animación.
   * Devuelve false si no hubo red (el siguiente refresco lo pone al día).
   */
  async function actualizarAnimado(): Promise<boolean> {
    try {
      const datos = await traer();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      aplicar(datos);
      return true;
    } catch {
      return false;
    }
  }

  async function onCambiarTurno(valor: boolean) {
    setCambiandoTurno(true);
    setEnTurno(valor);
    try {
      toast.info(valor ? 'En turno' : 'Fuera de turno', await cambiarTurno(token, valor));
    } catch (e) {
      setEnTurno(!valor);
      toast.error('No se pudo cambiar', e instanceof Error ? e.message : 'Error');
    } finally {
      setCambiandoTurno(false);
    }
  }

  async function onTomar(minutos: number) {
    const pedido = porTomar;
    if (!pedido) return;
    setTomando(true);
    try {
      await tomarPedido(token, pedido.id, minutos);
    } catch (e) {
      // Puede que otro lo haya tomado: se cierra y se refresca la lista.
      toast.error('No se pudo tomar', e instanceof Error ? e.message : 'Error');
      setTomando(false);
      setPorTomar(null);
      cargar();
      return;
    }

    // El que elegí sube a "en curso" (arriba) y los demás disponibles bajan.
    if (!(await actualizarAnimado())) {
      setDisponibles(prev => prev.filter(p => p.id !== pedido.id));
    }
    setTomando(false);
    setPorTomar(null);
    onTomado?.();
    toast.exito('Pedido tomado', `Pasa a recogerlo en ${minutos} min.`);
  }

  async function onAvanzar(id: number, accion: string) {
    setAvanzando(id);
    try {
      await avanzarPedido(token, id, accion);
      await actualizarAnimado();
      if (accion === 'entregado') {
        toast.exito('¡Entrega completada!', 'La encuentras en Pedidos entregados.');
      }
    } catch (e) {
      toast.error('No se pudo actualizar', e instanceof Error ? e.message : 'Error');
    } finally {
      setAvanzando(null);
    }
  }

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 16 }} />;
  }

  return (
    <>
      {/* Turno: solo en turno llegan los avisos de pedidos listos. */}
      {!vetado && (
        <View style={[styles.turno, enTurno ? styles.turnoOn : styles.turnoOff]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.turnoTitulo}>{enTurno ? 'Estás en turno' : 'Estás fuera de turno'}</Text>
            <Text style={styles.turnoSub}>
              {enTurno
                ? 'Te avisamos cuando haya pedidos listos para recoger.'
                : 'No te llegan avisos de pedidos nuevos. Actívalo cuando salgas a trabajar.'}
            </Text>
          </View>
          <Switch
            value={enTurno}
            onValueChange={onCambiarTurno}
            disabled={cambiandoTurno}
            trackColor={{ false: c.borderStrong, true: c.success }}
            thumbColor={c.surface}
          />
        </View>
      )}

      {/* Lo que ya tomé va arriba: los disponibles quedan debajo. */}
      {entregas.length > 0 && (
        <>
          <Text style={styles.seccion}>Mis entregas en curso</Text>
          {entregas.map((p, i) => {
            const ec = estadoColor(p.estado);
            return (
              <FadeInView key={p.id} delay={i * 50}>
                <View style={[styles.card, styles.bordeAzul]}>
                  <View style={styles.cardHead}>
                    <Text style={styles.pedidoId}>Pedido #{p.id}</Text>
                    <Text style={[styles.badge, { backgroundColor: ec.bg, color: ec.fg }]}>{p.estado_label}</Text>
                  </View>
                  {p.estado === 'tomado' && !!p.minutos_recogida && (
                    <View style={[styles.lineaSub, styles.fila]}>
                      <Icon name="reloj" size={13} color={c.goldText} />
                      <Text style={styles.prometido}>Prometiste recogerlo en {p.minutos_recogida} min</Text>
                    </View>
                  )}
                  <View style={[styles.linea, styles.fila]}>
                    <Icon name="tienda" size={14} color={c.text} />
                    <Text style={[styles.linea, { flex: 1 }]}>
                      Recoger: {p.negocio?.nombre} — {p.negocio?.direccion ?? 's/d'}
                    </Text>
                  </View>
                  <View style={[styles.linea, styles.fila]}>
                    <Icon name="casa" size={14} color={c.text} />
                    <Text style={[styles.linea, { flex: 1 }]}>
                      Entregar: {p.cliente?.name} — {p.direccion_entrega}
                    </Text>
                  </View>
                  <View style={[styles.linea, styles.fila]}>
                    <Icon name="tarjeta" size={14} color={c.text} />
                    <Text style={styles.linea}>
                      {p.cobrar > 0
                        ? `Cobrar al cliente: ${cop(p.cobrar)} en efectivo`
                        : 'Pagado por transferencia: no cobres nada'}
                    </Text>
                  </View>
                  <Text style={styles.lineaSub}>
                    Productos {cop(p.subtotal ?? p.total)} · Domicilio {cop(p.costo_domicilio ?? 0)}
                  </Text>
                  {/* Antes de recoger se coordina con el negocio; después, con el cliente. */}
                  {p.estado === 'tomado' ? (
                    <BotonesContacto
                      telefono={p.negocio?.telefono}
                      mensaje={`Hola, soy el domiciliario de Vitrina que va por el pedido #${p.id}.`}
                      etiquetaLlamar="Llamar al negocio"
                    />
                  ) : (
                    <BotonesContacto
                      telefono={p.telefono_contacto}
                      mensaje={`Hola, soy tu domiciliario de Vitrina con el pedido #${p.id}.`}
                      etiquetaLlamar="Llamar al cliente"
                    />
                  )}
                  <Novedad pedido={p} onReportada={() => cargar()} />
                  {p.estado === 'tomado' && (
                    <Boton
                      icon="caja"
                      texto="Marcar recogido"
                      cargando={avanzando === p.id}
                      onPress={() => onAvanzar(p.id, 'recogido')}
                    />
                  )}
                  {p.estado === 'recogido' && (
                    <Boton
                      icon="moto"
                      texto="Salir / En camino"
                      cargando={avanzando === p.id}
                      onPress={() => onAvanzar(p.id, 'en-camino')}
                    />
                  )}
                  {p.estado === 'en_camino' && (
                    <Boton
                      icon="check"
                      texto="Marcar entregado"
                      color={c.success}
                      cargando={avanzando === p.id}
                      onPress={() => onAvanzar(p.id, 'entregado')}
                    />
                  )}
                </View>
              </FadeInView>
            );
          })}
        </>
      )}

      <Text style={styles.seccion}>
        Pedidos disponibles{!vetado && disponibles.length > 0 ? ` (${disponibles.length})` : ''}
      </Text>
      {vetado ? (
        <View style={styles.vetado}>
          <Icon name="alerta" size={18} color={c.danger} />
          <Text style={styles.vetadoTxt}>
            Tu cuenta de domiciliario está suspendida por baja confiabilidad, así que no puedes tomar pedidos nuevos.
            Termina las entregas que llevas; un administrador revisará tu caso.
          </Text>
        </View>
      ) : disponibles.length === 0 ? (
        <Text style={styles.vacio}>No hay pedidos disponibles ahora.</Text>
      ) : (
        disponibles.map((p, i) => (
          <FadeInView key={p.id} delay={i * 50}>
            <DisponibleCard pedido={p} onTomar={() => setPorTomar(p)} />
          </FadeInView>
        ))
      )}

      {/* Módulo aparte con las entregas que ya completé. */}
      <PressableScale
        style={styles.entregados}
        onPress={() => navigationRef.isReady() && navigationRef.navigate('PedidosEntregados')}>
        <Icon name="check" size={22} color={c.success} />
        <View style={{ flex: 1 }}>
          <Text style={styles.entregadosTitulo}>Pedidos entregados</Text>
          <Text style={styles.entregadosSub}>Revisa las entregas que ya completaste</Text>
        </View>
        <Icon name="chevron" size={20} color={c.chevron} />
      </PressableScale>

      <MinutosRecogida
        pedido={porTomar}
        enviando={tomando}
        onCerrar={() => setPorTomar(null)}
        onAceptar={onTomar}
      />
    </>
  );
}

type Listas = { d: Awaited<ReturnType<typeof getDisponibles>>; e: Pedido[] };

/** Motivos rápidos para justificar una demora. */
const NOVEDADES = ['Lluvia fuerte', 'Tráfico o vía cerrada', 'Problema con la moto', 'El negocio no lo tenía listo', 'No encuentro la dirección'];

/**
 * Reportar una novedad de una entrega en curso: el cliente y el negocio la
 * ven, y una demora justificada no resta confiabilidad.
 */
function Novedad({ pedido, onReportada }: { pedido: Pedido; onReportada: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [otra, setOtra] = useState('');

  async function enviar(texto: string) {
    if (!texto.trim()) return;
    try {
      await reportarNovedad(auth!.token, pedido.id, texto.trim());
      toast.exito('Novedad reportada', 'El cliente ya la puede ver.');
      setAbierto(false);
      setOtra('');
      onReportada();
    } catch (e) {
      toast.error('No se pudo reportar', e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <View>
      {!!pedido.novedad && (
        <View style={styles.novedadActual}>
          <Icon name="alerta" size={14} color={c.warning} />
          <Text style={styles.novedadActualTxt}>Novedad: {pedido.novedad}</Text>
        </View>
      )}
      {abierto ? (
        <View style={styles.novedadCaja}>
          <Text style={styles.minLabel}>¿Qué está pasando?</Text>
          <View style={styles.chips}>
            {NOVEDADES.map(n => (
              <PressableScale key={n} style={styles.chip} onPress={() => enviar(n)}>
                <Text style={styles.chipTxt}>{n}</Text>
              </PressableScale>
            ))}
          </View>
          <View style={styles.otraFila}>
            <TextInput
              style={styles.otraInput}
              value={otra}
              onChangeText={setOtra}
              placeholder="Otra cosa…"
              placeholderTextColor={c.mutedSoft}
              maxLength={255}
            />
            <PressableScale style={styles.otraBtn} onPress={() => enviar(otra)}>
              <Text style={styles.otraBtnTxt}>Enviar</Text>
            </PressableScale>
          </View>
          <PressableScale onPress={() => setAbierto(false)}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </PressableScale>
        </View>
      ) : (
        <PressableScale style={styles.novedadLink} onPress={() => setAbierto(true)}>
          <Icon name="reloj" size={14} color={c.goldText} />
          <Text style={styles.novedadLinkTxt}>{pedido.novedad ? 'Cambiar novedad' : '¿Te vas a demorar? Reporta una novedad'}</Text>
        </PressableScale>
      )}
    </View>
  );
}

function Boton({
  texto,
  onPress,
  icon,
  color,
  cargando,
}: {
  texto: string;
  onPress: () => void;
  icon?: IconName;
  color?: string;
  /** Mientras se envía: ruedita dentro del botón (la tarjeta sigue a la vista). */
  cargando?: boolean;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <PressableScale
      style={[styles.btn, styles.btnFila, { backgroundColor: color ?? c.brand }]}
      onPress={onPress}
      disabled={cargando}>
      {cargando ? (
        <ActivityIndicator color={c.onBrand} />
      ) : (
        <>
          {icon && <Icon name={icon} size={16} color={c.onBrand} />}
          <Text style={styles.btnTxt}>{texto}</Text>
        </>
      )}
    </PressableScale>
  );
}

function DisponibleCard({ pedido, onTomar }: { pedido: Pedido; onTomar: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.card, styles.bordeAmbar]}>
      <View style={styles.cardHead}>
        <Text style={styles.pedidoId}>Pedido #{pedido.id}</Text>
        <Text style={styles.total}>{cop(pedido.total)}</Text>
      </View>
      <View style={[styles.linea, styles.fila]}>
        <Icon name="tienda" size={14} color={c.text} />
        <Text style={[styles.linea, { flex: 1 }]}>{pedido.negocio?.nombre}</Text>
      </View>
      <View style={[styles.lineaSub, styles.fila]}>
        <Icon name="ubicacion" size={13} color={c.mutedSoft} />
        <Text style={[styles.lineaSub, { flex: 1 }]}>{pedido.negocio?.direccion ?? 'Sin dirección'}</Text>
      </View>
      <Text style={styles.lineaSub}>
        {pedido.items.reduce((s, i) => s + i.cantidad, 0)} producto(s) · Domicilio {cop(pedido.costo_domicilio ?? 0)} ·{' '}
        {pedido.metodo_pago === 'efectivo' ? `cobras ${cop(pedido.cobrar)}` : 'ya pagado'}
      </Text>
      {/* Abre el modal para elegir en cuántos minutos lo recojo. */}
      <PressableScale style={[styles.tomarBtn, styles.btnFila]} onPress={onTomar}>
        <Icon name="moto" size={16} color={c.onAccent} />
        <Text style={styles.tomarTxt}>Tomar pedido</Text>
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 18, marginBottom: 8 },
  card: {
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  bordeAmbar: { borderLeftWidth: 4, borderLeftColor: c.accent },
  bordeAzul: { borderLeftWidth: 4, borderLeftColor: c.info },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pedidoId: { fontSize: 15, fontFamily: font.bold, color: c.textStrong },
  total: { fontFamily: font.bold, color: c.textStrong },
  badge: {
    fontSize: 11, fontFamily: font.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden',
  },
  linea: { color: c.text, marginTop: 4, fontSize: 14, fontFamily: font.regular },
  lineaSub: { color: c.mutedSoft, marginTop: 4, fontSize: 13, fontFamily: font.regular },
  turno: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, padding: 14,
    marginBottom: 12, borderWidth: 1,
  },
  turnoOn: { backgroundColor: c.surface, borderColor: c.success },
  turnoOff: { backgroundColor: c.warningSoft, borderColor: c.warning },
  turnoTitulo: { fontFamily: font.bold, fontSize: 15, color: c.textStrong },
  turnoSub: { fontFamily: font.regular, fontSize: 12, color: c.text, marginTop: 2 },
  minLabel: { fontSize: 11, color: c.muted, marginBottom: 4, fontFamily: font.regular },
  tomarBtn: { backgroundColor: c.accent, borderRadius: radius.sm, paddingVertical: 13, marginTop: 12, ...shadow.gold },
  tomarTxt: { color: c.onAccent, fontFamily: font.bold },
  btn: { borderRadius: radius.sm, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  btnFila: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  btnTxt: { color: c.onBrand, fontFamily: font.bold },
  prometido: { color: c.goldText, fontSize: 13, fontFamily: font.semibold },
  vacio: { color: c.muted, fontSize: 14, fontFamily: font.regular },
  entregados: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface,
    borderRadius: radius.lg, padding: 16, marginTop: 22, ...shadow.soft,
  },
  entregadosTitulo: { fontSize: 15, fontFamily: font.bold, color: c.textStrong },
  entregadosSub: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  vetado: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: c.dangerSoft,
    borderRadius: radius.md, padding: 14,
  },
  vetadoTxt: { flex: 1, color: c.danger, fontFamily: font.medium, fontSize: 14, lineHeight: 20 },
  novedadActual: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.warningSoft,
    borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10,
  },
  novedadActualTxt: { flex: 1, color: c.warning, fontSize: 13, fontFamily: font.medium },
  novedadLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingVertical: 4 },
  novedadLinkTxt: { color: c.goldText, fontSize: 13, fontFamily: font.semibold },
  novedadCaja: { marginTop: 10, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipTxt: { color: c.text, fontSize: 13, fontFamily: font.medium },
  otraFila: { flexDirection: 'row', gap: 8, marginTop: 10 },
  otraInput: {
    flex: 1, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 8, color: c.textStrong, fontFamily: font.regular,
  },
  otraBtn: { backgroundColor: c.brand, borderRadius: radius.sm, paddingHorizontal: 16, justifyContent: 'center' },
  otraBtnTxt: { color: c.onBrand, fontFamily: font.bold },
  cancelar: { color: c.muted, fontSize: 13, marginTop: 10, fontFamily: font.medium },
}));
