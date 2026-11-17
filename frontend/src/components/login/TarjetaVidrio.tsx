/**
 * Tarjeta de vidrio del login: fondo totalmente transparente, sin borde, que
 * desenfoca lo que hay detrás (@react-native-community/blur).
 *
 * Profundidad: sombra exterior suave hacia abajo y, por dentro, luz que cae
 * desde arriba y sombra que sube desde abajo (boxShadow inset).
 *
 * Se usa el componente nativo de la librería y no su `BlurView`: ese fuerza
 * pointerEvents="none" (los campos no recibirían toques). El contenido va
 * DENTRO del desenfoque, en una sola vista hija que lo ocupa entero: así el
 * desenfoque no lo captura (dejaría un halo borroso detrás del texto) y el
 * FrameLayout nativo no le mueve la posición.
 *
 * Esa vista hija lleva collapsable={false}: si Fabric la aplana, sus hijos
 * cuelgan directo del FrameLayout y este los reacomoda (los íconos de los
 * campos salían gigantes o en la esquina de la tarjeta).
 */
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import BlurNativo from '@react-native-community/blur/src/fabric/BlurViewNativeComponentAndroid';
import { ColoresLogin } from '../../theme';

const RADIO = 24;
const DESENFOQUE = 10;

type Props = { ancho: number; c: ColoresLogin; children: React.ReactNode };

export default function TarjetaVidrio({ ancho, c, children }: Props) {
  const interior = (
    <View collapsable={false} style={styles.interior}>
      {/* luz desde arriba y sombra desde abajo, recortadas al radio */}
      <View
        pointerEvents="none"
        style={[
          styles.relieve,
          {
            boxShadow: `inset 0px 16px 36px -14px ${c.tarjetaLuz}, inset 0px -16px 40px -14px ${c.tarjetaSombraInterior}`,
          },
        ]}
      />
      {children}
    </View>
  );

  return (
    <View
      style={[
        styles.sombra,
        { width: ancho, boxShadow: `0px 30px 60px 0px ${c.tarjetaSombra}` },
      ]}
    >
      <View style={styles.recorte}>
        {Platform.OS === 'android' ? (
          <BlurNativo
            style={styles.vidrio}
            blurRadius={DESENFOQUE}
            overlayColor="transparent"
            pointerEvents="box-none"
          >
            {interior}
          </BlurNativo>
        ) : (
          interior
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sombra: { borderRadius: RADIO },
  recorte: { borderRadius: RADIO, overflow: 'hidden' },
  vidrio: { backgroundColor: 'transparent' },
  interior: {
    paddingTop: 24,
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  relieve: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIO,
  },
});
