/**
 * Diálogo de confirmación con los estilos de Vitrina, en lugar de la alerta
 * genérica del sistema: ícono en un círculo, título, explicación, puntos
 * opcionales (ícono + texto) y dos acciones. La tarjeta entra con un pequeño
 * zoom sobre el fondo oscurecido.
 *
 *   <Confirmacion
 *     visible={abierto}
 *     icono="moto"
 *     titulo="¿Quieres ser domiciliario?"
 *     texto="…"
 *     textoBoton="Quiero serlo"
 *     enviando={enviando}
 *     onCerrar={() => setAbierto(false)}
 *     onConfirmar={activar}
 *   />
 *
 * `peligro` pinta el ícono y el botón en rojo (acciones que quitan algo).
 */
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import Icon, { IconName } from './Icon';

type Props = {
  visible: boolean;
  icono: IconName;
  titulo: string;
  texto: string;
  /** Puntos clave bajo la explicación (qué cambia al confirmar). */
  puntos?: { icono: IconName; texto: string }[];
  textoBoton: string;
  textoCancelar?: string;
  peligro?: boolean;
  enviando?: boolean;
  onCerrar: () => void;
  onConfirmar: () => void;
};

export default function Confirmacion({
  visible,
  icono,
  titulo,
  texto,
  puntos,
  textoBoton,
  textoCancelar = 'Ahora no',
  peligro,
  enviando,
  onCerrar,
  onConfirmar,
}: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const escala = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    if (!visible) return;
    escala.setValue(0.92);
    Animated.spring(escala, { toValue: 1, friction: 7, tension: 140, useNativeDriver: true }).start();
  }, [visible, escala]);

  // Mientras se envía no se cierra (ni tocando fuera ni con "atrás").
  const cerrar = () => !enviando && onCerrar();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={cerrar}>
      <View style={styles.fondo}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cerrar} accessibilityLabel="Cerrar" />
        <Animated.View style={[styles.caja, { transform: [{ scale: escala }] }]}>
          <View style={[styles.icono, peligro && styles.iconoPeligro]}>
            <Icon name={icono} size={26} color={peligro ? c.danger : c.onAccent} strokeWidth={2} />
          </View>
          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.texto}>{texto}</Text>

          {!!puntos?.length && (
            <View style={styles.puntos}>
              {puntos.map(p => (
                <View key={p.texto} style={styles.punto}>
                  <View style={styles.puntoIcono}>
                    <Icon name={p.icono} size={16} color={c.accent} strokeWidth={2} />
                  </View>
                  <Text style={styles.puntoTxt}>{p.texto}</Text>
                </View>
              ))}
            </View>
          )}

          <PressableScale
            style={[styles.boton, peligro && styles.botonPeligro, enviando && styles.botonOcupado]}
            accessibilityRole="button"
            onPress={onConfirmar}
            disabled={enviando}>
            {enviando ? (
              <ActivityIndicator color={peligro ? c.surface : c.onAccent} />
            ) : (
              <Text style={[styles.botonTxt, peligro && styles.botonPeligroTxt]}>{textoBoton}</Text>
            )}
          </PressableScale>
          <TouchableOpacity onPress={cerrar} disabled={enviando} hitSlop={8}>
            <Text style={styles.cancelar}>{textoCancelar}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, backgroundColor: c.scrim, justifyContent: 'center', padding: 24 },
  caja: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 22, paddingTop: 26, ...shadow.card },
  icono: {
    width: 56, height: 56, borderRadius: radius.pill, backgroundColor: c.accent,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14, ...shadow.gold,
  },
  iconoPeligro: { backgroundColor: c.dangerSoft, shadowOpacity: 0, elevation: 0 },
  titulo: { fontSize: 19, fontFamily: font.display, color: c.textStrong, textAlign: 'center', marginBottom: 8 },
  texto: { fontSize: 14, fontFamily: font.regular, color: c.text, lineHeight: 20, textAlign: 'center' },
  puntos: { gap: 10, marginTop: 16, padding: 14, borderRadius: radius.lg, backgroundColor: c.bg },
  punto: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  puntoIcono: {
    width: 30, height: 30, borderRadius: radius.sm, backgroundColor: c.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  puntoTxt: { flex: 1, fontSize: 13, fontFamily: font.medium, color: c.textStrong, lineHeight: 18 },
  boton: {
    backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 15,
    alignItems: 'center', marginTop: 20, ...shadow.gold,
  },
  // El texto usa `surface` porque `danger` cambia de tono por modo (contraste).
  botonPeligro: { backgroundColor: c.danger, shadowOpacity: 0, elevation: 0 },
  botonOcupado: { opacity: 0.75 },
  botonTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
  botonPeligroTxt: { color: c.surface },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 16 },
}));
