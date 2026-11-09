import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  eliminarServicio,
  getServicios,
  guardarServicio,
  imagenUrl,
  Servicio,
} from '../api';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { useConfirmar } from './Confirmacion';
import {
  FieldErrors,
  fieldErrorsFromError,
  messageFromError,
} from '../formErrors';
import FieldError from './FieldError';
import SelectorImagen from './SelectorImagen';

export default function CatalogoServicios({
  token,
  negocioId,
}: {
  token: string;
  negocioId: number;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Servicio | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [disponible, setDisponible] = useState(true);
  const [duracion, setDuracion] = useState('30');
  const [precio, setPrecio] = useState('');
  const [permiteCitas, setPermiteCitas] = useState(true);
  const [galeria, setGaleria] = useState<string[]>([]);
  const [nuevasImagenes, setNuevasImagenes] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<FieldErrors>({});
  const cargar = useCallback(() => {
    setError('');
    setCargando(true);
    getServicios(token, negocioId)
      .then(setServicios)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, [token, negocioId]);
  useEffect(cargar, [cargar]);
  function abrir(servicio: Servicio | null) {
    setEditando(servicio);
    setNombre(servicio?.nombre ?? '');
    setDescripcion(servicio?.descripcion ?? '');
    setDisponible(servicio?.disponible ?? true);
    setDuracion(String(servicio?.duracion_minutos ?? 30));
    setPrecio(servicio?.precio != null ? String(servicio.precio) : '');
    setPermiteCitas(servicio?.permite_citas ?? true);
    setGaleria(servicio?.galeria ?? []);
    setNuevasImagenes([]);
    setErrores({});
    setModal(true);
  }
  async function guardar() {
    if (guardando) return;
    const campos: FieldErrors = {};
    if (!nombre.trim()) campos.nombre = 'Escribe el nombre del servicio.';
    if (!descripcion.trim())
      campos.descripcion = 'Describe el servicio que ofreces.';
    setErrores(campos);
    if (!/^\d+$/.test(duracion) || Number(duracion) < 5 || Number(duracion) > 480) campos.duracion_minutos = 'Indica una duración de 5 a 480 minutos.';
    if (precio && (!/^\d+$/.test(precio) || Number(precio) > 100000000)) campos.precio = 'Escribe el precio en pesos, sin puntos ni comas.';
    if (Object.keys(campos).length) return;
    setGuardando(true);
    try {
      const servicio = await guardarServicio(
        token,
        negocioId,
        { nombre: nombre.trim(), descripcion: descripcion.trim(), disponible, duracion_minutos: Number(duracion), precio: precio ? Number(precio) : null, permite_citas: permiteCitas, galeria },
        editando?.id,
        nuevasImagenes,
      );
      setServicios(prev =>
        [...prev.filter(s => s.id !== servicio.id), servicio].sort((a, b) =>
          a.nombre.localeCompare(b.nombre),
        ),
      );
      setModal(false);
      toast.exito('Servicio guardado');
    } catch (e) {
      setErrores(fieldErrorsFromError(e));
      toast.error(
        'No se pudo guardar',
        messageFromError(e, 'Intenta de nuevo.'),
      );
    } finally {
      setGuardando(false);
    }
  }
  function eliminar(servicio: Servicio) {
    confirmar({
      icono: 'basura',
      titulo: '¿Eliminar este servicio?',
      texto: servicio.nombre,
      textoBoton: 'Eliminar servicio',
      peligro: true,
      accion: async () => {
        try {
          await eliminarServicio(token, negocioId, servicio.id);
          setServicios(prev => prev.filter(s => s.id !== servicio.id));
        } catch (e) {
          toast.error(
            'No se pudo eliminar',
            messageFromError(e, 'Intenta de nuevo.'),
          );
        }
      },
    });
  }
  return (
    <View>
      <View style={styles.botones}>
        <TouchableOpacity style={styles.boton} onPress={() => abrir(null)}>
          <Text style={styles.botonTexto}>+ Añadir servicios</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.titulo}>Servicios</Text>
      {cargando ? (
        <ActivityIndicator color={c.accent} />
      ) : error ? (
        <TouchableOpacity onPress={cargar}>
          <Text style={styles.error}>{error} · Reintentar</Text>
        </TouchableOpacity>
      ) : servicios.length === 0 ? (
        <Text style={styles.detalle}>
          Aún no tienes servicios. Añade el primero para que los clientes lo
          encuentren.
        </Text>
      ) : (
        servicios.map(servicio => (
          <View key={servicio.id} style={styles.tarjeta}>
            <TouchableOpacity
              accessibilityLabel={`Editar ${servicio.nombre}`}
              onPress={() => abrir(servicio)}
            >
              {!!servicio.galeria?.[0] && <Image source={{ uri: imagenUrl(servicio.galeria[0])! }} style={styles.fotoServicio} resizeMode="cover" />}
              <Text style={styles.nombre}>{servicio.nombre}</Text>
              <Text style={styles.nombre}>{servicio.precio == null ? 'Consultar precio' : `$${servicio.precio.toLocaleString('es-CO')}`}</Text>
              <Text style={styles.detalle}>{servicio.duracion_minutos ?? 30} min</Text>
              <Text style={styles.detalle}>{servicio.descripcion}</Text>
              <Text style={styles.detalle}>
                {servicio.disponible ? 'Visible para clientes' : 'Oculto'} ·
                Toca para editar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={`Eliminar ${servicio.nombre}`}
              onPress={() => eliminar(servicio)}
            >
              <Text style={styles.error}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
      <Modal
        visible={modal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!guardando) setModal(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.fondo}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.formulario}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.titulo}>
              {editando ? 'Editar servicio' : 'Añadir servicio'}
            </Text>
            <Text style={styles.nombre}>Nombre *</Text>
            <TextInput
              accessibilityLabel="Nombre del servicio"
              style={styles.input}
              value={nombre}
              onChangeText={setNombre}
              maxLength={150}
              editable={!guardando}
              placeholder="Ej. Reparación de lavadoras"
              placeholderTextColor={c.muted}
            />
            <FieldError mensaje={errores.nombre} />
            <Text style={styles.nombre}>Descripción *</Text>
            <TextInput
              accessibilityLabel="Descripción del servicio"
              style={[styles.input, styles.descripcion]}
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              maxLength={5000}
              editable={!guardando}
              placeholder="Explica en qué consiste y cómo puedes ayudar al cliente"
              placeholderTextColor={c.muted}
            />
            <FieldError mensaje={errores.descripcion} />
            <Text style={styles.nombre}>Duración del servicio (minutos) *</Text>
            <TextInput accessibilityLabel="Duración del servicio" style={styles.input} value={duracion} onChangeText={setDuracion} keyboardType="number-pad" editable={!guardando} />
            <FieldError mensaje={errores.duracion_minutos} />
            <Text style={styles.nombre}>Precio en pesos (opcional)</Text>
            <TextInput accessibilityLabel="Precio del servicio" style={styles.input} value={precio} onChangeText={setPrecio} keyboardType="number-pad" editable={!guardando} placeholder="Consultar precio" placeholderTextColor={c.muted} />
            <FieldError mensaje={errores.precio} />
            <View style={styles.botones}>
              <Text style={styles.nombre}>Permitir citas para este servicio</Text>
              <Switch accessibilityLabel="Permitir citas" value={permiteCitas} onValueChange={setPermiteCitas} disabled={guardando} />
            </View>
            <Text style={styles.detalle}>Muestra tus trabajos: diseños de uñas, cortes, peinados y otros resultados. Hasta 8 fotografías.</Text>
            <View style={styles.botones}>
              {[...galeria, ...nuevasImagenes].map((uri, i) => <View key={`${uri}-${i}`}>
                <Image source={{ uri: i < galeria.length ? imagenUrl(uri)! : uri }} style={{ width: 84, height: 84, borderRadius: 8 }} />
                <TouchableOpacity disabled={guardando} accessibilityLabel={`Quitar fotografía ${i + 1}`} onPress={() => i < galeria.length ? setGaleria(prev => prev.filter((_, j) => i !== j)) : setNuevasImagenes(prev => prev.filter((_, j) => i - galeria.length !== j))}>
                  <Text style={styles.error}>Quitar</Text>
                </TouchableOpacity>
              </View>)}
            </View>
            {galeria.length + nuevasImagenes.length < 8 && <SelectorImagen label="Añadir fotografía del trabajo" disabled={guardando} onSelect={uri => setNuevasImagenes(prev => [...prev, uri].slice(0, 8 - galeria.length))} />}
            <FieldError mensaje={errores.imagenes} />
            <View style={styles.botones}>
              <Text style={styles.nombre}>Visible para clientes</Text>
              <Switch
                accessibilityLabel="Servicio visible para clientes"
                value={disponible}
                onValueChange={setDisponible}
                disabled={guardando}
              />
            </View>
            <TouchableOpacity
              style={styles.boton}
              disabled={guardando}
              onPress={guardar}
            >
              {guardando ? (
                <ActivityIndicator color={c.onBrand} />
              ) : (
                <Text style={styles.botonTexto}>Guardar servicio</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelar}
              disabled={guardando}
              onPress={() => setModal(false)}
            >
              <Text style={styles.nombre}>Cancelar</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
const useStyles = makeStyles(c => ({
  botones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    marginVertical: 12,
  },
  boton: {
    backgroundColor: c.accent,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  botonTexto: { color: c.onBrand, fontFamily: font.semibold },
  titulo: {
    color: c.textStrong,
    fontSize: 20,
    fontFamily: font.semibold,
    marginVertical: 16,
  },
  nombre: { color: c.textStrong, fontSize: 15, fontFamily: font.semibold },
  detalle: { color: c.muted, fontSize: 14, lineHeight: 21, marginVertical: 6 },
  tarjeta: {
    backgroundColor: c.surface2,
    padding: 16,
    borderRadius: radius.md,
    marginBottom: 10,
    gap: 8,
  },
  fotoServicio: { width: '100%', aspectRatio: 2, borderRadius: radius.md, marginBottom: 10 },
  error: { color: c.danger, paddingVertical: 8 },
  fondo: {
    flex: 1,
    backgroundColor: '#0008',
    justifyContent: 'center',
    padding: 20,
  },
  formulario: {
    flexGrow: 0,
    backgroundColor: c.bg,
    borderRadius: radius.md,
    padding: 20,
    maxHeight: '90%',
  },
  input: {
    color: c.text,
    borderColor: c.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 12,
    marginVertical: 10,
  },
  descripcion: { minHeight: 110, textAlignVertical: 'top' },
  cancelar: { alignItems: 'center', padding: 20, marginBottom: 20 },
}));
