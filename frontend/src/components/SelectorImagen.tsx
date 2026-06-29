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
            <Text style={styles.placeholder}>🖼️</Text>
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
  label: { fontSize: 13, fontWeight: '600', color: '#334155', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  preview: {
    width: 72, height: 72, borderRadius: 12, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  img: { width: '100%', height: '100%' },
  placeholder: { fontSize: 28 },
  boton: {
    backgroundColor: '#eef2ff', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11,
    borderWidth: 1, borderColor: '#c7d2fe',
  },
  botonDisabled: { opacity: 0.6 },
  botonTxt: { color: '#4338ca', fontWeight: '700' },
});
