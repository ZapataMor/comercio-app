/**
 * Estilos y piezas compartidas por lo que va dentro de la tarjeta de vidrio
 * (login, registro y registro con Google): logo, botón de volver, títulos,
 * botón principal, enlaces, separador, avisos y la casilla de la política de
 * privacidad.
 * Los colores salen de `paletasLogin` (theme.tsx), igual que el login.
 */
import React, { useEffect, useRef } from 'react';
import { BackHandler, Linking, StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { WEB_URL } from '../../config';
import { font, makeStyles, radius, useTheme } from '../../theme';
import { PressableScale } from '../anim';
import Icon from '../Icon';
import { marca, VitrinaLogo } from '../Logo';

export const useEstilosAcceso = makeStyles((c, _sombras, l) => ({
  logo: { alignSelf: 'center', marginBottom: 20 },
  // «Volver»: círculo arriba a la izquierda, a la altura del logo (40 de
  // alto) y sin moverlo. Mismo fondo que las píldoras de «Continuar como».
  volver: {
    position: 'absolute',
    top: 0,
    left: -6,
    zIndex: 1,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: l.campo,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  recuadroEtiqueta: { color: l.rotulo, opacity: 0.85, fontFamily: font.semibold, fontSize: 13, letterSpacing: 0.2 },
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

/**
 * El botón «atrás» de Android hace lo mismo que la flecha de la tarjeta
 * (ir al paso o la pantalla anterior). Con `alVolver` null no hace nada y
 * Android sigue con lo suyo.
 */
export function useAtrasAndroid(alVolver: (() => void) | null) {
  const ref = useRef(alVolver);
  ref.current = alVolver;
  const hay = !!alVolver;
  useEffect(() => {
    if (!hay) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!ref.current) return false;
      ref.current();
      return true;
    });
    return () => sub.remove();
  }, [hay]);
}

/**
 * Flecha para volver a la vista anterior (un paso atrás o la pantalla de
 * antes). Va primero dentro de la tarjeta, antes del logo: queda en la
 * esquina sin empujarlo. Úsese junto con useAtrasAndroid.
 */
export function BotonVolverAcceso({
  onPress,
  disabled,
  accessibilityLabel = 'Volver',
}: {
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { login: l } = useTheme();
  const e = useEstilosAcceso();
  return (
    <PressableScale
      style={[e.volver, disabled && e.botonInactivo]}
      scaleTo={0.9}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <Icon name="atras" size={20} color={l.campoTexto} strokeWidth={2} />
    </PressableScale>
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
