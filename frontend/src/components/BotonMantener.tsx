/**
 * Botón redondo de la topbar que se cambia manteniéndolo presionado, para
 * que un toque sin querer no cambie nada: mientras se sostiene se llena un
 * círculo con el color del estado al que va, y si se suelta antes no pasa
 * nada. Un toque solo llama a `onToque` (para explicar cómo se usa).
 *
 * Encendido es un círculo verde con el ícono claro; apagado, el fondo de
 * siempre con el ícono tenue. Lo usan el turno del domiciliario
 * (HeaderTurno) y el Abierto/Cerrado del negocio (Inicio).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import Icon, { IconName } from './Icon';

/** Cuánto hay que mantenerlo presionado para que cambie. */
const MANTENER_MS = 600;

/** Fondo apagado: el mismo de "Mi perfil" y la confiabilidad. */
const FONDO_APAGADO = 'rgba(255,255,255,0.14)';

type Props = {
  icon: IconName;
  encendido: boolean;
  /** Mientras se guarda el cambio no responde. */
  ocupado?: boolean;
  /** Lo que anuncia el lector de pantalla, p. ej. "En turno". */
  accessibilityLabel: string;
  onCambiar: () => void;
  onToque: () => void;
};

export default function BotonMantener({ icon, encendido, ocupado, accessibilityLabel, onCambiar, onToque }: Props) {
  const { c, modo } = useTheme();
  const styles = useStyles();
  // 0 → 1 mientras se mantiene presionado (el círculo que se llena).
  const progreso = useRef(new Animated.Value(0)).current;
  // Estado al que lleva el relleno (su color). Se fija al empezar a presionar
  // y no cambia al confirmar: así, cuando el botón pasa a ese estado, el
  // relleno y el fondo ya son del mismo color y no se nota ningún salto.
  const [destino, setDestino] = useState(!encendido);
  const destinoRef = useRef(destino);

  // Si guardar falla y vuelve al estado anterior, el relleno no lo debe tapar.
  useEffect(() => {
    if (encendido !== destinoRef.current) {
      progreso.setValue(0);
    }
  }, [encendido, progreso]);

  function llenar() {
    const nuevo = !encendido;
    if (nuevo !== destinoRef.current) {
      // Tras el último cambio el relleno es del color del fondo: se reinicia
      // sin que se note.
      progreso.setValue(0);
      destinoRef.current = nuevo;
      setDestino(nuevo);
    }
    Animated.timing(progreso, {
      toValue: 1,
      duration: MANTENER_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }

  // Al soltar se vacía: antes de tiempo deja ver el estado de siempre, y
  // después de cambiar no se nota (es del mismo color que el fondo).
  function vaciar() {
    Animated.timing(progreso, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  }

  function confirmar() {
    // Lleno del todo: el fondo pasa a su color por debajo sin que se vea.
    progreso.stopAnimation();
    progreso.setValue(1);
    onCambiar();
  }

  return (
    <PressableScale
      style={[styles.boton, encendido && styles.botonEncendido]}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Mantén presionado para cambiar"
      accessibilityState={{ checked: encendido, busy: ocupado }}
      disabled={ocupado}
      delayLongPress={MANTENER_MS}
      onPressIn={llenar}
      onPressOut={vaciar}
      onPress={onToque}
      onLongPress={confirmar}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.relleno,
          { backgroundColor: destino ? c.success : c.header, transform: [{ scale: progreso }] },
        ]}>
        {/* Apagado es el blanco translúcido sobre la topbar: el relleno lo
            imita igual para que el color final sea el mismo. */}
        {!destino && <View style={styles.rellenoApagado} />}
      </Animated.View>
      <Icon
        name={icon}
        size={18}
        // De noche el verde es claro: el ícono va oscuro para que se lea.
        color={encendido && modo === 'noche' ? c.header : c.onHeader}
        strokeWidth={2}
        style={!encendido && styles.iconoApagado}
      />
    </PressableScale>
  );
}

const useStyles = makeStyles(c => ({
  // Mismo botón redondo que "Mi perfil" y la confiabilidad.
  boton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: FONDO_APAGADO,
  },
  botonEncendido: { backgroundColor: c.success },
  relleno: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.pill },
  rellenoApagado: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.pill,
    backgroundColor: FONDO_APAGADO,
  },
  iconoApagado: { opacity: 0.45 },
}));
