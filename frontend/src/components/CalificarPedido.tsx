/**
 * Primer paso al terminar un pedido: el cliente califica al domiciliario con
 * caritas de 1 a 5 en amabilidad, rapidez y estado del producto. Lo grave (no
 * llegó, llegó abierto, cobró de más) va aparte. A la tienda y a sus productos
 * los valora después, con estrellas (ResenarPedido). Las caritas alimentan la
 * confiabilidad del domiciliario, un dato interno que el cliente no ve.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import {
  AspectoCaritas,
  calificarPedido,
  CalificacionPedido,
  NotaCarita,
  SeguimientoPedido,
} from '../api';
import { useAuth } from '../AuthContext';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { animarDespliegue, Desplegable, FadeInView, PressableScale } from './anim';
import Carita, { colorCarita } from './Carita';
import Icon from './Icon';
import { useBloqueConTeclado } from './EspacioTeclado';

const NOTAS: NotaCarita[] = [1, 2, 3, 4, 5];

export default function CalificarPedido({ pedido, onEnviado }: { pedido: SeguimientoPedido; onEnviado: () => void }) {
  // El comentario es el único campo: al escribir, también se ve «Enviar y seguir».
  const bloque = useBloqueConTeclado();
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const [caritas, setCaritas] = useState<Record<string, NotaCarita>>({});
  const [graves, setGraves] = useState<string[]>([]);
  const [verGraves, setVerGraves] = useState(false);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const opciones = pedido.opciones_problemas;
  const aspectos = pedido.aspectos_domiciliario ?? [];
  // Si nunca llegó, no hay trato, rapidez ni estado que calificar.
  const noLlego = graves.includes('no_llego');
  const lista = noLlego || aspectos.every(a => caritas[a.clave]);
  const caritaBaja = !noLlego && Object.values(caritas).some(n => n <= 2);
  const hayQueja = graves.length > 0 || caritaBaja;

  function alternarGrave(clave: string) {
    animarDespliegue();
    setGraves(g => (g.includes(clave) ? g.filter(x => x !== clave) : [...g, clave]));
  }

  async function enviar() {
    if (!lista) return;
    setEnviando(true);
    try {
      const msg = await calificarPedido(auth!.token, pedido.id, {
        domiciliario_caritas: !noLlego ? caritas : undefined,
        domiciliario_problemas: graves.length > 0 ? graves : undefined,
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
        <Icon name="moto" size={18} color={c.accent} />
        <Text style={styles.titulo}>¿Cómo te atendió el domiciliario?</Text>
      </View>
      <Text style={styles.sub}>{pedido.domiciliario} · Después podrás calificar la tienda y sus productos.</Text>

        <View style={styles.pregunta}>

          <Desplegable abierto={!noLlego}>
            {aspectos.map(a => (
              <FilaCaritas
                key={a.clave}
                aspecto={a}
                valor={caritas[a.clave]}
                onChange={n => setCaritas(v => ({ ...v, [a.clave]: n }))}
              />
            ))}
          </Desplegable>

          {/* Lo grave no es cuestión de caritas: va aparte y pesa mucho más. */}
          <PressableScale
            style={styles.graveBoton}
            onPress={() => {
              animarDespliegue();
              setVerGraves(v => !v);
            }}
            disabled={graves.length > 0}>
            <Icon name="alerta" size={15} color={graves.length > 0 ? c.danger : c.muted} />
            <Text style={[styles.graveTxt, graves.length > 0 && { color: c.danger }]}>¿Pasó algo grave?</Text>
            {graves.length === 0 && (
              <View style={{ transform: [{ rotate: verGraves ? '-90deg' : '90deg' }] }}>
                <Icon name="chevron" size={14} color={c.muted} />
              </View>
            )}
          </PressableScale>
          <Desplegable abierto={verGraves || graves.length > 0}>
            <View style={styles.chips}>
              {(opciones?.domiciliario ?? []).map(o => {
                const activo = graves.includes(o.clave);
                return (
                  <PressableScale
                    key={o.clave}
                    style={[styles.chip, activo && styles.chipGrave]}
                    onPress={() => alternarGrave(o.clave)}>
                    <Text style={[styles.chipTxt, activo && styles.chipTxtOn]}>{o.label}</Text>
                  </PressableScale>
                );
              })}
            </View>
            {noLlego && <Text style={styles.nota}>Como no te llegó, no hace falta calificarlo con caritas.</Text>}
          </Desplegable>
        </View>

      <View ref={bloque.ref}>
        {hayQueja && (
          <TextInput
            style={styles.comentario}
            value={comentario}
            onChangeText={setComentario}
            onFocus={bloque.onFocus}
            onBlur={bloque.onBlur}
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
          {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.enviarTxt}>Enviar y seguir</Text>}
        </PressableScale>
      </View>
    </FadeInView>
  );
}

/**
 * Una fila de 5 caritas (de muy brava a muy feliz) para un aspecto. Al
 * elegir una, las demás se apagan y arriba sale lo que significa.
 */
