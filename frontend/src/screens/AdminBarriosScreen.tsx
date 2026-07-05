import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { aprobarBarrio, BarrioPendiente, getBarriosPendientes, rechazarBarrio } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView } from '../components/anim';
import { RootStackParamList } from '../navTypes';
import { c, font, radius, shadow } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminBarrios'>;

/**
 * Barrios escritos a mano por clientes (no estaban en la lista oficial).
 * Aprobar → el barrio entra a la lista pública del selector.
 * Rechazar → se descarta la sugerencia (el cliente conserva su texto).
 */
export default function AdminBarriosScreen(_props: Props) {
  const { auth } = useAuth();
  const toast = useToast();
  const [barrios, setBarrios] = useState<BarrioPendiente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<number | null>(null);

  useEffect(() => {
    getBarriosPendientes(auth!.token)
      .then(setBarrios)
      .catch(e => setError(e.message));
  }, [auth]);

  async function resolver(barrio: BarrioPendiente, aprobar: boolean) {
    setProcesando(barrio.id);
    try {
      if (aprobar) {
        await aprobarBarrio(auth!.token, barrio.id);
        toast.exito('Barrio aprobado', `«${barrio.nombre}» ahora aparece en la lista.`);
      } else {
        await rechazarBarrio(auth!.token, barrio.id);
        toast.info('Barrio rechazado', `Se descartó «${barrio.nombre}».`);
      }
      setBarrios(prev => prev?.filter(b => b.id !== barrio.id) ?? null);
    } catch (e: any) {
      toast.error('No se pudo completar la acción', e.message);
    } finally {
      setProcesando(null);
    }
  }

  return (
    <View style={styles.container}>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : barrios === null ? (
        <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={barrios}
          keyExtractor={b => String(b.id)}
          contentContainerStyle={{ padding: 16 }}
          ListHeaderComponent={
            <Text style={styles.ayuda}>
              Barrios que los clientes escribieron a mano porque no estaban en la lista.
              Al aprobarlos aparecen en el selector para todos.
            </Text>
          }
          ListEmptyComponent={
            <Text style={styles.vacio}>No hay barrios pendientes por revisar.</Text>
          }
          renderItem={({ item }) => (
            <FadeInView style={styles.tarjeta}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre}>{item.nombre}</Text>
                <Text style={styles.detalle}>
                  Sugerido por {item.sugerido_por ?? 'un cliente'}
                  {item.fecha ? ` · ${item.fecha}` : ''}
                </Text>
              </View>
              {procesando === item.id ? (
                <ActivityIndicator color={c.accent} />
              ) : (
                <View style={styles.acciones}>
                  <TouchableOpacity style={styles.btnAprobar} onPress={() => resolver(item, true)}>
                    <Text style={styles.btnAprobarTexto}>Aprobar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnRechazar} onPress={() => resolver(item, false)}>
                    <Text style={styles.btnRechazarTexto}>Rechazar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </FadeInView>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 13, marginBottom: 14 },
  vacio: { textAlign: 'center', color: c.muted, fontFamily: font.medium, marginTop: 40 },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 10,
    ...shadow.low,
  },
  nombre: { fontSize: 15, fontFamily: font.bold, color: c.textStrong },
  detalle: { fontSize: 12, fontFamily: font.regular, color: c.muted, marginTop: 2 },
  acciones: { flexDirection: 'row', gap: 8 },
  btnAprobar: {
    backgroundColor: c.brand,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnAprobarTexto: { color: c.onBrand, fontFamily: font.semibold, fontSize: 13 },
  btnRechazar: {
    backgroundColor: c.dangerSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnRechazarTexto: { color: c.danger, fontFamily: font.semibold, fontSize: 13 },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
});
