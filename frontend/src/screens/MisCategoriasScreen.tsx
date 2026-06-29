import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  actualizarCategoria,
  Categoria,
  crearCategoria,
  eliminarCategoria,
  getCategoriasComerciante,
} from '../api';
import { useAuth } from '../AuthContext';

export default function MisCategoriasScreen() {
  const { auth } = useAuth();
  const token = auth!.token;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nueva, setNueva] = useState('');
  const [creando, setCreando] = useState(false);

  // Edición en línea.
  const [editId, setEditId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');

  const cargar = useCallback(
    (refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      getCategoriasComerciante(token)
        .then(setCategorias)
        .catch(e => setError(e.message))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token],
  );

  useEffect(() => cargar(), [cargar]);

  async function onCrear() {
    if (!nueva.trim()) return;
    setCreando(true);
    try {
      await crearCategoria(token, nueva.trim());
      setNueva('');
      cargar();
    } catch (e) {
      Alert.alert('No se pudo crear', e instanceof Error ? e.message : 'Error');
    } finally {
      setCreando(false);
    }
  }

  async function onGuardarEdicion(id: number) {
    if (!editNombre.trim()) return;
    try {
      await actualizarCategoria(token, id, editNombre.trim());
      setEditId(null);
      setEditNombre('');
      cargar();
    } catch (e) {
      Alert.alert('No se pudo actualizar', e instanceof Error ? e.message : 'Error');
    }
  }

  function onEliminar(c: Categoria) {
    Alert.alert('Eliminar categoría', `¿Eliminar "${c.nombre}"? Los productos quedarán sin categoría.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await eliminarCategoria(token, c.id);
            cargar();
          } catch (e) {
            Alert.alert('No se pudo eliminar', e instanceof Error ? e.message : 'Error');
          }
        },
      },
    ]);
  }

  if (cargando) {
    return <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <FlatList
      style={styles.container}
      data={categorias}
      keyExtractor={c => String(c.id)}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={['#4f46e5']} />
      }
      ListHeaderComponent={
        <View style={styles.formBox}>
          <Text style={styles.label}>Nueva categoría</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={nueva}
              onChangeText={setNueva}
              placeholder="Ej: Bebidas"
              editable={!creando}
            />
            <TouchableOpacity style={styles.addBtn} onPress={onCrear} disabled={creando}>
              {creando ? <ActivityIndicator color="#fff" /> : <Text style={styles.addTxt}>Agregar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      }
      ListEmptyComponent={<Text style={styles.vacio}>Aún no tienes categorías.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          {editId === item.id ? (
            <>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={editNombre}
                onChangeText={setEditNombre}
                autoFocus
              />
              <TouchableOpacity style={styles.iconBtn} onPress={() => onGuardarEdicion(item.id)}>
                <Text style={styles.guardar}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setEditId(null)}>
                <Text style={styles.cancelar}>Cancelar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => {
                  setEditId(item.id);
                  setEditNombre(item.nombre);
                }}>
                <Text style={styles.editar}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => onEliminar(item)}>
                <Text style={styles.eliminar}>Eliminar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  formBox: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#0f172a', flex: 1,
  },
  addBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  addTxt: { color: '#fff', fontWeight: '700' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  nombre: { fontSize: 15, fontWeight: '600', color: '#0f172a', flex: 1 },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  editar: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  eliminar: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  guardar: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  cancelar: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, margin: 20 },
});
