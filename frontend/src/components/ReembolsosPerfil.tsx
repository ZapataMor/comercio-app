import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { getReembolsos, SolicitudReembolso } from '../api';
import { useAuth } from '../AuthContext';
import { useLectura } from '../useLectura';
import { useAvisosEnVivo } from '../usePolling';
import { font, makeStyles, radius } from '../theme';
import BotonesContacto from './BotonesContacto';
import ErrorCarga from './ErrorCarga';

/** Bandeja del equipo en Mi perfil: permanece aunque no llegue el push. */
export default function ReembolsosPerfil() {
  const { auth } = useAuth();
  const styles = useStyles();
  const [abierto, setAbierto] = useState(false);
  const [solicitudes, setSolicitudes] = useState<SolicitudReembolso[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [ultima, setUltima] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const token = auth?.token;
  const cargar = useCallback(async (p = 1) => {
    if (!token) return;
    setCargando(true);
    try {
      const d = await getReembolsos(token, p);
      setSolicitudes(d.solicitudes); setTotal(d.total); setPagina(d.pagina); setUltima(d.ultima_pagina); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las solicitudes.'); }
    finally { setCargando(false); }
  }, [token]);
  useLectura(() => { cargar(); }, [cargar]);
  useAvisosEnVivo(['pedidos'], () => { if (!abierto) cargar(); });
  return <>
    <TouchableOpacity accessibilityRole="button" onPress={() => { setAbierto(true); cargar(); }}>
      <Text style={styles.enlace}>Reembolsos solicitados{total > 0 ? ` (${total})` : ''}</Text>
    </TouchableOpacity>
    <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
      <View style={styles.fondo}><View style={styles.panel}>
        <Text style={styles.titulo}>Solicitudes de reembolso</Text>
        <ScrollView>
          {error ? <ErrorCarga mensaje={error} /> : cargando ? <ActivityIndicator /> : <>
            {!solicitudes.length && <Text style={styles.texto}>No hay solicitudes de reembolso.</Text>}
            {solicitudes.map(s => <View key={s.id} style={styles.solicitud}>
              <Text style={styles.titulo}>Pedido #{s.codigo} · {s.negocio}</Text>
              <Text style={styles.texto}>{s.cliente} solicita la devolución de una transferencia. Verifica el pago y acuerda el reembolso directamente.</Text>
              <Text style={styles.texto}>{s.telefono || 'Teléfono no disponible'}</Text>
              <BotonesContacto telefono={s.telefono} etiquetaLlamar="Llamar al cliente"
                mensaje={`Hola, te contactamos sobre la solicitud de reembolso del pedido #${s.codigo}.`} />
            </View>)}
            {pagina > 1 && <TouchableOpacity onPress={() => cargar(pagina - 1)}><Text style={styles.enlace}>Anterior</Text></TouchableOpacity>}
            {pagina < ultima && <TouchableOpacity onPress={() => cargar(pagina + 1)}><Text style={styles.enlace}>Siguiente</Text></TouchableOpacity>}
          </>}
        </ScrollView>
        <TouchableOpacity onPress={() => setAbierto(false)}><Text style={styles.enlace}>Cerrar</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </>;
}
const useStyles = makeStyles(c => ({
  fondo: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.5)' },
  panel: { maxHeight: '85%', padding: 20, borderRadius: radius.lg, backgroundColor: c.surface },
  titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 16, marginBottom: 12 },
  texto: { color: c.text, fontFamily: font.regular, marginBottom: 8 },
  enlace: { color: c.goldText, fontFamily: font.bold, padding: 12 },
  solicitud: { paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border },
}));
