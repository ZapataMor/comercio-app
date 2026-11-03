/**
 * Dropdown simple y sin dependencias nativas: un campo que, al tocarlo,
 * abre una lista de opciones en un modal. Sirve para "Unidad de venta",
 * categorías, etc. `DropdownMultiple` deja marcar varias opciones.
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { font, makeStyles, radius, useTheme } from '../theme';
import Icon from './Icon';

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
  const styles = useStyles();
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

type PropsMultiple<T extends string> = {
  valores: T[];
  opciones: OpcionDropdown<T>[];
  onChange: (valores: T[]) => void;
  /** Encabezado de la lista (p. ej. "Categorías"). */
  titulo: string;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * Como `Dropdown`, pero se marcan una o varias opciones: cada toque marca o
 * desmarca, y "Listo" cierra la lista. El campo muestra las elegidas.
 */
export function DropdownMultiple<T extends string>({
  valores,
  opciones,
  onChange,
  titulo,
  placeholder = 'Selecciona…',
  disabled,
}: PropsMultiple<T>) {
  const { c } = useTheme();
  const styles = useStyles();
  const [abierto, setAbierto] = useState(false);
  const elegidas = opciones.filter(o => valores.includes(o.value));

  function alternar(valor: T) {
    onChange(valores.includes(valor) ? valores.filter(v => v !== valor) : [...valores, valor]);
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.campo, disabled && styles.campoOff]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={titulo}
        onPress={() => !disabled && setAbierto(true)}>
        <Text style={[styles.valor, styles.valorMultiple, elegidas.length === 0 && styles.placeholder]} numberOfLines={2}>
          {elegidas.length > 0 ? elegidas.map(o => o.label).join(', ') : placeholder}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </TouchableOpacity>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <Pressable style={styles.fondo} onPress={() => setAbierto(false)}>
          {/* Tocar dentro de la lista no la cierra. */}
          <Pressable style={[styles.menu, styles.menuMultiple]} onPress={() => {}}>
            <View style={styles.cabecera}>
              <Text style={styles.titulo}>{titulo}</Text>
              <Text style={styles.subtitulo}>Elige una o varias</Text>
            </View>
            <ScrollView>
              {opciones.map(o => {
                const activa = valores.includes(o.value);
                return (
                  <TouchableOpacity
                    key={o.value}
                    style={styles.opcion}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: activa }}
                    onPress={() => alternar(o.value)}>
                    <Text style={[styles.opcionTxt, activa && styles.opcionTxtOn]}>{o.label}</Text>
                    <View style={[styles.casilla, activa && styles.casillaOn]}>
                      {activa && <Icon name="check" size={14} color={c.onAccent} strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.listo} onPress={() => setAbierto(false)}>
              <Text style={styles.listoTxt}>
                Listo{valores.length > 0 ? ` · ${valores.length} ${valores.length === 1 ? 'elegida' : 'elegidas'}` : ''}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const useStyles = makeStyles(c => ({
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
  // Varias opciones
  valorMultiple: { flex: 1 },
  menuMultiple: { maxHeight: '80%', paddingVertical: 0 },
  cabecera: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  titulo: { fontSize: 17, fontFamily: font.display, color: c.textStrong },
  subtitulo: { fontSize: 12.5, fontFamily: font.regular, color: c.muted, marginTop: 2 },
  casilla: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: c.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  casillaOn: { backgroundColor: c.accent, borderColor: c.accent },
  listo: {
    margin: 12, backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center',
  },
  listoTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
}));
