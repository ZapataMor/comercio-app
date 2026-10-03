/**
 * Botón "Mi perfil" de la topbar (parte superior derecha), visible para
 * TODOS los roles. Abre la pantalla del perfil PERSONAL del usuario
 * (la persona, no el negocio).
 */
import React from 'react';
import { Text } from 'react-native';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import Icon from './Icon';

export default function HeaderPerfil() {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <PressableScale
      style={styles.boton}
      hitSlop={6}
      onPress={() => navigationRef.isReady() && navigationRef.navigate('Perfil')}>
      <Icon name="usuario" size={14} color={c.onHeader} strokeWidth={2} />
      <Text style={styles.txt}>Mi perfil</Text>
    </PressableScale>
  );
}

const useStyles = makeStyles(c => ({
  boton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  txt: { color: c.onHeader, fontFamily: font.semibold, fontSize: 12 },
}));
