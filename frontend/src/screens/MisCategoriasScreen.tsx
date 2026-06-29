import { NativeStackScreenProps } from '@react-navigation/native-stack';
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
  getProductos,
} from '../api';
import { useAuth } from '../AuthContext';
import Icon from '../components/Icon';
import { RootStackParamList } from '../navTypes';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'MisCategorias'>;

export default function MisCategoriasScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [sinCategoria, setSinCategoria] = useState(0); // nº de productos sin categoría
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
      Promise.all([
        getCategoriasComerciante(token),
        getProductos(token, { sinCategoria: true }),
      ])
        .then(([cats, sueltos]) => {
          setCategorias(cats);
          setSinCategoria(sueltos.length);
        })
        .catch(e => setError(e.message))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token],
  );

  // Se recarga al volver (p. ej. tras crear productos en una categoría).
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => cargar());
    return unsub;
  }, [navigation, cargar]);

  async function onCrear() {
    if (!nueva.trim()) return;
    setCreando(true);
    try {
      await crearCategoria(token, nueva.trim());
      toast.exito('Categoría creada', `"${nueva.trim()}" lista para agregarle productos.`);
      setNueva('');
      cargar();
    } catch (e) {
      toast.error('No se pudo crear', e instanceof Error ? e.message : 'Error');
    } finally {
      setCreando(false);
    }
  }

  async function onGuardarEdicion(id: number) {
    if (!editNombre.trim()) return;
    try {
      await actualizarCategoria(token, id, editNombre.trim());
      toast.exito('Listo', 'Categoría actualizada.');
      setEditId(null);
      setEditNombre('');
      cargar();
    } catch (e) {
      toast.error('No se pudo actualizar', e instanceof Error ? e.message : 'Error');
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
            toast.exito('Eliminada', `"${c.nombre}" se eliminó.`);
            cargar();
          } catch (e) {
            toast.error('No se pudo eliminar', e instanceof Error ? e.message : 'Error');
          }
        },
      },
    ]);
  }

  function abrirProductos(c: Categoria) {
    navigation.navigate('CategoriaProductos', { categoriaId: c.id, nombre: c.nombre });
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
              placeholder="Ej: Comida"
              editable={!creando}
            />
            <TouchableOpacity style={styles.addBtn} onPress={onCrear} disabled={creando}>
              {creando ? <ActivityIndicator color="#fff" /> : <Text style={styles.addTxt}>Agregar</Text>}
            </TouchableOpacity>
          </View>
          <Text style={styles.ayuda}>Toca una categoría para ver y crear sus productos.</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.vacio}>Aún no tienes categorías.</Text>}
      ListFooterComponent={
        sinCategoria > 0 ? (
          <TouchableOpacity
            style={styles.sinCat}
            onPress={() => navigation.navigate('CategoriaProductos', { categoriaId: null, nombre: 'Sin categoría' })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sinCatNombre}>Sin categoría</Text>
              <Text style={styles.conteo}>
                {sinCategoria} {sinCategoria === 1 ? 'producto' : 'productos'} por organizar
              </Text>
            </View>
            <Icon name="chevron" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        ) : null
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={editId === item.id ? undefined : () => abrirProductos(item)}>
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
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.conteo}>
                  {item.productos ?? 0} {item.productos === 1 ? 'producto' : 'productos'}
                </Text>
              </View>
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
              <Icon name="chevron" size={20} color="#cbd5e1" />
            </>
          )}
        </TouchableOpacity>
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
  ayuda: { color: '#94a3b8', fontSize: 12, marginTop: 10 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  nombre: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  conteo: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  editar: { color: '#4f46e5', fontWeight: '600', fontSize: 13 },
  eliminar: { color: '#ef4444', fontWeight: '600', fontSize: 13 },
  guardar: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  cancelar: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  chevron: { fontSize: 24, color: '#cbd5e1', marginLeft: 2 },
  sinCat: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 4,
    borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed',
  },
  sinCatNombre: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, margin: 20 },
});
