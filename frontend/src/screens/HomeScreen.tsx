import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { ComercioPedido, getPedidosComercio } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import HeaderPerfil from '../components/HeaderPerfil';
import Icon from '../components/Icon';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/** Switch Abierto/Cerrado que va en la parte derecha de la topbar. */
function HeaderEstadoNegocio() {
  const { negocio, setAbierto } = useNegocio();
  const toast = useToast();
  const [cambiando, setCambiando] = useState(false);

  if (!negocio) {
    return null;
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
    <View style={styles.headerSwitch}>
      <Text style={[styles.headerSwitchTxt, { color: negocio.activo ? c.successSoft : c.dangerSoft }]}>
        {negocio.activo ? 'Abierto' : 'Cerrado'}
      </Text>
      <Switch
        value={negocio.activo}
        onValueChange={toggle}
        disabled={cambiando}
        trackColor={{ true: c.success, false: '#6B6358' }}
        thumbColor={c.onBrand}
      />
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { auth, salir } = useAuth();
  const user = auth!.user;
  const token = auth!.token;
  const esComerciante = user.roles.includes('comerciante');
  const esCliente = user.roles.includes('usuario');
  const esAdmin = user.roles.includes('administrador');
  const esDomiciliario = user.roles.includes('domiciliario');

  const { negocio } = useNegocio();
  const [pedidos, setPedidos] = useState<ComercioPedido[]>([]);

  // Topbar: el comerciante ve el switch Abierto/Cerrado junto a "Mi perfil".
  // (Para el resto de roles aplica el headerRight global con solo "Mi perfil".)
  useLayoutEffect(() => {
    if (!esComerciante) {
      return;
    }
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerDerecha}>
          <HeaderEstadoNegocio />
          <HeaderPerfil />
        </View>
      ),
    });
  }, [navigation, esComerciante]);

  const cargarPedidos = useCallback(() => {
    if (!esComerciante) {
      return;
    }

    getPedidosComercio(token)
      .then(setPedidos)
      .catch(() => {});
  }, [esComerciante, token]);

  // Pedidos en espera: se recargan al entrar y luego cada pocos segundos.
  useFocusEffect(
    useCallback(() => {
      if (!esComerciante) {
        return;
      }

      cargarPedidos();
      const timer = setInterval(cargarPedidos, 5000);
      return () => clearInterval(timer);
    }, [cargarPedidos, esComerciante]),
  );

  const enEspera = pedidos.filter(p => p.estado === 'pendiente');

  return (
    <ScrollView
      style={styles.container}
      // El cliente lleva la barra flotante abajo: dejamos aire para no taparla.
      contentContainerStyle={[styles.content, esCliente && styles.contentCliente]}>
      <FadeInView>
        <Text style={styles.saludo}>¡Hola, {user.name}!</Text>
        <View style={styles.rolesRow}>
          {user.roles.map(r => (
            <Text key={r} style={styles.rol}>{r}</Text>
          ))}
        </View>
      </FadeInView>

      {esComerciante && (
        <>
          <FadeInView delay={60}>
            <PressableScale style={styles.item} onPress={() => navigation.navigate('MiTienda')}>
              <Icon name="tienda" size={26} color={c.accent} style={styles.itemEmoji} />
              <View style={styles.itemTexto}>
                <Text style={styles.itemTitulo}>Mi negocio</Text>
                <Text style={styles.itemSub}>
                  {negocio ? `${negocio.nombre} · ${negocio.activo ? 'Abierto' : 'Cerrado'}` : 'Crea tu negocio'}
                </Text>
              </View>
              <Icon name="chevron" size={20} color={c.chevron} />
            </PressableScale>
          </FadeInView>

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

          {/* Pedidos en espera, directamente en el Inicio. */}
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

      {esDomiciliario && (
        <FadeInView delay={180}>
          <PressableScale style={styles.item} onPress={() => navigation.navigate('Domiciliario')}>
            <Icon name="moto" size={26} color={c.accent} style={styles.itemEmoji} />
            <View style={styles.itemTexto}>
              <Text style={styles.itemTitulo}>Mis entregas</Text>
              <Text style={styles.itemSub}>Pedidos para recoger y entregar</Text>
            </View>
            <Icon name="chevron" size={20} color={c.chevron} />
          </PressableScale>
        </FadeInView>
      )}

      <TouchableOpacity style={styles.logout} onPress={salir}>
        <Text style={styles.logoutTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  // Topbar switch
  headerSwitch: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerSwitchTxt: { fontFamily: font.bold, fontSize: 13 },
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
  logout: { marginTop: 28, alignItems: 'center' },
  logoutTexto: { color: c.danger, fontFamily: font.bold },
});
