import React from 'react';
import { Text, TextInput, View } from 'react-native';
import { separarDireccion, unirDireccion, limpiarCampoDireccion } from '../direccion';
import { font, makeStyles, radius, useTheme } from '../theme';

export default function CamposDireccion({ value, onChangeText, editable = true }: {
  value: string; onChangeText: (value: string) => void; editable?: boolean;
}) {
  const styles = useStyles();
  const { c } = useTheme();
  const partes = separarDireccion(value);
  return <View>
    {!!value && !value.includes(' #') && <Text style={styles.ayuda}>Dirección anterior: {value}. Completa los campos para actualizarla.</Text>}
    <Text style={styles.ayuda}>Escribe al menos Calle o Carrera. Puedes completar ambas.</Text>
    {(['calle', 'carrera', 'casa'] as const).map(campo => {
      const label = { calle: 'Calle', carrera: 'Carrera', casa: 'Número de la casa' }[campo];
      return <View key={campo}>
        <Text style={styles.label}>{label}{campo === 'casa' ? ' *' : ''}</Text>
        <TextInput accessibilityLabel={label} style={styles.input} value={partes[campo]}
          editable={editable} maxLength={70} placeholderTextColor={c.muted}
          placeholder={{ calle: 'Ej. 12A', carrera: 'Ej. 8', casa: 'Ej. 30-15' }[campo]}
          onChangeText={text => onChangeText(unirDireccion({ ...partes, [campo]: limpiarCampoDireccion(text) }))} />
      </View>;
    })}
  </View>;
}
const useStyles = makeStyles(c => ({
  label: { color: c.text, fontFamily: font.semibold, marginTop: 8, marginBottom: 6 },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 12 },
  input: { color: c.textStrong, fontFamily: font.regular, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, padding: 12 },
}));
