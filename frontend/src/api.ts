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
