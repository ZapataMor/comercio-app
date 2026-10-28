/**
 * Hoja para cancelar/rechazar un pedido: motivos sugeridos (chips) o uno
 * escrito a mano. El motivo lo ve la otra parte (cliente o negocio).
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { font, makeStyles, radius, useTheme } from '../theme';

type Props = {
  visible: boolean;
  titulo: string;
  explicacion: string;
  motivos: string[];
  textoBoton: string;
  enviando: boolean;
  onCerrar: () => void;
  onConfirmar: (motivo: string) => void;
};

export default function MotivoCancelacion({
  visible, titulo, explicacion, motivos, textoBoton, enviando, onCerrar, onConfirmar,
}: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const [elegido, setElegido] = useState<string | null>(null);
  const [otro, setOtro] = useState('');

  useEffect(() => {
    if (visible) {
      setElegido(null);
      setOtro('');
    }
  }, [visible]);

  const motivo = (elegido ?? otro).trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCerrar}>
      <KeyboardAvoidingView style={styles.fondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.caja}>
          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.texto}>{explicacion}</Text>

          <View style={styles.chips}>
            {motivos.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.chip, elegido === m && styles.chipActivo]}
                onPress={() => {
                  setElegido(elegido === m ? null : m);
                  setOtro('');
                }}
                disabled={enviando}>
                <Text style={[styles.chipTxt, elegido === m && styles.chipTxtActivo]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={otro}
            onChangeText={v => {
              setOtro(v);
              setElegido(null);
            }}
            placeholder="Otro motivo (opcional)"
            placeholderTextColor={c.mutedSoft}
            maxLength={255}
            editable={!enviando}
          />

          <TouchableOpacity
            style={[styles.boton, enviando && styles.botonDeshabilitado]}
            onPress={() => onConfirmar(motivo)}
            disabled={enviando}>
            {enviando ? <ActivityIndicator color={c.surface} /> : <Text style={styles.botonTxt}>{textoBoton}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onCerrar} disabled={enviando}>
            <Text style={styles.volver}>Volver</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  caja: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 22, ...shadow.card },
  titulo: { fontSize: 18, fontFamily: font.display, color: c.textStrong, marginBottom: 6 },
  texto: { fontSize: 13, fontFamily: font.regular, color: c.text, lineHeight: 19, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipActivo: { backgroundColor: c.accent, borderColor: c.accent },
  chipTxt: { fontFamily: font.medium, fontSize: 13, color: c.text },
  chipTxtActivo: { color: c.onAccent },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 15, fontFamily: font.regular, color: c.textStrong,
  },
  boton: { backgroundColor: c.danger, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  botonDeshabilitado: { opacity: 0.7 },
  botonTxt: { color: c.surface, fontFamily: font.bold, fontSize: 15 },
  volver: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
}));
