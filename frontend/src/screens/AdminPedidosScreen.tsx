import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useEnVivo } from '../usePolling';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { AdminPedido, cerrarPedidoAdmin, getAdminPedidos } from '../api';
import { useAuth } from '../AuthContext';
import { FadeInView } from '../components/anim';
import MotivoCancelacion from '../components/MotivoCancelacion';
import { RootStackParamList } from '../navTypes';
import { font, makeStyles, radius, useTheme } from '../theme';
import { useToast } from '../Toast';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminPedidos'>;
type Cierre = { pedido: AdminPedido; resultado: 'entregado' | 'cancelado' };

/** Desde que el domiciliario lo recoge, el pedido se puede dar por entregado. */
const YA_RECOGIDO = ['recogido', 'en_camino'];

function cop(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

function haceCuanto(minutos: number) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return horas < 24 ? `${horas} h` : `${Math.floor(horas / 24)} d`;
}

/**
 * Pedidos en curso de toda la plataforma, los más antiguos primero. Es la
 * salida para los que se atascan (cliente ausente, código perdido, domiciliario
 * suspendido): el admin los cierra a mano y deja escrito por qué.
 */
export default function AdminPedidosScreen(_props: Props) {
  const { c } = useTheme();
  const styles = useStyles();
  const { auth } = useAuth();
  const toast = useToast();
  const [pedidos, setPedidos] = useState<AdminPedido[] | null>(null);
  const [pagina, setPagina] = useState(1);
  const [ultima, setUltima] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [cierre, setCierre] = useState<Cierre | null>(null);
  const [cerrando, setCerrando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await getAdminPedidos(auth!.token, 1);
      setPedidos(r.items);
      setPagina(r.pagina);
      setUltima(r.ultima_pagina);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [auth]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  // En vivo: cada pedido que cambia de estado.
  useEnVivo(['pedidos'], () => {
    if (pagina === 1) cargar();
  });

  async function refrescar() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  async function cargarMas() {
    if (cargandoMas || pagina >= ultima) return;
    setCargandoMas(true);
    try {
      const r = await getAdminPedidos(auth!.token, pagina + 1);
      setPedidos(prev => [...(prev ?? []), ...r.items]);
      setPagina(r.pagina);
      setUltima(r.ultima_pagina);
    } catch (e: any) {
      toast.error('No se pudieron cargar más pedidos', e.message);
    } finally {
      setCargandoMas(false);
    }
  }

  async function confirmarCierre(motivo: string) {
    if (!cierre) return;
    if (!motivo) {
      toast.error('Falta el motivo', 'Elige o escribe por qué cierras el pedido.');
      return;
    }
    setCerrando(true);
    try {
      toast.exito('Pedido cerrado', await cerrarPedidoAdmin(auth!.token, cierre.pedido.id, cierre.resultado, motivo));
      setPedidos(prev => prev?.filter(p => p.id !== cierre.pedido.id) ?? null);
      setCierre(null);
    } catch (e: any) {
      toast.error('No se pudo cerrar el pedido', e.message);
      // Pudo terminar por su cuenta mientras tanto: la lista se pone al día.
      setCierre(null);
      cargar();
    } finally {
      setCerrando(false);
    }
  }

  const entregar = cierre?.resultado === 'entregado';

  return (
    <View style={styles.container}>
      {error && pedidos === null ? (
        <Text style={styles.error}>{error}</Text>
      ) : pedidos === null ? (
        <ActivityIndicator size="large" color={c.accent} style={styles.cargando} />
      ) : (
        <FlatList
          data={pedidos}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={c.accent} />}
          onEndReached={cargarMas}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <Text style={styles.ayuda}>
              Pedidos que siguen en curso, del más antiguo al más reciente. Si uno se atascó, llama a las partes y
              ciérralo aquí: queda guardado quién lo cerró y por qué.
            </Text>
          }
          ListEmptyComponent={<Text style={styles.vacio}>No hay pedidos en curso.</Text>}
          ListFooterComponent={cargandoMas ? <ActivityIndicator color={c.accent} style={styles.mas} /> : null}
          renderItem={({ item }) => (
            <FadeInView style={styles.tarjeta}>
              <View style={styles.cabecera}>
                <Text style={styles.codigo}>#{item.codigo}</Text>
                <Text style={styles.estado}>{item.estado_label}</Text>
              </View>
              <Text style={styles.detalle}>
                {item.negocio ?? 'Negocio'} · {cop(item.total)} · {item.metodo_pago}
              </Text>
              <Text style={styles.detalle}>Pedido el {item.fecha} · sin cambios hace {haceCuanto(item.minutos_sin_cambios)}</Text>
              <Text style={styles.dato}>
                Cliente: {item.cliente ?? 'sin nombre'}
                {item.telefono_contacto ? ` · ${item.telefono_contacto}` : ''}
              </Text>
              <Text style={styles.dato}>Entrega: {item.direccion_entrega}</Text>
              {!!item.negocio_telefono && <Text style={styles.dato}>Negocio: {item.negocio_telefono}</Text>}
              {!!item.domiciliario && (
                <Text style={styles.dato}>
                  Domiciliario: {item.domiciliario}
                  {item.domiciliario_telefono ? ` · ${item.domiciliario_telefono}` : ''}
                </Text>
              )}
              {item.domiciliario_suspendido && <Text style={styles.alerta}>El domiciliario está suspendido.</Text>}
              {!!item.novedad && <Text style={styles.detalle}>Novedad: {item.novedad}</Text>}

              <View style={styles.acciones}>
                {YA_RECOGIDO.includes(item.estado) && (
                  <TouchableOpacity
                    style={styles.btnEntregar}
                    onPress={() => setCierre({ pedido: item, resultado: 'entregado' })}>
                    <Text style={styles.btnEntregarTexto}>Dar por entregado</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.btnCancelar}
                  onPress={() => setCierre({ pedido: item, resultado: 'cancelado' })}>
                  <Text style={styles.btnCancelarTexto}>
                    {item.estado === 'devolviendo' ? 'Cerrar devolución' : 'Cancelar pedido'}
                  </Text>
                </TouchableOpacity>
                {item.estado === 'devolviendo' && (
                  <Text style={styles.alerta}>
                    Lo normal es que el comercio confirme la devolución. Ciérrala aquí solo si no responde.
                  </Text>
                )}
              </View>
            </FadeInView>
          )}
        />
      )}

      <MotivoCancelacion
        visible={cierre !== null}
        obligatorio
        titulo={entregar ? 'Dar por entregado' : 'Cancelar pedido'}
        explicacion={
          entregar
            ? `El pedido #${cierre?.pedido.codigo ?? ''} quedará como entregado sin el código del cliente. Hazlo solo si confirmaste la entrega.`
            : `El pedido #${cierre?.pedido.codigo ?? ''} se cancela y se avisa al cliente y al negocio con este motivo.`
        }
        motivos={
          entregar
            ? ['El cliente confirmó por teléfono', 'El cliente perdió el código', 'El domiciliario no pudo cerrarlo']
            : cierre?.pedido.estado === 'devolviendo'
            ? ['El comercio no responde', 'El comercio confirmó por teléfono que lo recibió', 'El domiciliario no devolvió el pedido']
            : ['El cliente no apareció', 'El negocio dejó de responder', 'No hubo domiciliario', 'Dirección incorrecta']
        }
        textoBoton={entregar ? 'Dar por entregado' : 'Cancelar pedido'}
        enviando={cerrando}
        onCerrar={() => setCierre(null)}
        onConfirmar={confirmarCierre}
      />
    </View>
  );
}

