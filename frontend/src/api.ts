import { API_URL } from './config';
import type { OpcionesLinea } from './opcionesProducto';

/** Rol de una persona DENTRO de un negocio (no es un rol global). */
export type RolNegocio = 'propietario' | 'trabajador';

export type PermisosNegocio = {
  modificar_inventario: boolean;
  gestionar_pedidos: boolean;
  cambiar_estado: boolean;
  administrador: boolean;
};

export function tienePermiso(negocio: Negocio | null | undefined, permiso: keyof PermisosNegocio): boolean {
  return !!negocio && (negocio.rol === 'propietario' || !!negocio.permisos?.administrador || !!negocio.permisos?.[permiso]);
}

export type Usuario = {
  id: number;
  /** Nombre(s). Los apellidos van aparte. */
  name: string;
  apellidos?: string | null;
  email: string;
  roles: string[];
  direccion?: string | null;
  barrio?: string | null;
  telefono?: string | null;
  /** Código que la persona comparte para que un negocio la invite (ej. "U34F4D"). */
  codigo_publico?: string | null;
  /** Negocios donde es miembro activo, con su rol en cada uno. */
  negocios?: { id: number; nombre: string; rol: RolNegocio }[];
  /** Domiciliario: si está en turno (le llegan los avisos de pedidos). */
  en_turno?: boolean;
};

/**
 * Nombre para mostrar de cada tipo de cuenta. Toda cuenta nueva es Cliente
 * (rol 'usuario'); el domiciliario es un cliente que además reparte.
 */
const TIPOS_CUENTA: Record<string, string> = {
  administrador: 'Administrador',
  usuario: 'Cliente',
  domiciliario: 'Domiciliario',
};

export function nombreTipoCuenta(rol: string): string {
  return TIPOS_CUENTA[rol] ?? rol;
}

/** Una página de una lista paginada del backend. */
/** `total`: cuántos hay en todas las páginas (solo en las listas que lo envían). */
export type Pagina<T> = { items: T[]; pagina: number; ultima_pagina: number; total?: number };

export type LoginResponse = {
  user: Usuario;
  token: string;
};

/**
 * Nivel de confiabilidad (0–100) de un negocio o un domiciliario. Sube cuando
 * cumple (a tiempo, completo, entrega el dinero) y baja cuando falla; por
 * debajo de 30, o con dos faltas graves, queda vetado.
 */
export type NivelReputacion = 'nuevo' | 'excelente' | 'confiable' | 'regular' | 'riesgo' | 'vetado';

export type Reputacion = {
  puntaje: number;
  nivel: NivelReputacion;
  nivel_label: string;
  /** Pedidos que ya cuentan para el puntaje. */
  pedidos: number;
  vetado: boolean;
  motivo_veto: string | null;
};

/** Algo que subió o bajó el puntaje (con su pedido y motivo). */
/** Estrellas de una tienda o un producto (`promedio` es null sin reseñas). */
export type ResumenResenas = {
  promedio: number | null;
  total: number;
  /** Cuántas reseñas hay de cada nota (solo en la lista de reseñas). */
  distribucion?: { estrellas: number; cantidad: number }[];
};

export type EventoReputacion = {
  id: number;
  motivo: string;
  descripcion: string;
  puntos: number;
  grave: boolean;
  origen: 'sistema' | 'cliente' | 'negocio' | 'admin';
  comentario: string | null;
  pedido_id: number | null;
  anulado: boolean;
  fecha: string;
};

export type Negocio = {
  permisos?: PermisosNegocio;
  id: number;
  nombre: string;
  descripcion: string | null;
  /** Tipo de negocio: Restaurante, Almacén de ropa, Farmacia, etc. */
  categoria: string | null;
  categorias: string[];
  direccion: string | null;
  /** Barrio de Maicao donde queda (null en negocios de antes de pedirlo). */
  barrio?: string | null;
  telefono: string | null;
  activo: boolean;
  estado_texto?: 'Abierto' | 'Cerrado' | 'Almorzando';
  imagen?: string | null; // ruta relativa "/storage/negocios/x.jpg"
  /** Minutos que el negocio promete tardar en tener listo un pedido. */
  tiempo_preparacion?: number;
  reputacion?: Reputacion;
  resenas?: ResumenResenas;
  /** Horario semanal: abre y cierra solo a esas horas. */
  horario?: HorarioSemana | null;
  /** "Hoy de 7:00 a. m. a 8:00 p. m." / "Hoy no abre" (null sin horario). */
  horario_hoy?: string | null;
  /** Lo que falta para que el horario lo cierre, solo si son 10 minutos o menos. */
  minutos_para_cerrar?: number | null;
  /** Hoy es festivo: rige el horario de festivos ('fes'). */
  festivo_hoy?: boolean;
  /** Mi rol en este negocio (solo en las rutas de "mis negocios"). */
  rol?: RolNegocio | null;
  /** Pin en el mapa (null = aún no lo ha fijado). */
  lat?: number | null;
  lng?: number | null;
};

/** Un punto del mapa. */
export type Coordenadas = { lat: number; lng: number };

/** Posición del domiciliario; `hace_segundos` = cuándo la reportó. */
export type UbicacionEnVivo = Coordenadas & { hace_segundos: number };

export type DiaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
/** Los 7 días y 'fes': el horario de los festivos, que esos días reemplaza al del día. */
export type ClaveHorario = DiaSemana | 'fes';
/** null = ese día no abre. Horas "HH:MM" (24 h); si cierra <= abre, cierra al día siguiente. */
export type FranjaHorario = { abre: string; cierra: string; almuerzo?: { inicio: string; fin: string } | null };
export type HorarioSemana = Record<ClaveHorario, FranjaHorario | null>;

/** "Calle 12 #8-30 · Centro": la dirección con el barrio, si lo tiene. */
export function direccionConBarrio(n: { direccion?: string | null; barrio?: string | null }): string {
  return [n.direccion, n.barrio].filter(Boolean).join(' · ');
}

export type Categoria = { id: number; nombre: string; productos?: number };
export type TipoNegocio = { id: number; nombre: string; slug: string };

/**
 * Tipo GLOBAL de producto (Comida, Medicamento, Herramienta...), pre-creado
 * por la app. Define la sección de atributos del formulario: la pregunta
 * (atributo_label), el texto del botón de añadir y las sugerencias.
 */
export type TipoProducto = {
  id: number;
  nombre: string;
  slug: string;
  atributo_label: string;
  atributo_boton: string;
  sugerencias: string[] | null;
  /** Solo los tipos que manejan colores (ropa y calzado). */
  sugerencias_colores?: string[] | null;
};

export type Producto = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  precio_token?: string;
  precio_vence_at?: string;
  tipo_venta?: string; // 'cantidad' | 'peso' | ...
  unidad_medida?: string; // 'unidad' | 'kg' | 'libra' | ...
  precio_formateado?: string; // ej. "$3.200 c/u" o "$8.900 / kg"
  imagen?: string | null; // ruta relativa "/storage/productos/x.jpg"
  disponible: boolean;
  resenas?: ResumenResenas;
  categoria: Categoria | null;
  /** Ingredientes, usos, tallas... según el tipo de producto. */
  atributos?: string[];
  /** Colores disponibles (ropa y calzado). */
  colores?: string[];
  /** Tipo global; null en productos creados antes de existir esta función. */
  tipo_producto?: { id: number; nombre: string; slug: string; atributo_label: string } | null;
};

/** Negocio tal como aparece en la lista de "Explorar". */
export type NegocioLista = {
  id: number;
  nombre: string;
  descripcion: string | null;
  /** Tipo de negocio: Restaurante, Almacén de ropa, Farmacia, etc. */
  categoria: string | null;
  categorias: string[];
  direccion: string | null;
  barrio?: string | null;
  imagen?: string | null;
  productos: number;
  servicios?: number;
  abierto: boolean;
  estado_texto?: string;
  /** "Hoy de 7:00 a. m. a 8:00 p. m." si el negocio tiene horario. */
  horario_hoy?: string | null;
  tiempo_preparacion?: number;
  reputacion?: Reputacion;
  resenas?: ResumenResenas;
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
export type ApiValidationErrors = Record<string, string[]>;

function validationErrors(data: any): ApiValidationErrors | undefined {
  if (!data?.errors || typeof data.errors !== 'object') return undefined;
  return data.errors as ApiValidationErrors;
}

function firstValidationMessage(errors?: ApiValidationErrors): string | undefined {
  if (!errors) return undefined;
  return (Object.values(errors)[0] as string[] | undefined)?.[0];
}

export class ApiError extends Error {
  status: number;
  errors?: ApiValidationErrors;
  /** Cuerpo de la respuesta, para los errores que traen datos (p. ej. el nuevo total). */
  data?: any;
  constructor(message: string, status: number, errors?: ApiValidationErrors, data?: any) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.data = data;
  }
}

