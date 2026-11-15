/**
 * Ingredientes de un producto de comida, cada uno con «Sin / Normal / Extra».
 * Se usa en la ficha del producto (antes de agregarlo al carrito) y en la hoja
 * para ajustar una línea que ya está en el carrito.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { font, makeStyles, radius } from '../theme';

type Estado = 'sin' | 'normal' | 'extra';

const ESTADOS: { valor: Estado; texto: string }[] = [
  { valor: 'sin', texto: 'Sin' },
  { valor: 'normal', texto: 'Normal' },
  { valor: 'extra', texto: 'Extra' },
];

type Props = {
  ingredientes: string[];
  sin: string[];
  extra: string[];
  onChange: (sin: string[], extra: string[]) => void;
};

export default function AjusteIngredientes({ ingredientes, sin, extra, onChange }: Props) {
  const styles = useStyles();

  const estadoDe = (ingrediente: string): Estado =>
    sin.includes(ingrediente) ? 'sin' : extra.includes(ingrediente) ? 'extra' : 'normal';

  function marcar(ingrediente: string, estado: Estado) {
    const sinEste = (lista: string[]) => lista.filter(i => i !== ingrediente);
    onChange(
      estado === 'sin' ? [...sinEste(sin), ingrediente] : sinEste(sin),
      estado === 'extra' ? [...sinEste(extra), ingrediente] : sinEste(extra),
    );
  }

  return (
    <>
      {ingredientes.map(ingrediente => {
        const estado = estadoDe(ingrediente);
        return (
          <View key={ingrediente} style={styles.ingrediente}>
            <Text style={[styles.ingredienteTxt, estado === 'sin' && styles.ingredienteQuitado]} numberOfLines={2}>
              {ingrediente}
            </Text>
            <View style={styles.segmento} accessibilityRole="radiogroup" accessibilityLabel={ingrediente}>
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
  );
}

const useStyles = makeStyles((c, shadow) => ({
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
}));
