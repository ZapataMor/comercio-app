/**
 * Cuando al carrito le quedan 10 minutos: con la app abierta, un modal que se
 * cierra solo a los pocos segundos (su borde se llena como barra de carga, y
 * se quita antes deslizándolo a la derecha); con la app en segundo plano o cerrada,
 * una notificación del teléfono (ver avisoCarrito.ts). Un solo aviso por
 * carrito: si ya llegó la notificación, al volver no se repite en el modal.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { AVISO_ANTES_DE_VENCER, programarNotificacionCarrito, retirarNotificacionCarrito } from '../avisoCarrito';
import { useCart } from '../CartContext';
import { navigationRef } from '../RootNavigation';
import { font, makeStyles, radius, useTheme } from '../theme';
import AvisoTemporal from './AvisoTemporal';
import Icon from './Icon';

/** El modal se va solo pasado este tiempo. */
const DURACION_MODAL = 10000;

/** `listo`: terminó el splash. La notificación se programa desde antes; el modal espera. */
export default function AvisoCarritoPorVencer({ listo }: { listo: boolean }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const { venceEn, negocioNombre, items } = useCart();
  const hayCarrito = !!auth && items.length > 0 && venceEn != null;
  const vence = hayCarrito ? venceEn : null;
  const [visible, setVisible] = useState(false);
  const [minutos, setMinutos] = useState(10);
  // Carrito (por su hora de vencimiento) al que ya se le avisó.
  const avisado = useRef<number | null>(null);
  // Hora a la que quedó programada la notificación al salir de la app.
  const notificacionEn = useRef<number | null>(null);
  const negocioRef = useRef(negocioNombre);
  negocioRef.current = negocioNombre;

  // Al salir de la app se programa la notificación; al volver se retira (si ya
  // sonó, el modal no la repite).
  useEffect(() => {
    if (vence == null) {
      notificacionEn.current = null;
      retirarNotificacionCarrito();
      return;
    }
    const alCambiar = async (estado: string) => {
      if (estado === 'background') {
        if (avisado.current !== vence) {
          notificacionEn.current = await programarNotificacionCarrito(vence, negocioRef.current);
        }
      } else if (estado === 'active') {
        if (notificacionEn.current != null && Date.now() >= notificacionEn.current) avisado.current = vence;
        notificacionEn.current = null;
        retirarNotificacionCarrito();
      }
    };
    // Si la app ya está en segundo plano cuando cambia el carrito, se reprograma.
    if (AppState.currentState === 'background') alCambiar('background');
    const sub = AppState.addEventListener('change', alCambiar);
    return () => sub.remove();
  }, [vence]);

  // Con la app abierta: cuando falten 10 minutos, el modal.
  useEffect(() => {
    if (vence == null) {
      setVisible(false);
      return;
    }
    if (!listo) return;
    const revisar = () => {
      if (AppState.currentState !== 'active' || avisado.current === vence) return;
      const falta = vence - Date.now();
      if (falta > 0 && falta <= AVISO_ANTES_DE_VENCER) {
        avisado.current = vence;
        setMinutos(Math.max(1, Math.ceil(falta / 60000)));
        setVisible(true);
      }
    };
    revisar();
    const timer = setInterval(revisar, 5000);
    return () => clearInterval(timer);
  }, [vence, listo]);

  const ruta = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
  const yaEnCompra = ruta === 'Carrito' || ruta === 'Checkout';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.fondo}>
        {visible && <AvisoTemporal
          duracion={DURACION_MODAL}
          onCerrar={() => setVisible(false)}
          radio={radius.lg}
          grosor={3}
          style={styles.marco}
          colorFondo={c.surface}
          contenidoStyle={styles.caja}>
          <View style={styles.icono}>
            <Icon name="reloj" size={26} color={c.accent} />
          </View>
          <Text style={styles.titulo}>Tu carrito vence en {minutos} {minutos === 1 ? 'minuto' : 'minutos'}</Text>
          <Text style={styles.texto}>
            {negocioNombre ? `Confirma tu pedido de ${negocioNombre}` : 'Confirma tu pedido'} antes de que se vacíe el carrito.
          </Text>
          {!yaEnCompra && (
            <TouchableOpacity
              style={styles.boton}
              onPress={() => {
                setVisible(false);
                if (navigationRef.isReady()) navigationRef.navigate('Carrito');
              }}>
              <Text style={styles.botonTxt}>Ir al carrito</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setVisible(false)}>
            <Text style={styles.cerrar}>{yaEnCompra ? 'Entendido' : 'Seguir mirando'}</Text>
          </TouchableOpacity>
        </AvisoTemporal>}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  marco: { ...shadow.card },
  caja: { padding: 22, alignItems: 'center' },
  icono: {
    width: 56, height: 56, borderRadius: radius.pill, backgroundColor: c.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 18, textAlign: 'center' },
  texto: { color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  boton: { alignSelf: 'stretch', backgroundColor: c.accent, paddingVertical: 14, borderRadius: radius.md, ...shadow.gold },
  botonTxt: { color: c.onAccent, textAlign: 'center', fontFamily: font.bold, fontSize: 15 },
  cerrar: { color: c.muted, textAlign: 'center', fontFamily: font.semibold, padding: 14 },
}));
