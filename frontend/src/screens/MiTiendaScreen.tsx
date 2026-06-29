import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { imagenUrl, Negocio } from '../api';
import SelectorImagen from '../components/SelectorImagen';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'MiTienda'>;

export default function MiTiendaScreen({ navigation }: Props) {
  const { negocio, cargando, guardar } = useNegocio();
  const toast = useToast();

  // 'ver' = tarjeta de solo lectura · 'editar' = formulario.
  const [modo, setModo] = useState<'ver' | 'editar'>('ver');
  const [guardando, setGuardando] = useState(false);

  // Campos del formulario.
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [activo, setActivo] = useState(true);
  // URI local de una imagen recién elegida (sin subir aún). null = sin cambios.
  const [imagenUri, setImagenUri] = useState<string | null>(null);

  // Si el comerciante aún no tiene negocio, se entra directo al formulario.
  useEffect(() => {
    if (!cargando && !negocio) {
      setModo('editar');
    }
  }, [cargando, negocio]);

  function empezarEdicion(n: Negocio | null) {
    setNombre(n?.nombre ?? '');
    setDescripcion(n?.descripcion ?? '');
    setDireccion(n?.direccion ?? '');
    setTelefono(n?.telefono ?? '');
    setActivo(n?.activo ?? true);
    setImagenUri(null);
    setModo('editar');
  }

  async function onGuardar() {
    if (!nombre.trim()) {
      toast.error('Falta el nombre', 'El nombre del negocio es obligatorio.');
      return;
    }
    setGuardando(true);
    const eraNuevo = !negocio;
    try {
      await guardar(
        {
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          direccion: direccion.trim() || null,
          telefono: telefono.trim() || null,
          activo,
        },
        imagenUri ?? undefined,
      );
      if (eraNuevo) {
        toast.exito('Negocio creado', 'Ya puedes gestionar tu tienda.');
        navigation.navigate('Home');
      } else {
        toast.exito('Listo', 'Negocio actualizado.');
        setModo('ver');
      }
    } catch (e) {
      toast.error('No se pudo guardar', e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando && !negocio) {
    return <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />;
  }

  // ---------------- Vista de solo lectura (tarjeta) ----------------
  if (modo === 'ver' && negocio) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {!!imagenUrl(negocio.imagen) && (
            <Image source={{ uri: imagenUrl(negocio.imagen) }} style={styles.fotoNegocio} resizeMode="cover" />
          )}
          <View style={styles.cardHead}>
            <Text style={styles.negocioNombre}>{negocio.nombre}</Text>
            <Text style={[styles.estado, negocio.activo ? styles.abierto : styles.cerrado]}>
              {negocio.activo ? 'Abierto' : 'Cerrado'}
            </Text>
          </View>

          <Campo etiqueta="Descripción" valor={negocio.descripcion} />
          <Campo etiqueta="Dirección" valor={negocio.direccion} />
          <Campo etiqueta="Teléfono" valor={negocio.telefono} />
        </View>

        <TouchableOpacity style={styles.boton} onPress={() => empezarEdicion(negocio)}>
          <Text style={styles.botonTexto}>Editar información</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ---------------- Formulario (crear / editar) ----------------
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!negocio && (
          <View style={styles.aviso}>
            <Text style={styles.avisoTxt}>
              Aún no has creado tu negocio. Complétalo para empezar a vender.
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <SelectorImagen
            label="Foto del negocio"
            uri={imagenUri ?? imagenUrl(negocio?.imagen)}
            onSelect={setImagenUri}
            disabled={guardando}
          />

          <Text style={styles.label}>Nombre del negocio *</Text>
          <TextInput
            style={styles.input}
            value={nombre}
            onChangeText={setNombre}
            placeholder="Ej: Panadería La Espiga"
            editable={!guardando}
          />

          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.area]}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="¿Qué vendes?"
            multiline
            editable={!guardando}
          />

          <Text style={styles.label}>Dirección</Text>
          <TextInput
            style={styles.input}
            value={direccion}
            onChangeText={setDireccion}
            placeholder="Calle 12 #8-30, Maicao"
            editable={!guardando}
          />

          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            value={telefono}
            onChangeText={setTelefono}
            placeholder="3001234567"
            keyboardType="phone-pad"
            editable={!guardando}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Negocio abierto</Text>
              <Text style={styles.switchSub}>
                {activo ? 'Visible para los clientes' : 'Oculto: no aparece en Explorar'}
              </Text>
            </View>
            <Switch value={activo} onValueChange={setActivo} disabled={guardando} />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.boton, guardando && styles.botonDisabled]}
          onPress={onGuardar}
          disabled={guardando}>
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonTexto}>{negocio ? 'Guardar cambios' : 'Crear negocio'}</Text>
          )}
        </TouchableOpacity>

        {negocio && (
          <TouchableOpacity onPress={() => setModo('ver')} disabled={guardando}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Fila etiqueta + valor para la tarjeta de solo lectura. */
function Campo({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <View style={styles.campo}>
      <Text style={styles.campoEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.campoValor, !valor && styles.campoVacio]}>{valor || 'Sin especificar'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 20 },
  aviso: { backgroundColor: '#fef9c3', borderRadius: 12, padding: 12, marginBottom: 16 },
  avisoTxt: { color: '#854d0e', fontSize: 13 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  fotoNegocio: { width: '100%', height: 160, borderRadius: 12, marginBottom: 14, backgroundColor: '#f1f5f9' },
  // Tarjeta de solo lectura
  cardHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  negocioNombre: { fontSize: 20, fontWeight: '800', color: '#0f172a', flex: 1, marginRight: 10 },
  estado: {
    fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, overflow: 'hidden',
  },
  abierto: { backgroundColor: '#dcfce7', color: '#15803d' },
  cerrado: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  campo: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingVertical: 10 },
  campoEtiqueta: { fontSize: 12, fontWeight: '600', color: '#94a3b8', marginBottom: 2 },
  campoValor: { fontSize: 15, color: '#0f172a' },
  campoVacio: { color: '#cbd5e1', fontStyle: 'italic' },
  // Formulario
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginBottom: 16, color: '#0f172a',
  },
  area: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  switchSub: { color: '#94a3b8', fontSize: 12, marginTop: 2 },
  boton: {
    backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 20,
  },
  botonDisabled: { opacity: 0.7 },
  botonTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancelar: { textAlign: 'center', color: '#64748b', fontWeight: '600', marginTop: 14 },
});
