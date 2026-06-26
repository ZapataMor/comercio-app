import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { RootStackParamList } from '../navTypes';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { auth, salir } = useAuth();
  const user = auth!.user;
  const esComerciante = user.roles.includes('comerciante');
  const esCliente = user.roles.includes('usuario');
  const esAdmin = user.roles.includes('administrador');
  const esDomiciliario = user.roles.includes('domiciliario');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.saludo}>¡Hola, {user.name}! 👋</Text>
      <View style={styles.rolesRow}>
        {user.roles.map(r => (
          <Text key={r} style={styles.rol}>{r}</Text>
        ))}
      </View>

      {esComerciante && (
        <>
          <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('MiTienda')}>
            <Text style={styles.itemEmoji}>🏪</Text>
            <View style={styles.itemTexto}>
              <Text style={styles.itemTitulo}>Mi Tienda</Text>
              <Text style={styles.itemSub}>Ver y gestionar tu negocio</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('MisProductos')}>
            <Text style={styles.itemEmoji}>📦</Text>
            <View style={styles.itemTexto}>
              <Text style={styles.itemTitulo}>Mis Productos</Text>
              <Text style={styles.itemSub}>Tu catálogo</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('ComercioPedidos')}>
            <Text style={styles.itemEmoji}>📥</Text>
            <View style={styles.itemTexto}>
              <Text style={styles.itemTitulo}>Pedidos recibidos</Text>
              <Text style={styles.itemSub}>Confírmalos para que los recojan</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </>
      )}

      {esCliente && (
        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('Explorar')}>
          <Text style={styles.itemEmoji}>🛍️</Text>
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Explorar negocios</Text>
            <Text style={styles.itemSub}>Mira los comercios abiertos</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}

      {esAdmin && (
        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('AdminTablero')}>
          <Text style={styles.itemEmoji}>🛠️</Text>
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Administración</Text>
            <Text style={styles.itemSub}>Usuarios, roles y negocios</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}

      {esDomiciliario && (
        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('Domiciliario')}>
          <Text style={styles.itemEmoji}>🛵</Text>
          <View style={styles.itemTexto}>
            <Text style={styles.itemTitulo}>Mis entregas</Text>
            <Text style={styles.itemSub}>Pedidos para recoger y entregar</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
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
  itemEmoji: { fontSize: 28, marginRight: 14 },
  itemTexto: { flex: 1 },
  itemTitulo: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  itemSub: { color: '#64748b', fontSize: 13, marginTop: 2 },
  chevron: { fontSize: 28, color: '#cbd5e1' },
  logout: { marginTop: 24, alignItems: 'center' },
  logoutTexto: { color: '#ef4444', fontWeight: '700' },
});
