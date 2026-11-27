/**
 * Etapa «Por hacer» de una producción, desde el teléfono: cuántas se hacen,
 * los materiales (los del modelo ya vienen puestos) con − y + para decir si
 * se usó más o menos de lo normal, y «Añadir material» para lo que se usó
 * aparte. «Terminada» los descuenta del inventario; si no alcanza, pregunta
 * si descuenta lo que haya. Ponerle nombre para el catálogo se hace en la web.
 */
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { ApiError, cancelarProduccion, guardarProduccion, ProduccionLinea, ProduccionMaterial } from '../api';
import { useAuth } from '../AuthContext';
import { PressableScale } from '../components/anim';
import { useConfirmar } from '../components/Confirmacion';
import { ScrollTeclado } from '../components/EspacioTeclado';
import Icon from '../components/Icon';
import { messageFromError } from '../formErrors';
import type { RootStackParamList } from '../navTypes';
import { useNegocio } from '../NegocioContext';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';
import { numero } from './ProduccionScreen';

/** «2,5» o «2.5» → 2.5; vacío → 0 */
export function leer(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, '');
  if (limpio === '') return 0;
  const n = Number(limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio);
  return Number.isFinite(n) ? n : NaN;
}
const redondear = (n: number) => Math.round(n * 1000) / 1000;

type Fila = ProduccionLinea & { texto: string };

/** De a uno, o de a 0,1 si lo normal es menos de uno (0,5 kg de soldadura). */
function paso(f: Fila): number {
  const base = f.normal ?? f.por_unidad ?? 1;
  return base > 0 && base < 1 ? 0.1 : 1;
}

