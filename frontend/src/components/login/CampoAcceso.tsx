/**
 * Campo hundido de las pantallas de acceso: rótulo, ícono a la izquierda y
 * anillo de foco. Con `clave` es de contraseña, con el ojo a la derecha para
 * mostrarla u ocultarla.
 */
import React, { useRef, useState } from 'react';
import { Animated, Easing, Text, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { font, makeStyles, radius, useTheme } from '../../theme';
import Icon, { IconName } from '../Icon';

const ALTO_CAMPO = 48;
const FOCO_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

type Props = Omit<TextInputProps, 'style' | 'secureTextEntry'> & {
  rotulo: string;
  icono: IconName;
  /** Contraseña: oculta lo escrito y pone el ojo a la derecha. */
  clave?: boolean;
};

export default function CampoAcceso({ rotulo, icono, clave, onFocus, onBlur, ...props }: Props) {
  const { login: l } = useTheme();
  const styles = useStyles();
  const foco = useRef(new Animated.Value(0)).current;
  const [verClave, setVerClave] = useState(false);

  function enfocar(encendido: boolean) {
    Animated.timing(foco, {
      toValue: encendido ? 1 : 0,
      duration: 180,
      easing: FOCO_EASE,
      useNativeDriver: true,
    }).start();
  }

  return (
    <>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <View style={styles.campo}>
        <TextInput
          {...(clave ? { autoCapitalize: 'none' as const, autoCorrect: false } : null)}
          {...props}
          style={[styles.campoTexto, clave && styles.campoTextoClave]}
          placeholderTextColor={l.campoEjemplo}
          cursorColor={l.cursor}
          selectionColor={l.cursor}
          selectionHandleColor={l.cursor}
          secureTextEntry={clave ? !verClave : undefined}
          onFocus={e => {
            enfocar(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            enfocar(false);
            onBlur?.(e);
          }}
        />
        <View pointerEvents="none" style={styles.campoIcono}>
          <Icon name={icono} size={20} color={l.campoIcono} />
        </View>
        {/* foco: borde de 1 px + anillo de 3 px */}
        <Animated.View pointerEvents="none" style={[styles.campoFoco, { opacity: foco }]} />
        {clave ? (
          <TouchableOpacity
            style={styles.ojo}
            onPress={() => setVerClave(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
            <Icon name={verClave ? 'ojo-cerrado' : 'ojo'} size={20} color={l.ojo} />
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );
}

const useStyles = makeStyles((_c, _sombras, l) => ({
  rotulo: { color: l.rotulo, fontFamily: font.semibold, fontSize: 14, letterSpacing: 0.2, marginBottom: 6 },
  // Campo hundido: sombra interior arriba y filo de luz abajo.
  campo: {
    height: ALTO_CAMPO,
    borderRadius: radius.md,
    backgroundColor: l.campo,
    boxShadow: `inset 0px 2px 5px 0px ${l.campoHundido}, inset 0px -1px 0px 0px ${l.campoFilo}`,
    justifyContent: 'center',
  },
  campoIcono: { position: 'absolute', left: 12, top: (ALTO_CAMPO - 20) / 2, width: 20, height: 20 },
  campoTexto: {
    height: ALTO_CAMPO,
    paddingLeft: 44,
    paddingRight: 14,
    paddingVertical: 0,
    color: l.campoTexto,
    fontFamily: font.medium,
    fontSize: 16,
  },
  // Deja lugar al ojo a la derecha del campo de contraseña.
  campoTextoClave: { paddingRight: ALTO_CAMPO },
  campoFoco: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: l.foco,
    boxShadow: `0px 0px 0px 3px ${l.foco}`,
  },
  ojo: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: ALTO_CAMPO,
    height: ALTO_CAMPO,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
