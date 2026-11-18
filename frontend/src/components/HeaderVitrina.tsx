/**
 * Barra superior de la app (reemplaza la nativa del native-stack).
 *
 * La nativa suma TODO el alto de la barra de estado más 56 dp. En teléfonos
 * con cámara perforada la barra de estado mide lo que mide el recorte
 * (~40–50 dp) aunque los íconos ocupen solo la franja del medio, así que
 * quedaba un hueco grande entre los íconos del sistema y el logo. Aquí la
 * barra arranca justo debajo de los íconos y el contenido es más bajo.
 */
import { getHeaderTitle, Header, HeaderBackButton } from '@react-navigation/elements';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Alto del contenido de la barra (sin la barra de estado). */
export const ALTO_CONTENIDO_HEADER = Platform.select({ android: 48, default: 44 });

/**
 * Parte de la barra de estado que de verdad ocupan los íconos del sistema.
 * Android los centra en la barra (alineados con la cámara): con una barra
 * de `alto` dp, terminan hacia `alto / 2 + 10`. Nunca menos de 24 dp (la
 * barra clásica, sin recorte, que los íconos llenan) ni más que la barra.
 * En iOS el área segura ya es la justa.
 */
export function altoBarraEstado(alto: number): number {
  if (Platform.OS !== 'android') return alto;
  return Math.min(alto, Math.max(24, Math.round(alto / 2 + 10)));
}

export default function HeaderVitrina({ navigation, route, options, back }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const barraEstado = altoBarraEstado(insets.top);
  const { headerLeft, headerStyle, ...resto } = options;
  // headerStyle del native-stack solo trae el color de fondo.
  const fondo = headerStyle && 'backgroundColor' in headerStyle ? headerStyle.backgroundColor : undefined;

  return (
    <Header
      {...(resto as React.ComponentProps<typeof Header>)}
      title={getHeaderTitle(options, route.name)}
      back={back}
      headerStatusBarHeight={barraEstado}
      headerStyle={{ backgroundColor: fondo, height: barraEstado + ALTO_CONTENIDO_HEADER }}
      // Mismo margen derecho que la barra nativa (los botones no traen el suyo).
      headerRightContainerStyle={{ paddingEnd: 16 }}
      headerLeft={
        typeof headerLeft === 'function'
          ? p => headerLeft({ ...p, canGoBack: !!back })
          : back
            ? ({ tintColor }) => <HeaderBackButton tintColor={tintColor} onPress={navigation.goBack} />
            : undefined
      }
    />
  );
}
