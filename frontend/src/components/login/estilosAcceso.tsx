/**
 * Estilos y piezas compartidas por lo que va dentro de la tarjeta de vidrio
 * (login, registro y registro con Google): logo, títulos, botón principal,
 * enlaces, separador, avisos y la casilla de la política de privacidad.
 * Los colores salen de `paletasLogin` (theme.tsx), igual que el login.
 */
import React from 'react';
import { Linking, StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { WEB_URL } from '../../config';
import { font, makeStyles, radius, useTheme } from '../../theme';
import Icon from '../Icon';
import { marca, VitrinaLogo } from '../Logo';

export const useEstilosAcceso = makeStyles((c, _sombras, l) => ({
  logo: { alignSelf: 'center', marginBottom: 20 },
  titulo: {
    color: l.rotulo,
    fontFamily: font.display,
    fontSize: 20,
    textAlign: 'center',
    marginTop: -6,
  },
  subtitulo: {
    color: l.rotulo,
    opacity: 0.8,
    fontFamily: font.medium,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  texto: { color: l.rotulo, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  ayuda: { color: l.rotulo, opacity: 0.8, fontFamily: font.regular, fontSize: 12, marginTop: -4, marginBottom: 12 },
  bloqueCampo: { marginBottom: 12 },
  boton: {
    height: 51,
    borderRadius: radius.md,
    backgroundColor: l.boton,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  botonInactivo: { opacity: 0.7 },
  botonTexto: { color: l.botonTexto, fontFamily: font.bold, fontSize: 16, includeFontPadding: false },
  // «¿No tienes cuenta? Regístrate» y parecidos, al pie de la tarjeta.
  pie: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  pieTexto: { color: l.rotulo, fontFamily: font.regular, fontSize: 14, textAlign: 'center' },
  enlace: { color: l.rotulo, fontFamily: font.bold, textDecorationLine: 'underline' },
  // Aviso general: mismos colores de error que el resto de la app.
  error: {
    backgroundColor: c.dangerSoft,
    color: c.danger,
    fontFamily: font.medium,
    padding: 10,
    borderRadius: radius.sm,
    marginBottom: 16,
    fontSize: 13,
  },
  separador: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 14 },
  separadorLinea: { flex: 1, height: 1, backgroundColor: l.rotulo, opacity: 0.25 },
  separadorTxt: { color: l.rotulo, fontFamily: font.medium, fontSize: 12 },
  // Recuadro hundido con un dato ya confirmado (celular, cuenta de Google).
  recuadro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radius.md,
    backgroundColor: l.campo,
    boxShadow: `inset 0px 2px 5px 0px ${l.campoHundido}, inset 0px -1px 0px 0px ${l.campoFilo}`,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  recuadroTexto: { flex: 1 },
  recuadroEtiqueta: { color: l.rotulo, opacity: 0.8, fontFamily: font.bold, fontSize: 11, letterSpacing: 1.1 },
  recuadroValor: { color: l.campoTexto, fontFamily: font.semibold, fontSize: 15, marginTop: 2 },
  recuadroAccion: { color: l.rotulo, fontFamily: font.bold, fontSize: 13, textDecorationLine: 'underline' },
  // Casilla de la política de privacidad.
  terminosFila: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4, marginBottom: 12 },
  casilla: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: l.rotulo,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  casillaMarcada: { backgroundColor: l.boton, borderColor: l.boton },
  terminosTexto: { flex: 1 },
  nota: { color: l.rotulo, opacity: 0.8, fontFamily: font.regular, fontSize: 12, textAlign: 'center', marginBottom: 14 },
}));

/** Logo de Vitrina en la cabecera de la tarjeta, como en el login. */
export function LogoAcceso() {
  const { modo } = useTheme();
  const e = useEstilosAcceso();
  return (
    <VitrinaLogo
      height={40}
      chip={false}
      modo={modo}
      textColor={modo === 'noche' ? marca.arena : marca.tinta}
      style={e.logo}
    />
  );
}

/** Línea con un texto en medio («o», «o con tu celular»). */
export function SeparadorAcceso({ texto }: { texto: string }) {
  const e = useEstilosAcceso();
  return (
    <View style={e.separador}>
      <View style={e.separadorLinea} />
      <Text style={e.separadorTxt}>{texto}</Text>
      <View style={e.separadorLinea} />
    </View>
  );
}

/** Autorización del tratamiento de datos (Ley 1581): sin marcar por defecto. */
export function CasillaPolitica({
  marcada,
  alCambiar,
  deshabilitada,
  style,
}: {
  marcada: boolean;
  alCambiar: () => void;
  deshabilitada?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { login: l } = useTheme();
  const e = useEstilosAcceso();
  return (
    <View style={[e.terminosFila, style]}>
      <TouchableOpacity
        style={[e.casilla, marcada && e.casillaMarcada]}
        onPress={alCambiar}
        disabled={deshabilitada}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityLabel="Acepto la política de privacidad"
        accessibilityState={{ checked: marcada }}>
        {marcada && <Icon name="check" size={14} color={l.botonTexto} />}
      </TouchableOpacity>
      <Text style={[e.texto, e.terminosTexto]}>
        Acepto la{' '}
        <Text style={e.enlace} onPress={() => Linking.openURL(`${WEB_URL}/privacidad`)}>
          política de privacidad
        </Text>{' '}
        y autorizo el tratamiento de mis datos para gestionar mis pedidos.
      </Text>
    </View>
  );
}
