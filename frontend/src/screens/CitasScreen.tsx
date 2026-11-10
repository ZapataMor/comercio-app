import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  actualizarCita,
  cancelarCita,
  Cita,
  getCitas,
  getServicios,
  Servicio,
  tienePermiso,
  getEquipo,
  MiembroNegocio,
  reasignarCita,
  registrarLlegadaCita,
} from '../api';
import { useAuth } from '../AuthContext';
import { estadosCita, fechaCita } from '../citas';
import { useConfirmar } from '../components/Confirmacion';
import { hora12 } from '../components/EditorHorario';
import { messageFromError } from '../formErrors';
import { useNegocio } from '../NegocioContext';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { usePolling } from '../usePolling';

type Props = NativeStackScreenProps<
  RootStackParamList,
  'MisCitas' | 'AgendaNegocio'
>;
export default function CitasScreen({ route, navigation }: Props) {
  const { auth } = useAuth();
  const token = auth!.token;
  const { negocio, negocios } = useNegocio();
  const gestion = route.name === 'AgendaNegocio';
  const negocioId = gestion
    ? route.params?.negocioId ?? negocio?.id
    : undefined;
  const nombre =
    negocios.find(n => n.id === negocioId)?.nombre ?? 'Agenda del negocio';
  const { c } = useTheme();
  const styles = useStyles();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [citas, setCitas] = useState<Cita[]>([]);
  const [pagina, setPagina] = useState(1);
  const [ultima, setUltima] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [servicios, setServicios] = useState<Servicio[] | null>(null);
  const [decision, setDecision] = useState<{
    cita: Cita;
    estado: 'rechazada' | 'cancelada';
  } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [errorDecision, setErrorDecision] = useState('');
  const [porReasignar, setPorReasignar] = useState<Cita | null>(null);
  const [equipo, setEquipo] = useState<MiembroNegocio[]>([]);
  const [errorReasignar, setErrorReasignar] = useState('');
  const propietario = tienePermiso(negocios.find(n => n.id === negocioId), 'administrador');
  const consulta = useRef(0);
  const cargar = useCallback(
    async (pag = 1) => {
      const version = ++consulta.current;
      if (gestion && !negocioId) {
        setCargando(false);
        return;
      }
      try {
        const d = await getCitas(token, negocioId, pag);
        if (version !== consulta.current) return;
        setCitas(prev =>
          pag === 1
            ? d.citas
            : [
                ...prev.filter(item => !d.citas.some(n => n.id === item.id)),
                ...d.citas,
              ],
        );
        setPagina(d.pagina);
        setUltima(d.ultima_pagina);
        setError('');
      } catch (e) {
        if (version === consulta.current)
          setError(messageFromError(e, 'No se pudo cargar la agenda.'));
      } finally {
        if (version === consulta.current) setCargando(false);
      }
    },
    [token, negocioId, gestion],
  );
  useFocusEffect(
    useCallback(() => {
      setCargando(true);
      setCitas([]);
      cargar();
      return () => {
        consulta.current++;
      };
    }, [cargar]),
  );
  usePolling(() => {
    if (pagina === 1 && !ocupado && !decision) cargar();
  }, 15000);

  async function cambiar(cita: Cita, estado: Cita['estado'], razon?: string) {
    if (ocupado) return;
    setOcupado(true);
    try {
      if (gestion && negocioId)
        await actualizarCita(auth!.token, negocioId, cita.id, estado, razon);
      else await cancelarCita(auth!.token, cita.id);
      setDecision(null);
      toast.exito('Cita actualizada');
      await cargar();
    } catch (e) {
      const mensaje = messageFromError(e, 'Intenta de nuevo.');
      if (decision) setErrorDecision(mensaje);
      else toast.error('No se pudo actualizar', mensaje);
      cargar();
    } finally {
      setOcupado(false);
    }
  }
  async function elegirProfesional(cita: Cita) {
    if (!negocioId) return;
    setPorReasignar(cita); setEquipo([]); setErrorReasignar('');
    try { setEquipo((await getEquipo(token, negocioId)).miembros.filter(m => m.id !== cita.profesional_id && m.activo)); }
    catch (e) { setErrorReasignar(messageFromError(e)); }
  }
  async function registrarLlegada(cita: Cita) {
    if (!negocioId || ocupado) return;
    setOcupado(true);
    try {
      await registrarLlegadaCita(token, negocioId, cita.id);
      toast.exito('Llegada registrada');
      await cargar();
    } catch (e) {
      toast.error('No se pudo registrar la llegada', messageFromError(e));
      await cargar();
    } finally {
      setOcupado(false);
    }
  }
  async function reasignar(profesionalId: number) {
    if (!negocioId || !porReasignar || ocupado) return;
    setOcupado(true);
    try { await reasignarCita(token, negocioId, porReasignar.id, profesionalId); setPorReasignar(null); await cargar(); toast.exito('Cita reasignada', 'El cliente recibió el aviso con el nuevo profesional.'); }
    catch (e) { setErrorReasignar(messageFromError(e)); }
    finally { setOcupado(false); }
  }
  function confirmarAccion(cita: Cita, estado: Cita['estado']) {
    confirmar({
      icono: 'calendario',
      titulo:
        estado === 'confirmada'
          ? '¿Confirmar esta cita?'
          : estado === 'completada'
          ? '¿Marcar como atendida?'
          : '¿Cancelar esta cita?',
      texto: `${cita.servicio_nombre} · ${fechaCita(cita.fecha)}, ${hora12(
        cita.hora,
      )}.${
        estado === 'confirmada'
          ? ' Revisa tu agenda presencial antes de confirmar.'
          : ''
      }`,
      textoBoton:
        estado === 'confirmada'
          ? 'Confirmar cita'
          : estado === 'completada'
          ? 'Marcar atendida'
          : 'Cancelar cita',
      accion: () => cambiar(cita, estado),
    });
  }
  async function nuevaPresencial() {
    if (!negocioId || ocupado) return;
    setOcupado(true);
    try {
      setServicios(
        (await getServicios(auth!.token, negocioId)).filter(
          s => s.disponible && s.permite_citas,
        ),
      );
    } catch (e) {
      toast.error(
        'No se pudieron cargar los servicios',
        messageFromError(e, 'Intenta de nuevo.'),
      );
    } finally {
      setOcupado(false);
    }
  }
  return (
    <>
      <ScrollView style={styles.fondo} contentContainerStyle={styles.contenido}>
        <Text style={styles.titulo}>{gestion ? nombre : 'Mis citas'}</Text>
        <Text style={styles.detalle}>
          {gestion
            ? 'Las solicitudes sin respuesta vencen en un máximo de una hora. Registra la llegada del cliente: después de 15 minutos de retraso, la cita se cancela automáticamente como No asistió.'
            : 'Una solicitud pendiente necesita confirmación del negocio. Si pasan más de 15 minutos sin registrar tu llegada, la cita se cancelará y tendrás que solicitar una nueva.'}
        </Text>
        {gestion && !!negocioId && (
          <TouchableOpacity
            style={styles.boton}
            disabled={ocupado}
            onPress={nuevaPresencial}
          >
            <Text style={styles.botonTexto}>+ Registrar cita presencial</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          disabled={ocupado}
          onPress={() => {
            setCargando(true);
            cargar();
          }}
        >
          <Text style={styles.enlace}>Actualizar agenda</Text>
        </TouchableOpacity>
        {cargando && <ActivityIndicator color={c.accent} />}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {!cargando && !error && citas.length === 0 && (
          <Text style={styles.aviso}>
            {gestion
              ? 'Todavía no hay citas. Configura el horario automático en Mi Tienda y publica tus servicios para empezar.'
              : 'Todavía no tienes citas. Explora los servicios de un negocio y pulsa Solicitar cita.'}
          </Text>
        )}
        {citas.map(cita => (
          <View key={cita.id} style={styles.tarjeta}>
            <Text
              style={[
                styles.estado,
                cita.estado === 'confirmada' && styles.confirmada,
              ]}
            >
              {estadosCita[cita.estado]}
            </Text>
            <Text style={styles.nombre}>{cita.servicio_nombre}</Text>
            <Text style={styles.texto}>{fechaCita(cita.fecha)}</Text>
            <Text style={styles.texto}>
              {hora12(cita.hora)} – {hora12(cita.hora_fin)}
              {cita.fecha_fin !== cita.fecha ? ' (día siguiente)' : ''} ·
              Colombia
            </Text>
            <Text style={styles.texto}>Con {cita.profesional_nombre}</Text>
            <Text style={styles.detalle}>
              {gestion
                ? `${cita.cliente_nombre}${
                    cita.cliente_telefono ? ` · ${cita.cliente_telefono}` : ''
                  }`
                : cita.negocio_nombre}
            </Text>
            <Text style={styles.detalle}>
              {cita.origen === 'presencial'
                ? 'Registrada presencialmente'
                : 'Solicitada desde la app'}
            </Text>
            {cita.estado === 'pendiente' && cita.confirmar_antes_de && (
              <Text style={styles.aviso}>
                Responder antes de{' '}
                {new Date(cita.confirmar_antes_de).toLocaleTimeString('es-CO', {
                  timeZone: 'America/Bogota',
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                (Colombia).
              </Text>
            )}
            {!!cita.notas && <Text style={styles.texto}>{cita.notas}</Text>}
            {!!cita.motivo && <Text style={styles.detalle}>{cita.motivo}</Text>}
            {!!cita.llegada_at && <Text style={styles.detalle}>Llegada registrada</Text>}
            <View style={styles.acciones}>
              {gestion && propietario && ['pendiente', 'confirmada'].includes(cita.estado) && (
                <TouchableOpacity disabled={ocupado} style={styles.secundario} onPress={() => elegirProfesional(cita)}>
                  <Text style={styles.enlace}>Reasignar a otro trabajador</Text>
                </TouchableOpacity>
              )}
              {gestion && cita.estado === 'pendiente' && (
                <>
                  <TouchableOpacity
                    disabled={ocupado}
                    style={styles.boton}
                    onPress={() => confirmarAccion(cita, 'confirmada')}
                  >
                    <Text style={styles.botonTexto}>Confirmar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={ocupado}
                    style={styles.secundario}
                    onPress={() => {
                      setDecision({ cita, estado: 'rechazada' });
                      setMotivo('');
                      setErrorDecision('');
                    }}
                  >
                    <Text style={styles.error}>Rechazar</Text>
                  </TouchableOpacity>
                </>
              )}
              {gestion && cita.estado === 'confirmada' && (
                <>
                  {!cita.llegada_at && (
                    <TouchableOpacity disabled={ocupado} style={styles.boton} onPress={() => confirmar({
                      icono: 'calendario',
                      titulo: '¿El cliente ya llegó?',
                      texto: 'Registra la llegada solo cuando el cliente esté presente para evitar la cancelación automática.',
                      textoBoton: 'Registrar llegada',
                      accion: () => registrarLlegada(cita),
                    })}>
                      <Text style={styles.botonTexto}>Registrar llegada</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    disabled={ocupado || !cita.llegada_at}
                    style={styles.secundario}
                    onPress={() => confirmarAccion(cita, 'completada')}
                  >
                    <Text style={styles.enlace}>Marcar atendida</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={ocupado}
                    style={styles.secundario}
                    onPress={() => {
                      setDecision({ cita, estado: 'cancelada' });
                      setMotivo('');
                      setErrorDecision('');
                    }}
                  >
                    <Text style={styles.error}>Cancelar cita</Text>
                  </TouchableOpacity>
                </>
              )}
              {!gestion &&
                ['pendiente', 'confirmada'].includes(cita.estado) && (
                  <TouchableOpacity
                    disabled={ocupado}
                    style={styles.secundario}
                    onPress={() => confirmarAccion(cita, 'cancelada')}
                  >
                    <Text style={styles.error}>Cancelar cita</Text>
                  </TouchableOpacity>
                )}
              {!gestion && cita.estado === 'no_asistio' && (
                <TouchableOpacity style={styles.boton} onPress={() => navigation.navigate('Negocio', {
                  id: cita.negocio_id, nombre: cita.negocio_nombre, seccion: 'servicios',
                })}>
                  <Text style={styles.botonTexto}>Solicitar nueva cita</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {pagina < ultima && (
          <TouchableOpacity
            disabled={ocupado}
            onPress={async () => {
              setOcupado(true);
              await cargar(pagina + 1);
              setOcupado(false);
            }}
          >
            <Text style={styles.enlace}>Cargar más citas</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
      <Modal visible={porReasignar !== null} transparent animationType="slide" onRequestClose={() => { if (!ocupado) setPorReasignar(null); }}>
        <View style={styles.modalFondo}><ScrollView style={styles.modal} contentContainerStyle={styles.contenido}>
          <Text style={styles.nombre}>Reasignar cita</Text>
          <Text style={styles.texto}>Conservaremos la fecha y la hora. El cliente recibirá una notificación con el nuevo profesional.</Text>
          {!!errorReasignar && <Text style={styles.error}>{errorReasignar}</Text>}
          {!equipo.length && <Text style={styles.detalle}>No hay otro trabajador disponible en el equipo. Agrega uno antes de retirar al profesional.</Text>}
          {equipo.map(m => <TouchableOpacity key={m.id} style={styles.secundario} disabled={ocupado} onPress={() => reasignar(m.id)}><Text style={styles.enlace}>{m.name}</Text></TouchableOpacity>)}
          <TouchableOpacity disabled={ocupado} onPress={() => setPorReasignar(null)}><Text style={styles.enlace}>Volver</Text></TouchableOpacity>
        </ScrollView></View>
      </Modal>
      <Modal
        visible={servicios !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setServicios(null)}
      >
        <View style={styles.modalFondo}>
          <ScrollView
            style={styles.modal}
            contentContainerStyle={styles.contenido}
          >
            <Text style={styles.nombre}>
              Elige el servicio de la cita presencial
            </Text>
            {servicios?.length === 0 && (
              <Text style={styles.detalle}>
                Añade servicios con citas habilitadas en el catálogo.
              </Text>
            )}
            {servicios?.map(s => (
              <TouchableOpacity
                key={s.id}
                style={styles.secundario}
                onPress={() => {
                  setServicios(null);
                  navigation.navigate('AgendarCita', {
                    negocioId: negocioId!,
                    negocioNombre: nombre,
                    servicio: s,
                    presencial: true,
                  });
                }}
              >
                <Text style={styles.enlace}>
                  {s.nombre} · {s.duracion_minutos} min
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setServicios(null)}>
              <Text style={styles.enlace}>Volver</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
      <Modal
        visible={!!decision}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!ocupado) setDecision(null);
        }}
      >
        <View style={styles.modalFondo}>
          <View style={[styles.modal, styles.contenido]}>
            <Text style={styles.nombre}>
              {decision?.estado === 'rechazada'
                ? 'Rechazar solicitud'
                : 'Cancelar cita'}
            </Text>
            <Text style={styles.detalle}>
              Explica el motivo para que el cliente pueda elegir otra hora.
            </Text>
            <TextInput
              accessibilityLabel="Motivo de la decisión"
              style={styles.input}
              value={motivo}
              onChangeText={setMotivo}
              multiline
              maxLength={500}
              editable={!ocupado}
            />
            {!!errorDecision && (
              <Text style={styles.error}>{errorDecision}</Text>
            )}
            <TouchableOpacity
              style={styles.boton}
              disabled={ocupado || !motivo.trim()}
              onPress={() =>
                decision &&
                cambiar(decision.cita, decision.estado, motivo.trim())
              }
            >
              <Text style={styles.botonTexto}>Guardar decisión</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={ocupado}
              onPress={() => setDecision(null)}
            >
              <Text style={styles.enlace}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
const useStyles = makeStyles(c => ({
  fondo: { flex: 1, backgroundColor: c.bg },
  contenido: { padding: 20, gap: 14, paddingBottom: 40 },
  titulo: { color: c.textStrong, fontFamily: font.display, fontSize: 24 },
  nombre: { color: c.textStrong, fontFamily: font.semibold, fontSize: 17 },
  texto: { color: c.text, lineHeight: 21 },
  detalle: { color: c.muted, lineHeight: 21 },
  tarjeta: {
    backgroundColor: c.surface2,
    padding: 18,
    borderRadius: radius.md,
    gap: 8,
  },
  aviso: {
    color: c.text,
    lineHeight: 22,
    padding: 10,
    backgroundColor: c.bg,
    borderRadius: radius.sm,
  },
  estado: { color: c.muted, fontFamily: font.semibold },
  confirmada: { color: c.success },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  boton: {
    backgroundColor: c.accent,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  botonTexto: { color: c.onBrand, fontFamily: font.semibold },
  secundario: { paddingVertical: 12 },
  enlace: { color: c.goldText, fontFamily: font.semibold },
  error: { color: c.danger, lineHeight: 21 },
  modalFondo: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#0009',
    padding: 20,
  },
  modal: {
    backgroundColor: c.bg,
    borderRadius: radius.md,
    maxHeight: '85%',
    flexGrow: 0,
  },
  input: {
    borderWidth: 1,
    borderColor: c.borderStrong,
    padding: 14,
    borderRadius: radius.sm,
    color: c.text,
    minHeight: 80,
  },
}));
