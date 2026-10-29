/**
 * Botón de la topbar, junto a "Mi perfil", con el nivel de confiabilidad del
 * domiciliario: un escudo con un punto del color de su nivel (verde
 * excelente, azul confiable, ámbar regular, rojo en riesgo o suspendido).
 * Al tocarlo abre un modal con la barra de confiabilidad y sus movimientos.
 *
 * Solo aparece para el rol domiciliario. La pantalla de entregas, que ya
 * refresca cada 15 s y con cada push, avisa el nivel nuevo con
 * `publicarMiReputacion` y el ícono se actualiza sin pedirlo otra vez.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getMiReputacion, Reputacion, ReputacionDetalle } from '../api';
import { useAuth } from '../AuthContext';
import { Colores, font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import Icon from './Icon';
import { colorNivel, TarjetaReputacion } from './Reputacion';

const EXPLICACION =
  'Sube cuando el cliente queda conforme y cuando entregas el dinero completo al negocio. ' +
  'Baja si recoges después de lo que prometiste, si llegas tarde sin avisar o si hay quejas. ' +
  'Con menos de 30 puntos, o 2 faltas graves (pedido que no llegó, dinero no entregado) en 30 días, ' +
  'la cuenta se suspende. ¿Te vas a demorar? Reporta una novedad y la demora no te resta.';

// Último nivel conocido de la sesión y los íconos que lo muestran.
let ultimo: { token: string; detalle: ReputacionDetalle } | null = null;
const oyentes = new Set<(d: ReputacionDetalle) => void>();

/** Comparte el nivel recién traído con el ícono de la topbar. */
export function publicarMiReputacion(token: string, detalle: ReputacionDetalle) {
  ultimo = { token, detalle };
  oyentes.forEach(o => o(detalle));
}

function colorPunto(c: Colores, r: Reputacion): string {
  if (r.vetado) return c.danger;
  if (r.nivel === 'nuevo') return c.accent;
  return colorNivel(c, r.nivel).fg;
}

export default function HeaderConfiabilidad() {
  const { auth } = useAuth();
  if (!auth?.user.roles.includes('domiciliario')) {
    return null;
  }
  return <BotonConfiabilidad token={auth.token} />;
}

function BotonConfiabilidad({ token }: { token: string }) {
  const { c } = useTheme();
  const styles = useStyles();
  const [detalle, setDetalle] = useState<ReputacionDetalle | null>(
    ultimo?.token === token ? ultimo.detalle : null,
  );
  const [error, setError] = useState(false);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(() => {
    setError(false);
    getMiReputacion(token)
      .then(d => publicarMiReputacion(token, d))
      .catch(() => setError(true));
  }, [token]);

  useEffect(() => {
    oyentes.add(setDetalle);
    if (ultimo?.token !== token) {
      cargar();
    }
    return () => {
      oyentes.delete(setDetalle);
    };
  }, [token, cargar]);

  function abrir() {
    setAbierto(true);
    // Se ve el último nivel conocido mientras llega el más reciente.
    cargar();
  }

  const r = detalle?.reputacion;
  const etiqueta = r
    ? `Mi confiabilidad: ${r.nivel_label}${r.nivel !== 'nuevo' ? `, ${r.puntaje} de 100` : ''}`
    : 'Mi confiabilidad';

  return (
    <>
      <PressableScale
        style={styles.boton}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        onPress={abrir}>
        <Icon name="escudo" size={18} color={c.onHeader} strokeWidth={2} />
        {!!r && <View style={[styles.punto, { backgroundColor: colorPunto(c, r) }]} />}
      </PressableScale>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <View style={styles.fondo}>
          {/* Tocar fuera de la tarjeta también cierra. */}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAbierto(false)} accessibilityLabel="Cerrar" />
          <View style={styles.caja}>
            <ScrollView contentContainerStyle={styles.contenido}>
              {detalle ? (
                <TarjetaReputacion
                  reputacion={detalle.reputacion}
                  eventos={detalle.eventos}
                  titulo="Tu nivel de confiabilidad"
                  explicacion={EXPLICACION}
                  style={styles.tarjeta}
                />
              ) : error ? (
                <View style={styles.errorCaja}>
                  <Text style={styles.errorTxt}>No pudimos cargar tu nivel de confiabilidad.</Text>
                  <TouchableOpacity onPress={cargar}>
                    <Text style={styles.reintentar}>Reintentar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ActivityIndicator color={c.accent} style={styles.cargando} />
              )}
            </ScrollView>
            <TouchableOpacity style={styles.cerrar} onPress={() => setAbierto(false)}>
              <Text style={styles.cerrarTxt}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  // Mismo botón redondo que "Mi perfil".
  boton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  punto: {
    position: 'absolute', right: 3, bottom: 3, width: 11, height: 11, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: c.onHeader,
  },
  fondo: { flex: 1, backgroundColor: c.scrim, justifyContent: 'center', padding: 24 },
  caja: { maxHeight: '85%', backgroundColor: c.surface, borderRadius: radius.xl, overflow: 'hidden', ...shadow.card },
  contenido: { padding: 20, paddingBottom: 4 },
  // La tarjeta ya va dentro de la caja del modal: sin su propio marco.
  tarjeta: { padding: 0, marginBottom: 0, elevation: 0, shadowOpacity: 0 },
  cargando: { marginVertical: 30 },
  errorCaja: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  errorTxt: { color: c.text, fontFamily: font.medium, textAlign: 'center' },
  reintentar: { color: c.goldText, fontFamily: font.semibold },
  cerrar: { borderTopWidth: 1, borderTopColor: c.border, paddingVertical: 14, alignItems: 'center' },
  cerrarTxt: { color: c.textStrong, fontFamily: font.bold, fontSize: 15 },
}));
