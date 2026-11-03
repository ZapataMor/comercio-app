/**
 * Fondo borroso (sin oscurecerlo) detrás de un menú flotante.
 *
 * El menú va en una capa encima de la app y fuera de ella (CapaMenus, en
 * MenuDesplegable): basta con desenfocar la raíz de la app
 * (`AppDesenfocable`, en App.tsx) para que todo lo de atrás, topbar
 * incluida, quede borroso y el menú se vea nítido.
 *
 * Usa `filter: blur`, que React Native aplica solo en Android 12+ (New
 * Architecture). En iOS y en Android anteriores el fondo no cambia.
 *
 *   desenfocarApp(true)   // al abrir el menú
 *   desenfocarApp(false)  // al cerrarlo
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleProp, View, ViewStyle } from 'react-native';

/** Radio del desenfoque. */
const RADIO = 6;

const oyentes = new Set<(activo: boolean) => void>();

/** Pone borrosa la app detrás de un menú flotante, o la deja nítida otra vez. */
export function desenfocarApp(activo: boolean) {
  if (Platform.OS !== 'android') return;
  oyentes.forEach(o => o(activo));
}

type Props = { style?: StyleProp<ViewStyle>; children?: React.ReactNode };

/** Raíz de la app que se desenfoca con `desenfocarApp`. */
export function AppDesenfocable({ style, children }: Props) {
  const [radio, setRadio] = useState(0);
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // `filter` no admite el driver nativo: el radio se lleva al estado. Solo
    // se re-renderiza esta vista; sus hijos llegan ya creados.
    const id = v.addListener(({ value }) => setRadio(Math.round(value * 4) / 4));
    const oyente = (activo: boolean) =>
      Animated.timing(v, {
        toValue: activo ? RADIO : 0,
        // Al quitarse acompaña lo que tarda el menú en recogerse.
        duration: activo ? 260 : 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
      v.removeListener(id);
    };
  }, [v]);

  return (
    // collapsable={false}: la vista existe siempre en Android, así ponerle o
    // quitarle el filtro no reacomoda la jerarquía nativa (pantallas, mapa).
    <View collapsable={false} style={[style, radio > 0 && { filter: [{ blur: radio }] }]}>
      {children}
    </View>
  );
}
