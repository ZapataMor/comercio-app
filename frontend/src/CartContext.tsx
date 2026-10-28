import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Producto } from './api';
import { useAuth } from './AuthContext';

export type CartItem = { producto_id: number; nombre: string; precio: number; cantidad: number };

type CartContextType = {
  negocioId: number | null;
  negocioNombre: string | null;
  items: CartItem[];
  count: number;
  total: number;
  /** Devuelve false si el producto es de otra tienda (carrito = 1 negocio). */
  agregar: (negocioId: number, negocioNombre: string, p: Producto) => boolean;
  /** Vacía el carrito y lo deja SOLO con este producto (cambio de tienda). */
  reemplazar: (negocioId: number, negocioNombre: string, p: Producto) => void;
  cambiar: (productoId: number, delta: number) => void;
  quitar: (productoId: number) => void;
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const userId = auth?.user.id ?? null;
  const [negocioId, setNegocioId] = useState<number | null>(null);
  const [negocioNombre, setNegocioNombre] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  // No se guarda nada hasta haber leído el carrito de esta cuenta (si no, el
  // carrito vacío inicial borraría el guardado).
  const cargadoPara = useRef<number | null>(null);

  useEffect(() => {
    cargadoPara.current = null;
    setItems([]);
    setNegocioId(null);
    setNegocioNombre(null);
    if (userId == null) return;

    let vigente = true;
    AsyncStorage.getItem(claveCarrito(userId))
      .then(raw => {
        if (!vigente || !raw) return;
        try {
          const guardado = JSON.parse(raw) as CarritoGuardado;
          setItems(guardado.items ?? []);
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

  useEffect(() => {
    if (userId == null || cargadoPara.current !== userId) return;
    const guardado: CarritoGuardado = { negocioId, negocioNombre, items };
    AsyncStorage.setItem(claveCarrito(userId), JSON.stringify(guardado)).catch(() => {});
  }, [userId, negocioId, negocioNombre, items]);

  const agregar = (nid: number, nombre: string, p: Producto): boolean => {
    if (items.length > 0 && negocioId !== nid) {
      return false; // productos de otra tienda
    }
    setNegocioId(nid);
    setNegocioNombre(nombre);
    setItems(prev => {
      const ex = prev.find(i => i.producto_id === p.id);
      if (ex) {
        return prev.map(i => (i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [...prev, { producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 }];
    });
    return true;
  };

  // "Vaciar y agregar" en un solo paso: llamar a vaciar() y agregar() seguidos
  // no funciona porque agregar() leería el estado viejo (aún sin vaciar).
  const reemplazar = (nid: number, nombre: string, p: Producto) => {
    setNegocioId(nid);
    setNegocioNombre(nombre);
    setItems([{ producto_id: p.id, nombre: p.nombre, precio: p.precio, cantidad: 1 }]);
  };

  const cambiar = (productoId: number, delta: number) => {
    setItems(prev =>
      prev
        .map(i => (i.producto_id === productoId ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter(i => i.cantidad > 0),
    );
  };

  const quitar = (productoId: number) => {
    setItems(prev => prev.filter(i => i.producto_id !== productoId));
  };

  const vaciar = () => {
    setItems([]);
    setNegocioId(null);
    setNegocioNombre(null);
  };

  const count = items.reduce((s, i) => s + i.cantidad, 0);
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

  return (
    <CartContext.Provider
      value={{ negocioId, negocioNombre, items, count, total, agregar, reemplazar, cambiar, quitar, vaciar }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
