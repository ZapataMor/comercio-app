import React, { createContext, useContext, useState } from 'react';
import { Producto } from './api';

export type CartItem = { producto_id: number; nombre: string; precio: number; cantidad: number };

type CartContextType = {
  negocioId: number | null;
  negocioNombre: string | null;
  items: CartItem[];
  count: number;
  total: number;
  /** Devuelve false si el producto es de otra tienda (carrito = 1 negocio). */
  agregar: (negocioId: number, negocioNombre: string, p: Producto) => boolean;
  cambiar: (productoId: number, delta: number) => void;
  quitar: (productoId: number) => void;
  vaciar: () => void;
};

const CartContext = createContext<CartContextType>({} as CartContextType);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [negocioId, setNegocioId] = useState<number | null>(null);
  const [negocioNombre, setNegocioNombre] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

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
      value={{ negocioId, negocioNombre, items, count, total, agregar, cambiar, quitar, vaciar }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
