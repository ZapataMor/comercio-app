import { ApiError } from './api';

export type FieldErrors = Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
  name: 'nombre',
  nombre: 'nombre',
  email: 'correo',
  pin: 'clave',
  pin_actual: 'clave actual',
  confirmar: 'confirmación',
  direccion: 'dirección',
  barrio: 'barrio',
  categorias: 'categoría',
  categoria: 'categoría',
  descripcion: 'descripción',
  telefono: 'teléfono',
  precio: 'precio',
  imagen: 'imagen',
  rol: 'rol',
  direccion_entrega: 'ubicación de entrega',
  telefono_contacto: 'teléfono de contacto',
  metodo_pago: 'forma de pago',
};

function baseField(field: string) {
  return field.replace(/\.\d+(\.|$).*/, '').replace(/\..*/, '');
}

function simplify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function friendlyFieldMessage(field: string, message: string) {
  const key = baseField(field);
  const label = FIELD_LABELS[key] ?? key;
  const text = simplify(message);

  if (key === 'email' && (text.includes('registrad') || text.includes('taken') || text.includes('unique'))) {
    return 'Este correo ya está registrado. Usa otro correo o inicia sesión.';
  }
  if (text.includes('required') || text.includes('obligatorio') || text.includes('requerido')) {
    return `El campo ${label} es obligatorio.`;
  }
  if (key === 'email' && (text.includes('valid') || text.includes('correo'))) {
    return 'Escribe un correo válido, por ejemplo nombre@correo.com.';
  }
  if (text.includes('max')) {
    return `El campo ${label} es demasiado largo.`;
  }
  if (key === 'precio' && (text.includes('numeric') || text.includes('number') || text.includes('numero'))) {
    return 'Ingresa un precio válido.';
  }
  if (key === 'precio' && text.includes('min')) {
    return 'El precio no puede ser menor que 0.';
  }
  if (key === 'imagen') {
    return text.includes('image') || text.includes('imagen')
      ? 'Selecciona una imagen valida.'
      : 'La imagen no se pudo subir. Revisa el archivo.';
  }
  if (text.includes('unique') || text.includes('registrad')) {
    return `Ya existe un registro con este ${label}.`;
  }

  return message;
}

export function fieldErrorsFromError(error: unknown, aliases: Record<string, string> = {}): FieldErrors {
  if (!(error instanceof ApiError) || !error.errors) return {};

  return Object.entries(error.errors).reduce<FieldErrors>((acc, [field, messages]) => {
    const target = aliases[field] ?? aliases[baseField(field)] ?? baseField(field);
    if (!acc[target] && messages?.[0]) {
      acc[target] = friendlyFieldMessage(target, messages[0]);
    }
    return acc;
  }, {});
}

/** Lo que se dice cuando algo falló y no hay un mensaje claro para la persona. */
export const MENSAJE_FALLO = 'Algo salió mal. Intenta de nuevo en un momento.';

/**
 * El mensaje de un error, dicho para la persona: los del servidor que ya
 * vienen en español se muestran tal cual; los técnicos («Server Error»,
 * «Unauthenticated.», un TypeError del código...) se cambian por uno claro.
 */
export function messageFromError(error: unknown, fallback = MENSAJE_FALLO) {
  if (error instanceof ApiError) {
    const texto = (error.message ?? '').trim();
    if (error.status >= 500) return 'Tuvimos un problema de nuestro lado. Intenta de nuevo en un momento.';
    if (error.status === 401) return 'Tu sesión se cerró. Vuelve a entrar con tu celular y tu clave.';
    if (error.status === 403 && /unauthori[sz]ed|forbidden/i.test(texto)) return 'No tienes permiso para hacer esto.';
    if (error.status === 404 && (/not found|no query results/i.test(texto) || !texto)) {
      return 'No encontramos lo que buscabas. Puede que ya no exista.';
    }
    if (!texto || /^(error en la petición\.?|server error|unauthenticated\.?|too many attempts\.?)$/i.test(texto)) return fallback;
    return texto;
  }
  // Fallos del propio código: nunca se muestran tal cual.
  if (error instanceof TypeError || error instanceof SyntaxError || error instanceof ReferenceError || error instanceof RangeError) {
    return fallback;
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
