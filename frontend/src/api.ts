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
  /** Tipo de negocio: Restaurante, Almacén de ropa, Farmacia, etc. */
  categoria: string | null;
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
  imagen?: string | null; // ruta relativa "/storage/negocios/x.jpg"
};

export type Categoria = { id: number; nombre: string; productos?: number };

export type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  tipo_venta?: string; // 'cantidad' | 'peso' | ...
  unidad_medida?: string; // 'unidad' | 'kg' | 'libra' | ...
  precio_formateado?: string; // ej. "$3.200 c/u" o "$8.900 / kg"
  imagen?: string | null; // ruta relativa "/storage/productos/x.jpg"
  disponible: boolean;
  categoria: Categoria | null;
};

/** Negocio tal como aparece en la lista de "Explorar". */
export type NegocioLista = {
  id: number;
  nombre: string;
  descripcion: string | null;
  /** Tipo de negocio: Restaurante, Almacén de ropa, Farmacia, etc. */
  categoria: string | null;
  direccion: string | null;
  imagen?: string | null;
  productos: number;
  abierto: boolean;
};

/**
 * Convierte la ruta relativa de imagen del backend (ej "/storage/...") en una
 * URL completa usando la API_URL. Devuelve undefined si no hay imagen, para
 * poder usarla directo en `source={{ uri }}` (Image no pinta nada si es undefined).
 */
export function imagenUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  return `${API_URL}${path}`;
}

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

/** Roles que el público puede elegir al registrarse (NUNCA admin/domiciliario). */
export type RolPublico = 'usuario' | 'comerciante';

/**
 * Registro de una cuenta nueva contra POST /api/register.
 * Solo permite roles 'usuario' (cliente) o 'comerciante'.
 * Devuelve usuario + token, o lanza Error con el mensaje del backend.
 */
export async function register(body: {
  name: string;
  email: string;
  password: string;
  role: RolPublico;
}): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...body,
        // El backend exige confirmación de contraseña (regla 'confirmed').
        password_confirmation: body.password,
      }),
    });
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo la API?');
  }

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    // El backend puede devolver errores de validación en data.errors.
    const primero =
      data?.errors && typeof data.errors === 'object'
        ? (Object.values(data.errors)[0] as string[])?.[0]
        : undefined;
    throw new Error(primero ?? data?.message ?? 'No se pudo crear la cuenta.');
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
    // Si hay errores de validación, mostramos el primero (más útil que el genérico).
    const primero =
      data?.errors && typeof data.errors === 'object'
        ? (Object.values(data.errors)[0] as string[])?.[0]
        : undefined;
    throw new ApiError(primero ?? data?.message ?? 'Error en la petición.', res.status);
  }
  return data;
}

/**
 * Envío multipart/form-data autenticado, para subir archivos (imágenes).
 * Como PHP no parsea archivos en peticiones PUT reales, los "PUT" se simulan
 * con POST + campo `_method=PUT` (method spoofing de Laravel).
 * NO fijamos Content-Type: fetch pone el boundary correcto solo.
 */
