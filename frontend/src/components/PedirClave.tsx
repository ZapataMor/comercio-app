/**
 * Pide la clave de 4 números antes de algo: entrar con «Continuar como» o
 * con Google, o una acción delicada (eliminar la cuenta, cambiar el celular,
 * desconectar Google, cambiar las cuentas de pago del negocio).
 *
 *   const clave = usePedirClave();
 *   clave.pedir({ titulo: 'Eliminar mi cuenta', accion: pin => eliminarCuenta(token, pin) });
 *   ...
 *   {clave.modal}
 *
 * Al escribir el cuarto número hace la `accion` con la clave. Si falla, el
 * error se ve aquí y la clave se borra para escribirla otra vez; si quedó
 * bloqueada, ofrece desbloquearla (`onOlvide`, solo donde hay cómo).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { claveBloqueada, esErrorDeClave } from '../api';
import { messageFromError } from '../formErrors';
import { font, makeStyles, radius, useTheme } from '../theme';
import CampoPin from './CampoPin';
import { EspacioTecladoModal } from './EspacioTeclado';
import Icon from './Icon';

export type OpcionesClave = {
  titulo?: string;
  texto?: string;
  /** Pinta el botón en rojo (acciones que quitan algo). */
  peligro?: boolean;
  textoBoton?: string;
  /** Lo que se hace con la clave. Si lanza un error, se muestra en el modal. */
  accion: (pin: string) => Promise<unknown>;
  /** «¿Olvidaste tu clave?» (desbloquearla o crear una nueva). */
  onOlvide?: () => void;
  /**
   * Errores que no son de la clave (p. ej., un dato del formulario): el modal
   * se cierra y el error va aquí. Sin esto, todo error se muestra en el modal.
   */
  onOtroError?: (e: unknown) => void;
};

type Props = OpcionesClave & { visible: boolean; onCerrar: () => void };

export default function PedirClaveModal({
  visible,
  titulo = 'Escribe tu clave',
  texto,
  peligro,
  textoBoton = 'Confirmar',
  accion,
  onOlvide,
  onOtroError,
  onCerrar,
}: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bloqueada, setBloqueada] = useState(false);
  const [cargando, setCargando] = useState(false);
  const campo = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPin('');
      setError(null);
      setBloqueada(false);
      setCargando(false);
    }
  }, [visible]);

  async function enviar(clave = pin) {
    if (clave.length !== 4) {
      setError('Escribe los 4 números de tu clave.');
      return;
    }
    setCargando(true);
    setError(null);
    try {
      await accion(clave);
      onCerrar();
    } catch (e) {
      if (onOtroError && !esErrorDeClave(e)) {
        onCerrar();
        onOtroError(e);
        return;
      }
      setError(messageFromError(e));
      setBloqueada(claveBloqueada(e));
      setPin('');
      // Tras un error vuelve el teclado para escribirla otra vez.
      setTimeout(() => campo.current?.focus(), 50);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !cargando && onCerrar()}>
      <EspacioTecladoModal style={styles.fondo}>
        <View style={styles.caja}>
          <View style={styles.icono}>
            <Icon name="candado" size={22} color={peligro ? c.danger : c.brand} />
          </View>
          <Text style={styles.titulo}>{titulo}</Text>
          {texto ? <Text style={styles.texto}>{texto}</Text> : null}

          <CampoPin
            ref={campo}
            value={pin}
            onChangeText={v => {
              // Mientras se revisa no se escribe, pero el campo sigue activo (no pierde el foco).
              if (cargando) return;
              setPin(v);
              setError(null);
            }}
            onCompleto={v => !cargando && enviar(v)}
            autoFocus
            editable={!bloqueada}
            conError={!!error}
            accessibilityLabel="Escribe tu clave de 4 números"
            style={styles.pin}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {bloqueada && onOlvide ? (
            <TouchableOpacity
              style={styles.boton}
              onPress={() => {
                onCerrar();
                onOlvide();
              }}>
              <Text style={styles.botonTxt}>Desbloquear mi clave</Text>
            </TouchableOpacity>
          ) : !bloqueada ? (
            <TouchableOpacity
              style={[styles.boton, peligro && styles.botonPeligro, cargando && styles.botonInactivo]}
              onPress={() => enviar()}
              disabled={cargando}
              accessibilityRole="button">
              {cargando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTxt}>{textoBoton}</Text>}
            </TouchableOpacity>
          ) : null}

          {onOlvide && !bloqueada ? (
            <TouchableOpacity
              onPress={() => {
                onCerrar();
                onOlvide();
              }}
              disabled={cargando}>
              <Text style={styles.enlace}>¿Olvidaste tu clave?</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onCerrar} disabled={cargando}>
            <Text style={styles.cancelar}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </EspacioTecladoModal>
    </Modal>
  );
}

/** Un modal de clave listo para usar en una pantalla: `pedir(opciones)` y poner `modal` en el árbol. */
export function usePedirClave() {
  const [opciones, setOpciones] = useState<OpcionesClave | null>(null);
  const pedir = useCallback((o: OpcionesClave) => setOpciones(o), []);
  const cerrar = useCallback(() => setOpciones(null), []);
  const modal = (
    <PedirClaveModal
      visible={!!opciones}
      {...(opciones ?? { accion: async () => {} })}
      onCerrar={cerrar}
    />
  );
  return { pedir, cerrar, modal };
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  caja: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 22, ...shadow.card },
  icono: {
    alignSelf: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  titulo: { fontSize: 19, fontFamily: font.display, color: c.textStrong, textAlign: 'center', marginBottom: 6 },
  texto: { fontSize: 13.5, fontFamily: font.regular, color: c.text, lineHeight: 19, textAlign: 'center', marginBottom: 6 },
  pin: { marginTop: 14 },
  error: { color: c.danger, fontFamily: font.semibold, fontSize: 13, textAlign: 'center', marginTop: 10 },
  boton: {
    backgroundColor: c.brand,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
    ...shadow.soft,
  },
  botonPeligro: { backgroundColor: c.danger },
  botonInactivo: { opacity: 0.7 },
  botonTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
  enlace: { textAlign: 'center', color: c.goldText, fontFamily: font.semibold, fontSize: 13, marginTop: 14 },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
}));
