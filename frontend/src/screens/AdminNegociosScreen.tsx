import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import { AdminNegocio, getAdminNegocios } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView } from '../components/anim';
import Icon from '../components/Icon';
import { font, makeStyles, radius, useTheme } from '../theme';

export default function AdminNegociosScreen() {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const [negocios, setNegocios] = useState<AdminNegocio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Búsqueda por nombre y paginación (30 por página).
  const [buscar, setBuscar] = useState('');
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const consulta = useRef(0);

  const cargar = useCallback(
    (texto: string, refresco = false) => {
      const id = ++consulta.current;
      refresco ? setRefrescando(true) : setCargando(true);
      getAdminNegocios(auth!.token, texto, 1)
        .then(p => {
          if (id !== consulta.current) return;
          setNegocios(p.items);
          setPagina(1);
          setHayMas(p.pagina < p.ultima_pagina);
          setError(null);
        })
        .catch(e => setError(e.message))
        .finally(() => {
          if (id !== consulta.current) return;
          setCargando(false);
          setRefrescando(false);
        });
    },
    [auth],
  );

  // Busca 350 ms después de dejar de escribir.
  useEffect(() => {
    const t = setTimeout(() => cargar(buscar), buscar ? 350 : 0);
    return () => clearTimeout(t);
  }, [buscar, cargar]);

  async function cargarMas() {
    if (!hayMas || cargandoMas || cargando) return;
    setCargandoMas(true);
    try {
      const p = await getAdminNegocios(auth!.token, buscar, pagina + 1);
      setNegocios(prev => [...prev, ...p.items.filter(n => !prev.some(m => m.id === n.id))]);
      setPagina(p.pagina);
      setHayMas(p.pagina < p.ultima_pagina);
    } catch {
      // Se reintenta al volver a llegar al final.
    } finally {
      setCargandoMas(false);
    }
  }

  if (error) {
    return <Text style={styles.error}>{error}</Text>;
  }

  return (
    <FlatList
      style={styles.container}
      data={cargando ? [] : negocios}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={() => cargar(buscar, true)} colors={[c.accent]} tintColor={c.accent} />
      }
      keyExtractor={n => String(n.id)}
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <>
          <Text style={styles.titulo}>Negocios</Text>
          <View style={styles.buscador}>
            <Icon name="lupa" size={18} color={c.muted} />
            <TextInput
              style={styles.buscadorInput}
              value={buscar}
              onChangeText={setBuscar}
              placeholder="Buscar por nombre"
              placeholderTextColor={c.mutedSoft}
            />
          </View>
        </>
      }
      ListEmptyComponent={
        cargando ? (
          <ActivityIndicator size="large" color={c.accent} style={{ marginTop: 40 }} />
        ) : (
          <Text style={styles.vacio}>No hay negocios con ese nombre.</Text>
        )
      }
      onEndReached={cargarMas}
      onEndReachedThreshold={0.4}
      ListFooterComponent={cargandoMas ? <ActivityIndicator color={c.accent} style={{ marginVertical: 16 }} /> : null}
      renderItem={({ item, index }) => (
        <FadeInView delay={Math.min(index, 8) * 40}>
          <View style={styles.card}>
            <View style={styles.texto}>
              <Text style={styles.nombre}>{item.nombre}</Text>
              <Text style={styles.sub}>
                Dueño: {item.dueno ?? '—'} · {item.productos} producto(s)
              </Text>
            </View>
            {item.archivado ? (
              <Text style={[styles.badge, styles.cerrado]}>Archivado</Text>
            ) : item.vetado ? (
              <Text style={[styles.badge, styles.vetado]}>Vetado</Text>
            ) : (
              <Text style={[styles.badge, item.activo ? styles.abierto : styles.cerrado]}>
                {item.activo ? 'Abierto' : 'Cerrado'}
              </Text>
            )}
          </View>
        </FadeInView>
      )}
    />
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  titulo: { fontSize: 22, fontFamily: font.display, color: c.textStrong, marginBottom: 12 },
  buscador: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface,
    borderRadius: radius.md, paddingHorizontal: 12, marginBottom: 12, ...shadow.low,
  },
  buscadorInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: c.textStrong, fontFamily: font.regular },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low,
  },
  texto: { flex: 1, marginRight: 10 },
  nombre: { fontSize: 15, fontFamily: font.semibold, color: c.textStrong },
  sub: { color: c.muted, fontSize: 13, marginTop: 2, fontFamily: font.regular },
  badge: { fontSize: 11, fontFamily: font.bold, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  abierto: { backgroundColor: c.successSoft, color: c.success },
  cerrado: { backgroundColor: c.surface2, color: c.muted },
  vetado: { backgroundColor: c.dangerSoft, color: c.danger },
  vacio: { textAlign: 'center', color: c.muted, marginTop: 30, fontFamily: font.regular },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
}));
