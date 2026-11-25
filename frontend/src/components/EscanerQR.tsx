/**
 * Escáner del QR del panel web del negocio (Vitrina Gestión, ADR-005).
 *
 * Pide el permiso de cámara, abre la cámara a pantalla completa y, al leer un
 * QR de la página /negocio/entrar («vitrina-web:ABCDEFGH»), entrega el código
 * y se cierra. Un QR de otra cosa no se acepta: se avisa y se sigue leyendo.
 *
 * La cámara la pone react-native-camera-kit (ML Kit para leer el código).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Linking, Modal, PermissionsAndroid, Platform, Text, TouchableOpacity, View } from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, makeStyles, radius } from '../theme';

/** Saca el código del contenido del QR, o null si el QR no es de Vitrina. */
export function codigoDeQrWeb(contenido: string): string | null {
  const m = /^vitrina-web:([A-Z0-9]{8})$/i.exec(contenido.trim());
  return m ? m[1].toUpperCase() : null;
}

type Permiso = 'preguntando' | 'si' | 'no' | 'nunca';

async function pedirCamara(): Promise<Permiso> {
  if (Platform.OS !== 'android') return 'si';
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Usar la cámara',
    message: 'Vitrina usa la cámara solo para leer el código QR del panel web.',
    buttonPositive: 'Permitir',
    buttonNegative: 'Ahora no',
  });
  if (r === PermissionsAndroid.RESULTS.GRANTED) return 'si';
  return r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'nunca' : 'no';
}

type Props = { visible: boolean; onCodigo: (codigo: string) => void; onCerrar: () => void };

export default function EscanerQR({ visible, onCodigo, onCerrar }: Props) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [permiso, setPermiso] = useState<Permiso>('preguntando');
  const [aviso, setAviso] = useState<string | null>(null);
  // La cámara avisa varias veces por segundo mientras ve el QR: solo vale la primera.
  const leido = useRef(false);

  useEffect(() => {
    if (!visible) return;
    leido.current = false;
    setAviso(null);
    setPermiso('preguntando');
    let vivo = true;
    pedirCamara()
      .then(p => vivo && setPermiso(p))
      .catch(() => vivo && setPermiso('no'));
    return () => {
      vivo = false;
    };
  }, [visible]);

  function alLeer(contenido: string) {
    if (leido.current) return;
    const codigo = codigoDeQrWeb(contenido);
    if (!codigo) {
      setAviso('Ese código no es del panel web de Vitrina.');
      return;
    }
    leido.current = true;
    onCodigo(codigo);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCerrar} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.fondo}>
        {permiso === 'si' && (
          <Camera
            style={styles.camara}
            scanBarcode
            allowedBarcodeTypes={['qr']}
            showFrame
            barcodeFrameSize={{ width: 260, height: 260 }}
            frameColor="#FFFFFF"
            laserColor="#E8A019"
            onReadCode={e => alLeer(e.nativeEvent.codeStringValue)}
          />
        )}
        <View style={[styles.arriba, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.titulo}>Escanea el código de la web</Text>
          <Text style={styles.texto}>Apunta al cuadro que muestra la página en el computador.</Text>
          {!!aviso && <Text style={styles.aviso}>{aviso}</Text>}
        </View>
        {(permiso === 'no' || permiso === 'nunca') && (
          <View style={styles.centro}>
            <Text style={styles.texto}>Sin permiso de cámara no se puede escanear. También puedes escribir el código.</Text>
            {permiso === 'nunca' ? (
              <TouchableOpacity style={styles.boton} onPress={() => Linking.openSettings()}>
                <Text style={styles.botonTxt}>Abrir ajustes</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.boton} onPress={() => pedirCamara().then(setPermiso)}>
                <Text style={styles.botonTxt}>Permitir la cámara</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={[styles.abajo, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={styles.boton} onPress={onCerrar} accessibilityLabel="Cerrar el escáner">
            <Text style={styles.botonTxt}>Escribir el código</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  fondo: { flex: 1, backgroundColor: '#000000' },
  camara: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  arriba: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 24, backgroundColor: 'rgba(0,0,0,0.55)', paddingBottom: 16 },
  centro: { flex: 1, justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  abajo: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24, alignItems: 'center' },
  titulo: { color: '#FFFFFF', fontFamily: font.displaySemi, fontSize: 18 },
  texto: { color: '#FFFFFF', fontFamily: font.regular, fontSize: 14, marginTop: 4 },
  aviso: { color: '#FFD27A', fontFamily: font.semibold, fontSize: 14, marginTop: 8 },
  boton: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 22, alignSelf: 'center' },
  botonTxt: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 15 },
}));
