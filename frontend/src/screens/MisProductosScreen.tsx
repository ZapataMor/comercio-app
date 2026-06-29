import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  actualizarProducto,
  Categoria,
  crearProducto,
  eliminarProducto,
  getCategoriasComerciante,
  getProductos,
  Producto,
} from '../api';
import { useAuth } from '../AuthContext';

function precioCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function MisProductosScreen() {
  const { auth } = useAuth();
  const token = auth!.token;

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado del formulario (modal).
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [unidad, setUnidad] = useState('unidad');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(
    (refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      Promise.all([getProductos(token), getCategoriasComerciante(token)])
        .then(([ps, cs]) => {
          setProductos(ps);
          setCategorias(cs);
        })
        .catch(e => setError(e.message))
        .finally(() => {
          setCargando(false);
          setRefrescando(false);
        });
    },
    [token],
  );

  useEffect(() => cargar(), [cargar]);

  function abrirNuevo() {
    setEditando(null);
    setNombre('');
    setDescripcion('');
    setPrecio('');
    setUnidad('unidad');
    setCategoriaId(null);
    setDisponible(true);
    setModal(true);
  }

  function abrirEditar(p: Producto) {
    setEditando(p);
    setNombre(p.nombre);
    setDescripcion(p.descripcion ?? '');
    setPrecio(String(Math.round(p.precio)));
    setUnidad((p as any).unidad_medida ?? 'unidad');
    setCategoriaId(p.categoria?.id ?? null);
    setDisponible(p.disponible);
    setModal(true);
  }

  async function guardar() {
    const precioNum = Number(precio.replace(/[^0-9.]/g, ''));
    if (!nombre.trim()) {
      Alert.alert('Falta el nombre', 'El nombre del producto es obligatorio.');
      return;
    }
    if (!precio || isNaN(precioNum) || precioNum < 0) {
      Alert.alert('Precio inválido', 'Ingresa un precio válido.');
      return;
    }
    setGuardando(true);
    try {
      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        precio: precioNum,
        unidad_medida: unidad.trim() || 'unidad',
        categoria_id: categoriaId,
        disponible,
      };
      if (editando) {
        await actualizarProducto(token, editando.id, body);
      } else {
        await crearProducto(token, body);
      }
      setModal(false);
      cargar();
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardando(false);
    }
  }

  function onEliminar(p: Producto) {
    Alert.alert('Eliminar producto', `¿Eliminar "${p.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await eliminarProducto(token, p.id);
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
    <View style={styles.container}>
      <FlatList
        data={productos}
        keyExtractor={p => String(p.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={['#4f46e5']} />
        }
        ListHeaderComponent={
          <TouchableOpacity style={styles.nuevoBtn} onPress={abrirNuevo}>
            <Text style={styles.nuevoTxt}>+ Nuevo producto</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={<Text style={styles.vacio}>Aún no tienes productos.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => abrirEditar(item)}>
            <View style={styles.itemTexto}>
              <View style={styles.itemTituloRow}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                {item.categoria && <Text style={styles.cat}>{item.categoria.nombre}</Text>}
              </View>
              <Text style={styles.precio}>{item.precio_formateado ?? precioCOP(item.precio)}</Text>
            </View>
            <View style={styles.acciones}>
              <Text style={[styles.estado, item.disponible ? styles.disp : styles.oculto]}>
                {item.disponible ? 'Disponible' : 'Oculto'}
              </Text>
              <TouchableOpacity onPress={() => onEliminar(item)} hitSlop={8}>
                <Text style={styles.eliminar}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Formulario crear/editar */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalFondo}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitulo}>{editando ? 'Editar producto' : 'Nuevo producto'}</Text>

              <Text style={styles.label}>Nombre *</Text>
              <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Arroz" />

              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.area]}
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Opcional"
                multiline
              />

              <View style={styles.fila}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.label}>Precio *</Text>
                  <TextInput
                    style={styles.input}
                    value={precio}
                    onChangeText={setPrecio}
                    placeholder="3000"
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Unidad</Text>
                  <TextInput
                    style={styles.input}
                    value={unidad}
                    onChangeText={setUnidad}
                    placeholder="unidad / kg"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Text style={styles.label}>Categoría</Text>
              <View style={styles.chips}>
                <TouchableOpacity
                  onPress={() => setCategoriaId(null)}
                  style={[styles.chip, categoriaId === null && styles.chipOn]}>
                  <Text style={[styles.chipTxt, categoriaId === null && styles.chipTxtOn]}>
                    Sin categoría
                  </Text>
                </TouchableOpacity>
                {categorias.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setCategoriaId(c.id)}
                    style={[styles.chip, categoriaId === c.id && styles.chipOn]}>
                    <Text style={[styles.chipTxt, categoriaId === c.id && styles.chipTxtOn]}>
                      {c.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {categorias.length === 0 && (
                <Text style={styles.ayuda}>Crea categorías desde "Categorías" en el inicio.</Text>
              )}

              <View style={styles.switchRow}>
                <Text style={styles.label}>Disponible</Text>
                <Switch value={disponible} onValueChange={setDisponible} />
              </View>

              <TouchableOpacity
                style={[styles.boton, guardando && { opacity: 0.7 }]}
                onPress={guardar}
                disabled={guardando}>
                {guardando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.botonTxt}>{editando ? 'Guardar cambios' : 'Crear producto'}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModal(false)} disabled={guardando}>
                <Text style={styles.cancelar}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  nuevoBtn: {
    backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 14,
  },
  nuevoTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
  item: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  itemTexto: { flex: 1 },
  itemTituloRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nombre: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  cat: {
    fontSize: 11, color: '#64748b', backgroundColor: '#f1f5f9',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  precio: { color: '#475569', marginTop: 4, fontWeight: '600' },
  acciones: { alignItems: 'flex-end', gap: 8, marginLeft: 8 },
  estado: {
    fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, overflow: 'hidden',
  },
  disp: { backgroundColor: '#dcfce7', color: '#15803d' },
  oculto: { backgroundColor: '#e2e8f0', color: '#64748b' },
  eliminar: { fontSize: 18 },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, margin: 20 },
  // Modal
  modalFondo: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '90%',
  },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, marginBottom: 14, color: '#0f172a',
  },
  area: { minHeight: 70, textAlignVertical: 'top' },
  fila: { flexDirection: 'row', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { backgroundColor: '#f1f5f9', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { backgroundColor: '#4f46e5' },
  chipTxt: { fontSize: 12, color: '#475569', fontWeight: '600' },
  chipTxtOn: { color: '#fff' },
  ayuda: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
  boton: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  botonTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelar: { textAlign: 'center', color: '#64748b', fontWeight: '600', marginTop: 14, marginBottom: 4 },
});
