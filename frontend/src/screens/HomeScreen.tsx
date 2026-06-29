import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { ComercioPedido, getPedidosComercio } from '../api';
import { useAuth } from '../AuthContext';
import Icon from '../components/Icon';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
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
      <Text style={[styles.headerSwitchTxt, { color: negocio.activo ? '#bbf7d0' : '#fecaca' }]}>
        {negocio.activo ? 'Abierto' : 'Cerrado'}
      </Text>
      <Switch
        value={negocio.activo}
        onValueChange={toggle}
        disabled={cambiando}
        trackColor={{ true: '#22c55e', false: '#64748b' }}
        thumbColor="#fff"
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

  // Switch Abierto/Cerrado en la topbar (solo para el comerciante).
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: esComerciante ? () => <HeaderEstadoNegocio /> : undefined,
    });
  }, [navigation, esComerciante]);

  // Pedidos en espera: se recargan cada vez que se entra al Inicio.
  useFocusEffect(
    useCallback(() => {
      if (!esComerciante) {
        return;
      }
      getPedidosComercio(token)
        .then(setPedidos)
        .catch(() => {});
    }, [esComerciante, token]),
  );

  const enEspera = pedidos.filter(p => p.estado === 'pendiente');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.saludo}>¡Hola, {user.name}!</Text>
      <View style={styles.rolesRow}>
        {user.roles.map(r => (
          <Text key={r} style={styles.rol}>{r}</Text>
        ))}
      </View>

      {esComerciante && (
        <>
          <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('MiTienda')}>
            <Icon name="tienda" size={26} color="#4f46e5" style={styles.itemEmoji} />
            <View style={styles.itemTexto}>
              <Text style={styles.itemTitulo}>Mi negocio</Text>
              <Text style={styles.itemSub}>
                {negocio ? `${negocio.nombre} · ${negocio.activo ? 'Abierto' : 'Cerrado'}` : 'Crea tu negocio'}
              </Text>
            </View>
            <Icon name="chevron" size={20} color="#cbd5e1" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('MisCategorias')}>
            <Icon name="etiqueta" size={26} color="#4f46e5" style={styles.itemEmoji} />
            <View style={styles.itemTexto}>
              <Text style={styles.itemTitulo}>Categorías</Text>
              <Text style={styles.itemSub}>Organiza tu catálogo y crea productos</Text>
            </View>
            <Icon name="chevron" size={20} color="#cbd5e1" />
          </TouchableOpacity>

          {/* Pedidos en espera, directamente en el Inicio. */}
          <Text style={styles.seccion}>
            Pedidos en espera{enEspera.length > 0 ? ` (${enEspera.length})` : ''}
          </Text>
          {enEspera.length === 0 ? (
            <View style={styles.vacioBox}>
              <Text style={styles.vacioTxt}>No tienes pedidos en espera.</Text>
            </View>
          ) : (
            enEspera.map(p => (
              <TouchableOpacity
                key={p.id}
                style={styles.pedidoCard}
                onPress={() => navigation.navigate('ComercioPedidoDetalle', { pedido: p })}>
                <View style={styles.pedidoHead}>
                  <Text style={styles.pedidoId}>Pedido #{p.id}</Text>
                  <Text style={styles.pedidoTotal}>{cop(p.total)}</Text>
                </View>
                <View style={[styles.pedidoCliente, styles.fila]}>
                  <Icon name="usuario" size={14} color="#334155" />
                  <Text style={styles.pedidoCliente}>{p.cliente ?? 'Cliente'}</Text>
                </View>
                <View style={[styles.pedidoItems, styles.fila]}>
                  <Text style={styles.pedidoItems}>
                    {p.items.reduce((s, i) => s + i.cantidad, 0)} artículo(s) ·
                  </Text>
                  <Icon name="ubicacion" size={13} color="#64748b" />
                  <Text style={[styles.pedidoItems, { flex: 1 }]} numberOfLines={1}>
                    {p.direccion_entrega}
                  </Text>
                </View>
                <Text style={styles.pedidoVer}>Ver y marcar listo ›</Text>
              </TouchableOpacity>
            ))
          )}
        </>
      )}

      {esCliente && (
        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('Explorar')}>
          <Icon name="bolsa" size={26} color="#4f46e5" style={styles.itemEmoji} />
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Explorar negocios</Text>
            <Text style={styles.itemSub}>Mira los comercios abiertos</Text>
          </View>
          <Icon name="chevron" size={20} color="#cbd5e1" />
        </TouchableOpacity>
      )}

      {esAdmin && (
        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('AdminTablero')}>
          <Icon name="herramientas" size={26} color="#4f46e5" style={styles.itemEmoji} />
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Administración</Text>
            <Text style={styles.itemSub}>Usuarios, roles y negocios</Text>
          </View>
          <Icon name="chevron" size={20} color="#cbd5e1" />
        </TouchableOpacity>
      )}

      {esDomiciliario && (
        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('Domiciliario')}>
          <Icon name="moto" size={26} color="#4f46e5" style={styles.itemEmoji} />
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Mis entregas</Text>
            <Text style={styles.itemSub}>Pedidos para recoger y entregar</Text>
          </View>
          <Icon name="chevron" size={20} color="#cbd5e1" />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logout} onPress={salir}>
        <Text style={styles.logoutTexto}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 20 },
  saludo: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginTop: 8 },
  rolesRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 24 },
  rol: {
    backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: '600', fontSize: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  itemEmoji: { marginRight: 14 },
  itemTexto: { flex: 1 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemTitulo: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  itemSub: { color: '#64748b', fontSize: 13, marginTop: 2 },
  chevron: { fontSize: 28, color: '#cbd5e1' },
  // Topbar switch
  headerSwitch: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerSwitchTxt: { fontWeight: '700', fontSize: 13 },
  // Pedidos en espera
  seccion: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 14, marginBottom: 10 },
  vacioBox: { backgroundColor: '#fff', borderRadius: 14, padding: 18, alignItems: 'center' },
  vacioTxt: { color: '#94a3b8', fontSize: 14 },
  pedidoCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    borderLeftWidth: 4, borderLeftColor: '#f59e0b',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  pedidoHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pedidoId: { fontWeight: '700', color: '#0f172a', fontSize: 15 },
  pedidoTotal: { fontWeight: '800', color: '#0f172a' },
  pedidoCliente: { color: '#334155', fontSize: 14, marginTop: 6 },
  pedidoItems: { color: '#64748b', fontSize: 13, marginTop: 2 },
  pedidoVer: { color: '#4f46e5', fontWeight: '700', fontSize: 13, marginTop: 8 },
  logout: { marginTop: 28, alignItems: 'center' },
  logoutTexto: { color: '#ef4444', fontWeight: '700' },
});
