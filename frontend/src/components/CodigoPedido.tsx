/**
 * Códigos de 4 dígitos que confirman que el pedido pasó a las manos correctas:
 *  - Recogida: el domiciliario lo ve y se lo dicta al negocio, que lo escribe.
 *  - Entrega: el cliente lo ve y se lo dicta al domiciliario, que lo escribe.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { fieldErrorsFromError, messageFromError } from '../formErrors';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import FieldError from './FieldError';

/** Lo ve quien tiene que dictar el código. */
export function VerCodigo({ titulo, codigo, ayuda }: { titulo: string; codigo: string; ayuda: string }) {
  const styles = useStyles();
  return (
    <View style={styles.caja} accessible accessibilityLabel={`${titulo}: ${codigo.split('').join(' ')}. ${ayuda}`}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.digitos}>{codigo}</Text>
      <Text style={styles.ayuda}>{ayuda}</Text>
    </View>
  );
}

/** Lo ve quien tiene que escribir el código que le dictan. */
export function PedirCodigo({
  titulo,
  ayuda,
  textoBoton,
  onConfirmar,
}: {
  titulo: string;
  ayuda: string;
  textoBoton: string;
  /** Si el código no es correcto, debe lanzar el error para mostrarlo aquí. */
  onConfirmar: (codigo: string) => Promise<void>;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const [codigo, setCodigo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function confirmar() {
    if (codigo.length !== 4) {
      setError('Escribe los 4 dígitos del código.');
      return;
    }
    setError(undefined);
    setEnviando(true);
    try {
      await onConfirmar(codigo);
    } catch (e) {
      setError(fieldErrorsFromError(e).codigo ?? messageFromError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={styles.caja}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.ayuda}>{ayuda}</Text>
      <TextInput
        style={styles.input}
        value={codigo}
        onChangeText={v => {
          setCodigo(v.replace(/\D/g, ''));
          setError(undefined);
        }}
        keyboardType="number-pad"
        maxLength={4}
        placeholder="0000"
        placeholderTextColor={c.mutedSoft}
        editable={!enviando}
        accessibilityLabel={titulo}
      />
      <FieldError mensaje={error} />
      <PressableScale style={styles.boton} onPress={confirmar} disabled={enviando}>
        {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTxt}>{textoBoton}</Text>}
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  caja: { backgroundColor: c.accentSoft, borderRadius: radius.md, padding: 14, marginTop: 10 },
  titulo: { color: c.goldText, fontFamily: font.bold, fontSize: 13 },
  digitos: { color: c.textStrong, fontFamily: font.extra, fontSize: 34, letterSpacing: 8, marginVertical: 4 },
  ayuda: { color: c.text, fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    paddingVertical: 10,
    marginTop: 10,
    // Mismo aire que los demás campos: FieldError se apoya en él.
    marginBottom: 12,
    color: c.textStrong,
    fontFamily: font.bold,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
  },
  boton: {
    backgroundColor: c.brand,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botonTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
}));
