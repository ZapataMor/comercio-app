import { API_URL } from './config';

export type Usuario = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

export type LoginResponse = {
  user: Usuario;
  token: string;
};

export type Negocio = {
  id: number;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
};

export type Categoria = { id: number; nombre: string };

export type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  precio_formateado?: string; // ej. "$3.200 c/u" o "$8.900 / kg"
  disponible: boolean;
  categoria: Categoria | null;
};

/** Negocio tal como aparece en la lista de "Explorar". */
export type NegocioLista = {
  id: number;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  productos: number;
};

/** Error de API que conserva el código HTTP (para distinguir 404, 422, etc.). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Inicia sesión contra POST /api/login del backend Laravel (Sanctum).
 * Devuelve el usuario + token, o lanza un Error con el mensaje del backend.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch (e) {
    // Falla de red: el server no responde / URL mal / sin conexión.
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo la API?');
  }

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    throw new Error(data?.message ?? 'No se pudo iniciar sesión.');
  }

  return data as LoginResponse;
}

/** GET autenticado con el token Sanctum. Lanza ApiError con el código HTTP. */
async function authGet(path: string, token: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new ApiError(data?.message ?? 'Error en la petición.', res.status);
  }
  return data;
}

/** POST/PUT autenticado con cuerpo JSON. */
async function authSend(method: 'POST' | 'PUT' | 'DELETE', path: string, token: string, body?: any): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new ApiError(data?.message ?? 'Error en la petición.', res.status);
  }
  return data;
}

/** Mi negocio (o null si el comerciante aún no lo creó → 404). */
export async function getNegocio(token: string): Promise<Negocio | null> {
  try {
    const data = await authGet('/api/comerciante/negocio', token);
    return data.negocio as Negocio;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return null;
    }
    throw e;
  }
}

/** Mis productos (primera página del catálogo). */
export async function getProductos(token: string): Promise<Producto[]> {
  const data = await authGet('/api/comerciante/productos', token);
  return (data.data ?? []) as Producto[];
}

/** Pedidos recibidos por mi negocio (comerciante). */
export type ComercioPedido = {
  id: number;
  estado: string;
  estado_label: string;
  total: number;
  metodo_pago: string;
  direccion_entrega: string;
  telefono_contacto: string | null;
  cliente: string | null;
  domiciliario: string | null;
  items: { nombre: string; cantidad: number }[];
};

export async function getPedidosComercio(token: string): Promise<ComercioPedido[]> {
  const d = await authGet('/api/comerciante/pedidos', token);
  return (d.pedidos ?? []) as ComercioPedido[];
}

export async function marcarPedidoListo(token: string, id: number): Promise<void> {
  await authSend('PUT', `/api/comerciante/pedidos/${id}/listo`, token);
}

// ---------- Cliente: explorar negocios y ver catálogo ----------

/** Negocios abiertos. */
export async function getNegocios(token: string): Promise<NegocioLista[]> {
  const data = await authGet('/api/negocios', token);
  return (data.negocios ?? []) as NegocioLista[];
}

/** Catálogo de un negocio (negocio + productos disponibles). */
export async function getCatalogo(
  token: string,
  id: number,
): Promise<{ negocio: Negocio; productos: Producto[] }> {
  const data = await authGet(`/api/negocios/${id}`, token);
  return { negocio: data.negocio as Negocio, productos: (data.productos ?? []) as Producto[] };
}

// ---------- Admin ----------

export type AdminStats = {
  usuarios: number;
  negocios: number;
  negocios_activos: number;
  productos: number;
};

export type AdminUsuario = { id: number; name: string; email: string; rol: string };

export type AdminUsuariosResp = {
  roles: string[];
  rol_actual: string;
  conteos: Record<string, number>;
  usuarios: AdminUsuario[];
};

export type AdminNegocio = {
  id: number;
  nombre: string;
  dueno: string | null;
  productos: number;
  activo: boolean;
};

export function getAdminStats(token: string): Promise<AdminStats> {
  return authGet('/api/admin/stats', token);
}

export function getAdminUsuarios(token: string, rol: string): Promise<AdminUsuariosResp> {
  return authGet(`/api/admin/usuarios?rol=${rol}`, token);
}

export async function crearUsuario(
  token: string,
  body: { name: string; email: string; password: string; rol: string },
): Promise<void> {
  await authSend('POST', '/api/admin/usuarios', token, body);
}

export async function cambiarRol(token: string, id: number, rol: string): Promise<void> {
  await authSend('PUT', `/api/admin/usuarios/${id}/rol`, token, { rol });
}

export async function getAdminNegocios(token: string): Promise<AdminNegocio[]> {
  const data = await authGet('/api/admin/negocios', token);
  return (data.negocios ?? []) as AdminNegocio[];
}

// ---------- Domiciliario (pedidos) ----------

export type PedidoItem = { nombre: string; cantidad: number };

export type Pedido = {
  id: number;
  estado: string;
  estado_label: string;
  total: number;
  metodo_pago: string;
  minutos_recogida: number | null;
  direccion_entrega: string;
  telefono_contacto: string | null;
  negocio: { nombre: string; direccion: string | null } | null;
  cliente: { name: string } | null;
  items: PedidoItem[];
};

export async function getDisponibles(token: string): Promise<Pedido[]> {
  const d = await authGet('/api/domiciliario/disponibles', token);
  return (d.pedidos ?? []) as Pedido[];
}

export async function getMisEntregas(token: string): Promise<Pedido[]> {
  const d = await authGet('/api/domiciliario/entregas', token);
  return (d.pedidos ?? []) as Pedido[];
}

export async function getHistorialEntregas(token: string): Promise<Pedido[]> {
  const d = await authGet('/api/domiciliario/historial', token);
  return (d.pedidos ?? []) as Pedido[];
}

export async function tomarPedido(token: string, id: number, minutos: number): Promise<void> {
  await authSend('PUT', `/api/domiciliario/pedidos/${id}/tomar`, token, { minutos_recogida: minutos });
}

/** accion: 'recogido' | 'en-camino' | 'entregado' */
export async function avanzarPedido(token: string, id: number, accion: string): Promise<void> {
  await authSend('PUT', `/api/domiciliario/pedidos/${id}/${accion}`, token);
}

// ---------- Cliente: pedidos (carrito → confirmar → seguimiento) ----------

export type MiPedido = {
  id: number;
  estado: string;
  estado_label: string;
  total: number;
  negocio: string | null;
  fecha: string;
};

export type SeguimientoPedido = {
  id: number;
  estado: string;
  estado_label: string;
  estados: string[];
  estado_index: number;
  total: number;
  metodo_pago: string;
  direccion_entrega: string;
  minutos_recogida: number | null;
  negocio: string | null;
  domiciliario: string | null;
  items: { nombre: string; cantidad: number; precio: number }[];
};

export type NuevoPedido = {
  negocio_id: number;
  items: { producto_id: number; cantidad: number }[];
  metodo_pago: string;
  direccion_entrega: string;
  telefono_contacto: string;
};

export async function crearPedido(token: string, body: NuevoPedido): Promise<number> {
  const d = await authSend('POST', '/api/pedidos', token, body);
  return d.id as number;
}

export async function getMisPedidos(token: string): Promise<MiPedido[]> {
  const d = await authGet('/api/pedidos', token);
  return (d.pedidos ?? []) as MiPedido[];
}

export async function getPedido(token: string, id: number): Promise<SeguimientoPedido> {
  return authGet(`/api/pedidos/${id}`, token);
}
