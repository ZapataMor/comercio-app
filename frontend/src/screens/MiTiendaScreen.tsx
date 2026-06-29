import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { actualizarNegocio, crearNegocio, getNegocio, Negocio } from '../api';
import { useAuth } from '../AuthContext';

export default function MiTiendaScreen() {
  const { auth } = useAuth();
  const token = auth!.token;

  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Campos del formulario.
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [activo, setActivo] = useState(true);

  function rellenar(n: Negocio | null) {
    setNegocio(n);
    setNombre(n?.nombre ?? '');
    setDescripcion(n?.descripcion ?? '');
    setDireccion(n?.direccion ?? '');
    setTelefono(n?.telefono ?? '');
    setActivo(n?.activo ?? true);
  }

  useEffect(() => {
    getNegocio(token)
      .then(rellenar)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
  }, [token]);

  async function guardar() {
    if (!nombre.trim()) {
      Alert.alert('Falta el nombre', 'El nombre del negocio es obligatorio.');
      return;
    }
    setGuardando(true);
    try {
      const body = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        direccion: direccion.trim() || null,
        telefono: telefono.trim() || null,
        activo,
      };
      const actualizado = negocio
        ? await actualizarNegocio(token, body)
        : await crearNegocio(token, body);
      rellenar(actualizado);
      Alert.alert('Listo', negocio ? 'Negocio actualizado.' : 'Negocio creado.');
    } catch (e) {
      Alert.alert('No se pudo guardar', e instanceof Error ? e.message : 'Error');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />;
  }
  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

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
          onPress={guardar}
          disabled={guardando}>
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botonTexto}>{negocio ? 'Guardar cambios' : 'Crear negocio'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  error: { color: '#b91c1c', backgroundColor: '#fee2e2', padding: 12, borderRadius: 10, margin: 20 },
});
