/**
 * Editor del horario semanal del negocio: con el horario activo, el negocio
 * se abre y se cierra solo a esas horas (el switch Abierto/Cerrado sigue
 * sirviendo para abrir o cerrar a mano un rato).
 *
 * Las horas se escriben en formato 24 h ("07:00", "20:30"). Si la hora de
 * cierre es menor que la de apertura, cierra al día siguiente (18:00 → 02:00).
 *
 * Al final va "Festivo": el horario de los días festivos de Colombia, que
 * esos días reemplaza al del día de la semana (el servidor sabe cuáles son).
 */
import React from 'react';
import { Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ClaveHorario, FranjaHorario, HorarioSemana } from '../api';
import { font, makeStyles, radius, useTheme } from '../theme';

export const DIAS: { clave: ClaveHorario; nombre: string }[] = [
  { clave: 'lun', nombre: 'Lunes' },
  { clave: 'mar', nombre: 'Martes' },
  { clave: 'mie', nombre: 'Miércoles' },
  { clave: 'jue', nombre: 'Jueves' },
  { clave: 'vie', nombre: 'Viernes' },
  { clave: 'sab', nombre: 'Sábado' },
  { clave: 'dom', nombre: 'Domingo' },
  { clave: 'fes', nombre: 'Festivo' },
];

const FRANJA_TIPICA = { abre: '07:00', cierra: '20:00' };

