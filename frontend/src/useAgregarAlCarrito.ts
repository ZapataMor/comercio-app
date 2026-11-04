import { Producto } from './api';
import { useCart } from './CartContext';
import { useConfirmar } from './components/Confirmacion';
import { OpcionesLinea } from './opcionesProducto';

/**
 * Agrega un producto de este negocio al carrito. Si el carrito tiene productos
 * de otra tienda, pregunta antes de vaciarlo. `alAgregar` corre solo cuando el
 * producto de verdad entró.
 */
export function useAgregarAlCarrito(negocioId: number, negocioNombre: string) {
  const cart = useCart();
  const confirmar = useConfirmar();

  return (
    p: Producto,
    { opciones, cantidad = 1, alAgregar }: { opciones?: OpcionesLinea; cantidad?: number; alAgregar: () => void },
  ) => {
    if (cart.agregar(negocioId, negocioNombre, p, opciones, cantidad)) {
      alAgregar();
      return;
    }
    confirmar({
      icono: 'carrito',
      titulo: '¿Vaciar el carrito?',
      texto: `Tu carrito tiene productos de "${cart.negocioNombre}". Cada pedido es de una sola tienda: vacíalo para pedir de "${negocioNombre}".`,
      textoBoton: 'Vaciar y agregar',
      textoCancelar: 'Cancelar',
      accion: () => {
        cart.reemplazar(negocioId, negocioNombre, p, opciones, cantidad);
        alAgregar();
      },
    });
  };
}
