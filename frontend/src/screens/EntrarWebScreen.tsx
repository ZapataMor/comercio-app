/**
 * Entrar a la web — aprobar desde el teléfono la entrada al panel web del
 * negocio (Vitrina Gestión, ADR-005). En el computador, la página
 * /negocio/entrar muestra un código; aquí se escribe, la app muestra desde qué
 * navegador se quiere entrar y, al aprobar, el navegador entra solo.
 *
 * También lista las sesiones web abiertas para cerrarlas (por ejemplo, si
 * quedó abierta en un computador ajeno).
 *
 * Por ahora el código se escribe; escanear el QR necesita una librería de
 * cámara y queda para después.
 */
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  AccesoWebDisponible,
  aprobarAccesoWeb,
  cerrarSesionWeb,
  ConsultaAccesoWeb,
  consultarAccesoWeb,
  getAccesoWeb,
  getSesionesWeb,
  SesionWeb,
} from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import { BloqueTeclado, ScrollTeclado } from '../components/EspacioTeclado';
import { messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { useLecturaEnFoco } from '../useLectura';

type Props = NativeStackScreenProps<RootStackParamList, 'EntrarWeb'>;

/** Deja solo letras y números, en mayúsculas, y pone el guion del medio. */
export function formatearCodigoWeb(texto: string): string {
  const limpio = texto.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return limpio.length > 4 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio;
}

function fechaCorta(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function EntrarWebScreen(_: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const token = auth!.token;
  const toast = useToast();

  const [info, setInfo] = useState<AccesoWebDisponible | null>(null);
  const [sesiones, setSesiones] = useState<SesionWeb[]>([]);
  const [codigo, setCodigo] = useState('');
  const [consulta, setConsulta] = useState<ConsultaAccesoWeb | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    getAccesoWeb(token).then(setInfo).catch(e => setError(messageFromError(e)));
    getSesionesWeb(token).then(setSesiones).catch(() => {});
  }, [token]);
  useLecturaEnFoco(cargar);
  const recarga = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(recarga.current), []);

  const listo = codigo.replace('-', '').length === 8;

  async function revisar() {
    setOcupado(true);
    setError(null);
    try {
      setConsulta(await consultarAccesoWeb(token, codigo));
    } catch (e) {
      setError(messageFromError(e));
    } finally {
      setOcupado(false);
    }
  }

  async function aprobar() {
    setOcupado(true);
    setError(null);
    try {
      toast.exito('Listo', await aprobarAccesoWeb(token, codigo));
      setCodigo('');
      setConsulta(null);
      // La sesión aparece cuando el navegador entra (pregunta cada 2 segundos).
      clearTimeout(recarga.current);
      recarga.current = setTimeout(cargar, 4000);
    } catch (e) {
      setError(messageFromError(e));
      setConsulta(null);
    } finally {
      setOcupado(false);
    }
  }

  async function cerrar(id: number) {
    try {
      await cerrarSesionWeb(token, id);
      setSesiones(s => s.filter(x => x.id !== id));
      toast.exito('Sesión web cerrada');
    } catch (e) {
      toast.error('No se pudo cerrar', messageFromError(e));
    }
  }

  if (!info) {
    return (
      <View style={[styles.container, styles.centro]}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={c.accent} />}
      </View>
    );
  }

  return (
    <ScrollTeclado style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!info.disponible ? (
        <View style={styles.card}>
          <Text style={styles.titulo}>Panel web</Text>
          <Text style={styles.texto}>
            Ninguno de tus negocios tiene el panel web. Es parte de Vitrina Gestión: pídeselo a Vitrina si quieres manejar
            tu negocio desde un computador.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.titulo}>Entrar a la web</Text>
          <Text style={styles.texto}>
            En el computador abre <Text style={styles.url}>{info.url}</Text> y escribe aquí el código que aparece.
          </Text>
          <Text style={styles.negocios}>Negocios con panel: {info.negocios.map(n => n.nombre).join(', ')}</Text>
          <BloqueTeclado>
            {campo => (
              <>
                <TextInput
                  style={styles.input}
                  value={codigo}
                  onChangeText={t => {
                    setCodigo(formatearCodigoWeb(t));
                    setConsulta(null);
                    setError(null);
                  }}
                  placeholder="ABCD-EFGH"
                  placeholderTextColor={c.muted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={9}
                  accessibilityLabel="Código que muestra la web"
                  onFocus={campo.onFocus}
                  onBlur={campo.onBlur}
                  editable={!ocupado}
                />
                {!!error && <Text style={styles.error}>{error}</Text>}
                {consulta ? (
                  <View style={styles.confirmar}>
                    <Text style={styles.texto}>
                      ¿Entrar al panel en <Text style={styles.fuerte}>{consulta.navegador}</Text>? Apruébalo solo si es tu
                      computador y lo tienes enfrente.
                    </Text>
                    <View style={styles.fila}>
                      <TouchableOpacity style={[styles.boton, styles.botonNo]} onPress={() => setConsulta(null)} disabled={ocupado}>
                        <Text style={styles.botonNoTxt}>No</Text>
                      </TouchableOpacity>
                      <PressableScale style={[styles.boton, styles.botonSi]} onPress={aprobar} disabled={ocupado}>
                        <Text style={styles.botonSiTxt}>{ocupado ? 'Aprobando…' : 'Sí, entrar'}</Text>
                      </PressableScale>
                    </View>
                  </View>
                ) : (
                  <PressableScale style={[styles.boton, styles.botonSi, !listo && styles.apagado]} onPress={revisar} disabled={!listo || ocupado}>
                    <Text style={styles.botonSiTxt}>{ocupado ? 'Revisando…' : 'Continuar'}</Text>
                  </PressableScale>
                )}
              </>
            )}
          </BloqueTeclado>
        </View>
      )}

      {sesiones.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.titulo}>Sesiones web abiertas</Text>
          {sesiones.map(s => (
            <View key={s.id} style={styles.sesion}>
              <View style={styles.sesionTexto}>
                <Text style={styles.fuerte}>{s.navegador}</Text>
                <Text style={styles.texto}>Desde {fechaCorta(s.desde)}</Text>
              </View>
              <TouchableOpacity onPress={() => cerrar(s.id)} accessibilityLabel={`Cerrar la sesión en ${s.navegador}`}>
                <Text style={styles.cerrar}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollTeclado>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  centro: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, paddingBottom: 120 },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 18, marginBottom: 16, ...shadow.soft },
  titulo: { fontSize: 17, fontFamily: font.displaySemi, color: c.textStrong, marginBottom: 8 },
  texto: { color: c.text, fontSize: 14, fontFamily: font.regular, lineHeight: 20 },
  url: { fontFamily: font.bold, color: c.goldText },
  negocios: { color: c.muted, fontSize: 12, fontFamily: font.regular, marginTop: 8 },
  fuerte: { fontFamily: font.bold, color: c.textStrong },
  input: {
    borderWidth: 1.5, borderColor: c.borderStrong, borderRadius: radius.md, marginTop: 14, paddingVertical: 12,
    textAlign: 'center', fontSize: 24, letterSpacing: 3, fontFamily: font.bold, color: c.textStrong,
  },
  error: { color: c.danger, fontSize: 13, fontFamily: font.semibold, marginTop: 8 },
  confirmar: { marginTop: 14 },
  fila: { flexDirection: 'row', gap: 10, marginTop: 12 },
  boton: { flex: 1, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  botonSi: { backgroundColor: c.brand },
  botonSiTxt: { color: c.onBrand, fontFamily: font.bold, fontSize: 15 },
  botonNo: { borderWidth: 1, borderColor: c.borderStrong },
  botonNoTxt: { color: c.text, fontFamily: font.semibold },
  apagado: { opacity: 0.5 },
  sesion: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
  sesionTexto: { flex: 1 },
  cerrar: { color: c.danger, fontFamily: font.bold },
}));
