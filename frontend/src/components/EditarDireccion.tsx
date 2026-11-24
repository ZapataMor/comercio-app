import FotosDireccion, { fotosCompletas } from './FotosDireccion';
import { FotosDireccion as Fotos } from '../api';
import { barrioValido, limpiarBarrio, limpiarIndicaciones, limpiarTextoDireccion, MAX_INDICACIONES, textoDireccionValido } from '../direccion';
import CamposDireccion from '../components/CamposDireccion';
import { normalizarDireccion } from '../direccion';
import { direccionValida, errorDireccion } from '../direccion';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity } from 'react-native';
import { ClienteDireccion, Coordenadas, crearClienteDireccion, editarClienteDireccion } from '../api';
import { useAuth } from '../AuthContext';
import { fieldErrorsFromError, messageFromError, FieldErrors } from '../formErrors';
import { font, makeStyles, radius, useTheme } from '../theme';
import BarrioSelect from './BarrioSelect';
import FieldError from './FieldError';
import SelectorUbicacion from './SelectorUbicacion';
import { EspacioTecladoModal } from './EspacioTeclado';
import { DesplazableTutorial, Objetivo, PantallaTutorial, useDesplazableTutorial } from '../tutorial/Objetivo';

export default function EditarDireccion({ direccion, onCerrar, onGuardada }: {
  direccion: ClienteDireccion | null; onCerrar: () => void; onGuardada: (d: ClienteDireccion) => void;
}) {
  const { auth, actualizarUsuario } = useAuth();
  const { c } = useTheme();
  // El tutorial baja hasta el mapa, las fotos y el botón de guardar.
  const tutorialScroll = useDesplazableTutorial();
  const styles = useStyles();
  const [fotos, setFotos] = useState<Fotos>(direccion?.fotos ?? {});
  const [nombre, setNombre] = useState(direccion?.nombre ?? '');
  const [calle, setCalle] = useState(direccion?.direccion ?? '');
  const [barrio, setBarrio] = useState(direccion?.barrio ?? '');
  const [indicaciones, setIndicaciones] = useState(direccion?.indicaciones ?? '');
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
    if (!barrioValido(barrio)) campos.barrio = 'Elige o escribe el barrio.';
    if (nombre.trim() && !textoDireccionValido(nombre.trim())) campos.nombre = errorDireccion;
    if (!punto) campos.lat = 'Marca tu casa en el mapa o usa tu ubicación actual.';
    if (!fotosCompletas(fotos)) campos.fotos = 'Añade las tres fotos de referencia.';
    setErrores(campos); setError('');
    if (Object.keys(campos).length) return;
    setGuardando(true);
    try {
      const body = {
        nombre: nombre.trim() || null, direccion: normalizarDireccion(calle), barrio: barrio.trim(),
        indicaciones: indicaciones.trim() || null,
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
    {/* Un modal tapa la capa del tutorial de la app: este trae la suya. */}
    <PantallaTutorial nombre="EditarDireccion" style={styles.raiz}>
    <DesplazableTutorial value={tutorialScroll.valor}>
    <EspacioTecladoModal style={styles.fondo}><ScrollView ref={tutorialScroll.scrollRef} onScroll={tutorialScroll.onScroll} scrollEventThrottle={32} style={styles.caja} contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
      <Text style={styles.titulo}>{direccion ? 'Editar dirección' : 'Agregar dirección'}</Text>
      <Text style={styles.label}>Nombre (opcional)</Text>
      <Objetivo id="direccion.nombre">
        <TextInput style={styles.input} value={nombre} onChangeText={v => setNombre(limpiarTextoDireccion(v))} maxLength={80} placeholder="Mi casa, Mi trabajo…" placeholderTextColor={c.muted} editable={!guardando} />
      </Objetivo>
      <Text style={styles.ayuda}>Solo tú verás este nombre.</Text>
      <FieldError mensaje={errores.nombre} />
      <Text style={styles.label}>Dirección</Text>
      <Objetivo id="direccion.campos"><CamposDireccion value={calle} onChangeText={setCalle} editable={!guardando} /></Objetivo>
      <FieldError mensaje={errores.direccion} />
      <Text style={styles.label}>Barrio</Text>
      <Objetivo id="direccion.barrio"><BarrioSelect disabled={guardando} valor={barrio} onSeleccionar={v => setBarrio(limpiarBarrio(v))} /></Objetivo>
      <FieldError mensaje={errores.barrio} />
      <Text style={styles.label}>Indicaciones para llegar (opcional)</Text>
      <TextInput
        style={[styles.input, styles.indicaciones]}
        value={indicaciones}
        onChangeText={v => setIndicaciones(limpiarIndicaciones(v))}
        maxLength={MAX_INDICACIONES}
        multiline
        placeholder="Ej.: frente a la tienda La 14, casa azul de rejas blancas"
        placeholderTextColor={c.muted}
        editable={!guardando}
      />
      <Text style={styles.ayuda}>Lo verá el domiciliario. Sirve mucho si tu casa no tiene número.</Text>
      <FieldError mensaje={errores.indicaciones} />
      <Objetivo id="direccion.mapa" style={styles.mapa}><SelectorUbicacion tipo="entrega" valor={punto} onCambiar={setPunto} disabled={guardando} barrio={barrio} /></Objetivo>
      <FieldError mensaje={errores.lat ?? errores.lng} />
      <Objetivo id="direccion.fotos"><FotosDireccion fotos={fotos} onChange={setFotos} token={auth!.token} disabled={guardando} /></Objetivo>
      <FieldError mensaje={errores.fotos ?? errores.foto_frente ?? errores.foto_izquierda ?? errores.foto_derecha} />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Objetivo id="direccion.guardar">
        <TouchableOpacity style={styles.boton} disabled={guardando} onPress={guardar}>
          {guardando ? <ActivityIndicator color={c.onAccent} /> : <Text style={styles.botonTexto}>Guardar dirección</Text>}
        </TouchableOpacity>
      </Objetivo>
      <TouchableOpacity disabled={guardando} onPress={onCerrar}><Text style={styles.enlace}>Cancelar</Text></TouchableOpacity>
    </ScrollView></EspacioTecladoModal>
    </DesplazableTutorial>
    </PantallaTutorial>
  </Modal>;
}
const useStyles = makeStyles(c => ({
  raiz: { flex: 1 },
  fondo: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 },
  caja: { flexGrow: 0, maxHeight: '90%', borderRadius: radius.lg, backgroundColor: c.bg },
  contenido: { padding: 20, gap: 8 }, titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 22 },
  label: { color: c.text, fontFamily: font.semibold, fontSize: 14, marginTop: 8 },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  indicaciones: { minHeight: 72, textAlignVertical: 'top' },
  input: { color: c.textStrong, fontFamily: font.regular, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, padding: 12 },
  boton: { backgroundColor: c.accent, borderRadius: radius.md, alignItems: 'center', padding: 14, marginTop: 12 },
  botonTexto: { color: c.onAccent, fontFamily: font.bold },
  enlace: { color: c.accent, fontFamily: font.semibold, paddingVertical: 12 },
  error: { color: c.danger, fontFamily: font.regular },
  mapa: { marginTop: 8 },
}));
