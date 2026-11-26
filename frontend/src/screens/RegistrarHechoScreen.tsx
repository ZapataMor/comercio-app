/**
 * «Registrar como hecho» desde el teléfono: cuántos se hicieron, qué pasa con
 * ellos (al catálogo, en espera de sus datos o de un encargo) y una nota.
 * Antes de enviar se ve lo que se descuenta del inventario y lo que falta.
 * Si el servidor dice que no alcanza, pregunta si descuenta lo que haya.
 */
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { ApiError, DestinoProduccion, registrarHecho } from '../api';
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

const DESTINOS: { valor: DestinoProduccion; titulo: string; ayuda: string }[] = [
  { valor: 'catalogo', titulo: 'Sumar al catálogo', ayuda: 'Salió igual al producto: queda para la venta.' },
  { valor: 'espera', titulo: 'Dejar en espera', ayuda: 'Salió con medidas o acabado propios: sus datos se completan en la web.' },
  { valor: 'pedido', titulo: 'Es de un pedido o encargo', ayuda: 'Ya tiene dueño: no aparece en el catálogo.' },
];

/** «2,5» o «2.5» → 2.5 */
function leer(texto: string): number {
  const limpio = texto.trim().replace(/\s/g, '');
  const n = Number(limpio.includes(',') ? limpio.replace(/\./g, '').replace(',', '.') : limpio);
  return Number.isFinite(n) ? n : NaN;
}

