import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
  crearProducto,
  eliminarProducto,
  getProductos,
  getTiposProducto,
  imagenUrl,
  Producto,
  TipoProducto,
} from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import { Dropdown } from '../components/Dropdown';
import FieldError from '../components/FieldError';
import Icon from '../components/Icon';
import ListaAtributos from '../components/ListaAtributos';
import SelectorImagen from '../components/SelectorImagen';
import { FieldErrors, fieldErrorsFromError, messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'MisProductos'>;

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

/**
 * Catálogo del comerciante: TODOS los productos de su negocio, con el botón
 * "Añadir producto". El tipo de producto (Comida, Medicamento...) se elige en
 * el formulario y define qué atributos se piden.
 */
export default function MisProductosScreen({}: Props) {
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [tipos, setTipos] = useState<TipoProducto[]>([]);
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
  const [tipoId, setTipoId] = useState<number | null>(null);
  const [atributos, setAtributos] = useState<string[]>([]);
  // Valores con los que se monta ListaAtributos (se limpia al cambiar de tipo).
  const [atributosIniciales, setAtributosIniciales] = useState<string[]>([]);
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<FieldErrors>({});

  // --- Cierre del formulario deslizando hacia abajo (desde la barra de agarre) ---
  // Espejo de `guardando` para leerlo dentro del PanResponder (se crea una sola
  // vez y capturaría el valor viejo del estado).
  const guardandoRef = useRef(false);
  useEffect(() => {
    guardandoRef.current = guardando;
  }, [guardando]);

  const dragY = useRef(new Animated.Value(0)).current;

  const cerrarDeslizando = useCallback(() => {
    // Termina de deslizar la tarjeta fuera de la pantalla y recién ahí cierra.
    Animated.timing(dragY, {
      toValue: Dimensions.get('window').height,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      // OJO: la posición NO se resetea aquí. El Modal todavía reproduce su
      // animación de salida y la tarjeta reaparecería un instante; dragY
      // vuelve a 0 recién al abrir el formulario de nuevo.
      setModal(false);
    });
  }, [dragY]);

  const panResponder = useRef(
    PanResponder.create({
      // La zona de agarre no tiene botones, así que reclamamos el gesto desde
      // que el dedo toca (no solo al moverse): más confiable en Android.
      onStartShouldSetPanResponder: () => !guardandoRef.current,
      onMoveShouldSetPanResponder: (_e, g) =>
        !guardandoRef.current && g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      // Nadie (ScrollView, Modal) puede robarnos el gesto a mitad de arrastre.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 90 || g.vy > 0.5) {
          cerrarDeslizando();
        } else {
          // No alcanzó el umbral: la tarjeta rebota a su lugar.
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  function limpiarError(campo: string) {
    setErrores(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  const cargar = useCallback(
    (refresco = false) => {
      refresco ? setRefrescando(true) : setCargando(true);
      Promise.all([getProductos(token, { porPagina: 100 }), getTiposProducto(token)])
        .then(([ps, ts]) => {
          setProductos(ps);
          setTipos(ts);
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
    dragY.setValue(0);
    setEditando(null);
    setNombre('');
    setDescripcion('');
    setPrecio('');
    setUnidad('cantidad');
    setTipoId(null);
    setAtributos([]);
    setAtributosIniciales([]);
    setImagenUri(null);
    setDisponible(true);
    setErrores({});
    setModal(true);
  }

  function abrirEditar(p: Producto) {
    dragY.setValue(0);
    setEditando(p);
    setNombre(p.nombre);
    setDescripcion(p.descripcion ?? '');
    setPrecio(String(Math.round(p.precio)));
    setUnidad(unidadDesdeProducto(p));
    setTipoId(p.tipo_producto?.id ?? null);
    setAtributos(p.atributos ?? []);
    setAtributosIniciales(p.atributos ?? []);
    setImagenUri(null);
    setDisponible(p.disponible);
    setErrores({});
    setModal(true);
  }

  async function guardar() {
    setErrores({});
    if (!tipoId) {
      setErrores({ tipo_producto: 'Selecciona el tipo de producto.' });
      return;
    }
    if (!nombre.trim()) {
      setErrores({ nombre: 'El campo nombre es obligatorio.' });
      return;
    }
    // Solo dígitos: en pesos colombianos, sin puntos ni comas.
    if (!/^\d+$/.test(precio)) {
      setErrores({ precio: 'Ingresa el precio en pesos, sin puntos ni comas. Ej: 12000' });
      return;
    }
    const precioNum = Number(precio);
    const u = UNIDADES.find(x => x.value === unidad)!;
    // Atributos limpios: sin espacios sobrantes, vacíos ni repetidos.
    const atributosLimpios = [...new Set(atributos.map(a => a.trim()).filter(Boolean))];
    setGuardando(true);
    try {
      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        precio: precioNum,
        tipo_venta: u.tipo_venta,
        unidad_medida: u.unidad_medida,
        tipo_producto_id: tipoId,
        // null (y no []) para que también se limpien al subir con imagen.
        atributos: atributosLimpios.length ? atributosLimpios : null,
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
      const campos = fieldErrorsFromError(e, { tipo_producto_id: 'tipo_producto' });
      if (Object.keys(campos).length > 0) {
        setErrores(campos);
      } else {
        toast.error('No se pudo guardar', messageFromError(e, 'Error'));
      }
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
    return <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  // Tipo global elegido: define qué sección de atributos muestra el formulario.
  const tipoSeleccionado = tipos.find(t => t.id === tipoId) ?? null;

  return (
    <View style={styles.container}>
      <FlatList
        data={productos}
        keyExtractor={p => String(p.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={() => cargar(true)} colors={[c.accent]} tintColor={c.accent} />
        }
        ListHeaderComponent={
          <PressableScale style={styles.nuevoBtn} onPress={abrirNuevo}>
            <Text style={styles.nuevoTxt}>+ Añadir producto</Text>
          </PressableScale>
        }
        ListEmptyComponent={
          <Text style={styles.vacio}>
            {'Aún no tienes productos.\nToca "+ Añadir producto" para crear el primero.'}
          </Text>
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 8) * 40}>
            <TouchableOpacity style={styles.item} onPress={() => abrirEditar(item)}>
              <View style={styles.thumb}>
                {item.imagen ? (
                  <Image source={{ uri: imagenUrl(item.imagen) }} style={styles.thumbImg} resizeMode="cover" />
                ) : (
                  <Icon name="caja" size={22} color={c.muted} />
                )}
              </View>
              <View style={styles.itemTexto}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                {item.tipo_producto && <Text style={styles.tipo}>{item.tipo_producto.nombre}</Text>}
                <Text style={styles.precio}>{item.precio_formateado ?? precioCOP(item.precio)}</Text>
              </View>
              <View style={styles.acciones}>
                <Text style={[styles.estado, item.disponible ? styles.disp : styles.oculto]}>
                  {item.disponible ? 'Disponible' : 'Oculto'}
                </Text>
                <TouchableOpacity onPress={() => onEliminar(item)} hitSlop={8}>
                  <Icon name="basura" size={18} color={c.danger} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </FadeInView>
        )}
      />

      {/* Formulario crear/editar */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalFondo}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[styles.modalCard, { transform: [{ translateY: dragY }] }]}>
            {/* Barra de agarre: arrastrar hacia abajo cierra el formulario. */}
            <View style={styles.dragZona} {...panResponder.panHandlers}>
              <View style={styles.dragHandle} />
              <Text style={styles.modalTitulo}>{editando ? 'Editar producto' : 'Nuevo producto'}</Text>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Tipo de producto *</Text>
              <Dropdown
                valor={tipoId == null ? null : String(tipoId)}
                opciones={tipos.map(t => ({ label: t.nombre, value: String(t.id) }))}
                onChange={v => {
                  setTipoId(Number(v));
                  // Al cambiar de tipo, los atributos anteriores ya no aplican.
                  setAtributos([]);
                  setAtributosIniciales([]);
                  limpiarError('tipo_producto');
                }}
                placeholder="¿Qué vas a vender?"
                disabled={guardando}
              />
              <FieldError mensaje={errores.tipo_producto} />

              <SelectorImagen
                label="Foto del producto"
                uri={imagenUri ?? imagenUrl(editando?.imagen)}
                onSelect={uri => {
                  setImagenUri(uri);
                  limpiarError('imagen');
                }}
                disabled={guardando}
              />
              <FieldError mensaje={errores.imagen} />

              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={valor => {
                  setNombre(valor);
                  limpiarError('nombre');
                }}
                placeholder="Ej: Arroz con pollo"
                placeholderTextColor={c.mutedSoft}
                editable={!guardando}
              />
              <FieldError mensaje={errores.nombre} />

              <Text style={styles.label}>Descripción</Text>
              <TextInput
                style={[styles.input, styles.area]}
                value={descripcion}
                onChangeText={valor => {
                  setDescripcion(valor);
                  limpiarError('descripcion');
                }}
                placeholder="Opcional"
                placeholderTextColor={c.mutedSoft}
                multiline
                editable={!guardando}
              />
              <FieldError mensaje={errores.descripcion} />

              {tipoSeleccionado && (
                <>
                  <ListaAtributos
                    key={`${editando?.id ?? 'nuevo'}-${tipoSeleccionado.id}`}
                    label={tipoSeleccionado.atributo_label}
                    textoBoton={tipoSeleccionado.atributo_boton}
                    sugerencias={tipoSeleccionado.sugerencias}
                    iniciales={atributosIniciales}
                    onChange={setAtributos}
                    disabled={guardando}
                  />
                  <FieldError mensaje={errores.atributos} />
                </>
              )}

              <Text style={styles.label}>Precio (COP) *</Text>
              <Text style={styles.ayudaCampo}>
                En pesos colombianos, sin puntos ni comas. Ej: 12000
              </Text>
              <TextInput
                style={styles.input}
                value={precio}
                onChangeText={valor => {
                  // Solo dígitos: se descartan puntos, comas y letras.
                  setPrecio(valor.replace(/[^0-9]/g, ''));
                  limpiarError('precio');
                }}
                placeholder="12000"
                placeholderTextColor={c.mutedSoft}
                keyboardType="number-pad"
                editable={!guardando}
              />
              <FieldError mensaje={errores.precio} />

              <Text style={styles.label}>Unidad de venta</Text>
              <Dropdown<UnidadKey>
                valor={unidad}
                opciones={UNIDADES.map(u => ({ label: u.label, value: u.value }))}
                onChange={setUnidad}
                disabled={guardando}
              />

              <View style={styles.switchRow}>
                <Text style={styles.label}>Disponible</Text>
                <Switch
                  value={disponible}
                  onValueChange={setDisponible}
                  disabled={guardando}
                  trackColor={{ true: c.accent, false: '#D8D0C4' }}
                  thumbColor={c.surface}
                />
              </View>

              <PressableScale
                style={[styles.boton, guardando && { opacity: 0.7 }]}
                onPress={guardar}
                disabled={guardando}>
                {guardando ? (
                  <ActivityIndicator color={c.onBrand} />
                ) : (
                  <Text style={styles.botonTxt}>{editando ? 'Guardar cambios' : 'Crear producto'}</Text>
                )}
              </PressableScale>
              <TouchableOpacity onPress={() => setModal(false)} disabled={guardando}>
                <Text style={styles.cancelar}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  nuevoBtn: {
    backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginBottom: 14, ...shadow.soft,
  },
  nuevoTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: c.surface, borderRadius: radius.md, padding: 12, marginBottom: 10, ...shadow.low,
  },
  thumb: {
    width: 52, height: 52, borderRadius: radius.sm, backgroundColor: c.surface2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12,
  },
  thumbImg: { width: '100%', height: '100%' },
  itemTexto: { flex: 1 },
  nombre: { fontSize: 15, fontFamily: font.semibold, color: c.textStrong },
  tipo: { fontSize: 12, color: c.mutedSoft, marginTop: 2, fontFamily: font.regular },
  precio: { color: c.goldText, marginTop: 4, fontFamily: font.bold },
  acciones: { alignItems: 'flex-end', gap: 8, marginLeft: 8 },
  estado: {
    fontSize: 11, fontFamily: font.bold, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.pill, overflow: 'hidden',
  },
  disp: { backgroundColor: c.successSoft, color: c.success },
  oculto: { backgroundColor: c.surface2, color: c.muted },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 40, lineHeight: 20, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 20, fontFamily: font.medium },
  // Modal
  // Sin scrim: el fondo de la app queda visible tal cual detrás de la tarjeta.
  modalFondo: { flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: c.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: 20, maxHeight: '90%', ...shadow.soft,
  },
  // Zona de agarre generosa (incluye el título) para iniciar el gesto fácil.
  dragZona: { paddingTop: 6, paddingBottom: 6, marginTop: -20, marginHorizontal: -20, paddingHorizontal: 20 },
  dragHandle: {
    alignSelf: 'center', width: 44, height: 5, borderRadius: radius.pill,
    backgroundColor: c.borderStrong, marginTop: 8, marginBottom: 12,
  },
  modalTitulo: { fontSize: 18, fontFamily: font.display, color: c.textStrong, marginBottom: 16 },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  ayudaCampo: { fontSize: 12, color: c.muted, fontFamily: font.regular, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, marginBottom: 14, color: c.textStrong, fontFamily: font.regular,
  },
  area: { minHeight: 70, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 10 },
  boton: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 6, ...shadow.soft },
  botonTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 16 },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14, marginBottom: 4 },
});