/** Horario de arranque: lunes a sábado de 7:00 a 20:00; domingos y festivos no abre. */
export function horarioInicial(): HorarioSemana {
  return {
    lun: { ...FRANJA_TIPICA }, mar: { ...FRANJA_TIPICA }, mie: { ...FRANJA_TIPICA }, jue: { ...FRANJA_TIPICA },
    vie: { ...FRANJA_TIPICA }, sab: { ...FRANJA_TIPICA }, dom: null, fes: null,
  };
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "07:00" → "7:00 a. m."; "20:30" → "8:30 p. m." (como lo escribe el servidor). */
export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

/** Mensaje de error si alguna hora está mal escrita, o null si todo bien. */
export function errorHorario(h: HorarioSemana | null): string | null {
  if (!h) return null;
  for (const { clave, nombre } of DIAS) {
    const f = h[clave] ?? null;
    if (!f) continue;
    if (!HORA.test(f.abre) || !HORA.test(f.cierra)) {
      return `${nombre}: escribe las horas como 07:00 o 20:30.`;
    }
    if (f.abre === f.cierra) {
      return `${nombre}: la hora de abrir y la de cerrar no pueden ser iguales.`;
    }
    if (f.almuerzo) {
      if (!HORA.test(f.almuerzo.inicio) || !HORA.test(f.almuerzo.fin)) return `${nombre}: escribe las horas de almuerzo como 12:00 o 13:00.`;
      const min = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
      const offset = (s: string) => (min(s) - min(f.abre) + 1440) % 1440;
      if (offset(f.almuerzo.inicio) <= 0 || offset(f.almuerzo.fin) <= offset(f.almuerzo.inicio) || offset(f.almuerzo.fin) >= offset(f.cierra)) {
        return `${nombre}: el almuerzo debe comenzar y terminar dentro del horario de atención, en ese orden.`;
      }
    }
  }
  return null;
}

/**
 * Mientras se escribe solo pone los dos puntos ("2030" → "20:30"); no rellena
 * con ceros, para que borrar con la tecla de retroceso no rehaga la hora.
 */
export function formatearHora(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** Al salir del campo completa la hora: "8" → "08:00", "730" → "07:30". */
export function completarHora(texto: string): string {
  const d = texto.replace(/\D/g, '');
  if (d.length === 0) return texto;
  if (d.length <= 2) return `${d.padStart(2, '0')}:00`;
  if (d.length === 3) return `0${d[0]}:${d.slice(1)}`;
  return `${d.slice(0, 2)}:${d.slice(2, 4)}`;
}

type Props = {
  valor: HorarioSemana | null;
  onCambiar: (h: HorarioSemana | null) => void;
  disabled?: boolean;
};

export default function EditorHorario({ valor, onCambiar, disabled }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const activo = valor !== null;

  function cambiarDia(dia: ClaveHorario, franja: FranjaHorario | null) {
    if (!valor) return;
    onCambiar({ ...valor, [dia]: franja });
  }

  function copiarLunes() {
    if (!valor) return;
    const lunes = valor.lun;
    const nuevo = { ...valor };
    DIAS.forEach(({ clave }) => {
      if (clave !== 'lun' && clave !== 'dom' && clave !== 'fes') nuevo[clave] = lunes ? { ...lunes } : null;
    });
    onCambiar(nuevo);
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.fila}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titulo}>Horario automático</Text>
          <Text style={styles.sub}>
            {activo ? 'El negocio se abre y se cierra solo a estas horas.' : 'Solo abres y cierras a mano.'}
          </Text>
        </View>
        <Switch
          value={activo}
          onValueChange={v => onCambiar(v ? horarioInicial() : null)}
          disabled={disabled}
          trackColor={{ true: c.accent, false: c.switchOff }}
          thumbColor={c.switchThumb}
        />
      </View>

      {activo &&
        DIAS.map(({ clave, nombre }) => {
          const franja = valor![clave] ?? null;
          return (
            // El festivo va aparte, bajo una línea: no es un día de la semana.
            <View key={clave}>
            <View style={[styles.dia, clave === 'fes' && styles.festivo]}>
              <Switch
                value={franja !== null}
                onValueChange={v => cambiarDia(clave, v ? { ...FRANJA_TIPICA } : null)}
                disabled={disabled}
                trackColor={{ true: c.accent, false: c.switchOff }}
                thumbColor={c.switchThumb}
              />
              <Text style={[styles.diaNombre, !franja && styles.diaCerrado]}>{nombre}</Text>
              {franja ? (
                <View style={styles.horas}>
                  <TextInput
                    style={styles.hora}
                    value={franja.abre}
                    onChangeText={t => cambiarDia(clave, { ...franja, abre: formatearHora(t) })}
                    onBlur={() => cambiarDia(clave, { ...franja, abre: completarHora(franja.abre) })}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="07:00"
                    placeholderTextColor={c.mutedSoft}
                    editable={!disabled}
                  />
                  <Text style={styles.a}>a</Text>
                  <TextInput
                    style={styles.hora}
                    value={franja.cierra}
                    onChangeText={t => cambiarDia(clave, { ...franja, cierra: formatearHora(t) })}
                    onBlur={() => cambiarDia(clave, { ...franja, cierra: completarHora(franja.cierra) })}
                    keyboardType="number-pad"
                    maxLength={5}
                    placeholder="20:00"
                    placeholderTextColor={c.mutedSoft}
                    editable={!disabled}
                  />
                </View>
              ) : (
                <Text style={styles.noAbre}>No abre</Text>
              )}
            </View>
            {franja && <View style={styles.almuerzo}>
              <View style={styles.fila}>
                <Text style={styles.sub}>Descanso de almuerzo (opcional)</Text>
                <Switch accessibilityLabel={`Almuerzo ${nombre}`} value={!!franja.almuerzo} disabled={disabled}
                  onValueChange={v => cambiarDia(clave, { ...franja, almuerzo: v ? { inicio: '12:00', fin: '13:00' } : null })} />
              </View>
              {franja.almuerzo && <View style={styles.horas}>
                {(['inicio', 'fin'] as const).map(campo => <TextInput key={campo}
                  accessibilityLabel={`${campo === 'inicio' ? 'Inicio' : 'Fin'} del almuerzo ${nombre}`}
                  style={styles.hora} value={franja.almuerzo![campo]} editable={!disabled} keyboardType="number-pad" maxLength={5}
                  onChangeText={t => cambiarDia(clave, { ...franja, almuerzo: { ...franja.almuerzo!, [campo]: formatearHora(t) } })}
                  onBlur={() => cambiarDia(clave, { ...franja, almuerzo: { ...franja.almuerzo!, [campo]: completarHora(franja.almuerzo![campo]) } })} />)}
              </View>}
            </View>}
            </View>
          );
        })}

      {activo && (
        <Text style={styles.ayuda}>Festivo: rige los días festivos en lugar del día de la semana.</Text>
      )}

      {activo && (
        <TouchableOpacity onPress={copiarLunes} disabled={disabled}>
          <Text style={styles.copiar}>Copiar el horario del lunes de martes a sábado</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  almuerzo: { paddingLeft: 12, marginBottom: 8, gap: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  titulo: { fontSize: 13, fontFamily: font.semibold, color: c.text },
  sub: { fontSize: 12, fontFamily: font.regular, color: c.muted, marginTop: 2 },
  dia: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  diaNombre: { width: 82, fontFamily: font.medium, fontSize: 14, color: c.textStrong },
  diaCerrado: { color: c.muted },
  horas: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  hora: {
    flex: 1, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm, paddingVertical: 7,
    textAlign: 'center', fontFamily: font.semibold, fontSize: 15, color: c.textStrong,
  },
  a: { color: c.muted, fontFamily: font.regular },
  noAbre: { flex: 1, color: c.muted, fontFamily: font.regular, fontSize: 13 },
  festivo: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, marginTop: 12 },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 12, marginTop: 6 },
  copiar: { color: c.goldText, fontFamily: font.semibold, fontSize: 13, marginTop: 12 },
  // Aire antes del switch "Negocio abierto" que va debajo en el formulario.
  contenedor: { marginBottom: 18 },
}));
