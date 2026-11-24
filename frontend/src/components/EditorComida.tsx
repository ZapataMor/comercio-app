/**
 * Formulario de un plato (tipo Comida) en dos partes, igual a como lo verá el
 * cliente al pedir:
 *  - Ingredientes: lo que trae. Cada uno se marca «Se puede quitar» (el cliente
 *    elige Sin / Con: tomate, cebolla) o «Fijo» (la carne de la hamburguesa).
 *  - Extras: lo que se pide aparte, con su precio por porción. El cliente elige
 *    cuántas porciones y el precio del plato sube enseguida (0 = gratis).
 *
 * Es semi-controlado, como ListaAtributos: recibe los valores iniciales y el
 * padre lo remonta (prop `key`) al abrir el formulario o cambiar de tipo.
 */
import React, { useRef, useState } from 'react';
import { Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ExtraProducto } from '../api';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import Icon from './Icon';

/** Lo que más se pide aparte: un toque lo agrega a la lista. */
const SUGERENCIAS_EXTRAS = ['Queso', 'Tocineta', 'Huevo', 'Porción de papas', 'Salsa de la casa', 'Carne', 'Aguacate'];

type Ingrediente = { id: number; nombre: string; quitable: boolean };
type Extra = { id: number; nombre: string; precio: string };

export type DatosComida = {
  ingredientes: string[];
  fijos: string[];
  /** `precio` null = el comerciante no escribió el precio de ese extra. */
  extras: { nombre: string; precio: number | null }[];
};

type Props = {
  ingredientes?: string[];
  fijos?: string[];
  extras?: ExtraProducto[];
  onChange: (datos: DatosComida) => void;
  disabled?: boolean;
};