export default function RegistrarHechoScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const { producto } = useRoute<RouteProp<RootStackParamList, 'RegistrarHecho'>>().params;
  const { auth } = useAuth();
  const token = auth!.token;
  const { negocio } = useNegocio();
  const toast = useToast();
  const confirmar = useConfirmar();
  const [cantidad, setCantidad] = useState('1');
  const [nota, setNota] = useState('');
  const [destino, setDestino] = useState<DestinoProduccion>(producto.modo === 'pedido' ? 'pedido' : 'catalogo');
  const [enviando, setEnviando] = useState(false);

  const n = leer(cantidad);
  const valida = n > 0 && n <= 100000;
  const gasto = useMemo(() => producto.materiales.map(m => {
    const total = Math.round(m.por_unidad * (valida ? n : 0) * 1000) / 1000;
    return { ...m, total, corto: total > m.hay + 0.0005 };
  }), [producto.materiales, n, valida]);
  const falta = gasto.some(g => g.corto);

  function cambiar(delta: number) {
    const actual = valida ? n : 0;
    setCantidad(numero(Math.max(1, Math.round(actual + delta))));
  }

  async function enviar(aunqueFalte = false) {
    if (!negocio || !valida) return;
    setEnviando(true);
    try {
      const r = await registrarHecho(token, negocio.id, producto.id, { cantidad: String(n), nota: nota.trim(), destino, aunqueFalte });
      toast.exito('¡Registrado!', r.message);
      navigation.goBack();
    } catch (e) {
      const faltantes: { nombre: string; falta: string }[] | undefined = e instanceof ApiError && e.status === 422 ? e.data?.faltantes : undefined;
      if (faltantes?.length && !aunqueFalte) {
        confirmar({
          icono: 'alerta',
          titulo: 'No alcanza el material',
          texto: 'Puedes registrarlo de todas formas: se descuenta lo que haya y queda anotado lo que faltó.',
          puntos: faltantes.map(f => ({ icono: 'caja', texto: `Faltan ${f.falta} de «${f.nombre}»` })),
          textoBoton: 'Descontar lo que haya',
          accion: () => enviar(true),
        });
      } else {
        toast.error('No se pudo registrar', messageFromError(e));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <ScrollTeclado style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.titulo}>{producto.nombre}</Text>

      <Text style={styles.etiqueta}>¿Cuántos se hicieron?</Text>
      <View style={styles.contador}>
        <PressableScale style={styles.botonRedondo} onPress={() => cambiar(-1)} accessibilityRole="button" accessibilityLabel="Uno menos" hitSlop={6}>
          <Icon name="menos" size={20} color={c.textStrong} />
        </PressableScale>
        <TextInput
          style={styles.cantidad}
          value={cantidad}
          onChangeText={setCantidad}
          keyboardType="decimal-pad"
          selectTextOnFocus
          accessibilityLabel="Cantidad hecha"
        />
        <PressableScale style={styles.botonRedondo} onPress={() => cambiar(1)} accessibilityRole="button" accessibilityLabel="Uno más" hitSlop={6}>
          <Icon name="mas" size={20} color={c.textStrong} />
        </PressableScale>
      </View>

      <Text style={styles.etiqueta}>Se descuenta del inventario</Text>
      <View style={styles.caja}>
        {gasto.map(g => (
          <View key={g.id} style={styles.material}>
            <View style={styles.materialNombre}>
              <Text style={[styles.materialTitulo, g.corto && styles.peligro]}>{g.nombre}</Text>
              {!!g.rasgos && <Text style={styles.materialRasgos}>{g.rasgos}</Text>}
            </View>
            <View style={styles.materialCifras}>
              <Text style={[styles.materialGasto, g.corto && styles.peligro]}>
                {numero(g.total)} {Math.abs(g.total - 1) < 0.0005 ? g.unidad_uno : g.unidad_varios}
              </Text>
              <Text style={[styles.materialHay, g.corto && styles.peligro]}>hay {numero(g.hay)}</Text>
            </View>
          </View>
        ))}
        {falta && (
          <View style={styles.avisoFalta}>
            <Icon name="alerta" size={15} color={c.danger} />
            <Text style={styles.avisoFaltaTxt}>No alcanza lo que hay en rojo. Puedes registrarlo igual y se descuenta lo que haya.</Text>
          </View>
        )}
      </View>

      <Text style={styles.etiqueta}>¿Qué pasa con lo que se hizo?</Text>
      {DESTINOS.map(d => {
        const activo = destino === d.valor;
        return (
          <PressableScale
            key={d.valor}
            style={[styles.destino, activo && styles.destinoActivo]}
            onPress={() => setDestino(d.valor)}
            accessibilityRole="radio"
            accessibilityState={{ selected: activo }}>
            {/* El fondo siempre está montado y cambia su opacidad: en Android
                un fondo agregado después sale sin esquinas. */}
            <View style={[styles.destinoFondo, activo ? styles.visible : styles.oculto]} />
            <View style={styles.radio}>
              <View style={[styles.radioPunto, activo ? styles.visible : styles.oculto]} />
            </View>
            <View style={styles.destinoTexto}>
              <Text style={[styles.destinoTitulo, activo && styles.destinoTituloActivo]}>{d.titulo}</Text>
              <Text style={styles.destinoAyuda}>{d.ayuda}</Text>
            </View>
          </PressableScale>
        );
      })}

      <Text style={styles.etiqueta}>Nota (opcional)</Text>
      <TextInput
        style={styles.nota}
        value={nota}
        onChangeText={setNota}
        maxLength={255}
        placeholder="Para el señor Pérez, pedido de la semana…"
        placeholderTextColor={c.muted}
        accessibilityLabel="Nota"
      />

      <PressableScale
        style={[styles.boton, (!valida || enviando) && styles.botonApagado]}
        disabled={!valida || enviando}
        onPress={() => enviar()}
        accessibilityRole="button">
        {enviando ? <ActivityIndicator color={c.onBrand} /> : <Text style={styles.botonTxt}>Registrar como hecho</Text>}
      </PressableScale>
    </ScrollTeclado>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 40 },
  titulo: { fontFamily: font.display, fontSize: 22, color: c.textStrong, marginBottom: 6 },
  etiqueta: { fontFamily: font.semibold, fontSize: 14, color: c.textStrong, marginTop: 18, marginBottom: 8 },
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
  material: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  materialNombre: { flex: 1 },
  materialTitulo: { fontFamily: font.semibold, fontSize: 14, color: c.textStrong },
  materialRasgos: { fontFamily: font.regular, fontSize: 12, color: c.muted, marginTop: 1 },
  materialCifras: { alignItems: 'flex-end' },
  materialGasto: { fontFamily: font.bold, fontSize: 14, color: c.textStrong },
  materialHay: { fontFamily: font.regular, fontSize: 12, color: c.muted },
  peligro: { color: c.danger },
  avisoFalta: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 10 },
  avisoFaltaTxt: { flex: 1, fontFamily: font.medium, fontSize: 13, color: c.danger, lineHeight: 18 },
  destino: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, marginBottom: 8,
    borderRadius: radius.md, borderWidth: 1.5, borderColor: c.borderStrong, backgroundColor: c.surface, overflow: 'hidden',
  },
  destinoActivo: { borderColor: c.accent },
  destinoFondo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.accentSoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioPunto: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
  visible: { opacity: 1 },
  oculto: { opacity: 0 },
  destinoTexto: { flex: 1 },
  destinoTitulo: { fontFamily: font.bold, fontSize: 14, color: c.textStrong },
  destinoTituloActivo: { color: c.goldText },
  destinoAyuda: { fontFamily: font.regular, fontSize: 12, color: c.muted, marginTop: 2, lineHeight: 17 },
  nota: {
    height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface,
    paddingHorizontal: 14, fontFamily: font.regular, fontSize: 15, color: c.textStrong,
  },
  boton: { marginTop: 22, height: 52, borderRadius: radius.md, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' },
  botonApagado: { opacity: 0.5 },
  botonTxt: { fontFamily: font.bold, fontSize: 16, color: c.onBrand },
}));
