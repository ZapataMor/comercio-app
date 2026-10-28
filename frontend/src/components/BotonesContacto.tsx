/**
 * Botones "Llamar" y "WhatsApp" para un teléfono (cliente, negocio o
 * domiciliario). Abren el marcador o el chat de WhatsApp del teléfono; no
 * piden permisos ni guardan nada.
 *
 * Uso: <BotonesContacto telefono={pedido.telefono_contacto} mensaje="Hola, soy..." />
 */
import React from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import Icon from './Icon';

type Props = {
  telefono?: string | null;
  /** Texto con el que se abre el chat de WhatsApp. */
  mensaje?: string;
  /** Etiqueta del botón de llamar (por defecto "Llamar"). */
  etiquetaLlamar?: string;
};

/** Solo dígitos; un celular colombiano de 10 dígitos recibe el indicativo 57. */
export function telefonoInternacional(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.length === 10 && digitos.startsWith('3')) return `57${digitos}`;
  return digitos;
}

/** Burbuja de chat (estilo de línea, como los demás íconos). */
function IconoWhatsapp({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.4L3.5 20.5l1.6-4.2A8.5 8.5 0 1 1 20.5 11.6z" />
      <Path d="M9 8.8c0 3.3 2.7 6.2 6 6.2l1.2-1.5-2-1-1 .9c-1-.5-2-1.5-2.5-2.5l.9-1-1-2z" />
    </Svg>
  );
}

export default function BotonesContacto({ telefono, mensaje, etiquetaLlamar = 'Llamar' }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();

  if (!telefono || !telefono.replace(/\D/g, '')) return null;
  const numero = telefonoInternacional(telefono);

  async function abrir(url: string, queFalla: string) {
    try {
      await Linking.openURL(url);
    } catch {
      toast.error(`No se pudo abrir ${queFalla}`, telefono ?? undefined);
    }
  }

  const textoWa = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';

  return (
    <View style={styles.fila}>
      <TouchableOpacity
        style={styles.boton}
        onPress={() => abrir(`tel:${telefono.replace(/[^\d+]/g, '')}`, 'el marcador')}
        accessibilityLabel={`${etiquetaLlamar} al ${telefono}`}>
        <Icon name="telefono" size={16} color={c.accent} />
        <Text style={styles.txt}>{etiquetaLlamar}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.boton}
        onPress={() => abrir(`https://wa.me/${numero}${textoWa}`, 'WhatsApp')}
        accessibilityLabel={`Escribir por WhatsApp al ${telefono}`}>
        <IconoWhatsapp color={c.accent} />
        <Text style={styles.txt}>WhatsApp</Text>
      </TouchableOpacity>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  fila: { flexDirection: 'row', gap: 8, marginTop: 8 },
  boton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.borderStrong,
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7,
  },
  txt: { color: c.textStrong, fontFamily: font.semibold, fontSize: 13 },
}));
