/**
 * Hoja para ajustar una línea del carrito. En la comida, cada ingrediente que
 * trae el producto se deja normal, se quita o se pide con extra; en la ropa se
 * cambia la talla o el color. Si la línea tiene varias unidades se puede aplicar
 * solo a algunas: "de las 3 hamburguesas, 1 sin tomate". También pregunta cómo
 * quiere el cliente una unidad más, partiendo de lo que ya tiene la línea.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartItem } from '../CartContext';
import { OpcionesLinea } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import ChipsEleccion from './ChipsEleccion';
import Icon from './Icon';

type Estado = 'sin' | 'normal' | 'extra';

const ESTADOS: { valor: Estado; texto: string }[] = [
  { valor: 'sin', texto: 'Sin' },
  { valor: 'normal', texto: 'Normal' },
  { valor: 'extra', texto: 'Extra' },
];

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
  const tallas = item.tallas ?? [];
  const colores = item.colores ?? [];

  const [sin, setSin] = useState(item.opciones?.sin ?? []);
  const [extra, setExtra] = useState(item.opciones?.extra ?? []);
  const [talla, setTalla] = useState(item.opciones?.talla);
  const [color, setColor] = useState(item.opciones?.color);
  const [unidades, setUnidades] = useState(item.cantidad);

  // Si la cantidad baja a mano con la hoja abierta no puede quedar por encima.
  useEffect(() => setUnidades(n => Math.min(n, item.cantidad)), [item.cantidad]);

  const estadoDe = (ingrediente: string): Estado =>
    sin.includes(ingrediente) ? 'sin' : extra.includes(ingrediente) ? 'extra' : 'normal';

  function marcar(ingrediente: string, estado: Estado) {
    const sinEste = (lista: string[]) => lista.filter(i => i !== ingrediente);
    setSin(estado === 'sin' ? [...sinEste(sin), ingrediente] : sinEste(sin));
    setExtra(estado === 'extra' ? [...sinEste(extra), ingrediente] : sinEste(extra));
  }

  function guardar() {
    onGuardar(item.linea, { talla, color, sin, extra }, unidades);
  }

  return (
    <View style={styles.fondo}>
      <Pressable style={styles.afuera} accessibilityLabel="Cerrar" onPress={onCerrar} />
      <View style={[styles.hoja, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.agarre} />
        <Text style={styles.titulo} numberOfLines={2}>{item.nombre}</Text>
        {agregando && <Text style={styles.ayuda}>Agregas una unidad más: elige cómo la quieres.</Text>}

        <ScrollView style={styles.lista} showsVerticalScrollIndicator={false}>
          {ingredientes.length > 0 && (
            <>
              <Text style={styles.ayuda}>Quita lo que no quieras o pide más de lo que trae.</Text>
              {ingredientes.map(ingrediente => {
                const estado = estadoDe(ingrediente);
                return (
                  <View key={ingrediente} style={styles.ingrediente}>
                    <Text
                      style={[styles.ingredienteTxt, estado === 'sin' && styles.ingredienteQuitado]}
                      numberOfLines={2}>
                      {ingrediente}
                    </Text>
                    <View style={styles.segmento}>
                      {ESTADOS.map(({ valor, texto }) => {
                        const activo = estado === valor;
                        return (
                          <Pressable
                            key={valor}
                            style={[
                              styles.opcion,
                              activo && styles.opcionOn,
                              activo && valor === 'sin' && styles.opcionSin,
                              activo && valor === 'extra' && styles.opcionExtra,
                            ]}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: activo }}
                            accessibilityLabel={`${ingrediente}: ${texto}`}
                            onPress={() => marcar(ingrediente, valor)}>
                            <Text
                              style={[
                                styles.opcionTxt,
                                activo && styles.opcionTxtOn,
                                activo && valor === 'sin' && styles.opcionTxtSin,
                                activo && valor === 'extra' && styles.opcionTxtExtra,
                              ]}>
                              {texto}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {tallas.length > 0 && (
            <ChipsEleccion titulo="Talla" opciones={tallas} valor={talla} onChange={setTalla} />
          )}
          {colores.length > 0 && (
            <ChipsEleccion titulo="Color" opciones={colores} valor={color} onChange={setColor} conMuestra />
          )}
        </ScrollView>

        {!agregando && item.cantidad > 1 && (
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
          <Text style={styles.botonTxt}>{agregando ? 'Agregar' : 'Guardar'}</Text>
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
  ingrediente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  ingredienteTxt: { flex: 1, color: c.text, fontFamily: font.medium, fontSize: 15 },
  ingredienteQuitado: { color: c.mutedSoft, textDecorationLine: 'line-through' },
  segmento: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: c.surface2,
  },
  opcion: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.pill },
  opcionOn: { backgroundColor: c.surface, ...shadow.low },
  opcionSin: { backgroundColor: c.dangerSoft },
  opcionExtra: { backgroundColor: c.accentSoft },
  opcionTxt: { color: c.muted, fontFamily: font.medium, fontSize: 12 },
  opcionTxtOn: { color: c.textStrong, fontFamily: font.semibold },
  opcionTxtSin: { color: c.danger },
  opcionTxtExtra: { color: c.goldText },
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
