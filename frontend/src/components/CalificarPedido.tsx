/**
 * Calificación del cliente al terminar un pedido: ¿el negocio y el
 * domiciliario cumplieron? Si algo falló, el cliente elige qué. Cada
 * respuesta sube o baja su nivel de confiabilidad (ver Reputacion.tsx).
 */
import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { calificarPedido, CalificacionPedido, OpcionProblema, SeguimientoPedido } from '../api';
import { useAuth } from '../AuthContext';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { FadeInView, PressableScale } from './anim';
import Icon from './Icon';

type Respuesta = { ok: boolean | null; problemas: string[] };

const VACIA: Respuesta = { ok: null, problemas: [] };

export default function CalificarPedido({ pedido, onEnviado }: { pedido: SeguimientoPedido; onEnviado: () => void }) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const [negocio, setNegocio] = useState<Respuesta>(VACIA);
  const [domi, setDomi] = useState<Respuesta>(VACIA);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const conDomiciliario = !!pedido.domiciliario;
  const opciones = pedido.opciones_problemas;
  const completa = (r: Respuesta) => r.ok === true || (r.ok === false && r.problemas.length > 0);
  const lista = completa(negocio) && (!conDomiciliario || completa(domi));
  const hayQueja = negocio.ok === false || domi.ok === false;

  async function enviar() {
    if (!lista) return;
    setEnviando(true);
    try {
      const msg = await calificarPedido(auth!.token, pedido.id, {
        negocio_ok: negocio.ok!,
        negocio_problemas: negocio.ok ? undefined : negocio.problemas,
        domiciliario_ok: conDomiciliario ? domi.ok! : undefined,
        domiciliario_problemas: conDomiciliario && !domi.ok ? domi.problemas : undefined,
        comentario: comentario.trim() || undefined,
      });
      toast.exito('Calificación enviada', msg);
      onEnviado();
    } catch (e) {
      toast.error('No se pudo enviar', e instanceof Error ? e.message : 'Error');
      setEnviando(false);
    }
  }

  return (
    <FadeInView style={styles.card}>
      <View style={styles.cabecera}>
        <Icon name="escudo" size={18} color={c.accent} />
        <Text style={styles.titulo}>¿Cómo te fue?</Text>
      </View>
      <Text style={styles.sub}>Tu respuesta sube o baja el nivel de confiabilidad de quienes te atendieron.</Text>

      <Pregunta
        titulo={`El negocio · ${pedido.negocio ?? ''}`}
        opciones={opciones?.negocio ?? []}
        valor={negocio}
        onChange={setNegocio}
      />
      {conDomiciliario && (
        <Pregunta
          titulo={`El domiciliario · ${pedido.domiciliario}`}
          opciones={opciones?.domiciliario ?? []}
          valor={domi}
          onChange={setDomi}
        />
      )}

      {hayQueja && (
        <TextInput
          style={styles.comentario}
          value={comentario}
          onChangeText={setComentario}
          placeholder="Cuéntanos qué pasó (opcional)"
          placeholderTextColor={c.mutedSoft}
          multiline
          maxLength={500}
        />
      )}

      <PressableScale
        style={[styles.enviar, !lista && styles.enviarOff]}
        onPress={enviar}
        disabled={!lista || enviando}>
        {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.enviarTxt}>Enviar calificación</Text>}
      </PressableScale>
    </FadeInView>
  );
}

