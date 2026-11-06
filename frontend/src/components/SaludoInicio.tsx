/**
 * Lo que comparten las dos pantallas de arranque, el Inicio y "Mis entregas":
 * el saludo y el acceso a Explorar.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import { FadeInView, PressableScale } from './anim';
import Icon from './Icon';

export function Saludo() {
  const styles = useStyles();
  const { auth } = useAuth();
  const user = auth!.user;

  return (
    <FadeInView>
      <Text style={styles.saludo}>¡Hola, {user.name}!</Text>
    </FadeInView>
  );
}

/** Acceso a Explorar; solo para quien es cliente. */
export function IrAExplorar() {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();

  if (!auth!.user.roles.includes('usuario')) {
    return null;
  }

  return (
    <FadeInView delay={60}>
      <PressableScale style={styles.item} onPress={() => navigationRef.navigate('Explorar')}>
        <Icon name="bolsa" size={26} color={c.accent} style={styles.itemIcono} />
        <View style={styles.itemTexto}>
          <Text style={styles.itemTitulo}>Explorar negocios</Text>
          <Text style={styles.itemSub}>Mira los comercios abiertos</Text>
        </View>
        <Icon name="chevron" size={20} color={c.chevron} />
      </PressableScale>
    </FadeInView>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  saludo: { fontSize: 24, fontFamily: font.display, color: c.textStrong, marginTop: 8, marginBottom: 24 },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.lg, padding: 16, marginBottom: 12, ...shadow.soft,
  },
  itemIcono: { marginRight: 14 },
  itemTexto: { flex: 1 },
  itemTitulo: { fontSize: 16, fontFamily: font.bold, color: c.textStrong },
  itemSub: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
}));
