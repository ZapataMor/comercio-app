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
  disponible: boolean;
  categoria: Categoria | null;
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
