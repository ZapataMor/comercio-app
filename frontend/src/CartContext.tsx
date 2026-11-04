import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Producto } from './api';
import { useAuth } from './AuthContext';
import { animarDespliegue } from './components/anim';
import { coloresDe, ingredientesDe, OpcionesLinea, tallasDe } from './opcionesProducto';

/** Tiempo que una línea sigue en el carrito después de quitarla (ms). */
export const DURACION_RETIRO = 3000;

export type CartItem = {
  /** Identifica la línea: el mismo producto con otras opciones es otra línea. */
  linea: string;
  producto_id: number;
  nombre: string;
  precio: number;
  cantidad: number;
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
  /** Empieza la cuenta regresiva: en DURACION_RETIRO ms la línea desaparece. */
  quitar: (linea: string) => void;
  /**
   * Cambia las opciones de `unidades` de la línea (todas si no se indica). Si
   * son menos que todas, esas unidades pasan a su propia línea.
   */
  personalizar: (linea: string, opciones: OpcionesLinea, unidades?: number) => void;
  vaciar: () => void;
};

type CarritoGuardado = { negocioId: number | null; negocioNombre: string | null; items: CartItem[] };

const CartContext = createContext<CartContextType>({} as CartContextType);

/**
 * El carrito se guarda en el teléfono, uno por cuenta: sobrevive a cerrar la
 * app y no se mezcla si otra persona inicia sesión en el mismo aparato. Los
 * precios guardados son orientativos: el servidor recalcula al confirmar.
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
    cantidad,
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
          cantidad: i.saleEn ? nueva.cantidad : i.cantidad + nueva.cantidad,
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
  const items = useMemo(() => lineas.filter(i => !i.saleEn), [lineas]);
  // No se guarda nada hasta haber leído el carrito de esta cuenta (si no, el
  // carrito vacío inicial borraría el guardado).
  const cargadoPara = useRef<number | null>(null);

  useEffect(() => {
    cargadoPara.current = null;
    setLineas([]);
    setNegocioId(null);
    setNegocioNombre(null);
    if (userId == null) return;

    let vigente = true;
    AsyncStorage.getItem(claveCarrito(userId))
      .then(raw => {
        if (!vigente || !raw) return;
        try {
          const guardado = JSON.parse(raw) as CarritoGuardado;
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
    const guardado: CarritoGuardado = { negocioId, negocioNombre, items };
    AsyncStorage.setItem(claveCarrito(userId), JSON.stringify(guardado)).catch(() => {});
  }, [userId, negocioId, negocioNombre, items]);

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
    // De otra tienda solo pueden quedar líneas saliendo: esas no se conservan.
    setLineas(prev => sumarLinea(negocioId === nid ? prev : [], crearLinea(p, opciones, cantidad)));
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

    if (!actual.saleEn && actual.cantidad + delta < 1) {
      quitar(linea);
      return;
    }
    if (actual.saleEn && delta < 0) return;

    setLineas(prev =>
      prev.map(i => {
        if (i.linea !== linea) return i;
        return i.saleEn
          ? { ...i, saleEn: undefined }
          : { ...i, cantidad: i.cantidad + delta };
      }),
    );
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

  const vaciar = () => {
    setLineas([]);
    setNegocioId(null);
    setNegocioNombre(null);
  };

  const count = items.reduce((s, i) => s + i.cantidad, 0);
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  return (
    <CartContext.Provider
      value={{
        negocioId,
        negocioNombre,
        items,
        lineas,
        count,
        total,
        agregar,
        reemplazar,
        cambiar,
        quitar,
        personalizar,
        vaciar,
      }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
