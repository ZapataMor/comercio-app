import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { separarDireccion, unirDireccion, limpiarCampoDireccion, limpiarTextoDireccion } from '../direccion';
import { font, makeStyles, radius, useTheme } from '../theme';

export default function CamposDireccion({ value, onChangeText, editable = true }: {
  value: string; onChangeText: (value: string) => void; editable?: boolean;
}) {
  const styles = useStyles();
  const { c } = useTheme();
  const partes = separarDireccion(value);
  return <View>
    {!!value && !value.includes(' #') && <Text style={styles.ayuda}>Dirección anterior: {value}. Completa los campos para actualizarla.</Text>}
    <Text style={styles.ayuda}>
      Escribe al menos la Calle o la Carrera. Si tu calle no tiene número, escribe su nombre (ej.: Calle Principal). Si tu casa no tiene número, escribe SN.
    </Text>
    {(['calle', 'carrera', 'casa'] as const).map(campo => {
      const label = { calle: 'Calle', carrera: 'Carrera', casa: 'Número de la casa' }[campo];
      return <View key={campo}>
        <Text style={styles.label}>{label}{campo === 'casa' ? ' *' : ''}</Text>
        <TextInput accessibilityLabel={label} style={styles.input} value={partes[campo]}
          editable={editable} maxLength={70} placeholderTextColor={c.muted}
          placeholder={{ calle: 'Ej. 12A o San Martín', carrera: 'Ej. 8 o Primera', casa: 'Ej. 30-15 o SN' }[campo]}
          onChangeText={text => onChangeText(unirDireccion({ ...partes, [campo]: campo === 'casa' ? limpiarCampoDireccion(text) : limpiarTextoDireccion(text) }))} />
      </View>;
    })}
  </View>;
}
const useStyles = makeStyles(c => ({
  label: { color: c.text, fontFamily: font.semibold, fontSize: 14, marginTop: 2, marginBottom: 6 },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  // El aire de abajo es el que usa FieldError para no taparle el borde al campo.
  input: { color: c.textStrong, fontFamily: font.regular, fontSize: 15, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, padding: 12, marginBottom: 12 },
}));
