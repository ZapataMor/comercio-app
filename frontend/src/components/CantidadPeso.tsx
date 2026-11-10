import React, { useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { cantidadValida, redondearCantidad, textoCantidad } from '../cantidades';
import { font, makeStyles, radius, useTheme } from '../theme';

/** La edición se confirma de una vez: un texto incompleto nunca altera el pedido. */
export default function CantidadPeso({ cantidad, unidad, onChange, disabled = false }: {
  cantidad: number; unidad: string; onChange: (valor: number) => void; disabled?: boolean;
}) {
  const styles = useStyles();
  const { c } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const valor = Number(texto.replace(',', '.'));
  const valido = /^\d+(?:[.,]\d{1,3})?$/.test(texto) && cantidadValida(valor);
  return <>
    <TouchableOpacity disabled={disabled} accessibilityLabel="Editar cantidad por peso" onPress={() => {
      setTexto(String(cantidad).replace('.', ',')); setAbierto(true);
    }} style={styles.activador}>
      <Text style={styles.enlace}>{textoCantidad({ cantidad, unidad_medida: unidad })} · Editar</Text>
    </TouchableOpacity>
    <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
      <View style={styles.fondo}><View style={styles.caja}>
        <Text style={styles.titulo}>Cantidad en {unidad}</Text>
        <Text style={styles.texto}>{unidad === 'kg' ? 'Ejemplo: 0,5 kg = 500 g. ' : ''}Puedes usar hasta tres decimales, entre 0,001 y 99.</Text>
        <TextInput autoFocus style={styles.input} value={texto} onChangeText={setTexto} keyboardType="decimal-pad" accessibilityLabel={`Cantidad en ${unidad}`} placeholderTextColor={c.muted} />
        {!valido && <Text style={styles.error}>Escribe una cantidad válida.</Text>}
        <TouchableOpacity disabled={!valido} style={[styles.boton, !valido && styles.desactivado]} onPress={() => {
          onChange(redondearCantidad(valor)); setAbierto(false);
        }}><Text style={styles.botonTexto}>Guardar cantidad</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setAbierto(false)}><Text style={styles.enlace}>Cancelar</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </>;
}
const useStyles = makeStyles(c => ({
  activador: { paddingVertical: 10 }, enlace: { color: c.accent, fontFamily: font.semibold, paddingVertical: 8 },
  fondo: { flex: 1, justifyContent: 'center', backgroundColor: '#0008', padding: 24 },
  caja: { backgroundColor: c.bg, borderRadius: radius.lg, padding: 20, gap: 12 },
  titulo: { fontFamily: font.bold, color: c.textStrong, fontSize: 20 },
  texto: { color: c.text, fontFamily: font.regular }, error: { color: c.danger, fontFamily: font.regular },
  input: { borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, padding: 12, color: c.textStrong, fontSize: 18 },
  boton: { backgroundColor: c.accent, padding: 14, borderRadius: radius.md, alignItems: 'center' },
  botonTexto: { color: c.onAccent, fontFamily: font.bold }, desactivado: { opacity: 0.4 },
}));