/**
 * Aviso para AuthContext cuando el backend rechaza un token (401): esa sesión
 * ya no existe en el servidor (token revocado, base re-sembrada, otro backend…).
 * Recibe el token rechazado para no cerrar una sesión más nueva por una
 * petición vieja que llegó tarde.
 */
let onTokenRechazado: ((token: string) => void) | null = null;

export function alRechazarToken(cb: ((token: string) => void) | null) {
  onTokenRechazado = cb;
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
  } catch {
    // Falla de red: el server no responde / URL mal / sin conexión.
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo la API?');
  }

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    const errors = validationErrors(data);
    throw new ApiError(firstValidationMessage(errors) ?? data?.message ?? 'No se pudo iniciar sesión.', res.status, errors);
  }

  return data as LoginResponse;
}

/**
 * Registro de una cuenta nueva contra POST /api/register.
 * Modelo unificado: no se elige rol. Toda cuenta nace como cliente y luego
 * puede crear sus negocios (o unirse a otros) desde "Mis negocios".
 * Devuelve usuario + token, o lanza Error con el mensaje del backend.
 */
export async function register(body: {
  name: string;
  apellidos: string;
  email: string;
  password: string;
  direccion: string;
  barrio: string;
  telefono: string;
  // Autorización del tratamiento de datos (Ley 1581); el backend la exige.
  acepta_terminos: boolean;
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
  } catch {
    throw new Error('No se pudo conectar con el servidor. ¿Está corriendo la API?');
  }

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok) {
    // El backend puede devolver errores de validación en data.errors.
    const errors = validationErrors(data);
    throw new ApiError(firstValidationMessage(errors) ?? data?.message ?? 'No se pudo crear la cuenta.', res.status, errors);
  }

  return data as LoginResponse;
}

// ---------- Recuperar contraseña (sin sesión) ----------

/** POST público (sin token) con cuerpo JSON. Devuelve el `message` del backend. */
async function publicPost(path: string, body: any, porDefecto: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const errors = validationErrors(data);
    const mensaje = res.status === 429 ? 'Demasiados intentos. Espera un minuto.' : data?.message;
    throw new ApiError(firstValidationMessage(errors) ?? mensaje ?? porDefecto, res.status, errors);
  }
  return data?.message ?? '';
}

/** Envía al correo un código de 6 dígitos (la respuesta no dice si el correo existe). */
export function pedirCodigoClave(email: string): Promise<string> {
  return publicPost('/api/password/codigo', { email }, 'No se pudo enviar el código.');
}

/** Pone una contraseña nueva con el código recibido por correo. */
export function restablecerClave(email: string, codigo: string, password: string): Promise<string> {
  return publicPost(
    '/api/password/restablecer',
    { email, codigo, password, password_confirmation: password },
    'No se pudo cambiar la contraseña.',
  );
}

// ---------- Barrios (Maicao) ----------

export type Barrio = { id: number; nombre: string };

/**
 * Lista pública de barrios aprobados de Maicao (para el selector de barrio).
 * No requiere token: se usa en el registro, antes de iniciar sesión.
 */
