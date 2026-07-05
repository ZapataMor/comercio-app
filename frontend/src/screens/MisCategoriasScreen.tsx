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
import { FadeInView, PressableScale } from '../components/anim';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';
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
  const [errores, setErrores] = useState<FieldErrors>({});

  // Edición en línea.
  const [editId, setEditId] = useState<number | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editErrores, setEditErrores] = useState<FieldErrors>({});

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
    setErrores({});
    if (!nueva.trim()) {
      setErrores({ nombre: 'El campo nueva categoria es obligatorio.' });
      return;
    }
    setCreando(true);
    try {
      await crearCategoria(token, nueva.trim());
      toast.exito('Categoría creada', `"${nueva.trim()}" lista para agregarle productos.`);
      setNueva('');
      cargar();
    } catch (e) {
      const campos = fieldErrorsFromError(e);
      if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        toast.error('No se pudo crear', messageFromError(e, 'Error'));
      }
    } finally {
      setCreando(false);
    }
  }

  async function onGuardarEdicion(id: number) {
    setEditErrores({});
    if (!editNombre.trim()) {
      setEditErrores({ nombre: 'El campo nombre es obligatorio.' });
      return;
    }
    try {
      await actualizarCategoria(token, id, editNombre.trim());
      toast.exito('Listo', 'Categoría actualizada.');
      setEditId(null);
      setEditNombre('');
      cargar();
    } catch (e) {
      const campos = fieldErrorsFromError(e);
      if (Object.keys(campos).length > 0) {
        setEditErrores(campos);
      } else {
        toast.error('No se pudo actualizar', messageFromError(e, 'Error'));
      }
    }
  }

  function onEliminar(cat: Categoria) {
    Alert.alert('Eliminar categoría', `¿Eliminar "${cat.nombre}"? Los productos quedarán sin categoría.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await eliminarCategoria(token, cat.id);
            toast.exito('Eliminada', `"${cat.nombre}" se eliminó.`);
            cargar();
          } catch (e) {
            toast.error('No se pudo eliminar', e instanceof Error ? e.message : 'Error');
          }
        },
      },
    ]);
  }

  function abrirProductos(cat: Categoria) {
    navigation.navigate('CategoriaProductos', { categoriaId: cat.id, nombre: cat.nombre });
  }

  if (cargando) {
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <FlatList
      style={styles.container}
      data={categorias}
      keyExtractor={cat => String(cat.id)}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />
      }
      ListHeaderComponent={
        <View style={styles.formBox}>
          <Text style={styles.label}>Nueva categoría</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={nueva}
              onChangeText={valor => {
                setNueva(valor);
                setErrores({});
              }}
              placeholder="Ej: Comida"
              placeholderTextColor={c.mutedSoft}
              editable={!creando}
            />
            <PressableScale style={styles.addBtn} onPress={onCrear} disabled={creando}>
              {creando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.addTxt}>Agregar</Text>}
            </PressableScale>
          </View>
          <FieldError mensaje={errores.nombre} />
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
            <Icon name="chevron" size={20} color={c.chevron} />
          </TouchableOpacity>
        ) : null
      }
      renderItem={({ item, index }) => (
        <FadeInView delay={Math.min(index, 8) * 40}>
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={editId === item.id ? undefined : () => abrirProductos(item)}>
            {editId === item.id ? (
              <>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={editNombre}
                    onChangeText={valor => {
                      setEditNombre(valor);
                      setEditErrores({});
                    }}
                    autoFocus
                  />
                  <FieldError mensaje={editErrores.nombre} />
                </View>
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
                    setEditErrores({});
                  }}>
                  <Text style={styles.editar}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => onEliminar(item)}>
                  <Text style={styles.eliminar}>Eliminar</Text>
                </TouchableOpacity>
                <Icon name="chevron" size={20} color={c.chevron} />
              </>
            )}
          </TouchableOpacity>
        </FadeInView>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  formBox: { backgroundColor: c.surface, padding: 16, borderRadius: radius.lg, marginBottom: 12, ...shadow.low },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.textStrong, flex: 1, fontFamily: font.regular,
  },
  addBtn: { backgroundColor: c.brand, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 11 },
  addTxt: { color: c.onBrand, fontFamily: font.bold },
  ayuda: { color: c.mutedSoft, fontSize: 12, marginTop: 10, fontFamily: font.regular },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  nombre: { fontSize: 15, fontFamily: font.semibold, color: c.textStrong },
  conteo: { fontSize: 12, color: c.mutedSoft, marginTop: 2, fontFamily: font.regular },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  editar: { color: c.goldText, fontFamily: font.semibold, fontSize: 13 },
  eliminar: { color: c.danger, fontFamily: font.semibold, fontSize: 13 },
  guardar: { color: c.success, fontFamily: font.bold, fontSize: 13 },
  cancelar: { color: c.muted, fontFamily: font.semibold, fontSize: 13 },
  sinCat: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginTop: 4,
    borderWidth: 1, borderColor: c.border, borderStyle: 'dashed',
  },
  sinCatNombre: { fontSize: 15, fontFamily: font.semibold, color: c.muted },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 20, fontFamily: font.medium },
});
