import { API_URL } from './config';

/** Rol de una persona DENTRO de un negocio (no es un rol global). */
export type RolNegocio = 'propietario' | 'trabajador';

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
};

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
  id: number;
  nombre: string;
  descripcion: string | null;
  /** Tipo de negocio: Restaurante, Almacén de ropa, Farmacia, etc. */
  categoria: string | null;
  categorias: string[];
  direccion: string | null;
  telefono: string | null;
  activo: boolean;
  imagen?: string | null; // ruta relativa "/storage/negocios/x.jpg"
  /** Minutos que el negocio promete tardar en tener listo un pedido. */
  tiempo_preparacion?: number;
  reputacion?: Reputacion;
  /** Mi rol en este negocio (solo en las rutas de "mis negocios"). */
  rol?: RolNegocio | null;
};

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
};

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
  /** Ingredientes, usos, tallas... según el tipo de producto. */
  atributos?: string[];
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
  imagen?: string | null;
  productos: number;
  abierto: boolean;
  tiempo_preparacion?: number;
  reputacion?: Reputacion;
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
  constructor(message: string, status: number, errors?: ApiValidationErrors) {
    super(message);
    this.status = status;
    this.errors = errors;
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
  } catch (e) {
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
    if (res.status === 401) onTokenRechazado?.(token);
    // Si hay errores de validación, mostramos el primero (más útil que el genérico).
    const errors = validationErrors(data);
    throw new ApiError(firstValidationMessage(errors) ?? data?.message ?? 'Error en la petición.', res.status, errors);
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
  telefono?: string | null;
  activo?: boolean;
  tiempo_preparacion?: number;
};

/** Crea un negocio nuevo (quedo como propietario). Con `imagenUri` sube la foto. */
export async function crearNegocio(
  token: string,
  body: NegocioInput,
  imagenUri?: string,
): Promise<Negocio> {
  const d = imagenUri
    ? await authUpload('POST', '/api/negocios', token, body, imagenUri)
    : await authSend('POST', '/api/negocios', token, body);
  return d.negocio as Negocio;
}

/** Actualiza un negocio (solo el propietario). Con `imagenUri` reemplaza la foto. */
export async function actualizarNegocio(
  token: string,
  negocioId: number,
  body: NegocioInput,
  imagenUri?: string,
): Promise<Negocio> {
  const d = imagenUri
    ? await authUpload('PUT', `/api/negocios/${negocioId}`, token, body, imagenUri)
    : await authSend('PUT', `/api/negocios/${negocioId}`, token, body);
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
  id: number;
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
  cancelado_por?: 'cliente' | 'negocio' | null;
  motivo_cancelacion?: string | null;
  /** Se puede rechazar (pendiente) o cancelar (listo sin domiciliario). */
  puede_cancelar?: boolean;
  motivos_cancelacion?: string[];
  minutos_preparacion?: number | null;
  /** Justificación del domiciliario si se está demorando. */
  novedad?: string | null;
  /** Solo efectivo: lo que el negocio dijo del dinero. */
  dinero_estado?: DineroEstado | null;
  puede_confirmar_dinero?: boolean;
  items: { nombre: string; cantidad: number }[];
};

export type DineroEstado = 'recibido' | 'incompleto' | 'no_recibido';

export async function getPedidosComercio(token: string, negocioId: number): Promise<ComercioPedido[]> {
  const d = await authGet(`/api/negocios/${negocioId}/pedidos`, token);
  return (d.pedidos ?? []) as ComercioPedido[];
}

export async function marcarPedidoListo(token: string, negocioId: number, id: number): Promise<void> {
  await authSend('PUT', `/api/negocios/${negocioId}/pedidos/${id}/listo`, token);
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

/** Rechazar (pendiente) o cancelar (listo sin domiciliario) un pedido. */
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
};

/** Nivel de confiabilidad de un negocio mío y sus últimos eventos. */
export function getReputacionNegocio(token: string, negocioId: number): Promise<ReputacionDetalle> {
  return authGet(`/api/negocios/${negocioId}/reputacion`, token);
}

// ---------- Equipo del negocio (miembros e invitaciones enviadas) ----------

