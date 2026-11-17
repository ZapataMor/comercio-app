/**
 * Aviso fijo en el panel del domiciliario cuando su ubicación NO se está
 * compartiendo: sin permiso, con la ubicación aproximada o con el GPS apagado.
 * Sin esto, un permiso negado solo dejaba un toast pasajero y el cliente nunca
 * veía al domiciliario en el mapa.
 *
 * El botón lo arregla (vuelve a pedir el permiso o abre los Ajustes). Al
 * volver a Vitrina se comprueba solo y el aviso desaparece.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { font, makeStyles, radius, useTheme } from '../theme';
import { arreglarUbicacion, EstadoUbicacion, useEstadoUbicacion } from '../ubicacion';
import { PressableScale } from './anim';
import Icon from './Icon';

type Problema = Exclude<EstadoUbicacion, 'activa' | 'buscando'>;

const TEXTOS: Record<Problema, { titulo: string; texto: string; boton: string }> = {
  'sin-permiso': {
    titulo: 'Tu ubicación no se está compartiendo',
    texto: 'Vitrina necesita tu ubicación precisa para que el cliente y el negocio vean por dónde vas.',
    boton: 'Permitir ubicación',
  },
  aproximada: {
    titulo: 'Activa la ubicación precisa',
    texto: 'Con la ubicación aproximada el cliente no puede ver por dónde vas.',
    boton: 'Usar ubicación precisa',
  },
  bloqueado: {
    titulo: 'Tu ubicación no se está compartiendo',
    texto:
      'Actívala en Ajustes: Permisos → Ubicación → «Permitir solo mientras se usa la app» y enciende «Usar ubicación precisa».',
    boton: 'Abrir ajustes',
  },
  'gps-apagado': {
    titulo: 'No encontramos tu ubicación',
    texto: 'Revisa que la ubicación (GPS) del teléfono esté encendida.',
    boton: 'Encender ubicación',
  },
};

export default function AvisoUbicacion() {
  const { c } = useTheme();
  const styles = useStyles();
  const estado = useEstadoUbicacion();
  const [abriendo, setAbriendo] = useState(false);

  if (!estado || estado === 'activa' || estado === 'buscando') return null;
  const { titulo, texto, boton } = TEXTOS[estado];

  async function arreglar() {
    setAbriendo(true);
    try {
      await arreglarUbicacion();
    } catch {
      // Sin Ajustes que abrir: el texto ya dice qué hacer.
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <View style={styles.aviso} accessibilityRole="alert">
      <View style={styles.cabeza}>
        <Icon name="ubicacion" size={20} color={c.danger} />
        <Text style={styles.titulo}>{titulo}</Text>
      </View>
      <Text style={styles.texto}>{texto}</Text>
      <PressableScale
        onPress={arreglar}
        disabled={abriendo}
        accessibilityRole="button"
        accessibilityLabel={boton}
        style={styles.boton}>
        {abriendo ? (
          <ActivityIndicator size="small" color={c.onAccent} />
        ) : (
          <Text style={styles.botonTxt}>{boton}</Text>
        )}
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  aviso: {
    backgroundColor: c.dangerSoft,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: c.danger,
  },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { flex: 1, color: c.danger, fontFamily: font.bold, fontSize: 15 },
  texto: { color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginTop: 6 },
  boton: {
    alignSelf: 'flex-start',
    minWidth: 160,
    alignItems: 'center',
    backgroundColor: c.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginTop: 12,
  },
  botonTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 14 },
}));