async function authUpload(
  metodo: 'POST' | 'PUT',
  path: string,
  token: string,
  campos: Record<string, any>,
  imagenUri?: string,
): Promise<any> {
  const form = new FormData();
  if (metodo === 'PUT') {
    form.append('_method', 'PUT');
  }
  for (const [k, v] of Object.entries(campos)) {
    if (v === undefined) continue;
    if (typeof v === 'boolean') form.append(k, v ? '1' : '0');
    else if (v === null) form.append(k, ''); // '' -> null en el backend
    else form.append(k, String(v));
  }
  if (imagenUri) {
    const nombre = imagenUri.split('/').pop() || 'foto.jpg';
    const ext = (nombre.split('.').pop() || 'jpg').toLowerCase();
    const tipo = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    // En React Native el archivo se adjunta como {uri, name, type}.
    form.append('imagen', { uri: imagenUri, name: nombre, type: tipo } as any);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST', // siempre POST; el PUT real se simula con _method
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch (e) {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const primero =
      data?.errors && typeof data.errors === 'object'
        ? (Object.values(data.errors)[0] as string[])?.[0]
        : undefined;
    throw new ApiError(primero ?? data?.message ?? 'Error en la petición.', res.status);
  }
  return data;
}

// ---------- Perfil personal (cualquier rol) ----------

/** Datos editables del perfil de la PERSONA (no del negocio). */
export type PerfilInput = {
  name: string;
  email: string;
  /** Si viene, se exige también `password_actual`. */
  password?: string;
  password_actual?: string;
};

/** Actualiza mi perfil personal. Devuelve el usuario ya actualizado. */
export async function actualizarPerfil(token: string, body: PerfilInput): Promise<Usuario> {
  const d = await authSend('PUT', '/api/perfil', token, {
    ...body,
    // El backend exige confirmación (regla 'confirmed').
    ...(body.password ? { password_confirmation: body.password } : {}),
  });
  return d.user as Usuario;
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

/**
 * Mis productos. Sin opciones trae la primera página; con `categoriaId`
 * filtra por categoría y con `sinCategoria` los que no tienen categoría.
 */
export async function getProductos(
  token: string,
  opts?: { categoriaId?: number | null; sinCategoria?: boolean; porPagina?: number },
): Promise<Producto[]> {
  const partes: string[] = [];
  if (opts?.sinCategoria) {
    partes.push('sin_categoria=1');
  } else if (opts?.categoriaId != null) {
    partes.push(`categoria_id=${opts.categoriaId}`);
  }
  if (opts) {
    partes.push(`por_pagina=${opts.porPagina ?? 100}`);
  }
  const qs = partes.length ? `?${partes.join('&')}` : '';
  const data = await authGet(`/api/comerciante/productos${qs}`, token);
  return (data.data ?? []) as Producto[];
}

// ---------- Comerciante: crear / editar su negocio ----------

/** Datos editables del negocio. `categoria` es obligatoria al crear. */
export type NegocioInput = {
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  activo?: boolean;
};

/** Crea mi negocio (cuando aún no existe). Con `imagenUri` sube la foto. */
export async function crearNegocio(
  token: string,
  body: NegocioInput,
  imagenUri?: string,
): Promise<Negocio> {
  const d = imagenUri
    ? await authUpload('POST', '/api/comerciante/negocio', token, body, imagenUri)
    : await authSend('POST', '/api/comerciante/negocio', token, body);
  return d.negocio as Negocio;
}

/** Actualiza mi negocio. Con `imagenUri` reemplaza la foto. */
export async function actualizarNegocio(
  token: string,
  body: NegocioInput,
  imagenUri?: string,
): Promise<Negocio> {
  const d = imagenUri
    ? await authUpload('PUT', '/api/comerciante/negocio', token, body, imagenUri)
    : await authSend('PUT', '/api/comerciante/negocio', token, body);
  return d.negocio as Negocio;
}

/**
 * Abrir/cerrar el negocio rápidamente (switch de la topbar).
 * Reutiliza `activo`: cerrado = no visible para los clientes en Explorar.
 */
export async function cambiarEstadoNegocio(token: string, activo: boolean): Promise<Negocio> {
  const d = await authSend('PUT', '/api/comerciante/negocio', token, { activo });
  return d.negocio as Negocio;
}

// ---------- Comerciante: categorías ----------

export async function getCategoriasComerciante(token: string): Promise<Categoria[]> {
  const d = await authGet('/api/comerciante/categorias', token);
  return (d.data ?? []) as Categoria[];
}

export async function crearCategoria(token: string, nombre: string): Promise<Categoria> {
  const d = await authSend('POST', '/api/comerciante/categorias', token, { nombre });
  return d.categoria as Categoria;
}

export async function actualizarCategoria(token: string, id: number, nombre: string): Promise<void> {
  await authSend('PUT', `/api/comerciante/categorias/${id}`, token, { nombre });
}

export async function eliminarCategoria(token: string, id: number): Promise<void> {
  await authSend('DELETE', `/api/comerciante/categorias/${id}`, token);
}

// ---------- Comerciante: CRUD de productos ----------

/** Datos editables de un producto. */
export type ProductoInput = {
  nombre: string;
  descripcion?: string | null;
  precio: number;
  tipo_venta?: string;
  unidad_medida?: string;
  disponible?: boolean;
  categoria_id?: number | null;
};

export async function crearProducto(
  token: string,
  body: ProductoInput,
  imagenUri?: string,
): Promise<Producto> {
  const d = imagenUri
    ? await authUpload('POST', '/api/comerciante/productos', token, body, imagenUri)
    : await authSend('POST', '/api/comerciante/productos', token, body);
  return d.producto as Producto;
}

export async function actualizarProducto(
  token: string,
  id: number,
  body: ProductoInput,
  imagenUri?: string,
): Promise<Producto> {
  const d = imagenUri
    ? await authUpload('PUT', `/api/comerciante/productos/${id}`, token, body, imagenUri)
    : await authSend('PUT', `/api/comerciante/productos/${id}`, token, body);
  return d.producto as Producto;
}

export async function eliminarProducto(token: string, id: number): Promise<void> {
  await authSend('DELETE', `/api/comerciante/productos/${id}`, token);
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

/** Página del listado de negocios (50 por página). */
export type NegociosPagina = {
  negocios: NegocioLista[];
  pagina: number;
  ultimaPagina: number;
  total: number;
};

/**
 * Todos los negocios registrados (abiertos y cerrados), paginados de 50 en 50.
 * Si se pasa `buscar`, filtra por nombre/descr./productos.
 */
export async function getNegocios(
  token: string,
  buscar?: string,
  pagina = 1,
): Promise<NegociosPagina> {
  const params = new URLSearchParams();
  if (buscar && buscar.trim()) params.set('buscar', buscar.trim());
  if (pagina > 1) params.set('page', String(pagina));
  const q = params.toString() ? `?${params.toString()}` : '';
  const data = await authGet(`/api/negocios${q}`, token);
  const negocios = (data.negocios ?? []) as NegocioLista[];
  return {
    negocios,
    pagina: data.meta?.pagina ?? 1,
    ultimaPagina: data.meta?.ultima_pagina ?? 1,
    total: data.meta?.total ?? negocios.length,
  };
}

/** Producto de la búsqueda del cliente, con el negocio que lo vende. */
export type ProductoConNegocio = Producto & {
  negocio: { id: number; nombre: string };
};

/**
 * Búsqueda de productos para el cliente. Devuelve los productos disponibles de
 * negocios abiertos que coinciden con `buscar`, ordenados por relevancia (de la
 * coincidencia más cercana a la más lejana). Sin texto devuelve lista vacía.
 */
export async function buscarProductos(token: string, buscar: string): Promise<ProductoConNegocio[]> {
  const texto = buscar.trim();
  if (!texto) return [];
  const data = await authGet(`/api/productos?buscar=${encodeURIComponent(texto)}`, token);
  return (data.productos ?? []) as ProductoConNegocio[];
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

// ---------- Push notifications ----------

export async function registrarDeviceToken(token: string, fcmToken: string): Promise<void> {
  await authSend('POST', '/api/device-tokens', token, {
    token: fcmToken,
    plataforma: 'android',
  });
}

export async function eliminarDeviceToken(token: string, fcmToken: string): Promise<void> {
  await authSend('DELETE', '/api/device-tokens', token, { token: fcmToken });
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