export type MiembroNegocio = {
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
export async function invitarTrabajador(token: string, negocioId: number, codigo: string): Promise<string> {
  const d = await authSend('POST', `/api/negocios/${negocioId}/invitar`, token, { codigo });
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
): Promise<NegociosPagina> {
  const params = new URLSearchParams();
  if (buscar && buscar.trim()) params.set('buscar', buscar.trim());
  if (pagina > 1) params.set('page', String(pagina));
  if (tipoNegocioId != null) params.set('tipo_negocio_id', String(tipoNegocioId));
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
  negocio: { id: number; nombre: string; abierto: boolean };
};

export async function getTiposNegocio(token: string): Promise<TipoNegocio[]> {
  const data = await authGet('/api/tipos-negocio', token);
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
): Promise<ProductoConNegocio[]> {
  const texto = buscar.trim();
  if (!texto && tipoNegocioId == null) return [];
  const params = new URLSearchParams();
  if (texto) params.set('buscar', texto);
  if (tipoNegocioId != null) params.set('tipo_negocio_id', String(tipoNegocioId));
  const data = await authGet(`/api/productos?${params.toString()}`, token);
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
  domiciliarios_vetados?: number;
  negocios_vetados?: number;
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

export type PedidoItem = { nombre: string; cantidad: number };

export type Pedido = {
  id: number;
  estado: string;
  estado_label: string;
  subtotal: number;
  costo_domicilio: number;
  total: number;
  /** Lo que se le cobra al cliente al entregar (0 si pagó por transferencia). */
  cobrar: number;
  metodo_pago: string;
  minutos_recogida: number | null;
  direccion_entrega: string;
  /** Solo cuando el pedido es mío y lo estoy llevando. */
  telefono_contacto: string | null;
  /** Justificación que reporté para una demora. */
  novedad?: string | null;
  negocio: { nombre: string; direccion: string | null; telefono?: string | null } | null;
  cliente: { name: string } | null;
  items: PedidoItem[];
};

/** `vetado`: mi cuenta está suspendida y no puedo tomar pedidos nuevos. */
export async function getDisponibles(token: string): Promise<{ pedidos: Pedido[]; vetado: boolean }> {
  const d = await authGet('/api/domiciliario/disponibles', token);
  return { pedidos: (d.pedidos ?? []) as Pedido[], vetado: !!d.vetado };
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
  cancelado_por?: 'cliente' | 'negocio' | null;
  /** Entregado y aún sin calificar (dentro del plazo). */
  por_calificar?: boolean;
};

/** Problema que el cliente puede reportar al calificar. */
export type OpcionProblema = { clave: string; label: string };

export type CalificacionPedido = {
  negocio_ok: boolean;
  negocio_problemas: string[];
  domiciliario_ok: boolean | null;
  domiciliario_problemas: string[];
  comentario: string | null;
};

export type NuevaCalificacion = {
  negocio_ok: boolean;
  negocio_problemas?: string[];
  domiciliario_ok?: boolean;
  domiciliario_problemas?: string[];
  comentario?: string;
};

export type SeguimientoPedido = {
  id: number;
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
  cancelado_por?: 'cliente' | 'negocio' | null;
  motivo_cancelacion?: string | null;
  /** El negocio aún no lo tiene listo: el cliente puede cancelarlo. */
  puede_cancelar?: boolean;
  motivos_cancelacion?: string[];
  domiciliario_reputacion?: Reputacion | null;
  /** Justificación del domiciliario si se está demorando. */
  novedad?: string | null;
  items: { nombre: string; cantidad: number; precio: number }[];
  puede_calificar?: boolean;
  opciones_problemas?: { negocio: OpcionProblema[]; domiciliario: OpcionProblema[] } | null;
  calificacion?: CalificacionPedido | null;
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

/** El cliente cancela su pedido (solo mientras el negocio no lo tenga listo). */
export async function cancelarMiPedido(token: string, id: number, motivo?: string): Promise<void> {
  await authSend('POST', `/api/pedidos/${id}/cancelar`, token, { motivo: motivo || null });
}

// ---------- Ajustes de la plataforma ----------

/** Tarifa de domicilio vigente (COP), para mostrar el total en el checkout. */
export async function getTarifaDomicilio(token: string): Promise<number> {
  const d = await authGet('/api/ajustes', token);
  return Number(d.tarifa_domicilio ?? 0);
}

/** Admin: cambiar la tarifa de domicilio (aplica a los pedidos nuevos). */
export async function actualizarTarifaDomicilio(token: string, tarifa: number): Promise<number> {
  const d = await authSend('PUT', '/api/admin/ajustes', token, { tarifa_domicilio: tarifa });
  return Number(d.tarifa_domicilio ?? tarifa);
}

/** Calificar un pedido entregado: ¿el negocio y el domiciliario cumplieron? */
export async function calificarPedido(token: string, id: number, body: NuevaCalificacion): Promise<string> {
  const d = await authSend('POST', `/api/pedidos/${id}/calificacion`, token, body);
  return d.message as string;
}