export default function EditorComida({ ingredientes = [], fijos = [], extras = [], onChange, disabled }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const siguienteId = useRef(0);
  const [lista, setLista] = useState<Ingrediente[]>(() =>
    ingredientes.map(nombre => ({ id: siguienteId.current++, nombre, quitable: !fijos.includes(nombre) })),
  );
  const [aparte, setAparte] = useState<Extra[]>(() =>
    extras.map(e => ({ id: siguienteId.current++, nombre: e.nombre, precio: String(Math.round(e.precio)) })),
  );
  const ultimoAgregado = useRef<number | null>(null);

  function emitir(nuevaLista: Ingrediente[], nuevosExtras: Extra[]) {
    const nombres = nuevaLista.map(i => ({ ...i, nombre: i.nombre.trim() })).filter(i => i.nombre);
    onChange({
      ingredientes: nombres.map(i => i.nombre),
      fijos: nombres.filter(i => !i.quitable).map(i => i.nombre),
      extras: nuevosExtras
        .map(e => ({ nombre: e.nombre.trim(), precio: /^\d+$/.test(e.precio) ? Number(e.precio) : null }))
        .filter(e => e.nombre),
    });
  }

  const cambiarLista = (nueva: Ingrediente[]) => { setLista(nueva); emitir(nueva, aparte); };
  const cambiarExtras = (nuevos: Extra[]) => { setAparte(nuevos); emitir(lista, nuevos); };

  function agregarExtra(nombre = '') {
    const id = siguienteId.current++;
    ultimoAgregado.current = id;
    cambiarExtras([...aparte, { id, nombre, precio: '' }]);
  }

  const sugerencias = SUGERENCIAS_EXTRAS.filter(
    s => !aparte.some(e => e.nombre.trim().toLowerCase() === s.toLowerCase()),
  );

  return (
    <View>
      <Text style={styles.label}>Ingredientes</Text>
      <Text style={styles.ayuda}>
        Lo que trae el plato. Toca la etiqueta de cada uno: «Se puede quitar» deja que el cliente lo pida sin él; «Obligatorio» siempre va y no se puede quitar (como el pan o la carne de una hamburguesa).
      </Text>
      {lista.map(i => (
        <View key={i.id} style={styles.fila}>
          <TextInput
            style={[styles.input, styles.flex1]}
            value={i.nombre}
            onChangeText={t => cambiarLista(lista.map(x => (x.id === i.id ? { ...x, nombre: t } : x)))}
            placeholder="Ej: Tomate"
            placeholderTextColor={c.mutedSoft}
            editable={!disabled}
            maxLength={100}
            autoFocus={ultimoAgregado.current === i.id}
          />
          <Pressable
            style={[styles.etiqueta, i.quitable ? styles.etiquetaQuitable : styles.etiquetaFija]}
            disabled={disabled}
            accessibilityRole="switch"
            accessibilityState={{ checked: i.quitable }}
            accessibilityLabel={`${i.nombre || 'Ingrediente'}: ${i.quitable ? 'se puede quitar' : 'obligatorio'}`}
            onPress={() => cambiarLista(lista.map(x => (x.id === i.id ? { ...x, quitable: !x.quitable } : x)))}>
            <Text style={[styles.etiquetaTxt, i.quitable ? styles.etiquetaTxtQuitable : styles.etiquetaTxtFija]}>
              {i.quitable ? 'Se puede quitar' : 'Obligatorio'}
            </Text>
          </Pressable>
          <TouchableOpacity
            style={styles.quitar}
            disabled={disabled}
            hitSlop={8}
            accessibilityLabel={`Quitar ${i.nombre || 'ingrediente'}`}
            onPress={() => cambiarLista(lista.filter(x => x.id !== i.id))}>
            <Icon name="basura" size={16} color={c.danger} />
          </TouchableOpacity>
        </View>
      ))}
      <PressableScale
        style={[styles.agregar, disabled && styles.apagado]}
        disabled={disabled}
        onPress={() => {
          const id = siguienteId.current++;
          ultimoAgregado.current = id;
          cambiarLista([...lista, { id, nombre: '', quitable: true }]);
        }}>
        <Text style={styles.agregarTxt}>+ Añadir ingrediente</Text>
      </PressableScale>

      <Text style={styles.label}>Extras</Text>
      <Text style={styles.ayuda}>
        Lo que el cliente puede pedir aparte y cuántas veces. Cada porción suma su precio al plato; pon 0 si es gratis.
      </Text>
      {aparte.map(e => (
        <View key={e.id} style={styles.fila}>
          <TextInput
            style={[styles.input, styles.flex1]}
            value={e.nombre}
            onChangeText={t => cambiarExtras(aparte.map(x => (x.id === e.id ? { ...x, nombre: t } : x)))}
            placeholder="Ej: Porción de papas"
            placeholderTextColor={c.mutedSoft}
            editable={!disabled}
            maxLength={100}
            autoFocus={ultimoAgregado.current === e.id && !e.nombre}
          />
          <View style={styles.precio}>
            <Text style={styles.precioSigno}>$</Text>
            <TextInput
              style={styles.precioInput}
              value={e.precio}
              onChangeText={t => cambiarExtras(aparte.map(x => (x.id === e.id ? { ...x, precio: t.replace(/[^0-9]/g, '') } : x)))}
              placeholder="3000"
              placeholderTextColor={c.mutedSoft}
              keyboardType="number-pad"
              editable={!disabled}
              maxLength={7}
              accessibilityLabel={`Precio de ${e.nombre || 'el extra'}`}
              autoFocus={ultimoAgregado.current === e.id && !!e.nombre}
            />
          </View>
          <TouchableOpacity
            style={styles.quitar}
            disabled={disabled}
            hitSlop={8}
            accessibilityLabel={`Quitar ${e.nombre || 'extra'}`}
            onPress={() => cambiarExtras(aparte.filter(x => x.id !== e.id))}>
            <Icon name="basura" size={16} color={c.danger} />
          </TouchableOpacity>
        </View>
      ))}
      {sugerencias.length > 0 && (
        <View style={styles.chips}>
          {sugerencias.map(s => (
            <TouchableOpacity key={s} style={styles.chip} disabled={disabled} onPress={() => agregarExtra(s)}>
              <Text style={styles.chipTxt}>+ {s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <PressableScale style={[styles.agregar, disabled && styles.apagado]} disabled={disabled} onPress={() => agregarExtra()}>
        <Text style={styles.agregarTxt}>+ Añadir extra</Text>
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 4 },
  ayuda: { fontSize: 12, lineHeight: 17, color: c.muted, fontFamily: font.regular, marginBottom: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  flex1: { flex: 1 },
  input: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.textStrong, fontFamily: font.regular,
  },
  etiqueta: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
  etiquetaQuitable: { backgroundColor: c.accentSoft, borderColor: c.accent },
  etiquetaFija: { backgroundColor: c.surface2, borderColor: c.border },
  etiquetaTxt: { fontSize: 12, fontFamily: font.semibold },
  etiquetaTxtQuitable: { color: c.goldText },
  etiquetaTxtFija: { color: c.muted },
  precio: {
    flexDirection: 'row', alignItems: 'center', width: 104,
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingLeft: 10,
  },
  precioSigno: { color: c.muted, fontFamily: font.semibold, fontSize: 15 },
  precioInput: { flex: 1, paddingHorizontal: 6, paddingVertical: 10, fontSize: 15, color: c.textStrong, fontFamily: font.regular },
  quitar: { padding: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: c.surface,
  },
  chipTxt: { fontSize: 13, color: c.text, fontFamily: font.medium },
  agregar: {
    borderWidth: 1, borderColor: c.borderStrong, borderStyle: 'dashed',
    borderRadius: radius.md, paddingVertical: 11, alignItems: 'center', marginBottom: 16,
  },
  apagado: { opacity: 0.5 },
  agregarTxt: { color: c.goldText, fontFamily: font.bold, fontSize: 14 },
}));
