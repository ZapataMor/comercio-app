/**
 * Botón "Mi perfil" de la topbar (parte superior derecha), visible para
 * TODOS los roles. Solo muestra el ícono de la persona; abre la pantalla del
 * perfil PERSONAL del usuario (la persona, no el negocio).
 *
 * Al domiciliario se le muestran al lado su nivel de confiabilidad
 * (HeaderConfiabilidad) y su turno (HeaderTurno).
 */
import React from 'react';
import { View } from 'react-native';
import { navigationRef } from '../RootNavigation';
import { radius, makeStyles, useTheme } from '../theme';
import { PressableScale } from './anim';
import HeaderConfiabilidad from './HeaderConfiabilidad';
import HeaderTurno from './HeaderTurno';
import Icon from './Icon';

export default function HeaderPerfil() {
  const { c } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.fila}>
      <HeaderConfiabilidad />
      <HeaderTurno />
      <PressableScale
        style={styles.boton}
        hitSlop={8}
        // Sin texto visible: el lector de pantalla anuncia "Mi perfil".
        accessibilityRole="button"
        accessibilityLabel="Mi perfil"
        onPress={() => navigationRef.isReady() && navigationRef.navigate('Perfil')}>
        <Icon name="usuario" size={18} color={c.onHeader} strokeWidth={2} />
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
}));
