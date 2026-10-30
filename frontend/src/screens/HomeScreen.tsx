import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, RefreshControl, ScrollView, Text, View } from 'react-native';
import { ComercioPedido, getPedidosComercio } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import BotonMantener from '../components/BotonMantener';
import HeaderPerfil from '../components/HeaderPerfil';
import Icon from '../components/Icon';
import PanelDomiciliario, { PanelDomiciliarioRef } from '../components/PanelDomiciliario';
import { NivelBadge } from '../components/Reputacion';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { usePolling } from '../usePolling';

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
function EtiquetaEstado({ abierto }: { abierto: boolean }) {
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
    <View style={styles.etiqueta} accessible accessibilityLabel={abierto ? 'Abierto' : 'Cerrado'}>
      {/* Invisible: le da al conjunto el ancho de la palabra actual. */}
      <Text style={[styles.headerEstadoTxt, styles.oculto]}>{abierto ? 'Abierto' : 'Cerrado'}</Text>
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
        Cerrado
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
  const { negocio, setAbierto, esPropietario } = useNegocio();
  const toast = useToast();
  const [cambiando, setCambiando] = useState(false);

  if (!negocio) {
    return null;
  }

  // Solo el propietario abre/cierra el negocio; el trabajador solo ve el estado.
  if (!esPropietario) {
    return <EtiquetaEstado abierto={negocio.activo} />;
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
    <View style={styles.headerEstado}>
      <EtiquetaEstado abierto={negocio.activo} />
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
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const user = auth!.user;
  const token = auth!.token;
  const esCliente = user.roles.includes('usuario');
  const esAdmin = user.roles.includes('administrador');
  const esDomiciliario = user.roles.includes('domiciliario');

  const { negocio, negocios, esPropietario } = useNegocio();
  const negocioId = negocio?.id ?? null;
  // Panel de negocio: quien es miembro de algún negocio (no hay rol global
  // de "comerciante"; los negocios se crean desde Mis negocios).
  const tienePanel = negocios.length > 0;
  const [pedidos, setPedidos] = useState<ComercioPedido[]>([]);
  // Domiciliario: sus entregas van en el Inicio, debajo del saludo.
  const scroll = useRef<ScrollView>(null);
  const panelDomiciliario = useRef<PanelDomiciliarioRef>(null);
  const panelY = useRef(0);
  const [refrescando, setRefrescando] = useState(false);

  // Topbar: con negocio, el switch Abierto/Cerrado va junto a "Mi perfil".
  // (Sin negocio aplica el headerRight global con solo "Mi perfil".)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerDerecha}>
          <HeaderEstadoNegocio />
          <HeaderPerfil />
        </View>
      ),
    });
  }, [navigation, styles]);

  const cargarPedidos = useCallback(() => {
    if (!negocioId) {
      setPedidos([]);
      return;
    }

    getPedidosComercio(token, negocioId)
      .then(setPedidos)
      .catch(() => {});
  }, [negocioId, token]);

  // Al cambiar de negocio no se muestran los pedidos del anterior.
  useEffect(() => setPedidos([]), [negocioId]);

  // Pedidos en espera del negocio activo: se recargan al entrar, al llegar un
  // push y cada 15 s mientras la pantalla está visible.
  useFocusEffect(
    useCallback(() => {
      cargarPedidos();
    }, [cargarPedidos]),
  );
  usePolling(cargarPedidos);

  // Deslizar hacia abajo recarga las entregas (y los pedidos del negocio, si tiene).
  async function refrescar() {
    setRefrescando(true);
    cargarPedidos();
    await panelDomiciliario.current?.recargar();
    setRefrescando(false);
  }

  const enEspera = pedidos.filter(p => p.estado === 'pendiente');
  // Efectivo: falta decir si el domiciliario entregó el dinero.
  const porConfirmar = pedidos.filter(p => p.puede_confirmar_dinero);

  return (
    <ScrollView
      ref={scroll}
      style={styles.container}
      // El cliente lleva la barra flotante abajo: dejamos aire para no taparla.
      contentContainerStyle={[styles.content, esCliente && styles.contentCliente]}
      refreshControl={
        esDomiciliario ? (
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} colors={[c.accent]} tintColor={c.accent} />
        ) : undefined
      }>
      <FadeInView>
        <Text style={styles.saludo}>¡Hola, {user.name}!</Text>
        <View style={styles.rolesRow}>
          {user.roles.map(r => (
            <Text key={r} style={styles.rol}>{r}</Text>
          ))}
        </View>
      </FadeInView>

      {tienePanel && (
        <>
          <FadeInView delay={60}>
            <PressableScale style={styles.item} onPress={() => navigation.navigate('MiTienda')}>
              <Icon name="tienda" size={26} color={c.accent} style={styles.itemEmoji} />
              <View style={styles.itemTexto}>
                <Text style={styles.itemTitulo}>Mi negocio</Text>
                <Text style={styles.itemSub}>
                  {negocio
                    ? `${negocio.nombre} · ${negocio.activo ? 'Abierto' : 'Cerrado'}${esPropietario ? '' : ' · Trabajador'}`
                    : 'Crea tu negocio'}
                </Text>
                {!!negocio?.reputacion && (
                  <View style={styles.itemBadge}>
                    <NivelBadge reputacion={negocio.reputacion} />
                  </View>
                )}
              </View>
              <Icon name="chevron" size={20} color={c.chevron} />
            </PressableScale>
          </FadeInView>

          {/* Cambiar de negocio, crear otro y responder invitaciones. */}
          <FadeInView delay={90}>
            <PressableScale style={styles.item} onPress={() => navigation.navigate('MisNegocios')}>
              <Icon name="lista" size={26} color={c.accent} style={styles.itemEmoji} />
              <View style={styles.itemTexto}>
                <Text style={styles.itemTitulo}>Mis negocios</Text>
                <Text style={styles.itemSub}>
                  {negocios.length > 1
                    ? `${negocios.length} negocios · toca para cambiar`
                    : 'Crea otro negocio o únete a uno'}
                </Text>
              </View>
              <Icon name="chevron" size={20} color={c.chevron} />
            </PressableScale>
          </FadeInView>

          {negocio && (
            <>
              <FadeInView delay={120}>
                <PressableScale style={styles.item} onPress={() => navigation.navigate('MisProductos')}>
                  <Icon name="caja" size={26} color={c.accent} style={styles.itemEmoji} />
                  <View style={styles.itemTexto}>
                    <Text style={styles.itemTitulo}>Productos</Text>
                    <Text style={styles.itemSub}>Tu catálogo: añade y edita productos</Text>
                  </View>
                  <Icon name="chevron" size={20} color={c.chevron} />
                </PressableScale>
              </FadeInView>

              <FadeInView delay={135}>
                <PressableScale style={styles.item} onPress={() => navigation.navigate('PedidosNegocio')}>
                  <Icon name="lista" size={26} color={c.accent} style={styles.itemEmoji} />
                  <View style={styles.itemTexto}>
                    <Text style={styles.itemTitulo}>Pedidos y ventas</Text>
                    <Text style={styles.itemSub}>En curso, entregados, cancelados y lo vendido hoy</Text>
                  </View>
                  <Icon name="chevron" size={20} color={c.chevron} />
                </PressableScale>
              </FadeInView>

              <FadeInView delay={150}>
                <PressableScale style={styles.item} onPress={() => navigation.navigate('Equipo')}>
                  <Icon name="usuarios" size={26} color={c.accent} style={styles.itemEmoji} />
                  <View style={styles.itemTexto}>
                    <Text style={styles.itemTitulo}>Equipo</Text>
                    <Text style={styles.itemSub}>
                      {esPropietario ? 'Invita trabajadores con su código' : 'Personas que trabajan aquí'}
                    </Text>
                  </View>
                  <Icon name="chevron" size={20} color={c.chevron} />
                </PressableScale>
              </FadeInView>
            </>
          )}

          {/* Pedidos en espera del negocio activo, directamente en el Inicio. */}
          {negocio && (
            <>
              <Text style={styles.seccion}>
                Pedidos en espera{enEspera.length > 0 ? ` (${enEspera.length})` : ''}
              </Text>
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
                        <Text style={styles.pedidoId}>Pedido #{p.id}</Text>
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
                      <Text style={styles.pedidoVer}>Ver y marcar listo ›</Text>
                    </PressableScale>
                  </FadeInView>
                ))
              )}

              {porConfirmar.length > 0 && (
                <>
                  <Text style={styles.seccion}>Dinero por confirmar ({porConfirmar.length})</Text>
                  {porConfirmar.map((p, i) => (
                    <FadeInView key={p.id} delay={i * 60}>
                      <PressableScale
                        style={[styles.pedidoCard, styles.pedidoCardDinero]}
                        onPress={() => navigation.navigate('ComercioPedidoDetalle', { pedido: p })}>
                        <View style={styles.pedidoHead}>
                          <Text style={styles.pedidoId}>Pedido #{p.id}</Text>
                          <Text style={styles.pedidoTotal}>{cop(p.total)}</Text>
                        </View>
                        <View style={[styles.pedidoCliente, styles.fila]}>
                          <Icon name="moto" size={14} color={c.text} />
                          <Text style={styles.pedidoCliente}>{p.domiciliario ?? 'Domiciliario'}</Text>
                        </View>
                        <Text style={styles.pedidoVer}>¿Te entregó el dinero? ›</Text>
                      </PressableScale>
                    </FadeInView>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}

      {esCliente && (
        <FadeInView delay={60}>
          <PressableScale style={styles.item} onPress={() => navigation.navigate('Explorar')}>
            <Icon name="bolsa" size={26} color={c.accent} style={styles.itemEmoji} />
            <View style={styles.itemTexto}>
              <Text style={styles.itemTitulo}>Explorar negocios</Text>
              <Text style={styles.itemSub}>Mira los comercios abiertos</Text>
            </View>
            <Icon name="chevron" size={20} color={c.chevron} />
          </PressableScale>
        </FadeInView>
      )}

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

      {/* Turno, entregas en curso y pedidos disponibles, directamente aquí. */}
      {esDomiciliario && (
        <View onLayout={e => (panelY.current = e.nativeEvent.layout.y)}>
          <PanelDomiciliario
            ref={panelDomiciliario}
            // Al tomar un pedido se sube hasta el panel: queda arriba, en curso.
            onTomado={() => scroll.current?.scrollTo({ y: panelY.current, animated: true })}
          />
        </View>
      )}
      {/* "Cerrar sesión" vive solo en Mi perfil (botón de la topbar). */}
    </ScrollView>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 20 },
  contentCliente: { paddingBottom: 110 },
  headerDerecha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  saludo: { fontSize: 24, fontFamily: font.display, color: c.textStrong, marginTop: 8 },
  rolesRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 24 },
  rol: {
    backgroundColor: c.accentSoft, color: c.goldText, fontFamily: font.bold, fontSize: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.lg, padding: 16, marginBottom: 12, ...shadow.soft,
  },
  itemEmoji: { marginRight: 14 },
  itemTexto: { flex: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitulo: { fontSize: 16, fontFamily: font.bold, color: c.textStrong },
  itemSub: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  // Topbar: Abierto/Cerrado
  headerEstado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerEstadoTxt: { fontFamily: font.bold, fontSize: 13 },
  etiqueta: { paddingLeft: 24 },
  oculto: { opacity: 0 },
  // Alineadas a la derecha en una caja más ancha que la palabra actual: la
  // otra no se parte en dos líneas, y el zoom crece hacia la izquierda sin
  // montarse sobre el botón.
  capa: { position: 'absolute', top: 0, right: 0, left: -40, textAlign: 'right', transformOrigin: 'right center' },
  // Pedidos en espera
  seccion: { fontSize: 16, fontFamily: font.displaySemi, color: c.textStrong, marginTop: 14, marginBottom: 10 },
  vacioBox: { backgroundColor: c.surface, borderRadius: radius.md, padding: 18, alignItems: 'center', ...shadow.low },
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
  itemBadge: { marginTop: 6 },
}));
