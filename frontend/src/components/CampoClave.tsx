/**
 * Campo de contraseña con un ojo a la derecha para mostrarla u ocultarla,
 * como el del login. Recibe los mismos props que un TextInput (menos
 * secureTextEntry, que maneja el ojo). Los márgenes del estilo pasan al
 * contenedor, así el ojo queda centrado en el campo y no en su margen.
 *
 *   <CampoClave style={styles.input} value={clave} onChangeText={setClave} placeholder="Contraseña" />
 */
import React, { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme';
import Icon from './Icon';

type Props = Omit<TextInputProps, 'secureTextEntry'> & {
  /** Color del ojo (por defecto, el gris secundario del tema). */
  colorOjo?: string;
};

export default function CampoClave({ style, colorOjo, ...props }: Props) {
  const { c } = useTheme();
  const [visible, setVisible] = useState(false);
  const {
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    marginStart,
    marginEnd,
    ...campo
  } = StyleSheet.flatten(style) ?? {};
  const margenes = {
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    marginStart,
    marginEnd,
  };

  return (
    <View style={margenes}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        {...props}
        style={[campo, styles.campo]}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        style={styles.ojo}
        onPress={() => setVisible(v => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        <Icon name={visible ? 'ojo-cerrado' : 'ojo'} size={20} color={colorOjo ?? c.muted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Deja lugar al ojo a la derecha.
  campo: { paddingRight: 48 },
  ojo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