export async function getBarrios(): Promise<Barrio[]> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/barrios`, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new ApiError(data?.message ?? 'No se pudo cargar la lista de barrios.', res.status);
  }
  return (data.barrios ?? []) as Barrio[];
}

/** GET autenticado con el token Sanctum. Lanza ApiError con el código HTTP. */
async function authGet(path: string, token: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    if (res.status === 401) onTokenRechazado?.(token);
    const errors = validationErrors(data);
    throw new ApiError(firstValidationMessage(errors) ?? data?.message ?? 'Error en la petición.', res.status, errors);
  }
  return data;
}

/** POST/PUT autenticado con cuerpo JSON. */
async function authSend(method: 'POST' | 'PUT' | 'DELETE', path: string, token: string, body?: any): Promise<any> {
  let res: Response;
  const abortador = path === '/api/pedidos' ? new AbortController() : null;
  const limite = abortador ? setTimeout(() => abortador.abort(), 15000) : null;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      ...(abortador ? { signal: abortador.signal } : {}),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  } finally {
    if (limite) clearTimeout(limite);
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    if (res.status === 401) onTokenRechazado?.(token);
    // Si hay errores de validación, mostramos el primero (más útil que el genérico).
    const errors = validationErrors(data);
    throw new ApiError(firstValidationMessage(errors) ?? data?.message ?? 'Error en la petición.', res.status, errors, data);
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
  imagenesUri?: string[],
): Promise<any> {
  const form = new FormData();
  if (metodo === 'PUT') {
    form.append('_method', 'PUT');
  }
  for (const [k, v] of Object.entries(campos)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach(item => form.append(`${k}[]`, String(item)));
    } else if (typeof v === 'boolean') form.append(k, v ? '1' : '0');
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

  for (const [indice, uri] of (imagenesUri ?? []).entries()) {
    form.append(`imagenes[${indice}]`, { uri, name: `trabajo-${indice}.jpg`, type: 'image/jpeg' } as any);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST', // siempre POST; el PUT real se simula con _method
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor.');
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    if (res.status === 401) onTokenRechazado?.(token);
    const errors = validationErrors(data);
    throw new ApiError(firstValidationMessage(errors) ?? data?.message ?? 'Error en la petición.', res.status, errors);
  }
  return data;
}

// ---------- Perfil personal (cualquier rol) ----------

/** Datos editables del perfil de la PERSONA (no del negocio). */
export type PerfilInput = {
  name: string;
  apellidos?: string | null;
  email: string;
  /** Si viene, se exige también `password_actual`. */
  password?: string;
  password_actual?: string;
  /** Datos de contacto: obligatorios para clientes, opcionales para el resto. */
  direccion?: string;
  barrio?: string;
  telefono?: string;
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

/**
 * El cliente se vuelve domiciliario (sigue siendo cliente). Falla con 422 si
 * su cuenta no tiene teléfono.
 */
export async function hacerseDomiciliario(token: string): Promise<{ message: string; user: Usuario }> {
  const d = await authSend('POST', '/api/perfil/domiciliario', token);
  return { message: d.message as string, user: d.user as Usuario };
}

/**
 * El domiciliario deja de repartir y queda solo como cliente. Falla con 409
 * si tiene entregas en curso.
 */
export async function dejarDeSerDomiciliario(token: string): Promise<{ message: string; user: Usuario }> {
  const d = await authSend('DELETE', '/api/perfil/domiciliario', token);
  return { message: d.message as string, user: d.user as Usuario };
}

/**
 * Elimina la cuenta (anonimiza los datos; exige la contraseña). Puede fallar
 * con 409 si hay pedidos o entregas en curso.
 */
export async function eliminarCuenta(token: string, password: string): Promise<void> {
  await authSend('DELETE', '/api/cuenta', token, { password });
}

// ---------- Cliente: ubicaciones ----------

export type ClienteDireccion = {
  id: number;
  direccion: string;
  barrio: string;
  es_principal: boolean;
};

export async function getClienteDirecciones(token: string): Promise<ClienteDireccion[]> {
  const d = await authGet('/api/cliente/direcciones', token);
  return (d.direcciones ?? []) as ClienteDireccion[];
}

export async function crearClienteDireccion(
  token: string,
  body: { direccion: string; barrio: string },
): Promise<ClienteDireccion> {
  const d = await authSend('POST', '/api/cliente/direcciones', token, body);
  return d.direccion as ClienteDireccion;
}

// ---------- Mis negocios (modelo unificado: propietario o trabajador) ----------
//
// Toda la gestión va contra /api/negocios/{negocioId}/...: una persona puede
// tener varios negocios y trabajar en otros. El backend autoriza por la
// membresía en ESE negocio, no por un rol global.

/** Negocios donde soy miembro activo (con mi rol) + mi código público. */
export async function getMisNegocios(
  token: string,
): Promise<{ negocios: Negocio[]; codigoPublico: string | null }> {
  const data = await authGet('/api/negocios/mios', token);
  return {
    negocios: (data.negocios ?? []) as Negocio[],
    codigoPublico: data.codigo_publico ?? null,
  };
}

/** Productos de un negocio mío. Sin opciones trae la primera página (15). */
export async function getProductos(
  token: string,
  negocioId: number,
  opts?: { porPagina?: number },
): Promise<Producto[]> {
  const qs = opts?.porPagina ? `?por_pagina=${opts.porPagina}` : '';
  const data = await authGet(`/api/negocios/${negocioId}/productos${qs}`, token);
  return (data.data ?? []) as Producto[];
}

// ---------- Crear / editar un negocio ----------

/** Datos editables del negocio. `categoria` es obligatoria al crear. */
export type NegocioInput = {
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  categorias?: string[];
  direccion?: string | null;
  barrio?: string;
  telefono?: string | null;
  activo?: boolean;
  tiempo_preparacion?: number;
  /** null = sin horario (solo el switch Abierto/Cerrado). */
  horario?: HorarioSemana | null;
  /** Pin en el mapa; null en ambos lo quita. */
  lat?: number | null;
  lng?: number | null;
};

/**
 * El horario viaja como texto JSON: el formulario con foto es multipart y ahí
 * no caben objetos anidados (el backend lo convierte de vuelta).
 */
function cuerpoNegocio(body: NegocioInput): Record<string, any> {
  const { horario, ...resto } = body;
  return horario === undefined ? resto : { ...resto, horario: JSON.stringify(horario) };
}

/** Crea un negocio nuevo (quedo como propietario). Con `imagenUri` sube la foto. */
export async function crearNegocio(
  token: string,
  body: NegocioInput,
  imagenUri?: string,
): Promise<Negocio> {
  const datos = cuerpoNegocio(body);
  const d = imagenUri
    ? await authUpload('POST', '/api/negocios', token, datos, imagenUri)
    : await authSend('POST', '/api/negocios', token, datos);
  return d.negocio as Negocio;
}

/** Actualiza un negocio (solo el propietario). Con `imagenUri` reemplaza la foto. */
export async function actualizarNegocio(
  token: string,
  negocioId: number,
  body: NegocioInput,
  imagenUri?: string,
): Promise<Negocio> {
  const datos = cuerpoNegocio(body);
  const d = imagenUri
    ? await authUpload('PUT', `/api/negocios/${negocioId}`, token, datos, imagenUri)
    : await authSend('PUT', `/api/negocios/${negocioId}`, token, datos);
  return d.negocio as Negocio;
}

/**
 * Abrir/cerrar el negocio rápidamente (switch de la topbar).
 * Reutiliza `activo`: cerrado = no visible para los clientes en Explorar.
 */
export async function cambiarEstadoNegocio(
  token: string,
  negocioId: number,
  activo: boolean,
): Promise<Negocio> {
  const d = await authSend('PUT', `/api/negocios/${negocioId}`, token, { activo });
  return d.negocio as Negocio;
}

// ---------- Catálogo del negocio: CRUD de productos ----------

/** Datos editables de un producto. */
export type ProductoInput = {
  nombre: string;
  descripcion?: string | null;
  /** En pesos colombianos, entero: sin puntos ni comas. */
  precio: number;
  tipo_venta?: string;
  unidad_medida?: string;
  disponible?: boolean;
  /** Tipo global (Comida, Medicamento...): obligatorio al crear. */
  tipo_producto_id?: number;
  /** Ingredientes, usos, tallas... `null` los borra (lista vacía). */
  atributos?: string[] | null;
  colores?: string[] | null;
};

/** Tipos globales de producto con su configuración de atributos. */
export async function getTiposProducto(token: string): Promise<TipoProducto[]> {
  const data = await authGet('/api/tipos-producto', token);
  return (data.tipos_producto ?? []) as TipoProducto[];
}

export async function crearProducto(
  token: string,
  negocioId: number,
  body: ProductoInput,
  imagenUri?: string,
): Promise<Producto> {
  const path = `/api/negocios/${negocioId}/productos`;
  const d = imagenUri
    ? await authUpload('POST', path, token, body, imagenUri)
    : await authSend('POST', path, token, body);
  return d.producto as Producto;
}

export async function actualizarProducto(
  token: string,
  negocioId: number,
  id: number,
  body: ProductoInput,
  imagenUri?: string,
): Promise<Producto> {
  const path = `/api/negocios/${negocioId}/productos/${id}`;
  const d = imagenUri
    ? await authUpload('PUT', path, token, body, imagenUri)
    : await authSend('PUT', path, token, body);
  return d.producto as Producto;
}

export async function eliminarProducto(token: string, negocioId: number, id: number): Promise<void> {
  await authSend('DELETE', `/api/negocios/${negocioId}/productos/${id}`, token);
}

/** Pedidos recibidos por un negocio mío. */
export type ComercioPedido = {
  faltante_motivo?: string | null;
  puede_confirmar_devolucion?: boolean;
  id: number;
  /** Lo que ven las personas; el id solo sirve para las rutas. */
  codigo: string;
  estado: string;
  estado_label: string;
  fecha?: string;
  /** Lo del negocio (productos); el domicilio es aparte. */
  subtotal?: number;
  costo_domicilio?: number;
  total: number;
  metodo_pago: string;
  direccion_entrega: string;
  telefono_contacto: string | null;
  cliente: string | null;
  domiciliario: string | null;
  /** Solo mientras el domiciliario lleva el pedido. */
  domiciliario_telefono?: string | null;
  domiciliario_reputacion?: Reputacion | null;
  cancelado_por?: CanceladoPor | null;
  motivo_cancelacion?: string | null;
  /** El comercio puede cancelar antes de marcar listo, con motivo escrito. */
  puede_cancelar?: boolean;
  /** Ya pasó el tiempo libre: cancelarlo le baja la confiabilidad al negocio. */
  cancelar_penaliza?: boolean;
  motivos_cancelacion?: string[];
  minutos_preparacion?: number | null;
  /** Dónde va el domiciliario mientras viene a recoger (estado "tomado"). */
  domiciliario_ubicacion?: UbicacionEnVivo | null;
  /** Justificación del domiciliario si se está demorando. */
  novedad?: string | null;
  /** Solo efectivo: lo que el negocio dijo del dinero. */
  dinero_estado?: DineroEstado | null;
  puede_confirmar_dinero?: boolean;
  items: PedidoItem[];
};

export type DineroEstado = 'recibido' | 'incompleto' | 'no_recibido';

/** Quién canceló un pedido; 'sistema': nadie del negocio respondió a tiempo. */
export type CanceladoPor = 'cliente' | 'negocio' | 'sistema' | 'administrador' | 'cliente_no_encontrado';

/** Qué pasó con un pedido cancelado, contado al equipo del negocio. */
export function textoCancelacion(p: { cancelado_por?: CanceladoPor | null; motivo_cancelacion?: string | null }): string {
  const quien = {
    cliente: 'El cliente lo canceló',
    sistema: 'Venció: nadie lo aceptó a tiempo',
    negocio: 'Lo cancelaron ustedes',
    administrador: 'Vitrina lo cerró',
    cliente_no_encontrado: 'El cliente no fue encontrado; el comercio recibió la devolución',
  }[p.cancelado_por ?? 'negocio'];
  return p.motivo_cancelacion ? `${quien}: ${p.motivo_cancelacion}` : `${quien}.`;
}

/** Pedido que nadie ha aceptado: de aquí sale la alarma con la app abierta. */
export type PedidoPorAceptar = {
  id: number;
  /** Lo que ven las personas; el id solo sirve para las rutas. */
  codigo: string;
  negocio_id: number;
  negocio: string | null;
  total: number;
  /** Lo que le queda antes de vencer. */
  segundos: number;
};

/** Cierre del horario automático que el dueño debe confirmar. */
export type CierrePorConfirmar = {
  id: number;
  nombre: string;
  /** "8:00 p. m." */
  cierra_texto: string;
  segundos: number;
};

export async function getCierresPorConfirmar(token: string): Promise<CierrePorConfirmar[]> {
  const d = await authGet('/api/negocios/mios/por-cerrar', token);
  return (d.cierres ?? []) as CierrePorConfirmar[];
}

/** `hora` null: sí cierra a la hora del horario. "21:30": cierra a esa, solo hoy. */
export async function confirmarCierre(token: string, negocioId: number, hora: string | null): Promise<void> {
  await authSend('PUT', `/api/negocios/mios/${negocioId}/cierre`, token, { hora });
}

/** Pedidos sin aceptar de todos mis negocios. */
export async function getPedidosPorAceptar(token: string): Promise<PedidoPorAceptar[]> {
  const d = await authGet('/api/negocios/mios/por-aceptar', token);
  return (d.pedidos ?? []) as PedidoPorAceptar[];
}

export async function getPedidosComercio(token: string, negocioId: number): Promise<ComercioPedido[]> {
  const d = await authGet(`/api/negocios/${negocioId}/pedidos`, token);
  return (d.pedidos ?? []) as ComercioPedido[];
}

/** Aceptar un pedido en espera: el negocio se compromete a prepararlo. */
export async function aceptarPedido(token: string, negocioId: number, id: number): Promise<void> {
  await authSend('PUT', `/api/negocios/${negocioId}/pedidos/${id}/aceptar`, token);
}

export async function marcarPedidoListo(token: string, negocioId: number, id: number): Promise<void> {
  await authSend('PUT', `/api/negocios/${negocioId}/pedidos/${id}/listo`, token);
}

/** Entregarle el pedido al domiciliario, con el código que él dicta. */
export async function confirmarRecogida(token: string, negocioId: number, id: number, codigo: string): Promise<void> {
  await authSend('PUT', `/api/negocios/${negocioId}/pedidos/${id}/recogido`, token, { codigo });
}

/** Pestañas del historial de pedidos del negocio. */
export type GrupoPedidos = 'en_espera' | 'en_curso' | 'entregados' | 'cancelados';

export type PedidosNegocioPagina = {
  pedidos: ComercioPedido[];
  pagina: number;
  ultima_pagina: number;
  total: number;
};

/** Historial paginado (20 por página) de un grupo de pedidos del negocio. */
export function getPedidosNegocio(
  token: string,
  negocioId: number,
  grupo: GrupoPedidos,
  pagina = 1,
): Promise<PedidosNegocioPagina> {
  return authGet(`/api/negocios/${negocioId}/pedidos?grupo=${grupo}&page=${pagina}`, token);
}

/** Un pedido del negocio (p. ej. al abrirlo desde una notificación). */
export function getPedidoNegocio(token: string, negocioId: number, id: number): Promise<ComercioPedido> {
  return authGet(`/api/negocios/${negocioId}/pedidos/${id}`, token);
}

/** Resumen de hoy: pedidos, entregados, cancelados y ventas (sin domicilios). */
export type ResumenNegocio = {
  pedidos: number;
  en_curso: number;
  entregados: number;
  cancelados: number;
  ventas: number;
};

export function getResumenNegocio(token: string, negocioId: number): Promise<ResumenNegocio> {
  return authGet(`/api/negocios/${negocioId}/pedidos/resumen`, token);
}

/** El comercio rechaza o cancela antes de marcar listo, con motivo obligatorio. */
export async function cancelarPedidoNegocio(token: string, negocioId: number, id: number, motivo?: string): Promise<void> {
  await authSend('PUT', `/api/negocios/${negocioId}/pedidos/${id}/cancelar`, token, { motivo: motivo || null });
}

/** Pedido en efectivo: ¿el domiciliario le entregó el dinero al negocio? */
export async function confirmarDinero(
  token: string,
  negocioId: number,
  id: number,
  estado: DineroEstado,
): Promise<string> {
  const d = await authSend('PUT', `/api/negocios/${negocioId}/pedidos/${id}/dinero`, token, { estado });
  return d.message as string;
}

export type ReputacionDetalle = {
  reputacion: Reputacion;
  eventos: EventoReputacion[];
  tiempo_preparacion?: number;
  /** Solo domiciliarios: promedio de caritas (null si nadie lo ha calificado). */
  caritas?: CaritasPromedio | null;
};

// ---------- Equipo del negocio (miembros e invitaciones enviadas) ----------

export type MiembroNegocio = {
  codigo_publico?: string | null;
  permisos: PermisosNegocio;
  id: number;
  name: string;
  rol: RolNegocio;
  activo: boolean;
  es_yo: boolean;
};

export type InvitacionEnviada = { id: number; nombre: string | null; fecha: string };

export async function getEquipo(
  token: string,
  negocioId: number,
): Promise<{ miembros: MiembroNegocio[]; pendientes: InvitacionEnviada[] }> {
  const d = await authGet(`/api/negocios/${negocioId}/miembros`, token);
  return {
    miembros: (d.miembros ?? []) as MiembroNegocio[],
    pendientes: (d.invitaciones_pendientes ?? []) as InvitacionEnviada[],
  };
}

/** Código público EXACTO → nombre de la persona (para confirmar antes de invitar). */
export async function resolverCodigo(
  token: string,
  negocioId: number,
  codigo: string,
): Promise<{ name: string; codigo_publico: string }> {
  const d = await authSend('POST', `/api/negocios/${negocioId}/resolver-codigo`, token, { codigo });
  return d.usuario;
}

/** Invita por código (solo propietario). Devuelve el mensaje del backend. */
export async function invitarTrabajador(token: string, negocioId: number, codigo: string, permisos: PermisosNegocio): Promise<string> {
  const d = await authSend('POST', `/api/negocios/${negocioId}/invitar`, token, { codigo, permisos });
  return d.message as string;
}

export async function cancelarInvitacion(token: string, negocioId: number, id: number): Promise<void> {
  await authSend('DELETE', `/api/negocios/${negocioId}/invitaciones/${id}`, token);
}

export async function quitarMiembro(token: string, negocioId: number, userId: number): Promise<void> {
  await authSend('DELETE', `/api/negocios/${negocioId}/miembros/${userId}`, token);
}

/** Un trabajador renuncia al negocio. */
export async function salirDelNegocio(token: string, negocioId: number): Promise<void> {
  await authSend('POST', `/api/negocios/${negocioId}/salir`, token);
}

// ---------- Invitaciones de trabajo recibidas ----------

export type InvitacionRecibida = {
  id: number;
  negocio: string | null;
  invitado_por: string | null;
  fecha: string;
};

export async function getInvitaciones(token: string): Promise<InvitacionRecibida[]> {
  const d = await authGet('/api/invitaciones', token);
  return (d.invitaciones ?? []) as InvitacionRecibida[];
}

/** Acepta: quedo como trabajador. Devuelve el id del negocio al que entré. */
export async function aceptarInvitacion(token: string, id: number): Promise<number> {
  const d = await authSend('PUT', `/api/invitaciones/${id}/aceptar`, token);
  return d.negocio.id as number;
}

export async function rechazarInvitacion(token: string, id: number): Promise<void> {
  await authSend('PUT', `/api/invitaciones/${id}/rechazar`, token);
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
  tipoNegocioId?: number | null,
  seccion?: 'productos' | 'servicios',
): Promise<NegociosPagina> {
  const params = new URLSearchParams();
  if (buscar && buscar.trim()) params.set('buscar', buscar.trim());
  if (pagina > 1) params.set('page', String(pagina));
  if (tipoNegocioId != null) params.set('tipo_negocio_id', String(tipoNegocioId));
  const q = params.toString() ? `?${params.toString()}` : '';
  const data = await authGet(`/api/negocios${q}${seccion ? `${q ? '&' : '?'}seccion=${seccion}` : ''}`, token);
  const negocios = (data.negocios ?? []) as NegocioLista[];
  return {
    negocios,
    pagina: data.meta?.pagina ?? 1,
    ultimaPagina: data.meta?.ultima_pagina ?? 1,
    total: data.meta?.total ?? negocios.length,
  };
}

/** Negocio como marcador del mapa. */
export type NegocioMapa = Coordenadas & {
  id: number;
  nombre: string;
  categoria: string | null;
  direccion: string | null;
  imagen?: string | null;
  abierto: boolean;
  estado_texto?: string;
  horario_hoy?: string | null;
};

/** Todos los negocios que ya fijaron su pin (para el mapa). */
export async function getNegociosMapa(token: string): Promise<NegocioMapa[]> {
  const d = await authGet('/api/negocios/mapa', token);
  return (d.negocios ?? []) as NegocioMapa[];
}

/** Producto de la búsqueda del cliente, con el negocio que lo vende. */
export type ProductoConNegocio = Producto & {
  negocio: { id: number; nombre: string; abierto: boolean; estado_texto?: string };
};

export async function getTiposNegocio(token: string, seccion?: 'productos' | 'servicios'): Promise<TipoNegocio[]> {
  const data = await authGet(`/api/tipos-negocio${seccion ? `?seccion=${seccion}` : ''}`, token);
  return (data.categorias ?? []) as TipoNegocio[];
}

/**
 * Búsqueda de productos para el cliente. Devuelve los productos disponibles de
 * negocios abiertos que coinciden con `buscar`, ordenados por relevancia (de la
 * coincidencia más cercana a la más lejana). Sin texto devuelve lista vacía.
 */
export async function buscarProductos(
  token: string,
  buscar: string,
  tipoNegocioId?: number | null,
  todos = false,
): Promise<ProductoConNegocio[]> {
  const texto = buscar.trim();
  if (!texto && tipoNegocioId == null && !todos) return [];
  const params = new URLSearchParams();
  if (texto) params.set('buscar', texto);
  if (todos) params.set('todos', '1');
  if (tipoNegocioId != null) params.set('tipo_negocio_id', String(tipoNegocioId));
  const data = await authGet(`/api/productos?${params.toString()}`, token);
  return (data.productos ?? []) as ProductoConNegocio[];
}

/** Catálogo de un negocio (negocio + productos disponibles). */
export async function getCatalogo(
  token: string,
  id: number,
): Promise<{ negocio: Negocio; productos: Producto[]; servicios: Servicio[] }> {
  const data = await authGet(`/api/negocios/${id}`, token);
  return { negocio: data.negocio as Negocio, productos: (data.productos ?? []) as Producto[], servicios: data.servicios ?? [] };
}

export type EstadoNegocio = Pick<Negocio, 'activo' | 'horario_hoy' | 'estado_texto'>;

/** Si la tienda sigue abierta, sin pedir todo el catálogo: es lo que se refresca seguido. */
export async function getEstadoNegocio(token: string, id: number): Promise<EstadoNegocio> {
  return (await authGet(`/api/negocios/${id}/estado`, token)) as EstadoNegocio;
}

/** Un plato que el cliente ya pidió varias veces con los mismos ajustes. */
export type RecetaPreferida = {
  producto: Producto;
  opciones: Pick<OpcionesLinea, 'sin' | 'extra'>;
  /** En cuántos pedidos entregados. */
  veces: number;
};

/** Recetas preferidas del cliente en esta tienda. */
export async function getRecetasPreferidas(token: string, negocioId: number): Promise<RecetaPreferida[]> {
  const data = await authGet(`/api/negocios/${negocioId}/recetas-preferidas`, token);
  return (data.recetas ?? []) as RecetaPreferida[];
}

// ---------- Admin ----------

export type AdminStats = {
  reportes_pendientes?: number;
  usuarios: number;
  negocios: number;
  negocios_activos: number;
  productos: number;
  pedidos_en_curso?: number;
  servicios?: number;
  domiciliarios_vetados?: number;
  negocios_vetados?: number;
  resenas_reportadas?: number;
};

export type AdminUsuario = {
  id: number;
  name: string;
  email: string;
  rol: string;
  /** Cuenta bloqueada por un admin (no puede iniciar sesión). */
  suspendido?: boolean;
  motivo_suspension?: string | null;
};

export type AdminUsuariosResp = {
  roles: string[];
  rol_actual: string;
  conteos: Record<string, number>;
  usuarios: AdminUsuario[];
  pagina: number;
  ultima_pagina: number;
};

export type AdminNegocio = {
  estado_texto?: string;
  id: number;
  nombre: string;
  dueno: string | null;
  productos: number;
  servicios?: number;
  activo: boolean;
  vetado?: boolean;
  /** Su único dueño eliminó la cuenta: ya no se ve en la app. */
  archivado?: boolean;
};

/** Domiciliario en el mapa del administrador. */
export type DomiciliarioMapa = {
  id: number;
  nombre: string;
  en_turno: boolean;
  /** Lleva un pedido en este momento. */
  en_entrega: boolean;
  ubicacion: UbicacionEnVivo;
};

export async function getDomiciliariosMapa(token: string): Promise<DomiciliarioMapa[]> {
  const d = await authGet('/api/admin/mapa/domiciliarios', token);
  return (d.domiciliarios ?? []) as DomiciliarioMapa[];
}

export function getAdminStats(token: string): Promise<AdminStats> {
  return authGet('/api/admin/stats', token);
}

/** Un pedido visto por el administrador (para destrabar los que se atascan). */
export type AdminPedido = {
  id: number;
  codigo: string;
  estado: string;
  estado_label: string;
  fecha: string;
  minutos_sin_cambios: number;
  total: number;
  metodo_pago: string;
  direccion_entrega: string;
  telefono_contacto: string | null;
  negocio: string | null;
  negocio_telefono: string | null;
  cliente: string | null;
  domiciliario: string | null;
  domiciliario_telefono: string | null;
  domiciliario_suspendido: boolean;
  novedad: string | null;
};

/** Pedidos en curso, los más antiguos primero (20 por página). */
export async function getAdminPedidos(token: string, pagina = 1): Promise<Pagina<AdminPedido>> {
  const d = await authGet(`/api/admin/pedidos?page=${pagina}`, token);
  return { items: d.pedidos ?? [], pagina: d.pagina, ultima_pagina: d.ultima_pagina, total: d.total };
}

/** Cierra a mano un pedido en curso; devuelve el mensaje del servidor. */
export async function cerrarPedidoAdmin(
  token: string,
  id: number,
  resultado: 'entregado' | 'cancelado',
  motivo: string,
): Promise<string> {
  const d = await authSend('PUT', `/api/admin/pedidos/${id}/cerrar`, token, { resultado, motivo });
  return d.message as string;
}

/** Usuarios de un rol, 30 por página, con búsqueda por nombre o correo. */
export function getAdminUsuarios(token: string, rol: string, buscar = '', pagina = 1): Promise<AdminUsuariosResp> {
  return authGet(`/api/admin/usuarios?rol=${rol}&buscar=${encodeURIComponent(buscar)}&page=${pagina}`, token);
}

/** Bloquear una cuenta (no puede iniciar sesión; sus sesiones se cierran). */
export async function suspenderUsuario(token: string, id: number, motivo: string): Promise<string> {
  const d = await authSend('PUT', `/api/admin/usuarios/${id}/suspender`, token, { motivo });
  return d.message as string;
}

export async function reactivarUsuario(token: string, id: number): Promise<string> {
  const d = await authSend('PUT', `/api/admin/usuarios/${id}/reactivar`, token);
  return d.message as string;
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

/** Todos los negocios, 30 por página, con búsqueda por nombre. */
export async function getAdminNegocios(token: string, buscar = '', pagina = 1): Promise<Pagina<AdminNegocio>> {
  const d = await authGet(`/api/admin/negocios?buscar=${encodeURIComponent(buscar)}&page=${pagina}`, token);
  return { items: (d.negocios ?? []) as AdminNegocio[], pagina: d.pagina ?? 1, ultima_pagina: d.ultima_pagina ?? 1 };
}

/** Barrio sugerido por un cliente, pendiente de que el admin lo apruebe. */
export type BarrioPendiente = {
  id: number;
  nombre: string;
  sugerido_por: string | null;
  fecha: string | null;
};

export async function getBarriosPendientes(token: string): Promise<BarrioPendiente[]> {
  const d = await authGet('/api/admin/barrios/pendientes', token);
  return (d.barrios ?? []) as BarrioPendiente[];
}

/** Aprueba un barrio sugerido: entra a la lista pública del selector. */
export async function aprobarBarrio(token: string, id: number): Promise<void> {
  await authSend('PUT', `/api/admin/barrios/${id}/aprobar`, token);
}

/** Rechaza (elimina) la sugerencia. El usuario conserva el texto que escribió. */
export async function rechazarBarrio(token: string, id: number): Promise<void> {
  await authSend('DELETE', `/api/admin/barrios/${id}`, token);
}

export type TipoReputacion = 'domiciliario' | 'negocio';

/** Domiciliario o negocio en la lista de reputación del admin. */
export type SujetoReputacion = {
  id: number;
  nombre: string;
  /** Email del domiciliario o dueño del negocio. */
  detalle: string | null;
  reputacion: Reputacion;
};

export type AdminReputacionResp = {
  tipo: TipoReputacion;
  sujetos: SujetoReputacion[];
  vetados: number;
  en_riesgo: number;
};

export type FiltroResenas = 'reportadas' | 'ocultas' | 'todas';

/** Una reseña tal como la revisa el admin. */
export type ResenaAdmin = {
  id: number;
  autor: string;
  estrellas: number;
  comentario: string | null;
  fecha: string;
  negocio: string | null;
  /** Null si la reseña es de la tienda. */
  producto: string | null;
  oculta: boolean;
  respuesta: string | null;
  /** Reportes sin atender, por motivo. */
  reportes: { motivo: string; cantidad: number }[];
  /** Lo que han hecho los admins, de lo más reciente a lo más antiguo. */
  historial: { accion: 'ocultar' | 'restaurar' | 'descartar'; motivo: string | null; admin: string | null; fecha: string }[];
};

export type PaginaResenasAdmin = {
  resenas: ResenaAdmin[];
  reportadas: number;
  ocultas: number;
  pagina: number;
  ultima_pagina: number;
};

export function getAdminResenas(token: string, filtro: FiltroResenas, pagina = 1): Promise<PaginaResenasAdmin> {
  return authGet(`/api/admin/resenas?filtro=${filtro}&page=${pagina}`, token);
}

/** Quita la reseña de lo público y del promedio. */
export async function ocultarResena(token: string, id: number, motivo: string): Promise<void> {
  await authSend('PUT', `/api/admin/resenas/${id}/ocultar`, token, { motivo });
}

export async function restaurarResena(token: string, id: number, motivo: string): Promise<void> {
  await authSend('PUT', `/api/admin/resenas/${id}/restaurar`, token, { motivo });
}

/** La reseña se queda publicada y sale de las reportadas. */
export async function descartarReportesResena(token: string, id: number): Promise<void> {
  await authSend('PUT', `/api/admin/resenas/${id}/descartar-reportes`, token);
}

/** Vetados primero, luego del peor al mejor puntaje. */
export function getAdminReputacion(token: string, tipo: TipoReputacion): Promise<AdminReputacionResp> {
  return authGet(`/api/admin/reputacion?tipo=${tipo}`, token);
}

export function getAdminReputacionDetalle(token: string, tipo: TipoReputacion, id: number): Promise<ReputacionDetalle> {
  return authGet(`/api/admin/reputacion/${tipo}/${id}`, token);
}

/** Anula un evento injusto (el puntaje se recalcula y puede levantar el veto). */
export async function anularEventoReputacion(token: string, eventoId: number): Promise<Reputacion> {
  const d = await authSend('PUT', `/api/admin/reputacion/eventos/${eventoId}/anular`, token);
  return d.reputacion as Reputacion;
}

/** Veto manual del admin (aunque el puntaje esté bien), con su motivo. */
export async function suspenderSujeto(
  token: string,
  tipo: TipoReputacion,
  id: number,
  motivo: string,
): Promise<Reputacion> {
  const d = await authSend('PUT', `/api/admin/reputacion/${tipo}/${id}/suspender`, token, { motivo });
  return d.reputacion as Reputacion;
}

/** Segunda oportunidad: quita el veto y deja el puntaje en "En riesgo". */
export async function levantarVeto(token: string, tipo: TipoReputacion, id: number): Promise<Reputacion> {
  const d = await authSend('PUT', `/api/admin/reputacion/${tipo}/${id}/levantar-veto`, token);
  return d.reputacion as Reputacion;
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

export type PedidoItem = {
  nombre: string;
  cantidad: number;
  /** Lo que eligió el cliente: "Talla M · Negro", "Sin lechuga · Extra queso". */
  detalle?: string | null;
};

export type Pedido = {
  llegada_at?: string | null;
  segundos_para_reportar_ausencia?: number | null;
  id: number;
  /** Lo que ven las personas; el id solo sirve para las rutas. */
  codigo: string;
  estado: string;
  estado_label: string;
  subtotal: number;
  costo_domicilio: number;
  total: number;
  /** Lo que se le cobra al cliente al entregar (0 si pagó por transferencia). */
  cobrar: number;
  metodo_pago: string;
  minutos_recogida: number | null;
  /** Lo dicto al negocio para que me entregue el pedido (solo si lo tomé y no lo he recogido). */
  codigo_recogida?: string | null;
  /** "dd/mm/aaaa hh:mm" en que lo entregué (solo los entregados). */
  fecha_entrega?: string | null;
  direccion_entrega: string;
  /** Solo cuando el pedido es mío y lo estoy llevando. */
  telefono_contacto: string | null;
  /** Justificación que reporté para una demora. */
  novedad?: string | null;
  negocio: {
    nombre: string;
    direccion: string | null;
    telefono?: string | null;
    /** Pin del negocio, para "Cómo llegar". */
    lat?: number | null;
    lng?: number | null;
  } | null;
  cliente: { name: string } | null;
  items: PedidoItem[];
};

/** `vetado`: mi cuenta está suspendida y no puedo tomar pedidos nuevos. */
export async function getDisponibles(
  token: string,
): Promise<{ pedidos: Pedido[]; vetado: boolean; en_turno: boolean; compartir_ubicacion: boolean }> {
  const d = await authGet('/api/domiciliario/disponibles', token);
  return {
    pedidos: (d.pedidos ?? []) as Pedido[],
    vetado: !!d.vetado,
    en_turno: !!d.en_turno,
    compartir_ubicacion: !!d.compartir_ubicacion,
  };
}

/** Entrar / salir de turno: solo en turno llegan los avisos de pedidos listos. */
export async function cambiarTurno(token: string, enTurno: boolean): Promise<string> {
  const d = await authSend('PUT', '/api/domiciliario/turno', token, { en_turno: enTurno });
  return d.message as string;
}

/**
 * Mi posición (GPS) para el mapa. Devuelve false si ya no debo compartirla
 * (fuera de turno y sin entregas).
 */
export async function enviarUbicacion(token: string, punto: Coordenadas): Promise<boolean> {
  const d = await authSend('PUT', '/api/domiciliario/ubicacion', token, punto);
  return !!d.compartir;
}

/** Mi nivel de confiabilidad como domiciliario y sus últimos eventos. */
export function getMiReputacion(token: string): Promise<ReputacionDetalle> {
  return authGet('/api/domiciliario/reputacion', token);
}

/** Justificar una demora (lluvia, tráfico...) de una entrega en curso. */
export async function reportarNovedad(token: string, id: number, novedad: string): Promise<void> {
  await authSend('PUT', `/api/domiciliario/pedidos/${id}/novedad`, token, { novedad });
}

export async function getMisEntregas(token: string): Promise<Pedido[]> {
  const d = await authGet('/api/domiciliario/entregas', token);
  return (d.pedidos ?? []) as Pedido[];
}

/** Mis entregas completadas (la más reciente primero), 20 por página. */
export async function getHistorialEntregas(token: string, pagina = 1): Promise<Pagina<Pedido>> {
  const d = await authGet(`/api/domiciliario/historial?page=${pagina}`, token);
  return {
    items: (d.pedidos ?? []) as Pedido[],
    pagina: d.pagina ?? 1,
    ultima_pagina: d.ultima_pagina ?? 1,
    total: d.total ?? 0,
  };
}

/** Tomar un pedido prometiendo recogerlo en `minutos` (1 a 20). */
export async function tomarPedido(token: string, id: number, minutos: number): Promise<void> {
  await authSend('PUT', `/api/domiciliario/pedidos/${id}/tomar`, token, { minutos_recogida: minutos });
}

/** Devolver un pedido tomado: solo antes de recogerlo. */
export async function soltarPedido(token: string, id: number): Promise<void> {
  await authSend('PUT', `/api/domiciliario/pedidos/${id}/soltar`, token);
}

export async function marcarEnCamino(token: string, id: number): Promise<void> {
  await authSend('PUT', `/api/domiciliario/pedidos/${id}/en-camino`, token);
}

/** Confirmar la entrega con el código que da el cliente. */
export async function confirmarEntrega(token: string, id: number, codigo: string): Promise<void> {
  await authSend('PUT', `/api/domiciliario/pedidos/${id}/entregado`, token, { codigo });
}

// ---------- Cliente: pedidos (carrito → confirmar → seguimiento) ----------

export type MiPedido = {
  id: number;
  /** Lo que ven las personas; el id solo sirve para las rutas. */
  codigo: string;
  estado: string;
  estado_label: string;
  total: number;
  negocio: string | null;
  fecha: string;
  cancelado_por?: CanceladoPor | null;
  /** Entregado y aún sin calificar (dentro del plazo). */
  por_calificar?: boolean;
  /** Entregado y sin ninguna reseña (dentro del plazo). */
  por_resenar?: boolean;
};

/** Problema que el cliente puede reportar al calificar. */
export type OpcionProblema = { clave: string; label: string };

/** Nota de 1 (carita muy brava) a 5 (muy feliz). */
export type NotaCarita = 1 | 2 | 3 | 4 | 5;

/** Lo que el cliente califica del domiciliario con caritas (amabilidad, rapidez...). */
export type AspectoCaritas = {
  clave: string;
  nombre: string;
  /** Pregunta corta debajo del nombre ("¿Cómo te trató?"). */
  ayuda: string;
  /** Texto de cada carita, de la 1 a la 5. */
  caritas: string[];
};

/** Una carita que el cliente ya dio. */
export type CaritaDada = { clave: string; nombre: string; nota: NotaCarita; texto: string };

export type CalificacionPedido = {
  negocio_ok: boolean;
  negocio_problemas: string[];
  domiciliario_ok: boolean | null;
  /** null en calificaciones de antes de las caritas. */
  domiciliario_caritas?: CaritaDada[] | null;
  domiciliario_problemas: string[];
  comentario: string | null;
};

/** Reseña pública de una tienda o un producto. */
export type ResenaPublica = {
  id: number;
  /** Nombre e inicial del apellido. */
  autor: string;
  estrellas: number;
  comentario: string | null;
  fecha: string;
  /** Lo que contestó el propietario de la tienda. */
  respuesta: RespuestaResena | null;
  /** La escribió quien la está viendo. */
  propia: boolean;
  /** Quien la está viendo ya la reportó. */
  reportada: boolean;
  /** Quien la está viendo es propietario y aún no ha respondido. */
  puede_responder: boolean;
};

export type RespuestaResena = { texto: string; fecha: string };

export type MotivoReporte = 'ofensiva' | 'falsa' | 'spam' | 'otro';

export type PaginaResenas = {
  resumen: ResumenResenas;
  items: ResenaPublica[];
  pagina: number;
  ultima_pagina: number;
};

/** Lo que el cliente opinó en su pedido (`estrellas` null: aún no lo reseña). */
export type OpinionPedido = { estrellas: number | null; comentario: string | null };

export type ResenaDeProducto = OpinionPedido & {
  producto_id: number;
  nombre: string;
  imagen: string | null;
};

export type ResenasPedido = {
  tienda: OpinionPedido | null;
  productos: ResenaDeProducto[];
  /** Último día para reseñar o corregir (dd/mm/aaaa). */
  hasta: string;
};

type NuevaOpinion = { estrellas: number; comentario: string | null };

export type NuevaResena = {
  tienda?: NuevaOpinion;
  productos?: (NuevaOpinion & { producto_id: number })[];
};

export type NuevaCalificacion = {
  negocio_ok: boolean;
  negocio_problemas?: string[];
  /** { amabilidad: 5, rapidez: 4, estado_producto: 5 }; no hace falta si nunca llegó. */
  domiciliario_caritas?: Record<string, NotaCarita>;
  /** Solo lo grave: nunca llegó, llegó abierto, cobró de más. */
  domiciliario_problemas?: string[];
  comentario?: string;
};

/** Promedio de caritas que los clientes le dan a un domiciliario. */
export type CaritasPromedio = {
  calificaciones: number;
  aspectos: { clave: string; nombre: string; promedio: number | null; votos: number }[];
};

export type SeguimientoPedido = {
  negocio_id?: number;
  faltante_motivo?: string | null;
  faltante_version?: string | null;
  cliente_no_encontrado_at?: string | null;
  id: number;
  /** Lo que ven las personas; el id solo sirve para las rutas. */
  codigo: string;
  estado: string;
  estado_label: string;
  estados: string[];
  estado_index: number;
  /** Productos + domicilio = total. */
  subtotal: number;
  costo_domicilio: number;
  total: number;
  metodo_pago: string;
  direccion_entrega: string;
  minutos_recogida: number | null;
  fecha?: string;
  negocio: string | null;
  negocio_telefono?: string | null;
  negocio_reputacion?: Reputacion | null;
  domiciliario: string | null;
  /** Solo mientras el domiciliario lleva el pedido. */
  domiciliario_telefono?: string | null;
  /** Se lo doy al domiciliario al recibir el pedido (solo mientras me lo llevan). */
  codigo_entrega?: string | null;
  cancelado_por?: CanceladoPor | null;
  motivo_cancelacion?: string | null;
  /** El domiciliario aún no sale en camino: el cliente puede cancelar. */
  puede_cancelar?: boolean;
  motivos_cancelacion?: string[];
  domiciliario_reputacion?: Reputacion | null;
  /** Dónde va el domiciliario (solo desde que recoge hasta que entrega). */
  domiciliario_ubicacion?: UbicacionEnVivo | null;
  negocio_ubicacion?: Coordenadas | null;
  /** Justificación del domiciliario si se está demorando. */
  novedad?: string | null;
  items: (PedidoItem & { precio: number; producto_id?: number | null; opciones?: OpcionesLinea })[];
  puede_calificar?: boolean;
  opciones_problemas?: { negocio: OpcionProblema[]; domiciliario: OpcionProblema[] } | null;
  aspectos_domiciliario?: AspectoCaritas[] | null;
  calificacion?: CalificacionPedido | null;
  puede_resenar?: boolean;
  resenas?: ResenasPedido | null;
};

export type NuevoPedido = {
  negocio_id: number;
  items: ({ producto_id: number; cantidad: number; precio_token?: string } & OpcionesLinea)[];
  metodo_pago: string;
  direccion_entrega: string;
  telefono_contacto: string;
  /** Identifica el intento: reintentar con la misma no crea otro pedido. */
  clave_intento?: string;
  /** Total que vio el cliente; si ya cambió, el servidor responde TotalCambio. */
  total_esperado?: number;
};

export async function crearPedido(token: string, body: NuevoPedido): Promise<number> {
  const d = await authSend('POST', '/api/pedidos', token, body);
  if (!Number.isSafeInteger(d.id) || d.id <= 0) throw new Error('No se pudo comprobar la recepción del pedido. Se volverá a consultar el mismo envío.');
  return d.id as number;
}

export async function sincronizarCarrito(token: string, items: { producto_id: number; precio_token: string }[], venceAt: number | null): Promise<void> {
  await authSend('PUT', '/api/carrito', token, { items, vence_at: venceAt == null ? null : Math.floor(venceAt / 1000) });
}

export type ObjetivoReporte = 'cliente' | 'negocio' | 'domiciliario';
export type ReportePedido = {
  id: number; pedido_id: number; codigo: string; objetivo: ObjetivoReporte; tipo: string;
  motivo: string; fecha: string; resuelto: boolean; resolucion: string | null; estado_pedido: string;
  cliente: string | null; cliente_id: number; negocio: string | null; negocio_id: number;
  domiciliario: string | null; domiciliario_id: number | null;
};
export async function reportarPedido(token: string, id: number, objetivo: ObjetivoReporte, motivo: string): Promise<void> {
  await authSend('POST', `/api/pedidos/${id}/reporte`, token, { objetivo, motivo });
}
export async function getReportesPedidos(token: string, pagina = 1, estado = 'pendientes'): Promise<Pagina<ReportePedido>> {
  const d = await authGet(`/api/admin/reportes?page=${pagina}&estado=${estado}`, token);
  return { items: d.reportes ?? [], pagina: d.pagina, ultima_pagina: d.ultima_pagina, total: d.total };
}
export async function resolverReportePedido(token: string, id: number, resolucion: string): Promise<void> {
  await authSend('PUT', `/api/admin/reportes/${id}/resolver`, token, { resolucion });
}
export async function registrarLlegada(token: string, id: number): Promise<void> {
  await authSend('PUT', `/api/domiciliario/pedidos/${id}/llegada`, token);
}
export async function clienteNoEncontrado(token: string, id: number): Promise<void> {
  await authSend('PUT', `/api/domiciliario/pedidos/${id}/cliente-no-encontrado`, token);
}
export async function confirmarDevolucion(token: string, negocioId: number, id: number): Promise<void> {
  await authSend('PUT', `/api/negocios/${negocioId}/pedidos/${id}/devolucion`, token);
}
export async function informarFaltante(token: string, negocioId: number, id: number, motivo: string): Promise<void> {
  await authSend('PUT', `/api/negocios/${negocioId}/pedidos/${id}/faltante`, token, { motivo });
}
export async function ajustarMiPedido(token: string, id: number, items: NuevoPedido['items'], total: number, version: string): Promise<void> {
  await authSend('PUT', `/api/pedidos/${id}/ajuste`, token, { items, total_esperado: total, faltante_version: version });
}
export async function reasignarCita(token: string, negocioId: number, id: number, profesionalId: number): Promise<Cita> {
  const d = await authSend('PUT', `/api/negocios/${negocioId}/citas/${id}/reasignar`, token, { profesional_id: profesionalId });
  return d.cita;
}
export async function eliminarNegocio(token: string, negocioId: number): Promise<void> {
  await authSend('DELETE', `/api/negocios/${negocioId}`, token);
}

/** Lo que responde el servidor cuando el total ya no es el que vio el cliente. */
export type TotalCambio = {
  total: number;
  costo_domicilio: number;
  precios: { producto_id: number; precio: number }[];
};

/** Si el error es "el total cambió", sus datos; si no, null. */
export function totalCambio(e: unknown): TotalCambio | null {
  return e instanceof ApiError && e.status === 409 && e.data?.codigo === 'total_cambio' ? (e.data as TotalCambio) : null;
}

/** Clave única de un intento de compra. */
export function nuevaClaveIntento(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Mis pedidos (más recientes primero), 20 por página. */
export async function getMisPedidos(token: string, pagina = 1): Promise<Pagina<MiPedido>> {
  const d = await authGet(`/api/pedidos?page=${pagina}`, token);
  return { items: (d.pedidos ?? []) as MiPedido[], pagina: d.pagina ?? 1, ultima_pagina: d.ultima_pagina ?? 1 };
}

export async function getPedido(token: string, id: number): Promise<SeguimientoPedido> {
  return authGet(`/api/pedidos/${id}`, token);
}

/** El cliente cancela antes de en camino; si ya fue recogido, requiere devolución. */
export async function cancelarMiPedido(token: string, id: number, motivo?: string): Promise<void> {
  await authSend('POST', `/api/pedidos/${id}/cancelar`, token, { motivo: motivo || null });
}

// ---------- Ajustes de la plataforma ----------

/** Tarifa de domicilio vigente (COP), para mostrar el total en el checkout. */
export async function getTarifaDomicilio(token: string): Promise<number> {
  const d = await authGet('/api/ajustes', token);
  const tarifa = Number(d.tarifa_domicilio);
  if (!['string', 'number'].includes(typeof d.tarifa_domicilio) || String(d.tarifa_domicilio).trim() === '' || !Number.isFinite(tarifa) || tarifa < 0) {
    throw new Error('No se pudo consultar una tarifa de domicilio válida.');
  }
  return tarifa;
}

/** Admin: cambiar la tarifa de domicilio (aplica a los pedidos nuevos). */
export async function actualizarTarifaDomicilio(token: string, tarifa: number): Promise<number> {
  const d = await authSend('PUT', '/api/admin/ajustes', token, { tarifa_domicilio: tarifa });
  return Number(d.tarifa_domicilio ?? tarifa);
}

/** Reseñas de una tienda o, con `productoId`, de uno de sus productos. */
export async function getResenas(
  token: string,
  negocioId: number,
  { productoId, pagina = 1 }: { productoId?: number; pagina?: number } = {},
): Promise<PaginaResenas> {
  const producto = productoId ? `&producto_id=${productoId}` : '';
  const d = await authGet(`/api/negocios/${negocioId}/resenas?page=${pagina}${producto}`, token);
  return { resumen: d.resumen, items: d.resenas, pagina: d.pagina, ultima_pagina: d.ultima_pagina };
}

/** Avisar al admin que una reseña no debería estar publicada. */
export async function reportarResena(token: string, id: number, motivo: MotivoReporte): Promise<string> {
  const d = await authSend('POST', `/api/resenas/${id}/reporte`, token, { motivo });
  return d.message as string;
}

/** El propietario responde una reseña; solo se puede una vez. */
export async function responderResena(token: string, id: number, respuesta: string): Promise<RespuestaResena> {
  const d = await authSend('POST', `/api/resenas/${id}/respuesta`, token, { respuesta });
  return d.respuesta as RespuestaResena;
}

/** Publicar o corregir las reseñas de un pedido entregado. */
export async function resenarPedido(token: string, id: number, body: NuevaResena): Promise<string> {
  const d = await authSend('POST', `/api/pedidos/${id}/resenas`, token, body);
  return d.message as string;
}

/** Calificar un pedido entregado: ¿el negocio y el domiciliario cumplieron? */
export async function calificarPedido(token: string, id: number, body: NuevaCalificacion): Promise<string> {
  const d = await authSend('POST', `/api/pedidos/${id}/calificacion`, token, body);
  return d.message as string;
}

export type Servicio = { id: number; nombre: string; descripcion: string; disponible?: boolean; duracion_minutos?: number; precio?: number | null; permite_citas?: boolean; galeria?: string[] | null };
export async function getServicios(token: string, negocioId: number): Promise<Servicio[]> {
  return (await authGet(`/api/negocios/${negocioId}/servicios`, token)).servicios;
}
export async function guardarServicio(token: string, negocioId: number, datos: Omit<Servicio, 'id'>, id?: number, nuevasImagenes?: string[]): Promise<Servicio> {
  const { galeria, ...campos } = datos;
  return (await authUpload(id ? 'PUT' : 'POST', `/api/negocios/${negocioId}/servicios${id ? `/${id}` : ''}`, token, { ...campos, conservar_imagenes: JSON.stringify(galeria ?? []) }, undefined, nuevasImagenes)).servicio;
}
export async function eliminarServicio(token: string, negocioId: number, id: number): Promise<void> {
  await authSend('DELETE', `/api/negocios/${negocioId}/servicios/${id}`, token);
}

export type Cita = {
  id: number; negocio_id: number; negocio_nombre: string; servicio_nombre: string;
  profesional_id: number | null; profesional_nombre: string; cliente_nombre: string; cliente_telefono: string | null;
  estado: 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada' | 'vencida' | 'completada' | 'no_asistio';
  origen: 'app' | 'presencial'; fecha: string; hora: string; hora_fin: string; fecha_fin: string;
  confirmar_antes_de: string | null; notas: string | null; motivo: string | null;
  llegada_at: string | null;
};
export type DisponibilidadCitas = { fecha: string; profesional_id: number; profesionales: { id: number; nombre: string }[]; horas: string[]; duracion_minutos: number; mensaje: string | null };
export type NuevaCita = { servicio_id: number; profesional_id: number; fecha: string; hora: string; notas?: string; cliente_nombre?: string; cliente_telefono?: string };
export type PaginaCitas = { citas: Cita[]; pagina: number; ultima_pagina: number };
export async function getDisponibilidadCitas(token: string, negocioId: number, servicioId: number, fecha: string, profesionalId?: number): Promise<DisponibilidadCitas> {
  return authGet(`/api/negocios/${negocioId}/disponibilidad?servicio_id=${servicioId}&fecha=${fecha}${profesionalId ? `&profesional_id=${profesionalId}` : ''}`, token);
}
export async function solicitarCita(token: string, negocioId: number, datos: NuevaCita, presencial = false): Promise<Cita> {
  return (await authSend('POST', `/api/negocios/${negocioId}/${presencial ? 'citas' : 'solicitudes-cita'}`, token, datos)).cita;
}
export async function getCitas(token: string, negocioId?: number, pagina = 1, fecha?: string): Promise<PaginaCitas> {
  return authGet(`${negocioId ? `/api/negocios/${negocioId}/citas` : '/api/citas'}?page=${pagina}${fecha ? `&fecha=${fecha}` : ''}`, token);
}
export async function actualizarCita(token: string, negocioId: number, id: number, estado: Cita['estado'], motivo?: string): Promise<Cita> {
  return (await authSend('PUT', `/api/negocios/${negocioId}/citas/${id}`, token, { estado, motivo })).cita;
}
export async function cancelarCita(token: string, id: number): Promise<Cita> {
  return (await authSend('POST', `/api/citas/${id}/cancelar`, token)).cita;
}
export async function registrarLlegadaCita(token: string, negocioId: number, id: number): Promise<Cita> {
  return (await authSend('POST', `/api/negocios/${negocioId}/citas/${id}/llegada`, token)).cita;
}

export async function actualizarPermisosMiembro(token: string, negocioId: number, userId: number, permisos: PermisosNegocio): Promise<void> {
  await authSend('PUT', `/api/negocios/${negocioId}/miembros/${userId}/permisos`, token, { permisos });
}
