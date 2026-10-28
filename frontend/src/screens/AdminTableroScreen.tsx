import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { actualizarTarifaDomicilio, AdminStats, getAdminStats, getTarifaDomicilio } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView, PressableScale } from '../components/anim';
import Icon from '../components/Icon';
import { messageFromError } from '../formErrors';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminTablero'>;

function Tarjeta({ valor, etiqueta, color }: { valor: number; etiqueta: string; color: string }) {
  const styles = useStyles();
  return (
    <View style={styles.tarjeta}>
      <Text style={[styles.valor, { color }]}>{valor}</Text>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
    </View>
  );
}

export default function AdminTableroScreen({ navigation }: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();
  // Tarifa de domicilio (igual para todos los pedidos nuevos).
  const [tarifa, setTarifa] = useState('');
  const [guardandoTarifa, setGuardandoTarifa] = useState(false);

  useEffect(() => {
    getAdminStats(auth!.token)
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setCargando(false));
    getTarifaDomicilio(auth!.token)
      .then(t => setTarifa(String(t)))
      .catch(() => {});
  }, [auth]);

  async function guardarTarifa() {
    const valor = Number(tarifa.replace(/\D/g, ''));
    if (!tarifa.trim() || Number.isNaN(valor)) {
      toast.error('Tarifa no válida', 'Escribe el valor en pesos, solo números.');
      return;
    }
    setGuardandoTarifa(true);
    try {
      const guardada = await actualizarTarifaDomicilio(auth!.token, valor);
      setTarifa(String(guardada));
      toast.exito('Tarifa actualizada', 'Aplica a los pedidos nuevos.');
    } catch (e) {
      toast.error('No se pudo guardar', messageFromError(e));
    } finally {
      setGuardandoTarifa(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.titulo}>Tablero</Text>

      {cargando ? (
        <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : stats ? (
        <FadeInView style={styles.grid}>
          <Tarjeta valor={stats.usuarios} etiqueta="Usuarios" color={c.goldText} />
          <Tarjeta valor={stats.negocios} etiqueta="Negocios" color={c.goldText} />
          <Tarjeta valor={stats.negocios_activos} etiqueta="Abiertos" color={c.success} />
          <Tarjeta valor={stats.productos} etiqueta="Productos" color={c.goldText} />
          <Tarjeta
            valor={stats.domiciliarios_vetados ?? 0}
            etiqueta="Domiciliarios vetados"
            color={stats.domiciliarios_vetados ? c.danger : c.muted}
          />
          <Tarjeta
            valor={stats.negocios_vetados ?? 0}
            etiqueta="Negocios vetados"
            color={stats.negocios_vetados ? c.danger : c.muted}
          />
        </FadeInView>
      ) : null}

      <FadeInView delay={20} style={styles.tarifaCaja}>
        <View style={styles.tarifaHead}>
          <Icon name="moto" size={22} color={c.accent} />
          <Text style={styles.itemTitulo}>Tarifa de domicilio</Text>
        </View>
        <Text style={styles.tarifaSub}>Se suma a cada pedido nuevo. Los pedidos ya hechos no cambian.</Text>
        <View style={styles.tarifaFila}>
          <Text style={styles.tarifaPeso}>$</Text>
          <TextInput
            style={styles.tarifaInput}
            value={tarifa}
            onChangeText={v => setTarifa(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            placeholder="4000"
            placeholderTextColor={c.mutedSoft}
            editable={!guardandoTarifa}
          />
          <PressableScale style={styles.tarifaBtn} onPress={guardarTarifa} disabled={guardandoTarifa}>
            {guardandoTarifa ? (
              <ActivityIndicator color={c.onAccent} />
            ) : (
              <Text style={styles.tarifaBtnTxt}>Guardar</Text>
            )}
          </PressableScale>
        </View>
      </FadeInView>

      <FadeInView delay={40}>
        <PressableScale style={styles.item} onPress={() => navigation.navigate('AdminReputacion')}>
          <Icon name="escudo" size={24} color={c.accent} style={styles.itemEmoji} />
          <Text style={styles.itemTitulo}>Confiabilidad</Text>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>

      <FadeInView delay={80}>
        <PressableScale style={styles.item} onPress={() => navigation.navigate('AdminUsuarios')}>
          <Icon name="usuarios" size={24} color={c.accent} style={styles.itemEmoji} />
          <Text style={styles.itemTitulo}>Usuarios y roles</Text>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>
      <FadeInView delay={140}>
        <PressableScale style={styles.item} onPress={() => navigation.navigate('AdminNegocios')}>
          <Icon name="tienda" size={24} color={c.accent} style={styles.itemEmoji} />
          <Text style={styles.itemTitulo}>Todos los negocios</Text>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>
      <FadeInView delay={200}>
        <PressableScale style={styles.item} onPress={() => navigation.navigate('AdminBarrios')}>
          <Icon name="ubicacion" size={24} color={c.accent} style={styles.itemEmoji} />
          <Text style={styles.itemTitulo}>Barrios sugeridos</Text>
          <Icon name="chevron" size={20} color={c.chevron} />
        </PressableScale>
      </FadeInView>
    </ScrollView>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  titulo: { fontSize: 22, fontFamily: font.display, color: c.textStrong, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 },
  tarjeta: {
    backgroundColor: c.surface, borderRadius: radius.lg, padding: 18, width: '47%', ...shadow.soft,
  },
  valor: { fontSize: 30, fontFamily: font.extra },
  etiqueta: { color: c.muted, marginTop: 4, fontFamily: font.medium },
  item: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface,
    borderRadius: radius.md, padding: 16, marginTop: 12, ...shadow.low,
  },
  itemEmoji: { marginRight: 12 },
  tarifaCaja: { backgroundColor: c.surface, borderRadius: radius.md, padding: 16, marginTop: 12, ...shadow.low },
  tarifaHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tarifaSub: { color: c.muted, fontSize: 13, fontFamily: font.regular, marginTop: 6 },
  tarifaFila: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  tarifaPeso: { fontFamily: font.bold, fontSize: 18, color: c.textStrong },
  tarifaInput: {
    flex: 1, borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.md, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 16, fontFamily: font.semibold, color: c.textStrong,
  },
  tarifaBtn: { backgroundColor: c.accent, borderRadius: radius.md, paddingVertical: 11, paddingHorizontal: 18 },
  tarifaBtnTxt: { color: c.onAccent, fontFamily: font.bold, fontSize: 15 },
  itemTitulo: { flex: 1, fontSize: 16, fontFamily: font.semibold, color: c.textStrong },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, marginTop: 16, fontFamily: font.medium },
}));
