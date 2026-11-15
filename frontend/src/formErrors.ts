import { ApiError } from './api';

export type FieldErrors = Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
  name: 'nombre',
  nombre: 'nombre',
  email: 'correo',
  password: 'contraseña',
  password_actual: 'contraseña actual',
  confirmar: 'confirmación de contraseña',
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
  if (key === 'password' && (text.includes('min') || text.includes('8'))) {
    return 'La contraseña debe tener al menos 5 caracteres.';
  }
  if (key === 'password' && text.includes('confirm')) {
    return 'La contraseña y su confirmación deben ser iguales.';
  }
  if (key === 'password_actual') {
    return 'La contraseña actual no es correcta.';
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

export function messageFromError(error: unknown, fallback = 'Error inesperado.') {
  return error instanceof Error ? error.message : fallback;
}
