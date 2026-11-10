import CamposDireccion from '../components/CamposDireccion';
import { direccionValida, errorDireccion } from '../direccion';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ClienteDireccion, crearClienteDireccion, editarClienteDireccion } from '../api';
import { useAuth } from '../AuthContext';
import { fieldErrorsFromError, messageFromError, FieldErrors } from '../formErrors';
import { font, makeStyles, radius, useTheme } from '../theme';
import BarrioSelect from './BarrioSelect';
import FieldError from './FieldError';

export default function EditarDireccion({ direccion, onCerrar, onGuardada }: {
  direccion: ClienteDireccion | null; onCerrar: () => void; onGuardada: (d: ClienteDireccion) => void;
}) {
  const { auth, actualizarUsuario } = useAuth();
  const { c } = useTheme();
  const styles = useStyles();
  const [nombre, setNombre] = useState(direccion?.nombre ?? '');
  const [calle, setCalle] = useState(direccion?.direccion ?? '');
  const [barrio, setBarrio] = useState(direccion?.barrio ?? '');
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  async function guardar() {
    if (!auth || guardando) return;
    const campos: FieldErrors = {};
    if (!direccionValida(calle)) campos.direccion = errorDireccion;
    if (!barrio.trim()) campos.barrio = 'Elige o escribe el barrio.';
    setErrores(campos); setError('');
    if (Object.keys(campos).length) return;
    setGuardando(true);
    try {
      const body = { nombre: nombre.trim() || null, direccion: calle.trim(), barrio: barrio.trim() };
      const guardada = direccion ? await editarClienteDireccion(auth.token, direccion.id, body)
        : await crearClienteDireccion(auth.token, body);
      if (guardada.es_principal) actualizarUsuario({ ...auth.user, direccion: guardada.direccion, barrio: guardada.barrio });
      onGuardada(guardada);
    } catch (e) {
      setErrores(fieldErrorsFromError(e)); setError(messageFromError(e));
    } finally { setGuardando(false); }
  }
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!guardando) onCerrar(); }}>
    <View style={styles.fondo}><ScrollView style={styles.caja} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
      <Text style={styles.titulo}>{direccion ? 'Editar dirección' : 'Agregar dirección'}</Text>
      <Text style={styles.label}>Nombre (opcional)</Text>
      <TextInput style={styles.input} value={nombre} onChangeText={setNombre} maxLength={80} placeholder="Mi casa, Trabajo…" placeholderTextColor={c.muted} editable={!guardando} />
      <Text style={styles.ayuda}>Solo tú verás este nombre.</Text>
      <FieldError mensaje={errores.nombre} />
      <Text style={styles.label}>Dirección</Text>
      <CamposDireccion value={calle} onChangeText={setCalle} editable={!guardando} />
      <FieldError mensaje={errores.direccion} />
      <Text style={styles.label}>Barrio</Text>
      <BarrioSelect disabled={guardando} valor={barrio} onSeleccionar={setBarrio} />
      <FieldError mensaje={errores.barrio} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.boton} disabled={guardando} onPress={guardar}>
        {guardando ? <ActivityIndicator color={c.onAccent} /> : <Text style={styles.botonTexto}>Guardar dirección</Text>}
      </TouchableOpacity>
      <TouchableOpacity disabled={guardando} onPress={onCerrar}><Text style={styles.enlace}>Cancelar</Text></TouchableOpacity>
    </ScrollView></View>
  </Modal>;
}
const useStyles = makeStyles(c => ({
  fondo: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 },
  caja: { flexGrow: 0, maxHeight: '90%', borderRadius: radius.lg, backgroundColor: c.bg },
  contenido: { padding: 20, gap: 8 }, titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 22 },
  label: { color: c.text, fontFamily: font.semibold, marginTop: 8 },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 12 },
  input: { color: c.textStrong, fontFamily: font.regular, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, padding: 12 },
  boton: { backgroundColor: c.accent, borderRadius: radius.md, alignItems: 'center', padding: 14, marginTop: 12 },
  botonTexto: { color: c.onAccent, fontFamily: font.bold },
  enlace: { color: c.accent, fontFamily: font.semibold, paddingVertical: 12 },
  error: { color: c.danger, fontFamily: font.regular },
}));