function FilaCaritas({
  aspecto,
  valor,
  onChange,
}: {
  aspecto: AspectoCaritas;
  valor?: NotaCarita;
  onChange: (n: NotaCarita) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.aspecto}>
      <View style={styles.aspectoCabecera}>
        <Text style={styles.aspectoNombre}>{aspecto.nombre}</Text>
        {!!valor && (
          <View style={[styles.aspectoValor, { borderColor: colorCarita(valor) }]}>
            <Text style={styles.aspectoValorTxt}>{aspecto.caritas[valor - 1]}</Text>
          </View>
        )}
      </View>
      <Text style={styles.aspectoAyuda}>{aspecto.ayuda}</Text>
      <View style={styles.caritasFila} accessibilityRole="radiogroup" accessibilityLabel={aspecto.nombre}>
        {NOTAS.map(n => {
          const activa = valor === n;
          return (
            <PressableScale
              key={n}
              scaleTo={0.88}
              onPress={() => onChange(n)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={`${aspecto.nombre}: ${aspecto.caritas[n - 1]}`}
              style={[
                styles.carita,
                activa && { borderColor: colorCarita(n), backgroundColor: `${colorCarita(n)}1F` },
                !!valor && !activa && styles.caritaApagada,
              ]}>
              <Carita nota={n} size={40} />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

/** Lo que el cliente ya contestó (después de calificar). */
export function ResumenCalificacion({
  calificacion,
  domiciliario,
}: {
  calificacion: CalificacionPedido;
  domiciliario: string | null;
}) {
  const { c } = useTheme();
  const styles = useStyles();
  const caritas = calificacion.domiciliario_caritas;

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
        <Icon name="moto" size={18} color={c.accent} />
        <Text style={styles.titulo}>Tu calificación al domiciliario</Text>
      </View>
      {caritas?.length ? (
        <>
          <Text style={[styles.resumenTxt, styles.resumenQuien, styles.resumenDomi]}>{domiciliario}</Text>
          <View style={styles.resumenCaritas}>
            {caritas.map(cd => (
              <View key={cd.clave} style={styles.resumenCarita}>
                <Carita nota={cd.nota} size={34} />
                <Text style={styles.resumenAspecto}>{cd.nombre}</Text>
                <Text style={styles.resumenTexto}>{cd.texto}</Text>
              </View>
            ))}
          </View>
          {calificacion.domiciliario_problemas.length > 0 && fila('Además', false, calificacion.domiciliario_problemas)}
        </>
      ) : (
        // Antes de las caritas, o si el pedido nunca llegó.
        fila(domiciliario, calificacion.domiciliario_ok, calificacion.domiciliario_problemas)
      )}
      {!!calificacion.comentario && <Text style={styles.resumenComentario}>“{calificacion.comentario}”</Text>}
      <Text style={styles.gracias}>Gracias por calificar.</Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipGrave: { backgroundColor: c.danger, borderColor: c.danger },
  chipTxt: { color: c.text, fontSize: 13, fontFamily: font.medium },
  chipTxtOn: { color: c.onBrand },
  aspecto: {
    backgroundColor: c.surface2, borderRadius: radius.sm, paddingHorizontal: 10, paddingTop: 10,
    paddingBottom: 8, marginBottom: 8,
  },
  aspectoCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  aspectoNombre: { fontFamily: font.bold, color: c.textStrong, fontSize: 14 },
  aspectoValor: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2 },
  aspectoValorTxt: { fontFamily: font.semibold, color: c.textStrong, fontSize: 12 },
  aspectoAyuda: { color: c.muted, fontSize: 12, marginTop: 1, fontFamily: font.regular },
  caritasFila: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  carita: { padding: 2, borderRadius: radius.pill, borderWidth: 2, borderColor: 'transparent' },
  caritaApagada: { opacity: 0.35 },
  graveBoton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  graveTxt: { color: c.muted, fontFamily: font.semibold, fontSize: 13 },
  nota: { color: c.muted, fontSize: 12, marginTop: 8, fontFamily: font.regular },
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
  resumenDomi: { flex: 0, marginTop: 12 },
  resumenCaritas: { flexDirection: 'row', gap: 8, marginTop: 8 },
  resumenCarita: {
    flex: 1, alignItems: 'center', backgroundColor: c.surface2, borderRadius: radius.sm,
    paddingVertical: 8, paddingHorizontal: 4,
  },
  resumenAspecto: { color: c.muted, fontSize: 11, marginTop: 4, textAlign: 'center', fontFamily: font.medium },
  resumenTexto: { color: c.textStrong, fontSize: 12, textAlign: 'center', fontFamily: font.semibold },
  resumenComentario: { color: c.muted, fontStyle: 'italic', marginTop: 8, fontFamily: font.regular },
  gracias: { color: c.mutedSoft, fontSize: 12, marginTop: 10, fontFamily: font.regular },
}));