const useStyles = makeStyles((c, shadow) => ({
  container: { flex: 1, backgroundColor: c.bg },
  lista: { padding: 16 },
  cargando: { marginTop: 40 },
  mas: { marginVertical: 16 },
  ayuda: { color: c.muted, fontFamily: font.regular, fontSize: 13, marginBottom: 14 },
  vacio: { textAlign: 'center', color: c.muted, fontFamily: font.medium, marginTop: 40 },
  tarjeta: { backgroundColor: c.surface, borderRadius: radius.md, padding: 14, marginBottom: 10, ...shadow.low },
  cabecera: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  codigo: { fontSize: 15, fontFamily: font.bold, color: c.textStrong },
  estado: { fontSize: 13, fontFamily: font.semibold, color: c.accent },
  detalle: { fontSize: 12, fontFamily: font.regular, color: c.muted, marginTop: 2 },
  dato: { fontSize: 13, fontFamily: font.regular, color: c.text, marginTop: 4 },
  alerta: { fontSize: 13, fontFamily: font.semibold, color: c.danger, marginTop: 6 },
  acciones: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  btnEntregar: { backgroundColor: c.brand, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  btnEntregarTexto: { color: c.onBrand, fontFamily: font.semibold, fontSize: 13 },
  btnCancelar: { backgroundColor: c.dangerSoft, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  btnCancelarTexto: { color: c.danger, fontFamily: font.semibold, fontSize: 13 },
  error: { color: c.danger, backgroundColor: c.dangerSoft, padding: 12, borderRadius: radius.sm, margin: 16, fontFamily: font.medium },
}));
