/**
 * Elegir una opción entre varias (talla, color) con chips. Los colores que la
 * app reconoce por su nombre llevan una muestra del tono real.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { muestraColor } from '../opcionesProducto';
import { font, makeStyles, radius } from '../theme';

type Props = {
  titulo: string;
  opciones: string[];
  valor?: string;
  onChange: (valor: string) => void;
  /** Muestra el tono de cada opción (para los colores). */
  conMuestra?: boolean;
  /** Mensaje cuando falta elegir (se muestra junto al título). */
  error?: string | null;
};

export default function ChipsEleccion({ titulo, opciones, valor, onChange, conMuestra, error }: Props) {
  const styles = useStyles();

  return (
    <View style={styles.seccion}>
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>{titulo}</Text>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
      <View style={styles.chips}>
        {opciones.map(opcion => {
          const activa = opcion === valor;
          const muestra = conMuestra ? muestraColor(opcion) : null;
          return (
            <Pressable
              key={opcion}
              style={[styles.chip, activa && styles.chipOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              onPress={() => onChange(opcion)}>
              {!!muestra && <View style={[styles.muestra, { backgroundColor: muestra }]} />}
              <Text style={[styles.chipTxt, activa && styles.chipTxtOn]}>{opcion}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  seccion: { marginTop: 22 },
  cabecera: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  titulo: { fontFamily: font.semibold, fontSize: 14, color: c.textStrong },
  error: { fontFamily: font.medium, fontSize: 12, color: c.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minWidth: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.borderStrong,
  },
  chipOn: { backgroundColor: c.brand, borderColor: c.brand },
  chipTxt: { fontFamily: font.medium, fontSize: 14, color: c.text },
  chipTxtOn: { fontFamily: font.semibold, color: c.onBrand },
  muestra: {
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(127,127,127,0.45)',
  },
}));
