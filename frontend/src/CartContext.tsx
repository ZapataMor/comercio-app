import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Producto } from './api';
import { cantidadValida, esPorPeso, redondearCantidad } from './cantidades';
import { useAuth } from './AuthContext';
import { animarDespliegue } from './components/anim';
import { coloresDe, ingredientesDe, OpcionesLinea, tallasDe } from './opcionesProducto';

/** Tiempo que una línea sigue en el carrito después de quitarla (ms). */
export const DURACION_RETIRO = 3000;
export const DURACION_CARRITO = 60 * 60 * 1000;

export type CartItem = {
  /** Identifica la línea: el mismo producto con otras opciones es otra línea. */
  linea: string;
  producto_id: number;
  nombre: string;
  precio: number;
  precio_token?: string;
  precio_vence_at?: string;
  precioVigente?: number;
  precioAvisado?: number;
  cantidad: number;
  tipo_venta?: string;
  unidad_medida?: string;
  imagen?: string | null;
  opciones?: OpcionesLinea;
  // Copia de lo que se puede elegir: el carrito se edita sin volver al catálogo.
  ingredientes?: string[];
  tallas?: string[];
  colores?: string[];
  /** Hora en que sale del carrito; mientras tanto ya no se cuenta ni se pide. */
  saleEn?: number;
};

type CartContextType = {
  negocioId: number | null;
  negocioNombre: string | null;
  /** Lo que se va a pedir. */
  items: CartItem[];
  /** `items` más las líneas que están saliendo, para la pantalla del carrito. */
  lineas: CartItem[];
  count: number;
  total: number;
  venceEn: number | null;
  cambiosPrecio: CartItem[];
  revisarPrecios: (productos: Producto[]) => void;
  resolverCambioPrecio: (productoId: number, conservar: boolean) => void;
  /** Devuelve false si el producto es de otra tienda (carrito = 1 negocio). */
  agregar: (
    negocioId: number,
    negocioNombre: string,
    p: Producto,
    opciones?: OpcionesLinea,
    cantidad?: number,
  ) => boolean;
  /** Vacía el carrito y lo deja SOLO con este producto (cambio de tienda). */
  reemplazar: (
    negocioId: number,
    negocioNombre: string,
    p: Producto,
    opciones?: OpcionesLinea,
    cantidad?: number,
  ) => void;
  /** Bajar de 1 la quita con su cuenta regresiva; subir una que sale la conserva. */
  cambiar: (linea: string, delta: number) => void;
  fijarCantidad: (linea: string, cantidad: number) => void;
  /** Empieza la cuenta regresiva: en DURACION_RETIRO ms la línea desaparece. */
  quitar: (linea: string) => void;
  /**
   * Cambia las opciones de `unidades` de la línea (todas si no se indica). Si
   * son menos que todas, esas unidades pasan a su propia línea.
   */
  personalizar: (linea: string, opciones: OpcionesLinea, unidades?: number) => void;
  /**
   * Suma una unidad del producto de `linea` con estas opciones: si son las de la
   * línea cae ahí y si son otras queda en su propia línea.
   */
  sumarUnidad: (linea: string, opciones: OpcionesLinea) => void;
  vaciar: () => void;
};

type CarritoGuardado = { negocioId: number | null; negocioNombre: string | null; items: CartItem[]; venceEn: number | null };

const CartContext = createContext<CartContextType>({} as CartContextType);

/**
 * El carrito se guarda en el teléfono, uno por cuenta: sobrevive a cerrar la
 * app y no se mezcla si otra persona inicia sesión en el mismo aparato. Los
 * precios se reservan por una hora y el servidor verifica la reserva al confirmar.
 */
const claveCarrito = (userId: number) => `carrito:${userId}`;

function claveLinea(productoId: number, o?: OpcionesLinea) {
  const lista = (v?: string[]) => [...(v ?? [])].sort().join(',');
  return [productoId, o?.talla ?? '', o?.color ?? '', lista(o?.sin), lista(o?.extra)].join('|');
}