export default function ProduccionEtapaScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const { produccion, materiales } = useRoute<RouteProp<RootStackParamList, 'ProduccionEtapa'>>().params;
  const { auth } = useAuth();
  const token = auth!.token;
  const { negocio } = useNegocio();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [cantidad, setCantidad] = useState(numero(produccion.cantidad));
  const [filas, setFilas] = useState<Fila[]>(produccion.materiales.map(m => ({ ...m, texto: numero(m.cantidad) })));
  const [nota, setNota] = useState(produccion.nota ?? '');
  const [eligiendo, setEligiendo] = useState(false);
  const [buscar, setBuscar] = useState('');
  const [enviando, setEnviando] = useState<'guardar' | 'terminar' | null>(null);

  const total = leer(cantidad);
  const totalValido = total > 0 && total <= 100000;
  const filasValidas = filas.every(f => !Number.isNaN(leer(f.texto)) && leer(f.texto) >= 0);
  const faltan = filas.filter(f => leer(f.texto) > f.hay + 0.0005);
  const disponibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return materiales.filter(m => !filas.some(f => f.id === m.id) && (!q || `${m.nombre} ${m.rasgos}`.toLowerCase().includes(q)));
  }, [materiales, filas, buscar]);

  function unidad(n: number, f: ProduccionMaterial) {
    return Math.abs(n - 1) < 0.0005 ? f.unidad_uno : f.unidad_varios;
  }

  function cambiarFila(id: number, texto: string) {
    setFilas(fs => fs.map(f => (f.id === id ? { ...f, texto } : f)));
  }

  function sumar(f: Fila, delta: number) {
    const actual = leer(f.texto);
    cambiarFila(f.id, numero(Math.max(0, redondear((Number.isNaN(actual) ? 0 : actual) + delta))));
  }

  // Cambió cuántas se hacen: lo normal se recalcula y se conserva lo que se puso de más o de menos.
  function cambiarTotal(texto: string) {
    setCantidad(texto);
    const nuevo = leer(texto);
    if (!(nuevo > 0)) return;
    setFilas(fs => fs.map(f => {
      if (f.normal === null || f.por_unidad === null) return f;
      const normal = redondear(f.por_unidad * nuevo);
      const actual = leer(f.texto);
      return { ...f, normal, texto: numero(Math.max(0, redondear((Number.isNaN(actual) ? f.normal : actual) + normal - f.normal))) };
    }));
  }

  function anadir(m: ProduccionMaterial) {
    setFilas(fs => [...fs, { ...m, cantidad: 1, normal: null, por_unidad: null, texto: '1' }]);
    setEligiendo(false);
    setBuscar('');
  }

  async function enviar(terminar: boolean, aunqueFalte = false) {
    if (!negocio || !totalValido || !filasValidas) return;
    setEnviando(terminar ? 'terminar' : 'guardar');
    try {
      const r = await guardarProduccion(token, negocio.id, produccion.id, {
        cantidad: total, nota: nota.trim(), terminar, aunqueFalte,
        materiales: filas.map(f => ({ articulo_id: f.id, cantidad: leer(f.texto) })),
      });
      toast.exito(terminar ? '¡Terminada!' : 'Guardado', r.message);
      navigation.goBack();
    } catch (e) {
      const faltantes: { nombre: string; falta: string }[] | undefined = e instanceof ApiError && e.status === 422 ? e.data?.faltantes : undefined;
      if (terminar && faltantes?.length && !aunqueFalte) {
        confirmar({
          icono: 'alerta',
          titulo: 'No alcanza el material',
          texto: 'Puedes terminarla de todas formas: se descuenta lo que haya y queda anotado lo que faltó.',
          puntos: faltantes.map(f => ({ icono: 'caja', texto: `Faltan ${f.falta} de «${f.nombre}»` })),
          textoBoton: 'Descontar lo que haya',
          accion: () => enviar(true, true),
        });
      } else {
        toast.error('No se pudo guardar', messageFromError(e));
      }
    } finally {
      setEnviando(null);
    }
  }

  function cancelar() {
    confirmar({
      icono: 'basura',
      titulo: `¿Cancelar «${produccion.nombre}»?`,
      texto: 'Todavía no se había descontado nada del inventario.',
      textoBoton: 'Cancelar producción',
      peligro: true,
      accion: async () => {
        if (!negocio) return;
        try {
          const r = await cancelarProduccion(token, negocio.id, produccion.id);
          toast.exito('Cancelada', r.message);
          navigation.goBack();
        } catch (e) {
          toast.error('No se pudo cancelar', messageFromError(e));
        }
      },
    });
  }

  const listo = totalValido && filasValidas && enviando === null;

  return (
    <ScrollTeclado style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.pasos}>
        {['Por hacer', 'Ponerle nombre', 'En el catálogo'].map((p, i) => (
          <Text key={p} style={[styles.paso, i === 0 && styles.pasoActual]}>{i + 1}. {p}</Text>
        ))}
      </View>
      <Text style={styles.titulo}>{produccion.nombre}</Text>
      <Text style={styles.subtitulo}>{produccion.modelo ? `Modelo «${produccion.modelo.nombre}»` : 'Sin modelo'}</Text>

      <Text style={styles.etiqueta}>¿Cuántas se hacen?</Text>
      <View style={styles.contador}>
        <PressableScale style={styles.botonRedondo} onPress={() => cambiarTotal(numero(Math.max(1, Math.round((totalValido ? total : 1) - 1))))} accessibilityRole="button" accessibilityLabel="Una menos" hitSlop={6}>
          <Icon name="menos" size={20} color={c.textStrong} />
        </PressableScale>
        <TextInput style={styles.cantidad} value={cantidad} onChangeText={cambiarTotal} keyboardType="decimal-pad" selectTextOnFocus accessibilityLabel="Cuántas se hacen" />
        <PressableScale style={styles.botonRedondo} onPress={() => cambiarTotal(numero(Math.round((totalValido ? total : 0) + 1)))} accessibilityRole="button" accessibilityLabel="Una más" hitSlop={6}>
          <Icon name="mas" size={20} color={c.textStrong} />
        </PressableScale>
      </View>

      <Text style={styles.etiqueta}>Materiales</Text>
      <Text style={styles.ayuda}>
        {produccion.modelo ? 'Estos son los de siempre. Usa − y + si se usó menos o más, y añade lo que se usó aparte.' : 'Añade los materiales que se usan.'}
      </Text>
      <View style={styles.caja}>
        {filas.length === 0 && <Text style={styles.vacio}>Sin materiales todavía.</Text>}
        {filas.map(f => {
          const n = leer(f.texto);
          const corto = n > f.hay + 0.0005;
          const resta = f.normal === null || Number.isNaN(n) ? 0 : redondear(n - f.normal);
          return (
            <View key={f.id} style={styles.material}>
              <View style={styles.materialArriba}>
                <View style={styles.materialNombre}>
                  <Text style={[styles.materialTitulo, corto && styles.peligro]}>{f.nombre}</Text>
                  <Text style={styles.materialRasgos}>
                    {f.rasgos ? `${f.rasgos} · ` : ''}
                    {f.normal === null ? 'Añadido aparte' : `Lo normal: ${numero(f.normal)} ${unidad(f.normal, f)}`}
                    {resta > 0 ? ` · ${numero(resta)} de más` : resta < 0 ? ` · ${numero(-resta)} de menos` : ''}
                  </Text>
                </View>
                <PressableScale onPress={() => setFilas(fs => fs.filter(x => x.id !== f.id))} accessibilityRole="button" accessibilityLabel={`Quitar ${f.nombre}`} hitSlop={8}>
                  <Icon name="cerrar" size={16} color={c.muted} />
                </PressableScale>
              </View>
              <View style={styles.materialAbajo}>
                <PressableScale style={styles.botonChico} onPress={() => sumar(f, -paso(f))} accessibilityRole="button" accessibilityLabel={`Usar menos ${f.nombre}`} hitSlop={4}>
                  <Icon name="menos" size={16} color={c.textStrong} />
                </PressableScale>
                <TextInput
                  style={[styles.materialInput, corto && styles.inputPeligro]}
                  value={f.texto}
                  onChangeText={t => cambiarFila(f.id, t)}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  accessibilityLabel={`Cuánto ${f.nombre} se usa`}
                />
                <PressableScale style={styles.botonChico} onPress={() => sumar(f, paso(f))} accessibilityRole="button" accessibilityLabel={`Usar más ${f.nombre}`} hitSlop={4}>
                  <Icon name="mas" size={16} color={c.textStrong} />
                </PressableScale>
                <Text style={styles.unidad}>{Number.isNaN(n) ? f.unidad_varios : unidad(n, f)}</Text>
                <Text style={[styles.hay, corto && styles.peligro]}>hay {numero(f.hay)}</Text>
              </View>
            </View>
          );
        })}
        {faltan.length > 0 && (
          <View style={styles.avisoFalta}>
            <Icon name="alerta" size={15} color={c.danger} />
            <Text style={styles.avisoFaltaTxt}>No alcanza lo que está en rojo. Puedes terminarla igual y se descuenta lo que haya.</Text>
          </View>
        )}
      </View>

      {eligiendo ? (
        <View style={styles.elegir}>
          <TextInput style={styles.buscar} value={buscar} onChangeText={setBuscar} placeholder="Buscar material" placeholderTextColor={c.muted} accessibilityLabel="Buscar material" autoFocus />
          {disponibles.slice(0, 30).map(m => (
            <PressableScale key={m.id} style={styles.opcion} onPress={() => anadir(m)} accessibilityRole="button" accessibilityLabel={`Añadir ${m.nombre}`}>
              <View style={styles.materialNombre}>
                <Text style={styles.materialTitulo}>{m.nombre}</Text>
                {!!m.rasgos && <Text style={styles.materialRasgos}>{m.rasgos}</Text>}
              </View>
              <Text style={styles.hay}>hay {numero(m.hay)}</Text>
            </PressableScale>
          ))}
          {disponibles.length === 0 && <Text style={styles.vacio}>No hay más materiales.</Text>}
          <PressableScale onPress={() => { setEligiendo(false); setBuscar(''); }} accessibilityRole="button"><Text style={styles.enlace}>Cerrar</Text></PressableScale>
        </View>
      ) : (
        <PressableScale style={styles.anadir} onPress={() => setEligiendo(true)} accessibilityRole="button">
          <Icon name="mas" size={16} color={c.goldText} />
          <Text style={styles.anadirTxt}>Añadir material</Text>
        </PressableScale>
      )}

      <Text style={styles.etiqueta}>Nota (opcional)</Text>
      <TextInput style={styles.nota} value={nota} onChangeText={setNota} maxLength={255} placeholder="Para el señor Pérez, 2 × 1,5 m…" placeholderTextColor={c.muted} accessibilityLabel="Nota" />

      <PressableScale style={[styles.boton, !listo && styles.botonApagado]} disabled={!listo} onPress={() => enviar(true)} accessibilityRole="button">
        {enviando === 'terminar' ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTxt}>Terminada: descontar materiales</Text>}
      </PressableScale>
      <PressableScale style={[styles.botonClaro, !listo && styles.botonApagado]} disabled={!listo} onPress={() => enviar(false)} accessibilityRole="button">
        {enviando === 'guardar' ? <ActivityIndicator color={c.textStrong} /> : <Text style={styles.botonClaroTxt}>Guardar y seguir después</Text>}
      </PressableScale>
      <PressableScale onPress={cancelar} accessibilityRole="button" style={styles.cancelar}>
        <Text style={styles.cancelarTxt}>Cancelar esta producción</Text>
      </PressableScale>
    </ScrollTeclado>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 40 },
  pasos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  paso: {
    fontFamily: font.semibold, fontSize: 12, color: c.muted, backgroundColor: c.surface2,
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden',
  },
  pasoActual: { color: c.goldText, backgroundColor: c.accentSoft },
  titulo: { fontFamily: font.display, fontSize: 22, color: c.textStrong },
  subtitulo: { fontFamily: font.regular, fontSize: 13, color: c.muted, marginTop: 2 },
  etiqueta: { fontFamily: font.semibold, fontSize: 14, color: c.textStrong, marginTop: 18, marginBottom: 8 },
  ayuda: { fontFamily: font.regular, fontSize: 13, color: c.muted, lineHeight: 18, marginTop: -4, marginBottom: 8 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  botonRedondo: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  cantidad: {
    flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface,
    textAlign: 'center', fontFamily: font.display, fontSize: 24, color: c.textStrong,
  },
  caja: { backgroundColor: c.surface, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 4, ...shadow.low },
  vacio: { fontFamily: font.regular, fontSize: 13, color: c.muted, paddingVertical: 12 },
  material: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border, gap: 8 },
  materialArriba: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  materialNombre: { flex: 1 },
  materialTitulo: { fontFamily: font.semibold, fontSize: 14, color: c.textStrong },
  materialRasgos: { fontFamily: font.regular, fontSize: 12, color: c.muted, marginTop: 1, lineHeight: 17 },
  materialAbajo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  botonChico: {
    width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  materialInput: {
    width: 70, height: 38, borderRadius: 12, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface,
    textAlign: 'center', fontFamily: font.bold, fontSize: 15, color: c.textStrong,
  },
  inputPeligro: { borderColor: c.danger },
  unidad: { fontFamily: font.regular, fontSize: 13, color: c.muted, minWidth: 54 },
  hay: { marginLeft: 'auto', fontFamily: font.regular, fontSize: 12, color: c.muted },
  peligro: { color: c.danger },
  avisoFalta: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 10 },
  avisoFaltaTxt: { flex: 1, fontFamily: font.medium, fontSize: 13, color: c.danger, lineHeight: 18 },
  anadir: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: c.accentSoft,
  },
  anadirTxt: { fontFamily: font.bold, fontSize: 14, color: c.goldText },
  elegir: { marginTop: 10, backgroundColor: c.surface, borderRadius: radius.md, padding: 12, gap: 4, ...shadow.low },
  buscar: {
    height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.bg,
    paddingHorizontal: 12, fontFamily: font.regular, fontSize: 15, color: c.textStrong, marginBottom: 4,
  },
  opcion: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  enlace: { fontFamily: font.semibold, fontSize: 14, color: c.goldText, paddingVertical: 8, textAlign: 'center' },
  nota: {
    height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface,
    paddingHorizontal: 14, fontFamily: font.regular, fontSize: 15, color: c.textStrong,
  },
  boton: { marginTop: 22, height: 52, borderRadius: radius.md, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' },
  botonApagado: { opacity: 0.5 },
  botonTxt: { fontFamily: font.bold, fontSize: 16, color: c.onBrand },
  botonClaro: {
    marginTop: 10, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  botonClaroTxt: { fontFamily: font.bold, fontSize: 15, color: c.textStrong },
  cancelar: { marginTop: 16, alignSelf: 'center', padding: 8 },
  cancelarTxt: { fontFamily: font.semibold, fontSize: 14, color: c.danger },
}));
