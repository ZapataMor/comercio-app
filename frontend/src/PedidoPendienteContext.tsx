import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ApiError, crearPedido, getPedido, NuevoPedido } from './api';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import { useToast } from './Toast';

type Envio = { body: NuevoPedido; negocioNombre: string; error?: string };
type Confirmado = { id: number; negocioId: number; negocioNombre: string };
type PendienteContexto = {
  pendiente: Envio | null;
  confirmado: Confirmado | null;
  consumirConfirmado: () => void;
  cargando: boolean;
  errorCarga: string | null;
  recargar: () => void;
  enviar: (body: NuevoPedido, nombre: string) => Promise<void>;
  revisar: () => Promise<void>;
};
const Contexto = createContext<PendienteContexto>({ pendiente: null, confirmado: null, consumirConfirmado: () => {}, cargando: false, errorCarga: null, recargar: () => {}, enviar: async () => {}, revisar: async () => {} });
const clave = (id: number) => `pedido-pendiente:${id}`;

/** Un envío confirmado conserva su cuerpo y su clave hasta obtener una respuesta definitiva. */
export function PedidoPendienteProvider({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const cart = useCart();
  const carritoActual = useRef(cart);
  carritoActual.current = cart;
  const toast = useToast();
  const [pendiente, setPendiente] = useState<Envio | null>(null);
  const [confirmado, setConfirmado] = useState<Confirmado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [revisionCarga, setRevisionCarga] = useState(0);
  const trabajo = useRef<Envio | null>(null);
  const ocupado = useRef(false);
  const usuario = useRef(auth?.user.id);
  usuario.current = auth?.user.id;
  const sesion = useRef(auth);
  sesion.current = auth;

  const procesar = useCallback(async () => {
    const actual = sesion.current;
    const envio = trabajo.current;
    if (!actual || !envio || envio.error || ocupado.current) return;
    ocupado.current = true;
    const idUsuario = actual.user.id;
    try {
      const id = await crearPedido(actual.token, envio.body);
      if (usuario.current !== idUsuario || trabajo.current !== envio) return;
      await AsyncStorage.removeItem(clave(idUsuario));
      if (usuario.current !== idUsuario || trabajo.current !== envio) return;
      trabajo.current = null;
      setPendiente(null);
      const carrito = carritoActual.current;
      const cuerpoCarrito = carrito.items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio_token: i.precio_token, ...i.opciones }));
      if (carrito.negocioId === envio.body.negocio_id && JSON.stringify(cuerpoCarrito) === JSON.stringify(envio.body.items)) carrito.vaciar();
      setConfirmado({ id, negocioId: envio.body.negocio_id, negocioNombre: envio.negocioNombre });
      // Consultar el estado no bloquea el envío de un pedido posterior.
      getPedido(actual.token, id).catch(() => null).then(pedido => {
        if (usuario.current !== idUsuario) return;
        if (pedido?.estado === 'cancelado') toast.info('Pedido cancelado', pedido.motivo_cancelacion ?? 'Abre el pedido para ver el motivo.');
        else toast.exito('Pedido recibido', 'El comercio ya recibió tu pedido. Puedes seguir su estado en Mis pedidos.');
      });
    } catch (e) {
      if (usuario.current !== idUsuario || trabajo.current !== envio) return;
      // Una desconexión o un 5xx pueden ocurrir después de guardar el pedido.
      // Se reenvía exactamente el mismo intento; nunca se crea una clave nueva.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status)) {
        const fallido = { ...envio, error: e.message };
        trabajo.current = fallido;
        setPendiente(fallido);
        await AsyncStorage.setItem(clave(idUsuario), JSON.stringify(fallido)).catch(() => {});
        toast.error('El pedido no fue aceptado', e.message);
      }
    } finally {
      ocupado.current = false;
    }
  }, [toast]);

  useEffect(() => {
    let activo = true;
    const userId = auth?.user.id;
    trabajo.current = null;
    setPendiente(null);
    setConfirmado(null);
    setCargando(true);
    setErrorCarga(null);
    if (!userId) { setCargando(false); return; }
    let recuperado = false;
    AsyncStorage.getItem(clave(userId)).then(raw => {
      if (!activo) return;
      if (!raw) { recuperado = true; return; }
      const guardado = JSON.parse(raw) as Envio;
      if (!guardado.body?.clave_intento) throw new Error('Envío sin identificador.');
      trabajo.current = guardado;
      setPendiente(guardado);
      recuperado = true;
    }).catch(e => {
      if (activo) setErrorCarga(e.message);
    }).finally(() => { if (activo && recuperado) { setCargando(false); procesar(); } });
    const timer = setInterval(() => { if (AppState.currentState === 'active') procesar(); }, 5000);
    const sub = AppState.addEventListener('change', estado => { if (estado === 'active') procesar(); });
    return () => { activo = false; clearInterval(timer); sub.remove(); };
  }, [auth?.user.id, procesar, revisionCarga]);

  async function enviar(body: NuevoPedido, negocioNombre: string) {
    if (!auth || cargando || trabajo.current || ocupado.current) throw new Error('Ya tienes un pedido en proceso de envío.');
    const envio: Envio = { body: JSON.parse(JSON.stringify(body)), negocioNombre };
    // El bloqueo ocurre antes del primer await: dos toques rápidos son el mismo envío.
    trabajo.current = envio;
    try {
      await AsyncStorage.setItem(clave(auth.user.id), JSON.stringify(envio));
    } catch {
      trabajo.current = null;
      throw new Error('No pudimos guardar el envío en el teléfono. Intenta de nuevo.');
    }
    if (usuario.current !== auth.user.id || trabajo.current !== envio) return;
    setConfirmado(null);
    setPendiente(envio);
    // La pantalla cambia a "Enviando" incluso si no hay conexión.
    procesar();
  }

  async function revisar() {
    if (!auth || !trabajo.current?.error) return;
    await AsyncStorage.removeItem(clave(auth.user.id));
    trabajo.current = null;
    setPendiente(null);
  }

  const consumirConfirmado = useCallback(() => setConfirmado(null), []);
  return <Contexto.Provider value={{ pendiente, confirmado, consumirConfirmado, cargando, errorCarga, recargar: () => setRevisionCarga(v => v + 1), enviar, revisar }}>{children}</Contexto.Provider>;
}

export const usePedidoPendiente = () => useContext(Contexto);
