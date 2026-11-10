import React, { useEffect, useRef } from 'react';
import { AppState, Modal, Text, TouchableOpacity, View } from 'react-native';
import { getCatalogo, sincronizarCarrito } from '../api';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { font, makeStyles, radius } from '../theme';
import { alCambiarDesdePush } from '../usePolling';

const cop = (n: number) => '$' + n.toLocaleString('es-CO');

export default function VigilarCarrito() {
  const { auth } = useAuth();
  const token = auth?.token;
  const cart = useCart();
  const ultimo = useRef(cart);
  ultimo.current = cart;
  const styles = useStyles();
  const suscripcion = useRef({ token, teniaProductos: false });
  if (suscripcion.current.token !== token) suscripcion.current = { token, teniaProductos: false };
  const firma = JSON.stringify(cart.items.filter(i => i.precio_token).map(i => ({ producto_id: i.producto_id, precio_token: i.precio_token }))
    .filter((i, idx, lista) => lista.findIndex(j => j.producto_id === i.producto_id) === idx));
  useEffect(() => {
    if (!token) return;
    if (firma === '[]' && !suscripcion.current.teniaProductos) return;
    suscripcion.current.teniaProductos = firma !== '[]';
    let activo = true;
    const timer = setTimeout(() => { if (activo) sincronizarCarrito(token, JSON.parse(firma), cart.venceEn).catch(() => {}); }, 250);
    return () => { activo = false; clearTimeout(timer); };
  }, [token, firma, cart.venceEn]);
  useEffect(() => {
    if (!token || !cart.negocioId) return;
    let activo = true;
    let consultando = false;
    const consultar = async () => {
      if (consultando || AppState.currentState !== 'active') return;
      consultando = true;
      try {
        const d = await getCatalogo(token, cart.negocioId!);
        if (activo) ultimo.current.revisarPrecios(d.productos);
        if (activo) await sincronizarCarrito(token, JSON.parse(firma), ultimo.current.venceEn).catch(() => {});
      } catch {} finally { consultando = false; }
    };
    consultar();
    const timer = setInterval(consultar, 15000);
    const sub = AppState.addEventListener('change', estado => { if (estado === 'active') consultar(); });
    const quitarPush = alCambiarDesdePush(consultar);
    return () => { activo = false; clearInterval(timer); sub.remove(); quitarPush(); };
  }, [token, cart.negocioId, firma]);
  const cambio = cart.cambiosPrecio[0];
  if (!cambio) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.fondo}><View style={styles.caja}>
        <Text style={styles.titulo}>Cambió el precio de {cambio.nombre}</Text>
        <Text style={styles.texto}>El precio del catálogo pasó de {cop(cambio.precio)} a {cop(cambio.precioVigente!)}. Tu carrito conserva {cop(cambio.precio)} hasta que venza su hora de vigencia.</Text>
        <Text style={styles.texto}>¿Quieres conservar este producto o eliminarlo?</Text>
        <TouchableOpacity style={styles.boton} onPress={() => cart.resolverCambioPrecio(cambio.producto_id, true)}><Text style={styles.botonTexto}>Conservar en el carrito</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => cart.resolverCambioPrecio(cambio.producto_id, false)}><Text style={styles.eliminar}>Eliminar producto</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );
}
const useStyles = makeStyles(c => ({
  fondo: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' },
  caja: { backgroundColor: c.surface, padding: 22, borderRadius: radius.lg },
  titulo: { color: c.textStrong, fontFamily: font.bold, fontSize: 18, marginBottom: 12 },
  texto: { color: c.text, fontFamily: font.regular, marginBottom: 14, lineHeight: 21 },
  boton: { backgroundColor: c.accent, padding: 14, borderRadius: radius.md },
  botonTexto: { color: c.onAccent, textAlign: 'center', fontFamily: font.bold },
  eliminar: { color: c.danger, textAlign: 'center', padding: 14, fontFamily: font.semibold },
}));
