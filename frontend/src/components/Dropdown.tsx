/**
 * Dropdown simple y sin dependencias nativas: un campo que, al tocarlo,
 * abre una lista de opciones en un modal. Sirve para "Unidad de venta",
 * categorías, etc.
 */
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: '#fff',
  },
  campoOff: { opacity: 0.5 },
  valor: { fontSize: 16, color: '#0f172a' },
  placeholder: { color: '#94a3b8' },
  caret: { fontSize: 14, color: '#64748b', marginLeft: 8 },
  fondo: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 32 },
  menu: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 6, overflow: 'hidden' },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  opcionTxt: { fontSize: 16, color: '#334155' },
  opcionTxtOn: { color: '#4f46e5', fontWeight: '700' },
  check: { color: '#4f46e5', fontWeight: '900', fontSize: 16 },
});
