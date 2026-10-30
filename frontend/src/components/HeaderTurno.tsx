/**
 * Botón de la topbar, entre la confiabilidad y "Mi perfil", para entrar y
 * salir de turno: una moto en un círculo verde cuando está en turno y una
 * moto apagada cuando no. Solo en turno le llegan los avisos de pedidos
 * listos para recoger.
 *
 * Para que no cambie sin querer, hay que mantenerla presionada: mientras
 * tanto se llena un círculo con el color del estado al que va. Un toque solo
 * explica cómo se usa.
 *
 * Solo aparece para el rol domiciliario (y no si está suspendido). El Inicio,
 * que refresca cada 15 s y con cada push, le avisa el turno del servidor con
 * `publicarTurno`.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { cambiarTurno } from '../api';
import { useAuth } from '../AuthContext';
import { makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { PressableScale } from './anim';
import Icon from './Icon';

/** Cuánto hay que mantener presionada la moto para cambiar el turno. */
const MANTENER_MS = 600;

type Turno = { enTurno: boolean; vetado: boolean; cambiando: boolean };

// Último turno conocido de la sesión y quienes lo muestran (cada pantalla
// tiene su propia topbar).
let ultimo: { token: string; turno: Turno } | null = null;
const oyentes = new Set<(t: Turno) => void>();

function publicar(token: string, cambios: Partial<Turno>) {
  const base = ultimo?.token === token ? ultimo.turno : { enTurno: false, vetado: false, cambiando: false };
  const turno = { ...base, ...cambios };
  ultimo = { token, turno };
  oyentes.forEach(o => o(turno));
}

/** Comparte el turno recién traído del servidor (viene con los disponibles). */
export function publicarTurno(token: string, enTurno: boolean, vetado: boolean) {
  // Mientras se guarda un cambio, un refresco viejo no lo debe deshacer.
  const cambiando = ultimo?.token === token && ultimo.turno.cambiando;
  publicar(token, cambiando ? { vetado } : { enTurno, vetado });
}

/** Turno del domiciliario y cómo cambiarlo; el mismo en todas las topbars. */
function useTurno() {
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [turno, setTurno] = useState<Turno>(() =>
    ultimo?.token === token
      ? ultimo.turno
      : { enTurno: !!auth!.user.en_turno, vetado: false, cambiando: false },
  );

  useEffect(() => {
    oyentes.add(setTurno);
    return () => {
      oyentes.delete(setTurno);
    };
  }, []);

  async function cambiar(valor: boolean) {
    publicar(token, { enTurno: valor, cambiando: true });
    try {
      const mensaje = await cambiarTurno(token, valor);
      publicar(token, { cambiando: false });
      toast.info(valor ? 'En turno' : 'Fuera de turno', mensaje);
    } catch (e) {
      publicar(token, { enTurno: !valor, cambiando: false });
      toast.error('No se pudo cambiar', e instanceof Error ? e.message : 'Error');
    }
  }

  return { ...turno, cambiar };
}

export default function HeaderTurno() {
  const { auth } = useAuth();
  if (!auth?.user.roles.includes('domiciliario')) {
    return null;
  }
  return <BotonTurno />;
}

function BotonTurno() {
  const { c, modo } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const { enTurno, vetado, cambiando, cambiar } = useTurno();
  // 0 → 1 mientras se mantiene presionada (el círculo que se llena).
  const progreso = useRef(new Animated.Value(0)).current;

  // Suspendido no puede tomar pedidos: el turno no le sirve de nada.
  if (vetado) {
    return null;
  }

  function llenar() {
    Animated.timing(progreso, {
      toValue: 1,
      duration: MANTENER_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }

  // Soltó antes de tiempo: el círculo se vacía y no cambia nada.
  function vaciar() {
    Animated.timing(progreso, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  }

  function confirmar() {
    progreso.stopAnimation();
    progreso.setValue(0);
    cambiar(!enTurno);
  }

  function explicar() {
    toast.info('Mantenla presionada', enTurno ? 'Así sales de turno.' : 'Así entras en turno.');
  }

  return (
    <PressableScale
      style={[styles.boton, enTurno && styles.botonEnTurno]}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel="En turno"
      accessibilityHint="Mantén presionado para cambiar"
      accessibilityState={{ checked: enTurno, busy: cambiando }}
      disabled={cambiando}
      delayLongPress={MANTENER_MS}
      onPressIn={llenar}
      onPressOut={vaciar}
      onPress={explicar}
      onLongPress={confirmar}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.relleno,
          { backgroundColor: enTurno ? c.headerTrack : c.success, transform: [{ scale: progreso }] },
        ]}
      />
      <Icon
        name="moto"
        size={18}
        // De noche el verde es claro: la moto va oscura para que se lea.
        color={enTurno && modo === 'noche' ? c.header : c.onHeader}
        strokeWidth={2}
        style={!enTurno && styles.motoApagada}
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
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  botonEnTurno: { backgroundColor: c.success },
  relleno: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius.pill },
  motoApagada: { opacity: 0.45 },
}));
