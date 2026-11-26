import AvisoPedidoEnCurso from '../components/AvisoPedidoEnCurso';
import { useLecturaEnFoco } from '../useLectura';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Text, View } from 'react-native';
import { detenerAlarma } from '../alarmaPedidos';
import { tienePermiso, aceptarPedido, ComercioPedido, confirmarRecogida, getCitas, getPedidosComercio, getReembolsos, getServicios, SolicitudReembolso } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import BotonMantener from '../components/BotonMantener';
import { PedirCodigo } from '../components/CodigoPedido';
import HeaderPerfil from '../components/HeaderPerfil';
import Icon, { IconName } from '../components/Icon';
import { IrAExplorar, Saludo } from '../components/SaludoInicio';
import { messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { temasDelNegocio, usePolling } from '../usePolling';
import { ScrollTeclado } from '../components/EspacioTeclado';
import { DesplazableTutorial, Objetivo, useDesplazableTutorial } from '../tutorial/Objetivo';
import MisTareas from '../components/MisTareas';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/**
 * Palabra "Abierto"/"Cerrado" de la topbar. Al cambiar, la vieja se
 * desvanece y la nueva llega con un zoom que se pasa un poco y se acomoda.
 * Las dos palabras están siempre montadas, una encima de la otra, y solo se
 * animan su opacidad y su tamaño.
 */
function EtiquetaEstado({ abierto, texto }: { abierto: boolean; texto?: string }) {
  const { c } = useTheme();
  const styles = useStyles();
  const opAbierto = useRef(new Animated.Value(abierto ? 1 : 0)).current;
  const opCerrado = useRef(new Animated.Value(abierto ? 0 : 1)).current;
  const escAbierto = useRef(new Animated.Value(1)).current;
  const escCerrado = useRef(new Animated.Value(1)).current;
  const previo = useRef(abierto);

  useEffect(() => {
    if (previo.current === abierto) {
      return;
    }
    previo.current = abierto;
    const [saleOp, entraOp, entraEsc] = abierto
      ? [opCerrado, opAbierto, escAbierto]
      : [opAbierto, opCerrado, escCerrado];

    entraOp.setValue(0);
    entraEsc.setValue(0.6);
    const anim = Animated.sequence([
      Animated.timing(saleOp, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(entraOp, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.sequence([
          // Llega rápido, un poco más grande…
          Animated.timing(entraEsc, {
            toValue: 1.25,
            duration: 160,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          // …y se acomoda a su tamaño.
          Animated.spring(entraEsc, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
        ]),
      ]),
    ]);
    anim.start();
    // Si cambia otra vez a mitad (p. ej. falló al guardar), sigue desde ahí.
    return () => anim.stop();
  }, [abierto, opAbierto, opCerrado, escAbierto, escCerrado]);

  return (
    // La topbar recorta lo que sale de aquí: el margen a la izquierda deja
    // sitio para la palabra más larga y para el zoom.
    <View style={styles.etiqueta} accessible accessibilityLabel={texto ?? (abierto ? 'Abierto' : 'Cerrado')}>
      {/* Invisible: le da al conjunto el ancho de la palabra actual. */}
      <Text style={[styles.headerEstadoTxt, styles.oculto]}>{texto ?? (abierto ? 'Abierto' : 'Cerrado')}</Text>
      <Animated.Text
        style={[
          styles.headerEstadoTxt,
          styles.capa,
          { color: c.onHeaderOk, opacity: opAbierto, transform: [{ scale: escAbierto }] },
        ]}>
        Abierto
      </Animated.Text>
      <Animated.Text
        style={[
          styles.headerEstadoTxt,
          styles.capa,
          { color: c.onHeaderOff, opacity: opCerrado, transform: [{ scale: escCerrado }] },
        ]}>
        {texto ?? 'Cerrado'}
      </Animated.Text>
    </View>
  );
}

/**
 * Abierto/Cerrado del negocio en la parte derecha de la topbar. Se cambia
 * manteniendo presionada la tienda, como el turno del domiciliario: un toque
 * sin querer no abre ni cierra el negocio.
 */
function HeaderEstadoNegocio() {
  const styles = useStyles();
  const { negocio, setAbierto } = useNegocio();
  const toast = useToast();
  const [cambiando, setCambiando] = useState(false);

  if (!negocio) {
    return null;
  }

  // Solo el propietario abre/cierra el negocio; el trabajador solo ve el estado.
  if (!tienePermiso(negocio, 'cambiar_estado')) {
    return <EtiquetaEstado abierto={negocio.activo} texto={negocio.estado_texto} />;
  }

  async function toggle(v: boolean) {
    setCambiando(true);
    try {
      await setAbierto(v);
      toast.exito(
        v ? 'Negocio abierto' : 'Negocio cerrado',
        v ? 'Ahora apareces en Explorar.' : 'Oculto para los clientes.',
      );
    } catch (e) {
      toast.error('No se pudo cambiar', e instanceof Error ? e.message : 'Error');
    } finally {
      setCambiando(false);
    }
  }

  return (
    <Objetivo id="home.estado" enBarra style={styles.headerEstado}>
      <EtiquetaEstado abierto={negocio.activo} texto={negocio.estado_texto} />
      <BotonMantener
        icon="tienda"
        encendido={negocio.activo}
        ocupado={cambiando}
        accessibilityLabel="Negocio abierto"
        onCambiar={() => toggle(!negocio.activo)}
        onToque={() =>
          toast.info('Mantenlo presionado', negocio.activo ? 'Así cierras el negocio.' : 'Así abres el negocio.')
        }
      />
    </Objetivo>
  );
}

type Acceso = { icono: IconName; titulo: string; abrir: () => void };

/** Cuántos cuadros de acceso van por fila. */
const COLUMNAS = 3;

/**
 * Accesos del negocio en cuadros iguales, para que los pedidos queden a la vista.
 * Una fila incompleta conserva sus huecos: así ningún cuadro se estira.
 */
function CuadrosAcceso({ accesos }: { accesos: Acceso[] }) {
  const { c } = useTheme();
  const styles = useStyles();
  const filas = Array.from({ length: Math.ceil(accesos.length / COLUMNAS) }, (_, i) =>
    accesos.slice(i * COLUMNAS, (i + 1) * COLUMNAS),
  );

  return (
    <Objetivo id="home.accesos" style={styles.cuadros}>
      {filas.map((fila, f) => (
        <View key={fila[0].titulo} style={styles.cuadrosFila}>
          {fila.map(({ icono, titulo, abrir }, i) => (
            <FadeInView key={titulo} delay={60 + (f * COLUMNAS + i) * 25} style={styles.celda}>
              <PressableScale
                style={styles.cuadro}
                accessibilityRole="button"
                accessibilityLabel={titulo}
                onPress={abrir}>
                <Icon name={icono} size={26} color={c.accent} />
                <Text style={styles.cuadroTxt} numberOfLines={2}>{titulo}</Text>
              </PressableScale>
            </FadeInView>
          ))}
          {Array.from({ length: COLUMNAS - fila.length }, (_, i) => (
            <View key={i} style={styles.celda} />
          ))}
        </View>
      ))}
    </Objetivo>
  );
}

/** Pedido del Inicio: número, total, con quién hay que tratar y qué sigue. */
function TarjetaPedido({
  pedido,
  icono,
  nombre,
  pie,
  destacada,
  onPress,
  children,
}: {
  pedido: ComercioPedido;
  icono: IconName;
  nombre: string;
  pie: string;
  destacada?: boolean;
  onPress: () => void;
  /** Va antes del pie. */
  children?: React.ReactNode;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <PressableScale style={[styles.pedidoCard, destacada && styles.pedidoCardDinero]} onPress={onPress}>
      <View style={styles.pedidoHead}>
        <Text style={styles.pedidoId}>Pedido #{pedido.codigo}</Text>
        <Text style={styles.pedidoTotal}>{cop(pedido.total)}</Text>
      </View>
      <View style={[styles.pedidoCliente, styles.fila]}>
        <Icon name={icono} size={14} color={c.text} />
        <Text style={styles.pedidoCliente}>{nombre}</Text>
      </View>
      {children}
      <Text style={styles.pedidoVer}>{pie}</Text>
    </PressableScale>
  );
}

export default function HomeScreen({ navigation, route }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const user = auth!.user;
  const token = auth!.token;
  const esAdmin = user.roles.includes('administrador');
  const esDomiciliario = user.roles.includes('domiciliario');
  // El tutorial baja hasta los pedidos en espera.
  const tutorialScroll = useDesplazableTutorial();

  const { negocio, negocios, recargar, seleccionar } = useNegocio();
  // Desde el aviso de una tarea: se gestiona el negocio de esa tarea.
  // Si aún no está en mi lista (me acaban de asociar), se recarga una vez.
  const negocioPedido = route?.params?.negocioId;
  const recargadoPara = useRef<number | null>(null);
  useEffect(() => {
    if (!negocioPedido) return;
    if (negocios.some(n => n.id === negocioPedido)) {
      seleccionar(negocioPedido);
      navigation.setParams({ negocioId: undefined });
    } else if (recargadoPara.current !== negocioPedido) {
      recargadoPara.current = negocioPedido;
      recargar();
    }
  }, [negocioPedido, negocios, seleccionar, navigation, recargar]);
  const negocioId = negocio?.id ?? null;
  // Panel de negocio: quien es miembro de algún negocio (no hay rol global
  // de "comerciante"; los negocios se crean desde Mis negocios).
  const tienePanel = negocios.length > 0;
  // La sesión ya dice que tiene negocios, pero la lista llega un momento después:
  // mientras tanto no se le muestra el Inicio de quien no tiene ninguno.
  const cargandoPanel = !tienePanel && (user.negocios?.length ?? 0) > 0;
  const [pedidos, setPedidos] = useState<ComercioPedido[]>([]);
  const [citasPendientes, setCitasPendientes] = useState(0);
  // Transferencias de pedidos cancelados que el negocio debe devolver.
  const [devoluciones, setDevoluciones] = useState<SolicitudReembolso[]>([]);
  const [catalogoServicios, setCatalogoServicios] = useState<{ negocioId: number; tieneServicios: boolean } | null>(null);
  const negocioIdActual = useRef(negocioId);
  negocioIdActual.current = negocioId;
  const tieneServicios = catalogoServicios?.negocioId === negocioId && catalogoServicios?.tieneServicios === true;
  // Pedido que se está aceptando: su botón muestra que va en curso.
  const [aceptando, setAceptando] = useState<number | null>(null);

  // Topbar: con negocio, el switch Abierto/Cerrado y la lista de mis
  // negocios van junto a "Mi perfil". (Sin negocio no se muestran.)
  useLayoutEffect(() => {
    navigation.setOptions({
      // El domiciliario llega aquí desde sus entregas: con la flecha de volver
      // y sus botones en la topbar, el logo se montaría sobre "Abierto".
      ...(esDomiciliario && { headerTitle: '' }),
      headerRight: () => (
        <View style={styles.headerDerecha}>
          <HeaderEstadoNegocio />
          <HeaderPerfil />
        </View>
      ),
    });
  }, [navigation, styles, esDomiciliario]);

  useLecturaEnFoco(useCallback(() => { recargar(); }, [recargar]));

  const cargarPedidos = useCallback(() => {
    if (!negocioId) {
      setPedidos([]);
      setCitasPendientes(0);
      return;
    }

    if (tienePermiso(negocio, 'gestionar_pedidos')) {
      getPedidosComercio(token, negocioId).then(setPedidos).catch(() => {});
      getReembolsos(token)
        .then(d => {
          if (negocioIdActual.current !== negocioId) return;
          setDevoluciones(d.solicitudes.filter(s => s.negocio_id === negocioId && (s.estado === 'solicitado' || s.estado === 'no_recibido')));
        })
        .catch(() => {});
    } else { setPedidos([]); setDevoluciones([]); }
    getServicios(token, negocioId)
      .then(servicios => {
        if (negocioIdActual.current !== negocioId) return;
        setCatalogoServicios({ negocioId, tieneServicios: servicios.length > 0 });
        if (!servicios.length) { setCitasPendientes(0); return; }
        return getCitas(token, negocioId).then(d => {
          if (negocioIdActual.current === negocioId) setCitasPendientes(d.citas.filter(cita => cita.estado === 'pendiente').length);
        });
      })
      .catch(() => {});
  }, [negocioId, token, negocio]);

  // Al cambiar de negocio no se muestran los pedidos del anterior.
  useEffect(() => { setPedidos([]); setCitasPendientes(0); setDevoluciones([]); }, [negocioId]);

  // Pedidos en espera del negocio activo: se recargan al entrar, al instante
  // cuando cambia un pedido o una cita del negocio (en vivo o push) y, de
  // respaldo, cada 15 s mientras la pantalla está visible.
  useLecturaEnFoco(
    useCallback(() => {
      cargarPedidos();
    }, [cargarPedidos]),
  );
  usePolling(() => {
    if (cargandoPanel) {
      recargar();
    } else {
      cargarPedidos();
    }
  }, 15000, temasDelNegocio(['pedidos', 'citas', 'catalogo'], negocioId));

  /** Si el código no es correcto, el error lo muestra el mismo campo. */
  async function entregarAlDomiciliario(pedido: ComercioPedido, codigo: string) {
    if (!negocioId) return;
    await confirmarRecogida(token, negocioId, pedido.id, codigo);
    toast.exito('El domiciliario recogió el pedido', 'Ya va en camino donde el cliente.');
    cargarPedidos();
  }

  /** Al aceptarlo se calla la alarma y pasa a "En preparación". */
  async function aceptar(pedido: ComercioPedido) {
    if (!negocioId) return;
    setAceptando(pedido.id);
    try {
      await aceptarPedido(token, negocioId, pedido.id);
      await detenerAlarma(pedido.id);
      toast.exito('Pedido aceptado', 'Ya le avisamos al cliente.');
    } catch (e) {
      toast.error('No se pudo aceptar', messageFromError(e));
    } finally {
      setAceptando(null);
      cargarPedidos();
    }
  }

  const enEspera = pedidos.filter(p => p.estado === 'pendiente');
  const enPreparacion = pedidos.filter(p => p.estado === 'aceptado');
  // Listo: esperando que un domiciliario lo tome, o ya viene por él (entonces
  // el negocio le pide su código). No desaparece del Inicio al marcarlo listo.
  const porRecoger = pedidos.filter(p => p.estado === 'listo' || p.estado === 'tomado');
  // Efectivo: falta decir si el domiciliario entregó el dinero.
  const porConfirmar = pedidos.filter(p => p.puede_confirmar_dinero);

  const accesos: Acceso[] = [
    { icono: 'tienda', titulo: 'Mi negocio', abrir: () => navigation.navigate('MiTienda') },
    // Cambiar de negocio, crear otro y responder invitaciones.
    { icono: 'negocios', titulo: 'Mis negocios', abrir: () => navigation.navigate('MisNegocios') },
    ...(negocio
      ? ([
          ...(tienePermiso(negocio, 'modificar_inventario') ? [
            { icono: 'caja', titulo: 'Mis productos', abrir: () => navigation.navigate('MisProductos') },
            { icono: 'calendario', titulo: 'Mis servicios', abrir: () => navigation.navigate('MisServicios') },
          ] satisfies Acceso[] : []),
          { icono: 'lista', titulo: 'Pedidos y ventas', abrir: () => navigation.navigate('PedidosNegocio') },
          { icono: 'usuarios', titulo: 'Equipo', abrir: () => navigation.navigate('Equipo') },
          ...(tienePermiso(negocio, 'administrador') ? [
            { icono: 'banco', titulo: 'Cuentas de pago', abrir: () => navigation.navigate('CuentasPago') },
          ] satisfies Acceso[] : []),
          ...(tieneServicios ? [{ icono: 'calendario', titulo: 'Agenda de citas', abrir: () => navigation.navigate('AgendaNegocio', { negocioId: negocio.id }) } satisfies Acceso] : []),
        ] satisfies Acceso[])
      : []),
    ...(user.roles.includes('usuario')
      ? ([{ icono: 'bolsa', titulo: 'Explorar negocios', abrir: () => navigation.navigate('Explorar') }] satisfies Acceso[])
      : []),
  ];

  return (
    <DesplazableTutorial value={tutorialScroll.valor}>
    <ScrollTeclado
      ref={tutorialScroll.scrollRef}
      onScroll={tutorialScroll.onScroll}
      style={styles.container}
      contentContainerStyle={styles.content}
      // Con el teclado abierto, el primer toque debe llegar a "Confirmar".
      keyboardShouldPersistTaps="handled">
      <Saludo />

      {/* Un pedido propio que aún no llega: se ve antes que todo lo demás. */}
      <AvisoPedidoEnCurso />

      {cargandoPanel && <ActivityIndicator size="large" color={c.accent} accessibilityLabel="Cargando tu negocio" />}

      {tienePanel && (
        <>
          {/* Lo primero que ve el trabajador al abrir la app: lo que le toca hacer. */}
          {!!negocio && <MisTareas token={token} negocioId={negocio.id} siempre={negocio.rol !== 'propietario'} />}
          <CuadrosAcceso accesos={accesos} />
          {!!negocio && tieneServicios && citasPendientes > 0 && <PressableScale style={styles.pedidoCard} onPress={() => navigation.navigate('AgendaNegocio', { negocioId: negocio.id })}>
            <Text style={styles.pedidoId}>{citasPendientes}{citasPendientes === 30 ? '+' : ''} solicitud(es) de cita por confirmar</Text>
            <Text style={styles.pedidoVer}>Revisa la agenda presencial y responde antes de una hora. Ver agenda ›</Text>
          </PressableScale>}

          {/* Pedidos en espera del negocio activo, directamente en el Inicio. */}
          {negocio && tienePermiso(negocio, 'gestionar_pedidos') && (
            <>
              <Objetivo id="home.pedidos">
              <Text style={styles.seccion}>
                Pedidos en espera{enEspera.length > 0 ? ` (${enEspera.length})` : ''}
              </Text>
              </Objetivo>
              {enEspera.length === 0 ? (
                <View style={styles.vacioBox}>
                  <Text style={styles.vacioTxt}>No tienes pedidos en espera.</Text>
                </View>
              ) : (
                enEspera.map((p, i) => (
                  <FadeInView key={p.id} delay={i * 60}>
                    <PressableScale
                      style={styles.pedidoCard}
                      onPress={() => navigation.navigate('ComercioPedidoDetalle', { pedido: p })}>
                      <View style={styles.pedidoHead}>
                        <Text style={styles.pedidoId}>Pedido #{p.codigo}</Text>
                        <Text style={styles.pedidoTotal}>{cop(p.total)}</Text>
                      </View>
                      <View style={[styles.pedidoCliente, styles.fila]}>
                        <Icon name="usuario" size={14} color={c.text} />
                        <Text style={styles.pedidoCliente}>{p.cliente ?? 'Cliente'}</Text>
                      </View>
                      <View style={[styles.pedidoItems, styles.fila]}>
                        <Text style={styles.pedidoItems}>
                          {p.items.reduce((s, i2) => s + i2.cantidad, 0)} artículo(s) ·
                        </Text>
                        <Icon name="ubicacion" size={13} color={c.muted} />
                        <Text style={[styles.pedidoItems, { flex: 1 }]} numberOfLines={1}>
                          {p.direccion_entrega}
                        </Text>
                      </View>
                      <Text style={styles.pedidoVer}>Ver detalle ›</Text>
                      <PressableScale
                        style={styles.aceptarBtn}
                        disabled={aceptando === p.id}
                        onPress={() => aceptar(p)}>
                        {aceptando === p.id ? (
                          <ActivityIndicator color={c.onBrand} />
                        ) : (
                          <Text style={styles.aceptarTxt}>Aceptar pedido</Text>
                        )}
                      </PressableScale>
                    </PressableScale>
                  </FadeInView>
                ))
              )}

              {enPreparacion.length > 0 && (
                <>
                  <Text style={styles.seccion}>En preparación ({enPreparacion.length})</Text>
                  {enPreparacion.map((p, i) => (
                    <FadeInView key={p.id} delay={i * 60}>
                      <TarjetaPedido
                        pedido={p}
                        icono="usuario"
                        nombre={p.cliente ?? 'Cliente'}
                        pie={p.metodo_pago === 'transferencia' && p.pago?.estado !== 'confirmado'
                          ? p.pago?.estado === 'informado'
                            ? 'El cliente dice que ya pagó: revisa y confirma ›'
                            : 'Esperando el pago por transferencia ›'
                          : 'Ver y marcar listo ›'}
                        onPress={() => navigation.navigate('ComercioPedidoDetalle', { pedido: p })}
                      />
                    </FadeInView>
                  ))}
                </>
              )}

              {porRecoger.length > 0 && (
                <>
                  <Text style={styles.seccion}>Listos para el domiciliario ({porRecoger.length})</Text>
                  {porRecoger.map((p, i) => (
                    <FadeInView key={p.id} delay={i * 60}>
                      <TarjetaPedido
                        pedido={p}
                        icono="moto"
                        nombre={p.estado === 'listo' ? 'Buscando domiciliario…' : `${p.domiciliario ?? 'El domiciliario'} viene por él`}
                        pie="Ver pedido ›"
                        onPress={() => navigation.navigate('ComercioPedidoDetalle', { pedido: p })}>
                        {p.estado === 'listo' ? (
                          <Text style={styles.domicilioNota}>
                            Cuando un domiciliario lo tome, aquí escribes su código para entregárselo.
                          </Text>
                        ) : (
                        <PedirCodigo
                          compacto
                          titulo="Código del domiciliario"
                          textoBoton="Confirmar"
                          onConfirmar={codigo => entregarAlDomiciliario(p, codigo)}
                        />
                        )}
                        {p.domicilio_lo_entrega_negocio && (
                          <Text style={styles.domicilioNota}>
                            Pagado por transferencia: entrégale {cop(p.costo_domicilio ?? 0)} del domicilio.
                          </Text>
                        )}
                      </TarjetaPedido>
                    </FadeInView>
                  ))}
                </>
              )}

              {devoluciones.length > 0 && (
                <>
                  <Text style={styles.seccion}>Devoluciones por hacer ({devoluciones.length})</Text>
                  {devoluciones.map(s => (
                    <PressableScale
                      key={s.id}
                      style={styles.pedidoCard}
                      onPress={() => navigation.navigate('ComercioPedidoDetalle', { pedidoId: s.id, negocioId: s.negocio_id })}>
                      <Text style={styles.pedidoId}>Pedido #{s.codigo} · {cop(s.monto)}</Text>
                      <Text style={styles.pedidoVer}>
                        {s.estado === 'no_recibido' ? 'El cliente dice que no le ha llegado ›' : 'Devuélvele la transferencia al cliente ›'}
                      </Text>
                    </PressableScale>
                  ))}
                </>
              )}

              {porConfirmar.length > 0 && (
                <>
                  <Text style={styles.seccion}>Dinero por confirmar ({porConfirmar.length})</Text>
                  {porConfirmar.map((p, i) => (
                    <FadeInView key={p.id} delay={i * 60}>
                      <TarjetaPedido
                        pedido={p}
                        icono="moto"
                        nombre={p.domiciliario ?? 'Domiciliario'}
                        pie={`¿Te entregó los ${cop(p.subtotal ?? p.total)}? ›`}
                        destacada
                        onPress={() => navigation.navigate('ComercioPedidoDetalle', { pedido: p })}>
                        {/* Lo que cobró se divide: la tienda recibe los productos y el
                            domiciliario se queda con el domicilio. */}
                        <View style={styles.reparto}>
                          <View style={styles.repartoFila}>
                            <Text style={styles.repartoTxt}>Para la tienda (productos)</Text>
                            <Text style={styles.repartoValor}>{cop(p.subtotal ?? p.total)}</Text>
                          </View>
                          <View style={styles.repartoFila}>
                            <Text style={styles.repartoTxt}>Para el domiciliario (domicilio)</Text>
                            <Text style={styles.repartoTxt}>{cop(p.costo_domicilio ?? 0)}</Text>
                          </View>
                        </View>
                      </TarjetaPedido>
                    </FadeInView>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Con panel de negocio, Explorar es uno de los cuadros. */}
      {!tienePanel && !cargandoPanel && <IrAExplorar />}

      {esAdmin && (
        <FadeInView delay={120}>
          <PressableScale style={styles.item} onPress={() => navigation.navigate('AdminTablero')}>
            <Icon name="herramientas" size={26} color={c.accent} style={styles.itemEmoji} />
            <View style={styles.itemTexto}>
              <Text style={styles.itemTitulo}>Administración</Text>
              <Text style={styles.itemSub}>Usuarios, roles y negocios</Text>
            </View>
            <Icon name="chevron" size={20} color={c.chevron} />
          </PressableScale>
        </FadeInView>
      )}
      {/* "Cerrar sesión" vive solo en el menú de Mi perfil (ícono de la topbar). */}
    </ScrollTeclado>
    </DesplazableTutorial>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20 },
  headerDerecha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.lg, padding: 16, marginBottom: 12, ...shadow.soft,
  },
  itemEmoji: { marginRight: 14 },
  itemTexto: { flex: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitulo: { fontSize: 16, fontFamily: font.bold, color: c.textStrong },
  itemSub: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  // Accesos del negocio
  cuadros: { gap: 10, marginBottom: 12 },
  cuadrosFila: { flexDirection: 'row', gap: 10 },
  celda: { flex: 1 },
  cuadro: {
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 6,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    ...shadow.soft,
  },
  cuadroTxt: { color: c.textStrong, fontFamily: font.semibold, fontSize: 13, lineHeight: 17, textAlign: 'center' },
  // Topbar: Abierto/Cerrado
  headerEstado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerEstadoTxt: { fontFamily: font.bold, fontSize: 13 },
  etiqueta: { paddingLeft: 24 },
  oculto: { opacity: 0 },
  // Alineadas a la derecha en una caja más ancha que la palabra actual: la
  // otra no se parte en dos líneas, y el zoom crece hacia la izquierda sin
  // montarse sobre el botón.
  capa: { position: 'absolute', top: 0, right: 0, left: -40, textAlign: 'right', transformOrigin: 'right center' },
  reparto: { marginTop: 8, gap: 4 },
  repartoFila: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  repartoTxt: { color: c.text, fontFamily: font.regular, fontSize: 14 },
  repartoValor: { color: c.textStrong, fontFamily: font.bold, fontSize: 15 },
  // Pedidos en espera
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 14, marginBottom: 10 },
  domicilioNota: { color: c.goldText, fontFamily: font.semibold, fontSize: 13, lineHeight: 18, marginTop: 8 },
  vacioBox: {
    backgroundColor: c.surface, borderRadius: radius.md, padding: 18, marginBottom: 12,
    alignItems: 'center', ...shadow.low,
  },
  vacioTxt: { color: c.muted, fontSize: 14, fontFamily: font.regular },
  pedidoCard: {
    backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 10,
    borderLeftWidth: 4, borderLeftColor: c.accent, ...shadow.low,
  },
  pedidoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pedidoId: { fontFamily: font.bold, color: c.textStrong, fontSize: 15 },
  pedidoTotal: { fontFamily: font.extra, color: c.textStrong },
  pedidoCliente: { color: c.text, fontSize: 14, marginTop: 6, fontFamily: font.medium },
  pedidoItems: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  pedidoVer: { color: c.goldText, fontFamily: font.bold, fontSize: 13, marginTop: 8 },
  pedidoCardDinero: { borderLeftColor: c.success },
  aceptarBtn: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  aceptarTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
}));