/** Deja solo lo elegido: sin nada elegido, dos líneas son la misma. */
function limpiarOpciones(o?: OpcionesLinea): OpcionesLinea | undefined {
  const limpias: OpcionesLinea = {};
  if (o?.talla) limpias.talla = o.talla;
  if (o?.color) limpias.color = o.color;
  if (o?.sin?.length) limpias.sin = o.sin;
  if (o?.extra?.length) limpias.extra = o.extra;
  return Object.keys(limpias).length ? limpias : undefined;
}

function crearLinea(p: Producto, opciones?: OpcionesLinea, cantidad = 1): CartItem {
  const limpias = limpiarOpciones(opciones);
  return {
    linea: claveLinea(p.id, limpias),
    producto_id: p.id,
    nombre: p.nombre,
    precio: p.precio,
    precio_token: p.precio_token,
    precio_vence_at: p.precio_vence_at,
    cantidad,
    tipo_venta: p.tipo_venta,
    unidad_medida: p.unidad_medida,
    imagen: p.imagen ?? null,
    opciones: limpias,
    ingredientes: ingredientesDe(p),
    tallas: tallasDe(p),
    colores: coloresDe(p),
  };
}

/** Suma a la línea igual si ya existe; si estaba saliendo, vuelve con lo nuevo. */
function sumarLinea(lineas: CartItem[], nueva: CartItem): CartItem[] {
  const existente = lineas.find(i => i.linea === nueva.linea);
  if (!existente) {
    return [...lineas, nueva];
  }
  return lineas.map(i =>
    i === existente
      ? {
          ...i,
          ...(i.saleEn ? nueva : {}),
          cantidad: i.saleEn ? nueva.cantidad : Math.min(99, redondearCantidad(i.cantidad + nueva.cantidad)),
          saleEn: undefined,
        }
      : i,
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const userId = auth?.user.id ?? null;
  const [negocioId, setNegocioId] = useState<number | null>(null);
  const [negocioNombre, setNegocioNombre] = useState<string | null>(null);
  const [lineas, setLineas] = useState<CartItem[]>([]);
  const [venceEn, setVenceEn] = useState<number | null>(null);
  const items = useMemo(() => lineas.filter(i => !i.saleEn), [lineas]);
  // No se guarda nada hasta haber leído el carrito de esta cuenta (si no, el
  // carrito vacío inicial borraría el guardado).
  const cargadoPara = useRef<number | null>(null);

  useEffect(() => {
    cargadoPara.current = null;
    setLineas([]);
    setNegocioId(null);
    setNegocioNombre(null);
    setVenceEn(null);
    if (userId == null) return;

    let vigente = true;
    AsyncStorage.getItem(claveCarrito(userId))
      .then(raw => {
        if (!vigente || !raw) return;
        try {
          const guardado = JSON.parse(raw) as CarritoGuardado;
          if (!guardado.venceEn || guardado.venceEn <= Date.now()) {
            AsyncStorage.removeItem(claveCarrito(userId)).catch(() => {});
            return;
          }
          setVenceEn(guardado.venceEn);
          setLineas(
            (guardado.items ?? []).map(i => ({
              ...i,
              // Los carritos guardados antes de las opciones no traen la línea.
              linea: i.linea ?? claveLinea(i.producto_id, i.opciones),
            })),
          );
          setNegocioId(guardado.negocioId ?? null);
          setNegocioNombre(guardado.negocioNombre ?? null);
        } catch {}
      })
      .catch(() => {})
      .finally(() => {
        if (vigente) cargadoPara.current = userId;
      });
    return () => {
      vigente = false;
    };
  }, [userId]);

  // Lo que está saliendo no se guarda: si la app se cierra antes de que acabe
  // la cuenta regresiva, el cliente ya había decidido quitarlo.
  useEffect(() => {
    if (userId == null || cargadoPara.current !== userId) return;
    const guardado: CarritoGuardado = { negocioId, negocioNombre, items, venceEn };
    AsyncStorage.setItem(claveCarrito(userId), JSON.stringify(guardado)).catch(() => {});
  }, [userId, negocioId, negocioNombre, items, venceEn]);

  useEffect(() => {
    if (venceEn == null) return;
    const vencer = () => {
      if (venceEn != null && venceEn <= Date.now()) {
        setLineas([]);
        setNegocioId(null);
        setNegocioNombre(null);
        setVenceEn(null);
      }
    };
    const timer = setInterval(vencer, 1000);
    const sub = AppState.addEventListener('change', estado => { if (estado === 'active') vencer(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [venceEn]);

  const agregar = (
    nid: number,
    nombre: string,
    p: Producto,
    opciones?: OpcionesLinea,
    cantidad = 1,
  ): boolean => {
    if (items.length > 0 && negocioId !== nid) {
      return false; // productos de otra tienda
    }
    setNegocioId(nid);
    setNegocioNombre(nombre);
    const vencePrecio = p.precio_vence_at ? Date.parse(p.precio_vence_at) : Date.now() + DURACION_CARRITO;
    setVenceEn(prev => Math.min(items.length && prev && negocioId === nid ? prev : Date.now() + DURACION_CARRITO, vencePrecio));
    // De otra tienda solo pueden quedar líneas saliendo: esas no se conservan.
    setLineas(prev => {
      const actuales = negocioId === nid ? prev : [];
      const reservado = actuales.find(i => i.producto_id === p.id && !i.saleEn);
      const nueva = crearLinea(p, opciones, cantidad);
      // Otra combinación del mismo producto usa la reserva que ya tiene en el carrito.
      if (reservado) {
        nueva.precio = reservado.precio;
        nueva.precio_token = reservado.precio_token;
        nueva.precio_vence_at = reservado.precio_vence_at;
        nueva.precioVigente = reservado.precioVigente;
        nueva.precioAvisado = reservado.precioAvisado;
      }
      return sumarLinea(actuales, nueva);
    });
    return true;
  };

  // "Vaciar y agregar" en un solo paso: llamar a vaciar() y agregar() seguidos
  // no funciona porque agregar() leería el estado viejo (aún sin vaciar).
  const reemplazar = (
    nid: number,
    nombre: string,
    p: Producto,
    opciones?: OpcionesLinea,
    cantidad = 1,
  ) => {
    setNegocioId(nid);
    setNegocioNombre(nombre);
    setVenceEn(Math.min(Date.now() + DURACION_CARRITO, p.precio_vence_at ? Date.parse(p.precio_vence_at) : Infinity));
    setLineas([crearLinea(p, opciones, cantidad)]);
  };

  const quitar = (linea: string) => {
    const saleEn = Date.now() + DURACION_RETIRO;
    setLineas(prev => prev.map(i => (i.linea === linea && !i.saleEn ? { ...i, saleEn } : i)));
    setTimeout(() => {
      animarDespliegue();
      // Solo sale si sigue en ESTA cuenta regresiva: el cliente pudo conservarla.
      setLineas(prev => prev.filter(i => i.linea !== linea || i.saleEn !== saleEn));
    }, DURACION_RETIRO);
  };

  const cambiar = (linea: string, delta: number) => {
    const actual = lineas.find(i => i.linea === linea);
    if (!actual) return;

    if (!actual.saleEn && redondearCantidad(actual.cantidad + delta) < (esPorPeso(actual) ? 0.001 : 1)) {
      quitar(linea);
      return;
    }
    if (actual.saleEn && delta < 0) return;

    setLineas(prev =>
      prev.map(i => {
        if (i.linea !== linea) return i;
        return i.saleEn
          ? { ...i, saleEn: undefined }
          : { ...i, cantidad: Math.min(99, redondearCantidad(i.cantidad + delta)) };
      }),
    );
  };

  const fijarCantidad = (linea: string, cantidad: number) => {
    setLineas(prev => prev.map(i => i.linea === linea && cantidadValida(cantidad, esPorPeso(i))
      ? { ...i, cantidad: redondearCantidad(cantidad), saleEn: undefined } : i));
  };

  const personalizar = (linea: string, opciones: OpcionesLinea, unidades?: number) => {
    setLineas(prev => {
      const actual = prev.find(i => i.linea === linea);
      if (!actual) return prev;

      const limpias = limpiarOpciones(opciones);
      const nuevaClave = claveLinea(actual.producto_id, limpias);
      if (nuevaClave === linea) return prev;

      const cantidad = Math.min(unidades ?? actual.cantidad, actual.cantidad);
      const nueva: CartItem = { ...actual, linea: nuevaClave, opciones: limpias, cantidad };
      const todas = cantidad === actual.cantidad;

      // Toda la línea cambia y no choca con otra: se queda en su sitio.
      if (todas && !prev.some(i => i.linea === nuevaClave)) {
        return prev.map(i => (i === actual ? nueva : i));
      }
      const resto = todas
        ? prev.filter(i => i !== actual)
        : prev.map(i => (i === actual ? { ...i, cantidad: i.cantidad - cantidad } : i));
      return sumarLinea(resto, nueva);
    });
  };

  const sumarUnidad = (linea: string, opciones: OpcionesLinea) => {
    setLineas(prev => {
      const actual = prev.find(i => i.linea === linea);
      if (!actual) return prev;

      const limpias = limpiarOpciones(opciones);
      const clave = claveLinea(actual.producto_id, limpias);
      return sumarLinea(prev, { ...actual, linea: clave, opciones: limpias, cantidad: 1 });
    });
  };

  const revisarPrecios = (productos: Producto[]) => {
    const precios = new Map(productos.map(p => [p.id, p.precio]));
    const medidas = new Map(productos.map(p => [p.id, p]));
    setLineas(prev => {
      const nuevas = prev.map(i => precios.has(i.producto_id) && precios.get(i.producto_id) !== i.precioVigente
        ? { ...i, precioVigente: precios.get(i.producto_id), tipo_venta: medidas.get(i.producto_id)?.tipo_venta, unidad_medida: medidas.get(i.producto_id)?.unidad_medida } : i);
      return nuevas.some((i, idx) => i !== prev[idx]) ? nuevas : prev;
    });
  };
  const cambiosPrecio = items.filter((i, idx) => i.precioVigente != null && i.precioVigente !== i.precio && i.precioVigente !== i.precioAvisado
    && items.findIndex(j => j.producto_id === i.producto_id) === idx);
  const resolverCambioPrecio = (productoId: number, conservar: boolean) => {
    setLineas(prev => conservar ? prev.map(i => i.producto_id === productoId ? { ...i, precioAvisado: i.precioVigente } : i)
      : prev.filter(i => i.producto_id !== productoId));
  };

  const vaciar = () => {
    setLineas([]);
    setNegocioId(null);
    setNegocioNombre(null);
    setVenceEn(null);
  };

  const count = items.reduce((s, i) => s + (esPorPeso(i) ? 1 : i.cantidad), 0);
  const total = items.reduce((s, i) => s + Math.round(i.precio * i.cantidad * 100) / 100, 0);

  return (
    <CartContext.Provider
      value={{
        negocioId,
        negocioNombre,
        items,
        lineas,
        count,
        total,
        venceEn,
        cambiosPrecio,
        revisarPrecios,
        resolverCambioPrecio,
        agregar,
        reemplazar,
        cambiar,
        fijarCantidad,
        quitar,
        personalizar,
        sumarUnidad,
        vaciar,
      }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
