import React from 'react';
import { Text, View } from 'react-native';
import { FotosDireccion as Fotos } from '../api';
import { API_URL } from '../config';
import SelectorImagen from './SelectorImagen';
import { useTheme } from '../theme';

export const fotosCompletas = (f: Fotos | undefined) => !!(f?.frente && f?.izquierda && f?.derecha);
export default function FotosDireccion({ fotos, onChange, token, disabled }: {
  fotos: Fotos; onChange: (f: Fotos) => void; token: string; disabled?: boolean;
}) {
  const { c } = useTheme();
  return <View>
    <Text style={{ color: c.text }}>Añade tres fotos: el frente de tu casa y la calle hacia cada lado. Solo el domiciliario asignado podrá verlas durante la entrega.</Text>
    {(['frente', 'izquierda', 'derecha'] as const).map(tipo => <SelectorImagen key={tipo}
      label={{ frente: 'Frente de la casa', izquierda: 'Calle hacia la izquierda', derecha: 'Calle hacia la derecha' }[tipo]}
      uri={fotos[tipo]?.startsWith('/api/') ? `${API_URL}${fotos[tipo]}` : fotos[tipo]}
      headers={fotos[tipo]?.startsWith('/api/') ? { Authorization: `Bearer ${token}` } : undefined}
      onSelect={uri => onChange({ ...fotos, [tipo]: uri })} disabled={disabled} />)}
  </View>;
}
