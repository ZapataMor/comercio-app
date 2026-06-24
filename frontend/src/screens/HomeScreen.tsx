import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Usuario } from '../api';

type Props = {
  user: Usuario;
  onLogout: () => void;
};

export default function HomeScreen({ user, onLogout }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.titulo}>¡Hola, {user.name}!</Text>
        <Text style={styles.email}>{user.email}</Text>

        <View style={styles.roles}>
          {user.roles.map(rol => (
            <Text key={rol} style={styles.rol}>
              {rol}
            </Text>
          ))}
        </View>

        <Text style={styles.ok}>✓ Sesión iniciada contra tu API</Text>

        <TouchableOpacity style={styles.boton} onPress={onLogout}>
          <Text style={styles.botonTexto}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  emoji: { fontSize: 40, marginBottom: 8 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  email: { color: '#64748b', marginTop: 4 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  rol: {
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    fontWeight: '600',
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  ok: { color: '#16a34a', marginTop: 20, fontSize: 13 },
  boton: {
    marginTop: 24,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  botonTexto: { color: '#fff', fontWeight: '700' },
});
