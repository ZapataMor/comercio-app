import FotosDireccion, { fotosCompletas } from './FotosDireccion';
import { FotosDireccion as Fotos } from '../api';
import { campoDireccionValido, limpiarCampoDireccion, limpiarTextoDireccion, textoDireccionValido } from '../direccion';
import CamposDireccion from '../components/CamposDireccion';
import { normalizarDireccion } from '../direccion';
import { direccionValida, errorDireccion } from '../direccion';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ClienteDireccion, Coordenadas, crearClienteDireccion, editarClienteDireccion } from '../api';
import { useAuth } from '../AuthContext';
import { fieldErrorsFromError, messageFromError, FieldErrors } from '../formErrors';
import { font, makeStyles, radius, useTheme } from '../theme';
import BarrioSelect from './BarrioSelect';
import FieldError from './FieldError';
import SelectorUbicacion from './SelectorUbicacion';

export default function EditarDireccion({ direccion, onCerrar, onGuardada }: {
  direccion: ClienteDireccion | null; onCerrar: () => void; onGuardada: (d: ClienteDireccion) => void;
}) {
  const { auth, actualizarUsuario } = useAuth();
  const { c } = useTheme();
  const styles = useStyles();
  const [fotos, setFotos] = useState<Fotos>(direccion?.fotos ?? {});
  const [nombre, setNombre] = useState(direccion?.nombre ?? '');
  const [calle, setCalle] = useState(direccion?.direccion ?? '');
  const [barrio, setBarrio] = useState(direccion?.barrio ?? '');
  const [punto, setPunto] = useState<Coordenadas | null>(
    direccion?.lat != null && direccion?.lng != null ? { lat: direccion.lat, lng: direccion.lng } : null,
  );
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  async function guardar() {
    if (!auth || guardando) return;
    const campos: FieldErrors = {};
    if (!direccionValida(calle)) campos.direccion = errorDireccion;
    if (!campoDireccionValido(barrio)) campos.barrio = 'Elige o escribe el barrio.';
    if (nombre.trim() && !textoDireccionValido(nombre.trim())) campos.nombre = errorDireccion;
    if (!punto) campos.lat = 'Marca tu casa en el mapa o usa tu ubicación actual.';
    if (!fotosCompletas(fotos)) campos.fotos = 'Añade las tres fotos de referencia.';
    setErrores(campos); setError('');
    if (Object.keys(campos).length) return;
    setGuardando(true);
    try {
      const body = {
        nombre: nombre.trim() || null, direccion: normalizarDireccion(calle), barrio: barrio.trim(),
        lat: punto?.lat ?? null, lng: punto?.lng ?? null, fotos,
      };
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
      <TextInput style={styles.input} value={nombre} onChangeText={v => setNombre(limpiarTextoDireccion(v))} maxLength={80} placeholder="Mi casa, Mi trabajo…" placeholderTextColor={c.muted} editable={!guardando} />
      <Text style={styles.ayuda}>Solo tú verás este nombre.</Text>
      <FieldError mensaje={errores.nombre} />
      <Text style={styles.label}>Dirección</Text>
      <CamposDireccion value={calle} onChangeText={setCalle} editable={!guardando} />
      <FieldError mensaje={errores.direccion} />
      <Text style={styles.label}>Barrio</Text>
      <BarrioSelect disabled={guardando} valor={barrio} onSeleccionar={v => setBarrio(limpiarCampoDireccion(v))} />
      <FieldError mensaje={errores.barrio} />
      <View style={styles.mapa}><SelectorUbicacion tipo="entrega" valor={punto} onCambiar={setPunto} disabled={guardando} /></View>
      <FieldError mensaje={errores.lat ?? errores.lng} />
      <FotosDireccion fotos={fotos} onChange={setFotos} token={auth!.token} disabled={guardando} />
      <FieldError mensaje={errores.fotos ?? errores.foto_frente ?? errores.foto_izquierda ?? errores.foto_derecha} />
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
  mapa: { marginTop: 8 },
}));
