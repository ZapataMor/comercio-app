import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ajustarMiPedido, getCatalogo, Producto, SeguimientoPedido } from '../api';
import { useAuth } from '../AuthContext';
import { CartItem } from '../CartContext';
import { messageFromError } from '../formErrors';
import { coloresDe, detalleOpciones, ingredientesDe, OpcionesLinea, tallasDe } from '../opcionesProducto';
import { font, makeStyles, radius } from '../theme';
import PersonalizarLinea from './PersonalizarLinea';

const cop = (n: number) => '$' + n.toLocaleString('es-CO');
export default function AjustarPedido({ pedido, visible, onCerrar, onGuardado }: {
  pedido: SeguimientoPedido; visible: boolean; onCerrar: () => void; onGuardado: () => void;
}) {
  const { auth } = useAuth();
  const token = auth?.token;
  const referencia = useRef(pedido);
  referencia.current = pedido;
  const styles = useStyles();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lineas, setLineas] = useState<CartItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [personalizar, setPersonalizar] = useState<string | null>(null);
  useEffect(() => {
    if (!visible || !token || !pedido.negocio_id) return;
    let activo = true;
    setCargando(true); setError('');
    getCatalogo(token, pedido.negocio_id).then(d => {
      if (!activo) return;
      setProductos(d.productos);
      setLineas(referencia.current.items.filter(i => i.producto_id).map((i, idx) => {
        const p = d.productos.find(v => v.id === i.producto_id);
        return { linea: `original-${idx}`, producto_id: i.producto_id!, nombre: i.nombre,
          precio: i.precio, cantidad: i.cantidad, opciones: i.opciones,
          ingredientes: p ? ingredientesDe(p) : [], tallas: p ? tallasDe(p) : [], colores: p ? coloresDe(p) : [] };
      }));
    }).catch(e => { if (activo) setError(messageFromError(e)); }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [visible, pedido.id, token, pedido.negocio_id, pedido.faltante_version]);
  function agregar(p: Producto) {
    const opciones: OpcionesLinea = {};
    const tallas = tallasDe(p); const colores = coloresDe(p);
    if (tallas.length) opciones.talla = tallas[0];
    if (colores.length) opciones.color = colores[0];
    const linea = `nueva-${Date.now()}-${Math.random()}`;
    const precioAnterior = pedido.items.find(i => i.producto_id === p.id)?.precio;
    setLineas(prev => [...prev, { linea, producto_id: p.id, nombre: p.nombre, precio: precioAnterior ?? p.precio,
      cantidad: 1, opciones, ingredientes: ingredientesDe(p), tallas, colores }]);
    if (tallas.length || colores.length || ingredientesDe(p).length) setPersonalizar(linea);
  }
  const total = lineas.reduce((s, i) => s + i.precio * i.cantidad, pedido.costo_domicilio);
  const noDisponibles = lineas.some(i => !productos.some(p => p.id === i.producto_id && p.disponible));
  async function guardar() {
    if (!auth || enviando || !pedido.faltante_version) return;
    setEnviando(true); setError('');
    try {
      await ajustarMiPedido(auth.token, pedido.id, lineas.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, ...i.opciones })), total, pedido.faltante_version);
      onGuardado(); onCerrar();
    } catch (e) { setError(messageFromError(e)); }
    finally { setEnviando(false); }
  }
  return <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!enviando) onCerrar(); }}>
    <ScrollView style={styles.fondo} contentContainerStyle={styles.contenido}>
      <Text style={styles.titulo}>Elige de nuevo</Text>
      <Text style={styles.aviso}>{pedido.faltante_motivo}</Text>
      <Text style={styles.texto}>Quita los productos agotados, elige alternativas o ajusta los ingredientes. Revisa el total antes de confirmar.</Text>
      {cargando && <ActivityIndicator />}
      {lineas.map(i => <View key={i.linea} style={styles.card}>
        <Text style={styles.nombre}>{i.nombre} · {cop(i.precio)}</Text>
        {!productos.some(p => p.id === i.producto_id && p.disponible) && <Text style={styles.error}>Agotado. Quita este producto o elige otro.</Text>}
        {!!detalleOpciones(i.opciones) && <Text style={styles.texto}>{detalleOpciones(i.opciones)}</Text>}
        <View style={styles.fila}>
          <TouchableOpacity disabled={enviando} onPress={() => setLineas(prev => prev.map(v => v.linea === i.linea ? { ...v, cantidad: Math.max(1, v.cantidad - 1) } : v))}><Text style={styles.enlace}>−</Text></TouchableOpacity>
          <Text style={styles.texto}>{i.cantidad}</Text>
          <TouchableOpacity disabled={enviando || i.cantidad >= 99} onPress={() => setLineas(prev => prev.map(v => v.linea === i.linea ? { ...v, cantidad: v.cantidad + 1 } : v))}><Text style={styles.enlace}>+</Text></TouchableOpacity>
          <TouchableOpacity disabled={enviando} onPress={() => setLineas(prev => prev.filter(v => v.linea !== i.linea))}><Text style={styles.error}>Quitar</Text></TouchableOpacity>
        </View>
        {!!(i.ingredientes?.length || i.tallas?.length || i.colores?.length) && <TouchableOpacity disabled={enviando} onPress={() => setPersonalizar(i.linea)}><Text style={styles.enlace}>Cambiar ingredientes u opciones</Text></TouchableOpacity>}
      </View>)}
      <Text style={styles.nombre}>Agregar una alternativa</Text>
      {productos.filter(p => p.disponible).map(p => <TouchableOpacity key={p.id} disabled={enviando} onPress={() => agregar(p)}><Text style={styles.enlace}>+ {p.nombre} · {cop(pedido.items.find(i => i.producto_id === p.id)?.precio ?? p.precio)}</Text></TouchableOpacity>)}
      <Text style={styles.nombre}>Total con domicilio: {cop(total)}</Text>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.boton} disabled={enviando || cargando || !lineas.length || noDisponibles} onPress={guardar}><Text style={styles.botonTexto}>{enviando ? 'Confirmando…' : 'Confirmar nueva elección'}</Text></TouchableOpacity>
      <TouchableOpacity disabled={enviando} onPress={onCerrar}><Text style={styles.enlace}>Volver al pedido</Text></TouchableOpacity>
    </ScrollView>
    <PersonalizarLinea item={lineas.find(i => i.linea === personalizar) ?? null} modo="ajustar" onCerrar={() => setPersonalizar(null)} onGuardar={(linea, opciones) => { setLineas(prev => prev.map(i => i.linea === linea ? { ...i, opciones } : i)); setPersonalizar(null); }} />
  </Modal>;
}
const useStyles = makeStyles(c => ({
  fondo: { flex: 1, backgroundColor: c.bg }, contenido: { padding: 24, paddingBottom: 45 },
  titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 22, marginBottom: 14 },
  aviso: { color: c.goldText, fontFamily: font.semibold, marginBottom: 12 },
  texto: { color: c.text, fontFamily: font.regular, lineHeight: 21 },
  card: { backgroundColor: c.surface, padding: 16, borderRadius: radius.md, marginVertical: 10 },
  nombre: { color: c.textStrong, fontFamily: font.bold, marginVertical: 10 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  enlace: { color: c.goldText, fontFamily: font.semibold, paddingVertical: 12 },
  error: { color: c.danger, marginVertical: 8 },
  boton: { backgroundColor: c.accent, padding: 16, borderRadius: radius.md, marginTop: 16 },
  botonTexto: { color: c.onAccent, fontFamily: font.bold, textAlign: 'center' },
}));
