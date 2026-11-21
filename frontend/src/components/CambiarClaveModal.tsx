/**
 * «Cambiar mi clave» (Mi información): la clave actual y la nueva escrita dos
 * veces. La actual cuenta como un intento: a los 5 fallos se bloquea y hay
 * que crear otra con «¿Olvidaste tu clave?» al entrar.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { guardarClave, Usuario } from '../api';
import { erroresClaveNueva } from '../clave';
import { fieldErrorsFromError, messageFromError } from '../formErrors';
import { font, makeStyles, radius, useTheme } from '../theme';
import CampoPin from './CampoPin';
import { EspacioTecladoModal } from './EspacioTeclado';
import FieldError from './FieldError';

type Props = {
  visible: boolean;
  token: string;
  onCerrar: () => void;
  onListo: (user: Usuario) => void;
};

type Errores = { pin_actual?: string; pin?: string; confirmar?: string };

export default function CambiarClaveModal({ visible, token, onCerrar, onListo }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [errores, setErrores] = useState<Errores>({});
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (visible) {
      setActual('');
      setNueva('');
      setConfirmar('');
      setErrores({});
    }
  }, [visible]);

  async function guardar() {
    if (actual.length !== 4) {
      setErrores({ pin_actual: 'Escribe tu clave actual.' });
      return;
    }
    const nuevos = erroresClaveNueva(nueva, confirmar);
    if (nuevos.pin || nuevos.confirmar) {
      setErrores(nuevos);
      return;
    }
    setCargando(true);
    setErrores({});
    try {
      const r = await guardarClave(token, nueva, actual);
      onListo(r.user);
    } catch (e) {
      const campos = fieldErrorsFromError(e, { pin_confirmation: 'confirmar' });
      if (campos.pin_actual) setActual('');
      setErrores(Object.keys(campos).length ? campos : { pin_actual: messageFromError(e) });
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !cargando && onCerrar()}>
      <EspacioTecladoModal style={styles.fondo}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.caja}>
            <Text style={styles.titulo}>Cambiar mi clave</Text>
            <Text style={styles.texto}>4 números que no sean fáciles de adivinar: ni repetidos (0000) ni seguidos (1234).</Text>

            <Text style={styles.label}>Clave actual</Text>
            <CampoPin
              value={actual}
              onChangeText={v => {
                setActual(v);
                setErrores({});
              }}
              autoFocus
              editable={!cargando}
              conError={!!errores.pin_actual}
              accessibilityLabel="Clave actual"
            />
            <FieldError mensaje={errores.pin_actual} />

            <Text style={styles.label}>Clave nueva</Text>
            <CampoPin
              value={nueva}
              onChangeText={v => {
                setNueva(v);
                setErrores({});
              }}
              editable={!cargando}
              conError={!!errores.pin}
              accessibilityLabel="Clave nueva"
            />
            <FieldError mensaje={errores.pin} />

            <Text style={styles.label}>Escríbela otra vez</Text>
            <CampoPin
              value={confirmar}
              onChangeText={v => {
                setConfirmar(v);
                setErrores({});
              }}
              editable={!cargando}
              conError={!!errores.confirmar}
              accessibilityLabel="Confirma la clave nueva"
            />
            <FieldError mensaje={errores.confirmar} />

            <TouchableOpacity style={[styles.boton, cargando && styles.inactivo]} onPress={guardar} disabled={cargando}>
              {cargando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTxt}>Guardar clave</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={onCerrar} disabled={cargando}>
              <Text style={styles.cancelar}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </EspacioTecladoModal>
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  caja: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 22, ...shadow.card },
  titulo: { fontSize: 19, fontFamily: font.display, color: c.textStrong, marginBottom: 6 },
  texto: { fontSize: 13, fontFamily: font.regular, color: c.text, lineHeight: 19, marginBottom: 6 },
  label: { fontSize: 13, fontFamily: font.semibold, color: c.text, marginTop: 12, marginBottom: 8 },
  boton: { backgroundColor: c.brand, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 18, ...shadow.soft },
  inactivo: { opacity: 0.7 },
  botonTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
}));
