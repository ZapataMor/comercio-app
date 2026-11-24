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
import { useBloqueConTeclado } from './EspacioTeclado';

/** Lo ve quien tiene que dictar el código. `grande`: para el cliente, más fácil de leer y dictar. */
export function VerCodigo({ titulo, codigo, ayuda, grande }: { titulo: string; codigo: string; ayuda: string; grande?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.caja, grande && styles.cajaGrande]} accessible accessibilityLabel={`${titulo}: ${codigo.split('').join(' ')}. ${ayuda}`}>
      <Text style={[styles.titulo, grande && styles.tituloGrande]}>{titulo}</Text>
      <Text style={[styles.digitos, grande && styles.digitosGrandes]}>{codigo}</Text>
      <Text style={[styles.ayuda, grande && styles.ayudaGrande]}>{ayuda}</Text>
    </View>
  );
}

/** Lo ve quien tiene que escribir el código que le dictan. */
export function PedirCodigo({
  titulo,
  ayuda,
  textoBoton,
  compacto,
  onConfirmar,
}: {
  titulo: string;
  ayuda?: string;
  textoBoton: string;
  /** Campo y botón en una fila, para que quepa dentro de una tarjeta de lista. */
  compacto?: boolean;
  /** Si el código no es correcto, debe lanzar el error para mostrarlo aquí. */
  onConfirmar: (codigo: string) => Promise<void>;
}) {
  // Al escribir el código también se ve el botón que lo confirma.
  const bloque = useBloqueConTeclado();
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

  const campo = (
    <TextInput
      style={[styles.input, compacto && styles.inputCompacto]}
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
      onFocus={bloque.onFocus}
      onBlur={bloque.onBlur}
    />
  );
  const boton = (
    <PressableScale style={[styles.boton, compacto && styles.botonCompacto]} onPress={confirmar} disabled={enviando}>
      {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTxt}>{textoBoton}</Text>}
    </PressableScale>
  );

  return (
    <View ref={bloque.ref} style={styles.caja}>
      <Text style={styles.titulo}>{titulo}</Text>
      {!!ayuda && <Text style={styles.ayuda}>{ayuda}</Text>}
      {compacto ? (
        <View style={[styles.filaCompacta, !!error && styles.filaConError]}>
          {campo}
          {boton}
        </View>
      ) : (
        campo
      )}
      <FieldError mensaje={error} />
      {!compacto && boton}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  caja: { backgroundColor: c.accentSoft, borderRadius: radius.md, padding: 14, marginTop: 10 },
  titulo: { color: c.goldText, fontFamily: font.bold, fontSize: 13 },
  digitos: { color: c.textStrong, fontFamily: font.extra, fontSize: 34, letterSpacing: 8, marginVertical: 4 },
  ayuda: { color: c.text, fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  cajaGrande: { alignItems: 'center', padding: 16, marginTop: 14, borderWidth: 1, borderColor: c.accent },
  tituloGrande: { fontSize: 15 },
  digitosGrandes: { fontSize: 46, letterSpacing: 14, marginVertical: 6, paddingLeft: 14 },
  ayudaGrande: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
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
  filaCompacta: { flexDirection: 'row', alignItems: 'stretch', gap: 8, marginTop: 8 },
  // FieldError se apoya en el aire de abajo, como en el campo normal.
  filaConError: { marginBottom: 12 },
  inputCompacto: { flex: 1, marginTop: 0, marginBottom: 0, paddingVertical: 8, fontSize: 20 },
  botonCompacto: { paddingHorizontal: 16, justifyContent: 'center' },
  boton: {
    backgroundColor: c.brand,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  botonTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
}));
