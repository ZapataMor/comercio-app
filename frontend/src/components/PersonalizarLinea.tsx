import { esPorPeso } from '../cantidades';
/**
 * Hoja para ajustar una línea del carrito. En la comida se quitan ingredientes
 * (los que se pueden quitar) y se piden extras con su precio; en la ropa se
 * cambia la talla o el color. Si la línea tiene varias unidades se puede aplicar
 * solo a algunas: "de las 3 hamburguesas, 1 sin tomate". También pregunta cómo
 * quiere el cliente una unidad más, partiendo de lo que ya tiene la línea.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartItem } from '../CartContext';
import { cop, costoExtras, OpcionesLinea } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import ChipsEleccion from './ChipsEleccion';
import Icon from './Icon';
import PersonalizarComida from './PersonalizarComida';

/** `ajustar` cambia las unidades que ya están; `agregar` es para una unidad más. */
export type ModoHoja = 'ajustar' | 'agregar';

type Props = {
  /** La línea a ajustar; null = hoja cerrada. */
  item: CartItem | null;
  modo?: ModoHoja;
  onCerrar: () => void;
  onGuardar: (linea: string, opciones: OpcionesLinea, unidades: number) => void;
};

export default function PersonalizarLinea({ item, modo = 'ajustar', onCerrar, onGuardar }: Props) {
  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onCerrar}>
      {item && <Contenido key={item.linea} item={item} modo={modo} onCerrar={onCerrar} onGuardar={onGuardar} />}
    </Modal>
  );
}

function Contenido({ item, modo, onCerrar, onGuardar }: { item: CartItem } & Omit<Props, 'item'>) {
  const { c } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const agregando = modo === 'agregar';
  const ingredientes = item.ingredientes ?? [];
  const extrasDisponibles = item.extrasDisponibles ?? [];
  const tallas = item.tallas ?? [];
  const colores = item.colores ?? [];

  const [sin, setSin] = useState(item.opciones?.sin ?? []);
  const [extras, setExtras] = useState(item.opciones?.extras ?? []);
  const [talla, setTalla] = useState(item.opciones?.talla);
  const [color, setColor] = useState(item.opciones?.color);
  const [unidades, setUnidades] = useState(item.cantidad);

  // Si la cantidad baja a mano con la hoja abierta no puede quedar por encima.
  useEffect(() => setUnidades(n => Math.min(n, item.cantidad)), [item.cantidad]);

  function guardar() {
    onGuardar(item.linea, { talla, color, sin, extras }, unidades);
  }

  return (
    <View style={styles.fondo}>
      <Pressable style={styles.afuera} accessibilityLabel="Cerrar" onPress={onCerrar} />
      <View style={[styles.hoja, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.agarre} />
        <Text style={styles.titulo} numberOfLines={2}>{item.nombre}</Text>
        {agregando && <Text style={styles.ayuda}>Agregas una unidad más: elige cómo la quieres.</Text>}

        <ScrollView style={styles.lista} showsVerticalScrollIndicator={false}>
          {(ingredientes.length > 0 || extrasDisponibles.length > 0) && (
            <PersonalizarComida
              ingredientes={ingredientes}
              fijos={item.ingredientesFijos}
              extrasDisponibles={extrasDisponibles}
              sin={sin}
              extras={extras}
              onChange={(nuevoSin, nuevosExtras) => {
                setSin(nuevoSin);
                setExtras(nuevosExtras);
              }}
            />
          )}

          {tallas.length > 0 && (
            <ChipsEleccion titulo="Talla" opciones={tallas} valor={talla} onChange={setTalla} />
          )}
          {colores.length > 0 && (
            <ChipsEleccion titulo="Color" opciones={colores} valor={color} onChange={setColor} conMuestra />
          )}
        </ScrollView>

        {!agregando && !esPorPeso(item) && item.cantidad > 1 && (
          <View style={styles.unidades}>
            <Text style={styles.unidadesTxt}>¿A cuántas se lo aplico?</Text>
            <View style={styles.contador}>
              <PressableScale
                style={[styles.contadorBtn, unidades === 1 && styles.contadorBtnOff]}
                disabled={unidades === 1}
                hitSlop={6}
                accessibilityLabel="Aplicar a una unidad menos"
                onPress={() => setUnidades(n => n - 1)}>
                <Icon name="menos" size={15} color={c.textStrong} strokeWidth={2.2} />
              </PressableScale>
              <Text style={styles.contadorTxt}>{unidades} de {item.cantidad}</Text>
              <PressableScale
                style={[styles.contadorBtn, unidades === item.cantidad && styles.contadorBtnOff]}
                disabled={unidades === item.cantidad}
                hitSlop={6}
                accessibilityLabel="Aplicar a una unidad más"
                onPress={() => setUnidades(n => n + 1)}>
                <Icon name="mas" size={15} color={c.textStrong} strokeWidth={2.2} />
              </PressableScale>
            </View>
          </View>
        )}

        <PressableScale style={styles.boton} onPress={guardar}>
          <Text style={styles.botonTxt}>
            {agregando ? 'Agregar' : 'Guardar'}
            {costoExtras({ extras }) > 0 ? ` · ${cop(item.precio + costoExtras({ extras }))} c/u` : ''}
          </Text>
        </PressableScale>
        <TouchableOpacity onPress={onCerrar}>
          <Text style={styles.cancelar}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  // Sin scrim: el fondo de la app queda visible tal cual detrás de la hoja,
  // igual que en el formulario de productos.
  fondo: { flex: 1, justifyContent: 'flex-end' },
  afuera: { flex: 1 },
  hoja: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    maxHeight: '86%',
    ...shadow.card,
  },
  agarre: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: c.borderStrong,
    marginTop: 12,
    marginBottom: 14,
  },
  titulo: { color: c.textStrong, fontFamily: font.display, fontSize: 19, lineHeight: 25, marginBottom: 4 },
  lista: { flexGrow: 0, marginBottom: 14 },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  unidades: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  unidadesTxt: { color: c.text, fontFamily: font.medium, fontSize: 14 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contadorBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  contadorBtnOff: { opacity: 0.4 },
  contadorTxt: { minWidth: 48, textAlign: 'center', color: c.textStrong, fontFamily: font.semibold, fontSize: 14 },
  boton: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', ...shadow.gold },
  botonTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 16 },
  cancelar: { textAlign: 'center', color: c.muted, fontFamily: font.semibold, marginTop: 14 },
}));
