import React, { useCallback, useEffect, useState } from 'react';
import { useEnVivo } from '../usePolling';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ClienteDireccion, getClienteDirecciones } from '../api';
import { useAuth } from '../AuthContext';
import EditarDireccion from '../components/EditarDireccion';
import { messageFromError } from '../formErrors';
import { font, makeStyles, radius } from '../theme';

export default function MisDireccionesScreen() {
  const { auth } = useAuth();
  const styles = useStyles();
  const [direcciones, setDirecciones] = useState<ClienteDireccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<ClienteDireccion | null | undefined>(undefined);
  const cargar = useCallback(async () => {
    if (!auth) return;
    setCargando(true); setError('');
    try { setDirecciones(await getClienteDirecciones(auth.token)); }
    catch (e) { setError(messageFromError(e)); }
    finally { setCargando(false); }
  }, [auth]);
  useEffect(() => { cargar(); }, [cargar]);
  useEnVivo(['direcciones'], cargar);
  return <>
    <ScrollView style={styles.fondo} contentContainerStyle={styles.contenido}>
      {cargando ? <ActivityIndicator /> : error ? <>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity onPress={cargar}><Text style={styles.enlace}>Reintentar</Text></TouchableOpacity>
      </> : <>
        {!direcciones.length && <Text style={styles.texto}>Aún no tienes direcciones guardadas.</Text>}
        {direcciones.map(d => <View key={d.id} style={styles.card}>
          <Text style={styles.titulo}>{d.nombre || (d.es_principal ? 'Dirección principal' : 'Otra dirección')}</Text>
          <Text style={styles.texto}>{d.direccion} · Barrio {d.barrio}</Text>
          <TouchableOpacity accessibilityLabel={`Editar ${d.nombre || d.direccion}`} onPress={() => setEditando(d)}><Text style={styles.enlace}>Editar dirección</Text></TouchableOpacity>
        </View>)}
      </>}
      <TouchableOpacity onPress={() => setEditando(null)}><Text style={styles.enlace}>+ Agregar dirección</Text></TouchableOpacity>
    </ScrollView>
    {editando !== undefined && <EditarDireccion direccion={editando} onCerrar={() => setEditando(undefined)} onGuardada={d => {
      setDirecciones(prev => prev.some(v => v.id === d.id) ? prev.map(v => v.id === d.id ? d : v) : [...prev, d]);
      setEditando(undefined);
    }} />}
  </>;
}
const useStyles = makeStyles(c => ({
  fondo: { flex: 1, backgroundColor: c.bg }, contenido: { padding: 20, gap: 12 },
  card: { padding: 16, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface },
  titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 17, marginBottom: 6 },
  texto: { color: c.text, fontFamily: font.regular }, enlace: { color: c.accent, fontFamily: font.semibold, paddingVertical: 12 },
  error: { color: c.danger, fontFamily: font.regular },
}));
