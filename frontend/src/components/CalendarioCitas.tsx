import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { hoyColombia, sumarDias } from '../citas';
import { font, makeStyles, radius } from '../theme';

export default function CalendarioCitas({
  fecha,
  onCambiar,
  disabled,
}: {
  fecha: string;
  onCambiar: (fecha: string) => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const [mes, setMes] = useState(fecha.slice(0, 7));
  const hoy = hoyColombia();
  const maximo = sumarDias(hoy, 90);
  const primero = new Date(`${mes}-01T12:00:00Z`);
  const dias = new Date(
    Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const espacios = (primero.getUTCDay() + 6) % 7;
  function mover(delta: number) {
    const d = new Date(primero);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMes(d.toISOString().slice(0, 7));
  }
  return (
    <View style={styles.calendario}>
      <View style={styles.cabecera}>
        <TouchableOpacity
          accessibilityLabel="Mes anterior"
          disabled={disabled || mes <= hoy.slice(0, 7)}
          onPress={() => mover(-1)}
        >
          <Text
            style={[
              styles.flecha,
              mes <= hoy.slice(0, 7) && styles.deshabilitado,
            ]}
          >
            ‹
          </Text>
        </TouchableOpacity>
        <Text style={styles.mes}>
          {primero.toLocaleDateString('es-CO', {
            month: 'long',
            year: 'numeric',
            timeZone: 'UTC',
          })}
        </Text>
        <TouchableOpacity
          accessibilityLabel="Mes siguiente"
          disabled={disabled || mes >= maximo.slice(0, 7)}
          onPress={() => mover(1)}
        >
          <Text
            style={[
              styles.flecha,
              mes >= maximo.slice(0, 7) && styles.deshabilitado,
            ]}
          >
            ›
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.rejilla}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <Text key={`sem-${i}`} style={styles.semana}>
            {d}
          </Text>
        ))}
        {Array.from({ length: espacios }, (_, i) => (
          <View key={`vacio-${i}`} style={styles.celda} />
        ))}
        {Array.from({ length: dias }, (_, i) => {
          const valor = `${mes}-${String(i + 1).padStart(2, '0')}`;
          const fuera = valor < hoy || valor > maximo;
          return (
            <TouchableOpacity
              key={valor}
              style={[styles.celda, fecha === valor && styles.elegido]}
              accessibilityRole="button"
              accessibilityLabel={`Elegir ${valor}`}
              accessibilityState={{
                selected: valor === fecha,
                disabled: fuera || disabled,
              }}
              disabled={fuera || disabled}
              onPress={() => onCambiar(valor)}
            >
              <Text
                style={[
                  styles.numero,
                  fuera && styles.deshabilitado,
                  fecha === valor && styles.numeroElegido,
                ]}
              >
                {i + 1}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
const useStyles = makeStyles(c => ({
  calendario: {
    backgroundColor: c.surface2,
    padding: 12,
    borderRadius: radius.md,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mes: {
    color: c.textStrong,
    fontFamily: font.semibold,
    fontSize: 16,
    textTransform: 'capitalize',
  },
  flecha: {
    color: c.accent,
    fontSize: 32,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap' },
  semana: {
    width: '14.2857%',
    textAlign: 'center',
    color: c.muted,
    paddingVertical: 10,
  },
  celda: {
    width: '14.2857%',
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  elegido: { backgroundColor: c.accent },
  numero: { color: c.textStrong, fontFamily: font.medium, fontSize: 15 },
  numeroElegido: { color: c.onBrand },
  deshabilitado: { opacity: 0.28 },
}));
