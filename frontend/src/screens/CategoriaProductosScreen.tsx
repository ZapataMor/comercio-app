import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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
  imagenUrl,
  Producto,
} from '../api';
import { useAuth } from '../AuthContext';
import { Dropdown } from '../components/Dropdown';
import SelectorImagen from '../components/SelectorImagen';
import { RootStackParamList } from '../navTypes';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'CategoriaProductos'>;

/**
 * Unidad de venta tal como la elige el comerciante en la app (3 opciones),
 * mapeada a los campos del backend (`tipo_venta` + `unidad_medida`).
 */
const UNIDADES = [
  { value: 'cantidad', label: 'Cantidad', tipo_venta: 'cantidad', unidad_medida: 'unidad' },
  { value: 'kilos', label: 'Kilos', tipo_venta: 'peso', unidad_medida: 'kg' },
  { value: 'libras', label: 'Libras', tipo_venta: 'peso', unidad_medida: 'libra' },
] as const;
type UnidadKey = (typeof UNIDADES)[number]['value'];

function unidadDesdeProducto(p: Producto | null): UnidadKey {
  if (p?.unidad_medida === 'kg') return 'kilos';
  if (p?.unidad_medida === 'libra') return 'libras';
  return 'cantidad';
}

function precioCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

export default function CategoriaProductosScreen({ route }: Props) {
  const { categoriaId } = route.params;
  const esSinCategoria = categoriaId == null;
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario (modal).
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precio, setPrecio] = useState('');
  const [unidad, setUnidad] = useState<UnidadKey>('cantidad');
  const [catId, setCatId] = useState<number | null>(categoriaId);
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(
    (refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      Promise.all([
        getProductos(token, esSinCategoria ? { sinCategoria: true } : { categoriaId }),
        getCategoriasComerciante(token),
      ])
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
    [token, categoriaId, esSinCategoria],
  );

  useEffect(() => cargar(), [cargar]);

  function abrirNuevo() {
    setEditando(null);
    setNombre('');
    setDescripcion('');
    setPrecio('');
    setUnidad('cantidad');
    setCatId(categoriaId);
    setImagenUri(null);
    setDisponible(true);
    setModal(true);
  }

  function abrirEditar(p: Producto) {
    setEditando(p);
    setNombre(p.nombre);
    setDescripcion(p.descripcion ?? '');
    setPrecio(String(Math.round(p.precio)));
    setUnidad(unidadDesdeProducto(p));
    setCatId(p.categoria?.id ?? null);
    setImagenUri(null);
    setDisponible(p.disponible);
    setModal(true);
  }

  async function guardar() {
    const precioNum = Number(precio.replace(/[^0-9.]/g, ''));
    if (!nombre.trim()) {
      toast.error('Falta el nombre', 'El nombre del producto es obligatorio.');
      return;
    }
    if (!precio || isNaN(precioNum) || precioNum < 0) {
      toast.error('Precio inválido', 'Ingresa un precio válido.');
      return;
    }
    const u = UNIDADES.find(x => x.value === unidad)!;
    setGuardando(true);
    try {
      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        precio: precioNum,
        tipo_venta: u.tipo_venta,
        unidad_medida: u.unidad_medida,
        categoria_id: catId,
        disponible,
      };
      if (editando) {
        await actualizarProducto(token, editando.id, body, imagenUri ?? undefined);
        toast.exito('Listo', 'Producto actualizado.');
      } else {
        await crearProducto(token, body, imagenUri ?? undefined);
        toast.exito('Listo', 'Producto creado.');
      }
      setModal(false);
      cargar();
    } catch (e) {
      toast.error('No se pudo guardar', e instanceof Error ? e.message : 'Error');
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
            toast.exito('Eliminado', `"${p.nombre}" se quitó del catálogo.`);
            cargar();
          } catch (e) {
            toast.error('No se pudo eliminar', e instanceof Error ? e.message : 'Error');
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

  // Opciones del dropdown de categoría (solo se usa en el grupo "Sin categoría").
  const opcionesCategoria = [
    { label: 'Sin categoría', value: '0' },
    ...categorias.map(c => ({ label: c.nombre, value: String(c.id) })),
  ];

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
          esSinCategoria ? (
            <Text style={styles.ayuda}>
              Productos sin categoría. Edítalos para asignarles una categoría.
            </Text>
          ) : (
            <TouchableOpacity style={styles.nuevoBtn} onPress={abrirNuevo}>
              <Text style={styles.nuevoTxt}>+ Nuevo producto</Text>
            </TouchableOpacity>
          )
        }
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {esSinCategoria
              ? 'No hay productos sin categoría.'
              : 'Aún no hay productos en esta categoría.\nToca "+ Nuevo producto" para crear el primero.'}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => abrirEditar(item)}>
            <View style={styles.thumb}>
              {item.imagen ? (
                <Image source={{ uri: imagenUrl(item.imagen) }} style={styles.thumbImg} resizeMode="cover" />
              ) : (
                <Text style={styles.thumbPlaceholder}>📦</Text>
              )}
            </View>
            <View style={styles.itemTexto}>
              <Text style={styles.nombre}>{item.nombre}</Text>
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

              <SelectorImagen
                label="Foto del producto"
                uri={imagenUri ?? imagenUrl(editando?.imagen)}
                onSelect={setImagenUri}
                disabled={guardando}
              />

              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
                placeholder="Ej: Arroz con pollo"
                editable={!guardando}
              />

              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.area]}
                value={descripcion}
                onChangeText={setDescripcion}
                placeholder="Opcional"
                multiline
                editable={!guardando}
              />

              <Text style={styles.label}>Precio *</Text>
              <TextInput
                style={styles.input}
                value={precio}
                onChangeText={setPrecio}
                placeholder="12000"
                keyboardType="numeric"
                editable={!guardando}
              />

              <Text style={styles.label}>Unidad de venta</Text>
              <Dropdown<UnidadKey>
                valor={unidad}
                opciones={UNIDADES.map(u => ({ label: u.label, value: u.value }))}
                onChange={setUnidad}
                disabled={guardando}
              />

              {esSinCategoria && (
                <>
                  <Text style={styles.label}>Categoría</Text>
                  <Dropdown
                    valor={catId == null ? '0' : String(catId)}
                    opciones={opcionesCategoria}
                    onChange={v => setCatId(v === '0' ? null : Number(v))}
                    disabled={guardando}
                  />
                </>
              )}

              <View style={styles.switchRow}>
                <Text style={styles.label}>Disponible</Text>
                <Switch value={disponible} onValueChange={setDisponible} disabled={guardando} />
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
  ayuda: { color: '#64748b', fontSize: 13, marginBottom: 14, textAlign: 'center' },
  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  thumb: {
    width: 48, height: 48, borderRadius: 10, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12,
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { fontSize: 22 },
  itemTexto: { flex: 1 },
  nombre: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  precio: { color: '#475569', marginTop: 4, fontWeight: '600' },
  acciones: { alignItems: 'flex-end', gap: 8, marginLeft: 8 },
  estado: {
    fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999, overflow: 'hidden',
  },
  disp: { backgroundColor: '#dcfce7', color: '#15803d' },
  oculto: { backgroundColor: '#e2e8f0', color: '#64748b' },
  eliminar: { fontSize: 18 },
  vacio: { textAlign: 'center', color: '#64748b', marginTop: 40, lineHeight: 20 },
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
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
  boton: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  botonTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelar: { textAlign: 'center', color: '#64748b', fontWeight: '600', marginTop: 14, marginBottom: 4 },
});
