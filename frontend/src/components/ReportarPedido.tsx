import React, { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ObjetivoReporte, reportarPedido } from '../api';
import { useAuth } from '../AuthContext';
import { messageFromError } from '../formErrors';
import { font, makeStyles, radius } from '../theme';
import { useToast } from '../Toast';

const etiquetas = { cliente: 'Cliente', negocio: 'Comercio', domiciliario: 'Domiciliario' };
/** `discreto`: enlace tenue, para el pie de una tarjeta con otras acciones. */
export default function ReportarPedido({ id, objetivos, discreto }: { id: number; objetivos: ObjetivoReporte[]; discreto?: boolean }) {
  const { auth } = useAuth();
  const toast = useToast();
  const styles = useStyles();
  const [visible, setVisible] = useState(false);
  const [objetivo, setObjetivo] = useState(objetivos[0]);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  async function enviar() {
    if (!auth || enviando || motivo.trim().length < 5) return;
    setEnviando(true);
    try { await reportarPedido(auth.token, id, objetivo, motivo.trim()); setVisible(false); toast.exito('Reporte recibido', 'El administrador revisará lo ocurrido.'); }
    catch (e) { setError(messageFromError(e)); }
    finally { setEnviando(false); }
  }
  return <>
    <TouchableOpacity onPress={() => { setVisible(true); setMotivo(''); setError(''); }}><Text style={[styles.enlace, discreto && styles.enlaceDiscreto]}>Reportar un incumplimiento</Text></TouchableOpacity>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!enviando) setVisible(false); }}>
      <View style={styles.fondo}><View style={styles.caja}>
        <Text style={styles.titulo}>Reportar un incumplimiento</Text>
        <Text style={styles.texto}>El administrador recibirá tu explicación junto con los datos de este pedido.</Text>
        <View style={styles.fila}>{objetivos.map(o => <TouchableOpacity key={o} disabled={enviando} onPress={() => setObjetivo(o)} style={styles.opcion}><Text style={objetivo === o ? styles.elegido : styles.texto}>{etiquetas[o]}</Text></TouchableOpacity>)}</View>
        <TextInput accessibilityLabel="Motivo del reporte" style={styles.input} multiline value={motivo} onChangeText={setMotivo} maxLength={1000} placeholder="Explica lo que ocurrió" editable={!enviando} />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.boton} disabled={enviando || motivo.trim().length < 5} onPress={enviar}><Text style={styles.botonTexto}>{enviando ? 'Enviando…' : 'Enviar reporte'}</Text></TouchableOpacity>
        <TouchableOpacity disabled={enviando} onPress={() => setVisible(false)}><Text style={styles.enlace}>Volver</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </>;
}
const useStyles = makeStyles(c => ({
  enlace: { color: c.goldText, fontFamily: font.semibold, textAlign: 'center', padding: 14 },
  enlaceDiscreto: { color: c.muted, fontFamily: font.medium, fontSize: 13 },
  fondo: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  caja: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 22 },
  titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 18, marginBottom: 12 },
  texto: { color: c.text, fontFamily: font.regular, lineHeight: 21 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginVertical: 10 },
  opcion: { padding: 8, borderWidth: 1, borderColor: c.border, borderRadius: radius.md },
  elegido: { color: c.goldText, fontFamily: font.bold },
  input: { minHeight: 90, color: c.text, borderWidth: 1, borderColor: c.border, padding: 12, borderRadius: radius.md, textAlignVertical: 'top', marginBottom: 12 },
  error: { color: c.danger, marginBottom: 8 },
  boton: { backgroundColor: c.accent, padding: 14, borderRadius: radius.md },
  botonTexto: { color: c.onAccent, fontFamily: font.bold, textAlign: 'center' },
}));
