/**
 * Clave de 4 números en cuatro casillas, como en Nequi. Encima va un campo
 * invisible que abre el teclado numérico y recibe lo que se escribe; las
 * casillas solo muestran un punto por número.
 *
 * Con `vidrio` toma el aspecto hundido de la tarjeta de las pantallas de
 * acceso (ver CampoAcceso); sin él, el de los formularios de la app.
 *
 * Los estilos de foco cambian sin animación: quitar una animación nativa de
 * una vista viva cierra la app en Android (ver memoria de la animación
 * nativa condicional).
 */
import React, { forwardRef, useState } from 'react';
import { Pressable, StyleProp, Text, TextInput, View, ViewStyle } from 'react-native';
import { LARGO_CLAVE } from '../clave';
import { font, makeStyles, radius } from '../theme';

type Props = {
  value: string;
  onChangeText: (valor: string) => void;
  /** Al escribir el cuarto número (p. ej., para enviar sin tocar el botón). */
  onCompleto?: (valor: string) => void;
  vidrio?: boolean;
  autoFocus?: boolean;
  editable?: boolean;
  /** Pinta las casillas en rojo (la clave no sirvió). */
  conError?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const CampoPin = forwardRef<TextInput, Props>(function CasillasPin(
  { value, onChangeText, onCompleto, vidrio, autoFocus, editable = true, conError, accessibilityLabel = 'Clave de 4 números', style },
  ref,
) {
  const app = useEstilosApp();
  const deVidrio = useEstilosVidrio();
  const styles = vidrio ? deVidrio : app;
  const [enfocado, setEnfocado] = useState(false);
  const interno = React.useRef<TextInput>(null);

  function asignar(input: TextInput | null) {
    interno.current = input;
    if (typeof ref === 'function') ref(input);
    else if (ref) ref.current = input;
  }

  return (
    // Sin foco propio: si no, al perderlo el campo Android resalta la fila entera en gris.
    <Pressable
      style={[styles.fila, style]}
      onPress={() => interno.current?.focus()}
      disabled={!editable}
      accessible={false}
      focusable={false}>
      {Array.from({ length: LARGO_CLAVE }, (_, i) => {
        const lleno = i < value.length;
        const actual = enfocado && (i === value.length || (i === LARGO_CLAVE - 1 && value.length === LARGO_CLAVE));
        return (
          <View key={i} style={[styles.casilla, actual && styles.casillaActual, conError && styles.casillaError]}>
            {lleno ? <Text style={styles.punto}>●</Text> : null}
          </View>
        );
      })}
      <TextInput
        ref={asignar}
        style={styles.campoOculto}
        value={value}
        onChangeText={texto => {
          const limpio = texto.replace(/\D/g, '').slice(0, LARGO_CLAVE);
          onChangeText(limpio);
          if (limpio.length === LARGO_CLAVE && value.length < LARGO_CLAVE) onCompleto?.(limpio);
        }}
        keyboardType="number-pad"
        maxLength={LARGO_CLAVE}
        autoFocus={autoFocus}
        editable={editable}
        caretHidden
        contextMenuHidden
        underlineColorAndroid="transparent"
        autoComplete="off"
        importantForAutofill="no"
        autoCorrect={false}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Escribe 4 números"
      />
    </Pressable>
  );
});

export default CampoPin;

const ALTO = 54;

const useEstilosApp = makeStyles(c => ({
  // Abajo deja el espacio que FieldError espera debajo de un campo.
  fila: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 12 },
  casilla: {
    width: 52,
    height: ALTO,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: c.borderStrong,
    backgroundColor: c.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaActual: { borderColor: c.brand, borderWidth: 2 },
  casillaError: { borderColor: c.danger },
  punto: { color: c.textStrong, fontSize: 18, fontFamily: font.bold, includeFontPadding: false },
  // Encima de las casillas: recibe los toques y lo que se escribe, sin verse
  // (sin fondo: el EditText de Android pinta uno gris aunque tenga opacity 0).
  campoOculto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent', backgroundColor: 'transparent' },
}));

const useEstilosVidrio = makeStyles((c, _sombras, l) => ({
  fila: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  casilla: {
    flex: 1,
    maxWidth: 64,
    height: ALTO,
    borderRadius: radius.md,
    backgroundColor: l.campo,
    boxShadow: `inset 0px 2px 5px 0px ${l.campoHundido}, inset 0px -1px 0px 0px ${l.campoFilo}`,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  casillaActual: { borderColor: l.foco, boxShadow: `0px 0px 0px 3px ${l.foco}` },
  casillaError: { borderColor: c.danger },
  punto: { color: l.campoTexto, fontSize: 18, fontFamily: font.bold, includeFontPadding: false },
  campoOculto: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, color: 'transparent', backgroundColor: 'transparent' },
}));
