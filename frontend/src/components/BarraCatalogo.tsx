/**
 * Barra inferior de Explorar, como la de Instagram: los tres catálogos
 * (Productos, Servicios y Propiedades) a lo ancho de la pantalla. La pestaña
 * activa va en el color de acento; tocar otra cambia el catálogo.
 *
 * Llega hasta el borde de abajo: deja ella misma el espacio de la barra de
 * navegación del sistema (Explorar es una pantalla bordeABorde en App.tsx).
 * Con el teclado abierto (escribiendo en el buscador) se esconde y deja solo
 * ese espacio, que la raíz descuenta del alto del teclado (EspacioTeclado).
 */
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SeccionCatalogo } from '../navTypes';
import { font, makeStyles, useTheme } from '../theme';
import { Objetivo } from '../tutorial/Objetivo';
import Icon, { IconName } from './Icon';

export const SECCIONES: { valor: SeccionCatalogo; titulo: string; icono: IconName }[] = [
  { valor: 'productos', titulo: 'Productos', icono: 'bolsa' },
  { valor: 'servicios', titulo: 'Servicios', icono: 'herramientas' },
  { valor: 'propiedades', titulo: 'Propiedades', icono: 'casa' },
];

/** Alto de la barra, sin contar el espacio de la barra de navegación del sistema. */
export const ALTO_BARRA_CATALOGO = 58;

export default function BarraCatalogo({
  seccion,
  onCambiar,
}: {
  seccion: SeccionCatalogo;
  onCambiar: (seccion: SeccionCatalogo) => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const teclado = useTecladoAbierto();
  if (teclado) {
    return <View style={{ height: insets.bottom }} />;
  }
  return (
    <Objetivo
      id="catalogo.selector"
      style={[styles.barra, { paddingBottom: insets.bottom }]}
      accessibilityRole="tablist">
      {SECCIONES.map(s => {
        const activa = s.valor === seccion;
        return (
          <Pressable
            key={s.valor}
            style={styles.pestana}
            accessibilityRole="tab"
            accessibilityLabel={s.titulo}
            accessibilityState={{ selected: activa }}
            onPress={() => !activa && onCambiar(s.valor)}>
            <Icon
              name={s.icono}
              size={24}
              color={activa ? c.accent : c.onHeader}
              strokeWidth={activa ? 2.3 : 1.8}
              style={activa ? undefined : styles.apagado}
            />
            <Text style={[styles.texto, activa ? styles.textoActivo : styles.apagado]}>{s.titulo}</Text>
          </Pressable>
        );
      })}
    </Objetivo>
  );
}

function useTecladoAbierto() {
  const [abierto, setAbierto] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setAbierto(true)),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setAbierto(false)),
    ];
    return () => subs.forEach(sub => sub.remove());
  }, []);
  return abierto;
}

const useStyles = makeStyles(c => ({
  barra: {
    flexDirection: 'row',
    backgroundColor: c.header,
  },
  pestana: {
    flex: 1,
    height: ALTO_BARRA_CATALOGO,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  texto: { color: c.onHeader, fontFamily: font.medium, fontSize: 11 },
  textoActivo: { color: c.accent, fontFamily: font.semibold },
  apagado: { opacity: 0.62 },
}));
