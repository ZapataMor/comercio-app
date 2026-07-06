/**
 * Sección de atributos del producto según su tipo: "Ingredientes" (Comida),
 * "¿Para qué sirve?" (Medicamento), etc.
 *
 * Muestra las sugerencias pre-creadas como chips que se marcan con un toque,
 * más casillas de texto libres que se agregan con el botón "Añadir…". Informa
 * al padre la lista combinada (chips marcados + textos libres) en cada cambio.
 *
 * Es semi-controlado: recibe los valores iniciales y maneja su propio estado.
 * El padre debe remontarlo (prop `key`) al abrir el formulario o cambiar de
 * tipo de producto.
 */
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from './Icon';
import { PressableScale } from './anim';
import { c, font, radius } from '../theme';

type Libre = { id: number; texto: string };

type Props = {
  /** La pregunta que se le hace al comerciante, ej. "Ingredientes". */
  label: string;
  /** Texto del botón para agregar casillas, ej. "Añadir ingrediente". */
  textoBoton: string;
  /** Opciones pre-creadas (chips); null/vacío = solo casillas libres. */
  sugerencias?: string[] | null;
  /** Valores ya guardados (al editar un producto). */
  iniciales?: string[];
  onChange: (valores: string[]) => void;
  disabled?: boolean;
};

export default function ListaAtributos({
  label,
  textoBoton,
  sugerencias,
  iniciales,
  onChange,
  disabled,
}: Props) {
  const chips = sugerencias ?? [];
  // Los valores guardados se reparten: los que coinciden con una sugerencia
  // vuelven como chip marcado; el resto, como casillas libres.
  const [marcados, setMarcados] = useState<string[]>(
    () => (iniciales ?? []).filter(v => chips.includes(v)),
  );
  const siguienteId = useRef(0);
  const [libres, setLibres] = useState<Libre[]>(() =>
    (iniciales ?? [])
      .filter(v => !chips.includes(v))
      .map(texto => ({ id: siguienteId.current++, texto })),
  );

  function emitir(nuevosMarcados: string[], nuevosLibres: Libre[]) {
    onChange([...nuevosMarcados, ...nuevosLibres.map(l => l.texto)]);
  }

  function alternarChip(valor: string) {
    const nuevos = marcados.includes(valor)
      ? marcados.filter(v => v !== valor)
      : [...marcados, valor];
    setMarcados(nuevos);
    emitir(nuevos, libres);
  }

  function agregarLibre() {
    const nuevos = [...libres, { id: siguienteId.current++, texto: '' }];
    setLibres(nuevos);
    emitir(marcados, nuevos);
  }

  function editarLibre(id: number, texto: string) {
    const nuevos = libres.map(l => (l.id === id ? { ...l, texto } : l));
    setLibres(nuevos);
    emitir(marcados, nuevos);
  }

  function quitarLibre(id: number) {
    const nuevos = libres.filter(l => l.id !== id);
    setLibres(nuevos);
    emitir(marcados, nuevos);
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>

      {chips.length > 0 && (
        <View style={styles.chips}>
          {chips.map(s => {
            const activo = marcados.includes(s);
            return (
              <TouchableOpacity
                key={s}
                style={[styles.chip, activo && styles.chipOn]}
                onPress={() => !disabled && alternarChip(s)}
                activeOpacity={0.7}>
                <Text style={[styles.chipTxt, activo && styles.chipTxtOn]}>
                  {activo ? '✓ ' : ''}{s}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {libres.map(l => (
        <View key={l.id} style={styles.fila}>
          <TextInput
            style={styles.input}
            value={l.texto}
            onChangeText={t => editarLibre(l.id, t)}
            placeholder={label}
            placeholderTextColor={c.mutedSoft}
            editable={!disabled}
            maxLength={100}
          />
          <TouchableOpacity
            style={styles.quitar}
            onPress={() => !disabled && quitarLibre(l.id)}
            hitSlop={8}>
            <Icon name="basura" size={16} color={c.danger} />
          </TouchableOpacity>
        </View>
      ))}

      <PressableScale
        style={[styles.agregar, disabled && { opacity: 0.5 }]}
        onPress={agregarLibre}
        disabled={disabled}>
        <Text style={styles.agregarTxt}>+ {textoBoton}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: c.surface,
  },
  chipOn: { backgroundColor: c.brand, borderColor: c.brand },
  chipTxt: { fontSize: 13, color: c.text, fontFamily: font.medium },
  chipTxtOn: { color: c.onBrand, fontFamily: font.bold },
  fila: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  input: {
    flex: 1, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 16, color: c.textStrong,
    fontFamily: font.regular,
  },
  quitar: { marginLeft: 10, padding: 4 },
  agregar: {
    borderWidth: 1, borderColor: c.borderStrong, borderStyle: 'dashed',
    borderRadius: radius.md, paddingVertical: 11, alignItems: 'center', marginBottom: 14,
  },
  agregarTxt: { color: c.goldText, fontFamily: font.bold, fontSize: 14 },
});
