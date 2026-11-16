/**
 * Personalización de un plato, en dos partes:
 *  - Ingredientes: los que trae. Cada uno que el negocio deja quitar va con
 *    «Sin / Con»; los fijos (la carne de la hamburguesa) solo se listan.
 *  - Extras: lo que se pide aparte, con − cantidad + y lo que suma cada porción.
 * Se usa en la ficha del producto (antes de agregarlo al carrito) y en la hoja
 * para ajustar una línea que ya está en el carrito.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ExtraProducto } from '../api';
import { ExtraElegido, MAX_PORCIONES_EXTRA, precioExtra } from '../opcionesProducto';
import { font, makeStyles, radius, useTheme } from '../theme';
import { PressableScale } from './anim';
import Icon from './Icon';

type Props = {
  ingredientes: string[];
  fijos?: string[];
  extrasDisponibles?: ExtraProducto[];
  sin: string[];
  extras: ExtraElegido[];
  onChange: (sin: string[], extras: ExtraElegido[]) => void;
};

export default function PersonalizarComida({ ingredientes, fijos = [], extrasDisponibles = [], sin, extras, onChange }: Props) {
  const { c } = useTheme();
  const styles = useStyles();

  const porciones = (nombre: string) => extras.find(e => e.nombre === nombre)?.cantidad ?? 0;

  function quitar(ingrediente: string, quitado: boolean) {
    const resto = sin.filter(i => i !== ingrediente);
    onChange(quitado ? [...resto, ingrediente] : resto, extras);
  }

  function cambiarExtra(nombre: string, delta: number) {
    // En el orden del negocio, y solo los que llevan al menos una porción.
    const nuevos = extrasDisponibles
      .map(e => ({
        nombre: e.nombre,
        precio: e.precio,
        cantidad: e.nombre === nombre
          ? Math.max(0, Math.min(MAX_PORCIONES_EXTRA, porciones(nombre) + delta))
          : porciones(e.nombre),
      }))
      .filter(e => e.cantidad > 0);
    onChange(sin, nuevos);
  }

  return (
    <>
      {ingredientes.length > 0 && (
        <View style={styles.grupo}>
          <Text style={styles.grupoTitulo}>Ingredientes</Text>
          {ingredientes.map(ingrediente => {
            const fijo = fijos.includes(ingrediente);
            const quitado = !fijo && sin.includes(ingrediente);
            return (
              <View key={ingrediente} style={styles.fila}>
                <Text style={[styles.nombre, quitado && styles.nombreQuitado]} numberOfLines={2}>
                  {ingrediente}
                </Text>
                {fijo ? (
                  <Text style={styles.incluido}>Incluido</Text>
                ) : (
                  <View style={styles.segmento} accessibilityRole="radiogroup" accessibilityLabel={ingrediente}>
                    {[
                      { valor: true, texto: 'Sin' },
                      { valor: false, texto: 'Con' },
                    ].map(({ valor, texto }) => {
                      const activo = quitado === valor;
                      return (
                        <Pressable
                          key={texto}
                          style={[styles.opcion, activo && styles.opcionOn, activo && valor && styles.opcionSin]}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: activo }}
                          accessibilityLabel={`${ingrediente}: ${texto}`}
                          onPress={() => quitar(ingrediente, valor)}>
                          <Text style={[styles.opcionTxt, activo && styles.opcionTxtOn, activo && valor && styles.opcionTxtSin]}>
                            {texto}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {extrasDisponibles.length > 0 && (
        <View style={styles.grupo}>
          <Text style={styles.grupoTitulo}>Extras</Text>
          {extrasDisponibles.map(extra => {
            const n = porciones(extra.nombre);
            return (
              <View key={extra.nombre} style={styles.fila}>
                <View style={styles.extraTexto}>
                  <Text style={[styles.nombre, n > 0 && styles.nombreElegido]} numberOfLines={2}>{extra.nombre}</Text>
                  <Text style={styles.extraPrecio}>{precioExtra(extra.precio)}</Text>
                </View>
                <View style={styles.contador}>
                  <PressableScale
                    style={[styles.contadorBtn, n === 0 && styles.contadorBtnOff]}
                    disabled={n === 0}
                    hitSlop={6}
                    accessibilityLabel={`Quitar una porción de ${extra.nombre}`}
                    onPress={() => cambiarExtra(extra.nombre, -1)}>
                    <Icon name="menos" size={14} color={c.textStrong} strokeWidth={2.2} />
                  </PressableScale>
                  <Text style={[styles.contadorTxt, n > 0 && styles.contadorTxtOn]} accessibilityLabel={`${n} de ${extra.nombre}`}>
                    {n}
                  </Text>
                  <PressableScale
                    style={[styles.contadorBtn, n >= MAX_PORCIONES_EXTRA && styles.contadorBtnOff]}
                    disabled={n >= MAX_PORCIONES_EXTRA}
                    hitSlop={6}
                    accessibilityLabel={`Agregar una porción de ${extra.nombre}`}
                    onPress={() => cambiarExtra(extra.nombre, 1)}>
                    <Icon name="mas" size={14} color={c.textStrong} strokeWidth={2.2} />
                  </PressableScale>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  grupo: { marginTop: 6, marginBottom: 6 },
  grupoTitulo: {
    color: c.muted,
    fontFamily: font.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 2,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  nombre: { flex: 1, color: c.text, fontFamily: font.medium, fontSize: 15 },
  nombreQuitado: { color: c.mutedSoft, textDecorationLine: 'line-through' },
  nombreElegido: { color: c.textStrong, fontFamily: font.semibold },
  incluido: { color: c.mutedSoft, fontFamily: font.medium, fontSize: 12, paddingHorizontal: 6 },
  segmento: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: c.surface2 },
  opcion: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill },
  opcionOn: { backgroundColor: c.surface, ...shadow.low },
  opcionSin: { backgroundColor: c.dangerSoft },
  opcionTxt: { color: c.muted, fontFamily: font.medium, fontSize: 12 },
  opcionTxtOn: { color: c.textStrong, fontFamily: font.semibold },
  opcionTxtSin: { color: c.danger },
  extraTexto: { flex: 1, gap: 1 },
  extraPrecio: { color: c.goldText, fontFamily: font.semibold, fontSize: 12 },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contadorBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface2,
  },
  contadorBtnOff: { opacity: 0.4 },
  contadorTxt: { minWidth: 22, textAlign: 'center', color: c.muted, fontFamily: font.bold, fontSize: 15 },
  contadorTxtOn: { color: c.textStrong },
}));
