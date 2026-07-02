/**
 * Selector de imagen reutilizable. Muestra una vista previa (de una imagen ya
 * guardada en el servidor o de una recién elegida) y un botón para elegir otra.
 *
 * Usa @react-native-documents/picker (ACTION_GET_CONTENT en Android), que está
 * disponible en TODOS los teléfonos Android (desde Android 4.4) y en los
 * emuladores AOSP — a diferencia del "photo picker" nuevo, que no existe en
 * algunos emuladores. La URI content:// que devuelve se sube tal cual: el
 * fetch de React Native sabe leer content:// en multipart.
 */
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { c, font, radius } from '../theme';
import Icon from './Icon';

type Props = {
  /** URL/URI a previsualizar (remota del servidor o local recién elegida). */
  uri?: string;
  /** Se llama con la URI cuando el usuario elige una imagen. */
  onSelect: (uri: string) => void;
  label?: string;
  disabled?: boolean;
};

export default function SelectorImagen({ uri, onSelect, label = 'Imagen', disabled }: Props) {
  async function elegir() {
    try {
      const [archivo] = await pick({ type: [types.images] });
      if (archivo?.uri) onSelect(archivo.uri);
    } catch (e) {
      // Si el usuario cancela, no es un error que mostrar.
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return;
      // Otros errores: se ignoran silenciosamente (la pantalla muestra su propio toast al guardar).
    }
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.preview}>
          {uri ? (
            <Image source={{ uri }} style={styles.img} resizeMode="cover" />
          ) : (
            <Icon name="imagen" size={28} color={c.mutedSoft} />
          )}
        </View>
        <TouchableOpacity
          style={[styles.boton, disabled && styles.botonDisabled]}
          onPress={elegir}
          disabled={disabled}>
          <Text style={styles.botonTxt}>{uri ? 'Cambiar imagen' : 'Elegir imagen'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  preview: {
    width: 72, height: 72, borderRadius: radius.md, backgroundColor: c.surface2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: c.border,
  },
  img: { width: '100%', height: '100%' },
  boton: {
    backgroundColor: c.accentSoft, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 11,
    borderWidth: 1, borderColor: c.accent,
  },
  botonDisabled: { opacity: 0.6 },
  botonTxt: { color: c.onAccent, fontFamily: font.bold },
});
