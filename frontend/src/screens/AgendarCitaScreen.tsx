import { telefonoValido, errorTelefono } from '../direccion';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DisponibilidadCitas,
  getDisponibilidadCitas,
  solicitarCita,
} from '../api';
import { useAuth } from '../AuthContext';
import { fechaCita, hoyColombia } from '../citas';
import CalendarioCitas from '../components/CalendarioCitas';
import { hora12 } from '../components/EditorHorario';
import { messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { temasDelNegocio, usePolling } from '../usePolling';

type Props = NativeStackScreenProps<RootStackParamList, 'AgendarCita'>;
export default function AgendarCitaScreen({ route, navigation }: Props) {
  const {
    negocioId,
    negocioNombre,
    servicio,
    presencial = false,
  } = route.params;
  const { auth } = useAuth();
  const token = auth!.token;
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const [fecha, setFecha] = useState(hoyColombia);
  const [profesional, setProfesional] = useState<number>();
  const [disponibilidad, setDisponibilidad] =
    useState<DisponibilidadCitas | null>(null);
  const [hora, setHora] = useState('');
  const [notas, setNotas] = useState('');
  const [cliente, setCliente] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [revision, setRevision] = useState(0);

  // Descarta respuestas de fechas/profesionales anteriores, también al salir de la pantalla.
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    getDisponibilidadCitas(token, negocioId, servicio.id, fecha, profesional)
      .then(d => {
        if (vigente) {
          setDisponibilidad(d);
          setHora(h => (d.horas.includes(h) ? h : ''));
        }
      })
      .catch(e => {
        if (vigente) {
          setDisponibilidad(null);
          setError(messageFromError(e, 'No se pudieron consultar las horas.'));
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [token, negocioId, servicio.id, fecha, profesional, revision]);
  const refrescar = useCallback(() => {
    if (!guardando) setRevision(v => v + 1);
  }, [guardando]);
  usePolling(refrescar, 30000, temasDelNegocio(['agenda', 'catalogo', 'negocio', 'equipo'], negocioId));

  async function guardar() {
    if (!hora || !disponibilidad || cargando || guardando) return;
    if (presencial && !cliente.trim()) {
      setError('Escribe el nombre del cliente.');
      return;
    }
    if (presencial && telefono && !telefonoValido(telefono)) { setError(errorTelefono); return; }
    setGuardando(true);
    setError('');
    try {
      await solicitarCita(
        token,
        negocioId,
        {
          servicio_id: servicio.id,
          profesional_id: disponibilidad.profesional_id,
          fecha,
          hora,
          notas: notas.trim(),
          ...(presencial
            ? {
                cliente_nombre: cliente.trim(),
                cliente_telefono: telefono.trim(),
              }
            : {}),
        },
        presencial,
      );
      toast.exito(
        presencial ? 'Cita presencial registrada' : 'Solicitud enviada',
        presencial
          ? 'Ese tiempo ya está ocupado en la agenda.'
          : 'Revisa Mis citas para ver la confirmación del negocio.',
      );
      if (presencial) navigation.replace('AgendaNegocio', { negocioId });
      else navigation.replace('MisCitas');
    } catch (e) {
      setError(messageFromError(e, 'No se pudo solicitar la cita.'));
      setHora('');
      setRevision(v => v + 1);
    } finally {
      setGuardando(false);
    }
  }
  return (
    <ScrollView
      style={styles.fondo}
      contentContainerStyle={styles.contenido}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.negocio}>{negocioNombre}</Text>
      <Text style={styles.titulo}>{servicio.nombre}</Text>
      <Text style={styles.detalle}>
        {servicio.duracion_minutos ?? 30} minutos ·{' '}
        {servicio.precio == null
          ? 'Precio por consultar'
          : `$${servicio.precio.toLocaleString('es-CO')}`}
      </Text>
      <Text style={styles.aviso}>
        {presencial
          ? 'Registra aquí las citas pactadas en persona o por teléfono para mantener una sola agenda.'
          : 'El negocio revisará también sus citas presenciales y tendrá hasta una hora para responder. La cita quedará reservada únicamente cuando la confirme. Si no responde a tiempo, la solicitud vencerá.'}
      </Text>
      <Text style={styles.subtitulo}>1. Elige la fecha</Text>
      <CalendarioCitas
        fecha={fecha}
        disabled={guardando}
        onCambiar={f => {
          if (f === fecha) return;
          setFecha(f);
          setHora('');
          setDisponibilidad(null);
          setError('');
        }}
      />
      <Text style={styles.detalle}>{fechaCita(fecha)} · Hora de Colombia</Text>
      <Text style={styles.subtitulo}>2. Elige quién te atiende</Text>
      <View style={styles.opciones}>
        {disponibilidad?.profesionales.map(p => (
          <TouchableOpacity
            key={p.id}
            disabled={guardando}
            style={[
              styles.chip,
              p.id === disponibilidad.profesional_id && styles.seleccion,
            ]}
            accessibilityRole="button"
            accessibilityState={{
              selected: p.id === disponibilidad.profesional_id,
            }}
            onPress={() => {
              setProfesional(p.id);
              setHora('');
            }}
          >
            <Text
              style={[
                styles.chipTexto,
                p.id === disponibilidad.profesional_id && styles.seleccionTexto,
              ]}
            >
              {p.nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.subtitulo}>3. Horas disponibles</Text>
      {cargando ? (
        <ActivityIndicator color={c.accent} />
      ) : (
        disponibilidad && (
          <>
            {disponibilidad.mensaje ? (
              <Text style={styles.aviso}>{disponibilidad.mensaje}</Text>
            ) : disponibilidad.horas.length === 0 ? (
              <Text style={styles.aviso}>
                No hay horas disponibles para este profesional en esta fecha.
                Elige otra fecha u otro profesional.
              </Text>
            ) : (
              <View style={styles.opciones}>
                {disponibilidad.horas.map(h => (
                  <TouchableOpacity
                    key={h}
                    disabled={guardando}
                    accessibilityLabel={`Elegir hora ${h}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: hora === h }}
                    style={[styles.chip, hora === h && styles.seleccion]}
                    onPress={() => setHora(h)}
                  >
                    <Text
                      style={[
                        styles.chipTexto,
                        hora === h && styles.seleccionTexto,
                      ]}
                    >
                      {hora12(h)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )
      )}
      {presencial && (
        <>
          <Text style={styles.subtitulo}>Datos del cliente</Text>
          <TextInput
            accessibilityLabel="Nombre del cliente"
            style={styles.input}
            value={cliente}
            onChangeText={setCliente}
            maxLength={150}
            editable={!guardando}
            placeholder="Nombre del cliente *"
            placeholderTextColor={c.muted}
          />
          <TextInput
            accessibilityLabel="Teléfono del cliente"
            style={styles.input}
            value={telefono}
            onChangeText={valor => setTelefono(valor.replace(/[^0-9]/g, '').slice(0, 10))}
            maxLength={10}
            editable={!guardando}
            keyboardType="number-pad"
            placeholder="Teléfono (opcional)"
            placeholderTextColor={c.muted}
          />
        </>
      )}
      <Text style={styles.subtitulo}>Notas (opcional)</Text>
      <TextInput
        accessibilityLabel="Notas para la cita"
        style={styles.input}
        value={notas}
        onChangeText={setNotas}
        multiline
        maxLength={1000}
        editable={!guardando}
        placeholder="Ej. Diseño elegido, largo del cabello…"
        placeholderTextColor={c.muted}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {!!error && !disponibilidad && (
        <TouchableOpacity onPress={refrescar}>
          <Text style={styles.chipTexto}>Reintentar consulta</Text>
        </TouchableOpacity>
      )}
      {!!hora && (
        <Text style={styles.aviso}>
          {fechaCita(fecha)} a las {hora12(hora)} con{' '}
          {
            disponibilidad?.profesionales.find(
              p => p.id === disponibilidad.profesional_id,
            )?.nombre
          }
          .
        </Text>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        style={[
          styles.boton,
          (!hora || cargando || guardando) && styles.inactivo,
        ]}
        disabled={!hora || cargando || guardando}
        onPress={guardar}
      >
        {guardando ? (
          <ActivityIndicator color={c.onBrand} />
        ) : (
          <Text style={styles.botonTexto}>
            {presencial ? 'Registrar cita presencial' : 'Solicitar cita'}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
const useStyles = makeStyles(c => ({
  fondo: { flex: 1, backgroundColor: c.bg },
  contenido: { padding: 20, paddingBottom: 60, gap: 12 },
  negocio: { color: c.muted, fontFamily: font.medium },
  titulo: { color: c.textStrong, fontFamily: font.display, fontSize: 24 },
  subtitulo: {
    color: c.textStrong,
    fontFamily: font.semibold,
    fontSize: 16,
    marginTop: 12,
  },
  detalle: { color: c.muted, fontFamily: font.regular, lineHeight: 20 },
  aviso: {
    color: c.text,
    backgroundColor: c.surface2,
    padding: 14,
    borderRadius: radius.md,
    lineHeight: 22,
  },
  opciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: 12,
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.sm,
  },
  chipTexto: { color: c.textStrong, fontFamily: font.medium },
  seleccion: { backgroundColor: c.accent, borderColor: c.accent },
  seleccionTexto: { color: c.onBrand },
  input: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    color: c.text,
    borderRadius: radius.md,
    padding: 14,
  },
  error: { color: c.danger, lineHeight: 22 },
  boton: {
    backgroundColor: c.accent,
    borderRadius: radius.md,
    padding: 16,
    alignItems: 'center',
  },
  botonTexto: { color: c.onBrand, fontFamily: font.semibold },
  inactivo: { opacity: 0.45 },
}));
