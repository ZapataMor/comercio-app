/**
 * Dropdown simple y sin dependencias nativas: un campo que, al tocarlo,
 * abre una lista de opciones en un modal. Sirve para "Unidad de venta",
 * categorías, etc.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { c, font, radius } from '../theme';

export type OpcionDropdown<T extends string> = { label: string; value: T };

type Props<T extends string> = {
  valor: T | null;
  opciones: OpcionDropdown<T>[];
  onChange: (valor: T) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function Dropdown<T extends string>({
  valor,
  opciones,
  onChange,
  placeholder = 'Selecciona…',
  disabled,
}: Props<T>) {
  const [abierto, setAbierto] = useState(false);
  const seleccion = opciones.find(o => o.value === valor) ?? null;

  return (
    <>
      <TouchableOpacity
        style={[styles.campo, disabled && styles.campoOff]}
        activeOpacity={0.7}
        onPress={() => !disabled && setAbierto(true)}>
        <Text style={[styles.valor, !seleccion && styles.placeholder]}>
          {seleccion ? seleccion.label : placeholder}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </TouchableOpacity>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={styles.fondo} onPress={() => setAbierto(false)}>
          <View style={styles.menu}>
            {opciones.map(o => {
              const activa = o.value === valor;
              return (
                <TouchableOpacity
                  key={o.value}
                  style={styles.opcion}
                  onPress={() => {
                    onChange(o.value);
                    setAbierto(false);
                  }}>
                  <Text style={[styles.opcionTxt, activa && styles.opcionTxtOn]}>{o.label}</Text>
                  {activa && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  campo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: c.surface,
  },
  campoOff: { opacity: 0.5 },
  valor: { fontSize: 16, color: c.textStrong, fontFamily: font.regular },
  placeholder: { color: c.mutedSoft },
  caret: { fontSize: 14, color: c.muted, marginLeft: 8 },
  fondo: { flex: 1, backgroundColor: c.scrim, justifyContent: 'center', padding: 32 },
  menu: { backgroundColor: c.surface, borderRadius: radius.md, paddingVertical: 6, overflow: 'hidden' },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  opcionTxt: { fontSize: 16, color: c.text, fontFamily: font.regular },
  opcionTxtOn: { color: c.goldText, fontFamily: font.bold },
  check: { color: c.goldText, fontWeight: '900', fontSize: 16 },
});
