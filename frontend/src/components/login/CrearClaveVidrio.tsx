/**
 * «Crea tu clave» en la tarjeta de vidrio: la clave de 4 números escrita dos
 * veces, revisada antes de enviar con las mismas reglas del backend (ver
 * src/clave.ts). La usan el registro con el celular y el registro con Google.
 *
 * `errorServidor` muestra el error del backend sobre la clave (y la borra
 * para escribirla otra vez).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { erroresClaveNueva } from '../../clave';
import { font, makeStyles, useTheme } from '../../theme';
import { PressableScale } from '../anim';
import CampoPin from '../CampoPin';
import FieldError from '../FieldError';
import { useEstilosAcceso } from './estilosAcceso';

type Props = {
  textoBoton: string;
  cargando: boolean;
  onCrear: (pin: string) => void;
  errorServidor?: string | null;
};

export default function CrearClaveVidrio({ textoBoton, cargando, onCrear, errorServidor }: Props) {
  const { login: l } = useTheme();
  const e = useEstilosAcceso();
  const styles = useStyles();
  const [clave, setClave] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errores, setErrores] = useState<{ pin?: string; confirmar?: string }>({});
  const segundo = useRef<TextInput>(null);
  const primero = useRef<TextInput>(null);

  // Un error del backend sobre la clave: se borra para escribirla otra vez.
  useEffect(() => {
    if (errorServidor) {
      setErrores({ pin: errorServidor });
      setClave('');
      setConfirmar('');
    }
  }, [errorServidor]);

  function crear(confirmacion = confirmar) {
    const nuevos = erroresClaveNueva(clave, confirmacion);
    if (nuevos.pin || nuevos.confirmar) {
      setErrores(nuevos);
      setConfirmar('');
      if (nuevos.pin) {
        setClave('');
        primero.current?.focus();
      } else {
        segundo.current?.focus();
      }
      return;
    }
    onCrear(clave);
  }

  return (
    <View>
      <Text style={e.texto}>
        Con tu clave entras a Vitrina, como en Nequi. Usa 4 números que no sean fáciles de adivinar: ni repetidos
        (0000) ni seguidos (1234).
      </Text>

      <Text style={styles.rotulo}>TU CLAVE</Text>
      <CampoPin
        ref={primero}
        vidrio
        value={clave}
        onChangeText={v => {
          setClave(v);
          setErrores({});
        }}
        onCompleto={() => segundo.current?.focus()}
        autoFocus
        editable={!cargando}
        conError={!!errores.pin}
        accessibilityLabel="Tu clave de 4 números"
      />
      <FieldError mensaje={errores.pin} />

      <Text style={[styles.rotulo, styles.rotuloSegundo]}>ESCRÍBELA OTRA VEZ</Text>
      <CampoPin
        ref={segundo}
        vidrio
        value={confirmar}
        onChangeText={v => {
          setConfirmar(v);
          setErrores({});
        }}
        onCompleto={v => crear(v)}
        editable={!cargando}
        conError={!!errores.confirmar}
        accessibilityLabel="Confirma tu clave"
      />
      <FieldError mensaje={errores.confirmar} />

      <PressableScale
        style={[e.boton, styles.boton, cargando && e.botonInactivo]}
        scaleTo={0.97}
        onPress={() => crear()}
        disabled={cargando}
        accessibilityRole="button">
        {cargando ? <ActivityIndicator size="small" color={l.botonTexto} /> : <Text style={e.botonTexto}>{textoBoton}</Text>}
      </PressableScale>
    </View>
  );
}

const useStyles = makeStyles((_c, _sombras, l) => ({
  rotulo: { color: l.rotulo, fontFamily: font.bold, fontSize: 11, letterSpacing: 1.3, marginTop: 14, marginBottom: 8 },
  rotuloSegundo: { marginTop: 4 },
  boton: { marginTop: 8 },
}));