/** "Todo bien" / "Hubo un problema" y, si falló, qué falló (varias). */
function Pregunta({
  titulo,
  opciones,
  valor,
  onChange,
}: {
  titulo: string;
  opciones: OpcionProblema[];
  valor: Respuesta;
  onChange: (r: Respuesta) => void;
}) {
  const { c } = useTheme();
  const styles = useStyles();

  function alternar(clave: string) {
    const problemas = valor.problemas.includes(clave)
      ? valor.problemas.filter(p => p !== clave)
      : [...valor.problemas, clave];
    onChange({ ok: false, problemas });
  }

  return (
    <View style={styles.pregunta}>
      <Text style={styles.preguntaTitulo} numberOfLines={1}>{titulo}</Text>
      <View style={styles.opcionesFila}>
        <PressableScale
          style={[styles.opcion, valor.ok === true && { backgroundColor: c.successSoft, borderColor: c.success }]}
          onPress={() => onChange({ ok: true, problemas: [] })}>
          <Icon name="check" size={16} color={valor.ok === true ? c.success : c.muted} />
          <Text style={[styles.opcionTxt, valor.ok === true && { color: c.success }]}>Todo bien</Text>
        </PressableScale>
        <PressableScale
          style={[styles.opcion, valor.ok === false && { backgroundColor: c.dangerSoft, borderColor: c.danger }]}
          onPress={() => onChange({ ok: false, problemas: valor.ok === false ? valor.problemas : [] })}>
          <Icon name="alerta" size={16} color={valor.ok === false ? c.danger : c.muted} />
          <Text style={[styles.opcionTxt, valor.ok === false && { color: c.danger }]}>Hubo un problema</Text>
        </PressableScale>
      </View>
      {valor.ok === false && (
        <View style={styles.chips}>
          {opciones.map(o => {
            const activo = valor.problemas.includes(o.clave);
            return (
              <PressableScale
                key={o.clave}
                style={[styles.chip, activo && styles.chipOn]}
                onPress={() => alternar(o.clave)}>
                <Text style={[styles.chipTxt, activo && styles.chipTxtOn]}>{o.label}</Text>
              </PressableScale>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Lo que el cliente ya contestó (después de calificar). */
export function ResumenCalificacion({
  calificacion,
  negocio,
  domiciliario,
}: {
  calificacion: CalificacionPedido;
  negocio: string | null;
  domiciliario: string | null;
}) {
  const { c } = useTheme();
  const styles = useStyles();

  const fila = (quien: string | null, ok: boolean | null, problemas: string[]) =>
    ok === null ? null : (
      <View style={styles.resumenFila}>
        <Icon name={ok ? 'check' : 'alerta'} size={16} color={ok ? c.success : c.danger} />
        <Text style={styles.resumenTxt}>
          <Text style={styles.resumenQuien}>{quien}: </Text>
          {ok ? 'todo bien' : problemas.join(', ').toLowerCase()}
        </Text>
      </View>
    );

  return (
    <FadeInView style={styles.card}>
      <View style={styles.cabecera}>
        <Icon name="escudo" size={18} color={c.accent} />
        <Text style={styles.titulo}>Tu calificación</Text>
      </View>
      {fila(negocio, calificacion.negocio_ok, calificacion.negocio_problemas)}
      {fila(domiciliario, calificacion.domiciliario_ok, calificacion.domiciliario_problemas)}
      {!!calificacion.comentario && <Text style={styles.resumenComentario}>“{calificacion.comentario}”</Text>}
      <Text style={styles.gracias}>Gracias: así Vitrina sabe en quién confiar.</Text>
    </FadeInView>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  card: {
    backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: c.accentSoft, ...shadow.soft,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titulo: { fontFamily: font.bold, color: c.textStrong, fontSize: 16 },
  sub: { color: c.muted, fontSize: 13, marginTop: 4, fontFamily: font.regular },
  pregunta: { marginTop: 16 },
  preguntaTitulo: { fontFamily: font.semibold, color: c.text, marginBottom: 8 },
  opcionesFila: { flexDirection: 'row', gap: 8 },
  opcion: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm, paddingVertical: 11,
  },
  opcionTxt: { fontFamily: font.semibold, color: c.text, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipOn: { backgroundColor: c.brand, borderColor: c.brand },
  chipTxt: { color: c.text, fontSize: 13, fontFamily: font.medium },
  chipTxtOn: { color: c.onBrand },
  comentario: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.sm, marginTop: 14,
    paddingHorizontal: 12, paddingVertical: 10, minHeight: 70, textAlignVertical: 'top',
    color: c.textStrong, fontFamily: font.regular,
  },
  enviar: {
    backgroundColor: c.brand, borderRadius: radius.sm, paddingVertical: 14,
    alignItems: 'center', marginTop: 16,
  },
  enviarOff: { opacity: 0.4 },
  enviarTxt: { color: c.onBrand, fontFamily: font.bold },
  resumenFila: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  resumenTxt: { flex: 1, color: c.text, fontSize: 14, fontFamily: font.regular },
  resumenQuien: { fontFamily: font.semibold, color: c.textStrong },
  resumenComentario: { color: c.muted, fontStyle: 'italic', marginTop: 8, fontFamily: font.regular },
  gracias: { color: c.mutedSoft, fontSize: 12, marginTop: 10, fontFamily: font.regular },
}));
