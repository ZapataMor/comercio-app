/**
 * Pregunta al dueño, 20 minutos antes del cierre del horario automático, si de
 * verdad cierra a esa hora. Si no, escribe la hora aproximada en el mismo modal:
 * vale solo para este cierre, el horario automático no cambia.
 *
 * Va encima de cualquier pantalla con la app abierta. Con la app cerrada le
 * llega un push (PreguntaCierreNegocio), y al abrirla aparece este modal. Si no
 * responde, el negocio cierra a la hora del horario.
 *
 * Mientras se ve, los Toast quedan detrás del Modal: los errores van en la tarjeta.
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Modal, Platform, Text, TextInput, View } from 'react-native';
import { CierrePorConfirmar, confirmarCierre, getCierresPorConfirmar } from '../api';
import { useAuth } from '../AuthContext';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { alCambiarEnVivo } from '../enVivo';
import { useNegocio } from '../NegocioContext';
import { alCambiarDesdePush } from '../usePolling';
import { PressableScale } from './anim';
import { completarHora, formatearHora, hora12 } from './EditorHorario';
import Icon from './Icon';

/** Cada cuánto se pregunta al servidor con la app abierta. */
const CADA_MS = 30000;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function ConfirmarCierre() {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();
  const [cierres, setCierres] = useState<CierrePorConfirmar[]>([]);
  // Lo que ya se respondió: una consulta en camino no lo puede devolver.
  const [respondidos, setRespondidos] = useState<number[]>([]);
  const [otraHora, setOtraHora] = useState(false);
  const [hora, setHora] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Para filtrar los avisos en vivo: solo los de mis negocios.
  const { negocios } = useNegocio();
  const misNegocios = useRef<number[]>([]);
  misNegocios.current = negocios.map(n => n.id);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let vigente = true;
    const consultar = () => {
      getCierresPorConfirmar(token)
        .then(lista => {
          if (vigente) setCierres(lista);
        })
        .catch(() => {});
    };
    const iniciar = () => {
      consultar();
      if (!timer) timer = setInterval(consultar, CADA_MS);
    };
    const detener = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (AppState.currentState === 'active') iniciar();
    const sub = AppState.addEventListener('change', estado => (estado === 'active' ? iniciar() : detener()));
    const quitarOyente = alCambiarDesdePush(consultar);
    // En vivo: llega la pregunta del cierre, u otro dueño ya la respondió.
    const quitarVivo = alCambiarEnVivo(a => {
      const mio = a.negocio_id != null && misNegocios.current.includes(a.negocio_id);
      if (a.tema === '*' || ((a.tema === 'cierre' || a.tema === 'negocio') && mio)) consultar();
    });

    return () => {
      vigente = false;
      detener();
      sub.remove();
      quitarOyente();
      quitarVivo();
    };
  }, [token]);

  const cierre = cierres.find(x => !respondidos.includes(x.id)) ?? null;
  const horaLista = HORA.test(hora);

  async function responder(nuevaHora: string | null) {
    if (!cierre) return;
    setEnviando(true);
    setError(null);
    try {
      await confirmarCierre(token, cierre.id, nuevaHora);
      setRespondidos(lista => [...lista, cierre.id]);
      setOtraHora(false);
      setHora('');
      if (nuevaHora) {
        toast.exito('Hora guardada', `Hoy cerrará a las ${hora12(nuevaHora)}. Tu horario no cambia.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal visible={!!cierre} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      {cierre && (
        <KeyboardAvoidingView style={styles.fondo} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.tarjeta} accessibilityViewIsModal>
            <View style={styles.icono}>
              <Icon name="reloj" size={28} color={c.goldText} />
            </View>
            <Text style={styles.titulo}>¿Cierras a las {cierre.cierra_texto}?</Text>
            <Text style={styles.detalle}>
              {cierre.nombre} se cerrará solo a esa hora, según tu horario automático.
            </Text>

            {otraHora ? (
              <>
                <Text style={styles.etiqueta}>¿A qué hora cerrarás, más o menos?</Text>
                <TextInput
                  style={styles.input}
                  value={hora}
                  onChangeText={v => {
                    setHora(formatearHora(v));
                    setError(null);
                  }}
                  onBlur={() => setHora(completarHora(hora))}
                  placeholder="21:30"
                  placeholderTextColor={c.mutedSoft}
                  keyboardType="number-pad"
                  maxLength={5}
                  editable={!enviando}
                  accessibilityLabel="Hora de cierre de hoy"
                />
                <Text style={styles.nota}>
                  {horaLista ? `Hoy cierra a las ${hora12(hora)} ` : 'En formato de 24 horas. '}
                  Solo vale para hoy: tu horario automático no cambia.
                </Text>
                {!!error && <Text style={styles.error}>{error}</Text>}
                <PressableScale
                  style={[styles.boton, !horaLista && styles.botonOff]}
                  disabled={!horaLista || enviando}
                  onPress={() => responder(hora)}>
                  {enviando ? (
                    <ActivityIndicator color={c.onAccent} />
                  ) : (
                    <Text style={styles.botonTxt}>Guardar hora</Text>
                  )}
                </PressableScale>
                <PressableScale
                  style={styles.secundario}
                  disabled={enviando}
                  onPress={() => {
                    setOtraHora(false);
                    setError(null);
                  }}>
                  <Text style={styles.secundarioTxt}>Volver</Text>
                </PressableScale>
              </>
            ) : (
              <>
                {!!error && <Text style={styles.error}>{error}</Text>}
                <PressableScale style={styles.boton} disabled={enviando} onPress={() => responder(null)}>
                  {enviando ? (
                    <ActivityIndicator color={c.onAccent} />
                  ) : (
                    <Text style={styles.botonTxt}>Sí, cierro a esa hora</Text>
                  )}
                </PressableScale>
                <PressableScale style={styles.secundario} disabled={enviando} onPress={() => setOtraHora(true)}>
                  <Text style={styles.secundarioTxt}>No, cerraré a otra hora</Text>
                </PressableScale>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  tarjeta: { backgroundColor: c.surface, borderRadius: radius.xl, padding: 24, ...shadow.card },
  icono: {
    alignSelf: 'center',
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentSoft,
    marginBottom: 14,
  },
  titulo: { color: c.textStrong, fontFamily: font.display, fontSize: 22, lineHeight: 28, textAlign: 'center' },
  detalle: { color: c.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  etiqueta: { color: c.textStrong, fontFamily: font.semibold, fontSize: 14, marginTop: 18, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: c.textStrong,
    fontFamily: font.semibold,
    fontSize: 18,
    textAlign: 'center',
  },
  nota: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 8 },
  error: { color: c.danger, fontFamily: font.medium, fontSize: 13, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  boton: {
    backgroundColor: c.accent,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
    ...shadow.gold,
  },
  botonOff: { opacity: 0.5 },
  botonTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
  secundario: { paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  secundarioTxt: { color: c.text, fontFamily: font.semibold, fontSize: 15 },
}));
