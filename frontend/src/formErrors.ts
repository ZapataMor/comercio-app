import { ApiError } from './api';

export type FieldErrors = Record<string, string>;

const FIELD_LABELS: Record<string, string> = {
  name: 'nombre',
  nombre: 'nombre',
  email: 'correo',
  password: 'contrasena',
  password_actual: 'contrasena actual',
  confirmar: 'confirmacion de contrasena',
  direccion: 'direccion',
  barrio: 'barrio',
  categorias: 'categoria',
  categoria: 'categoria',
  descripcion: 'descripcion',
  telefono: 'telefono',
  precio: 'precio',
  imagen: 'imagen',
  rol: 'rol',
  direccion_entrega: 'ubicacion de entrega',
  telefono_contacto: 'telefono de contacto',
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
    return 'Este correo ya esta registrado. Usa otro correo o inicia sesion.';
  }
  if (text.includes('required') || text.includes('obligatorio') || text.includes('requerido')) {
    return `El campo ${label} es obligatorio.`;
  }
  if (key === 'email' && (text.includes('valid') || text.includes('correo'))) {
    return 'Escribe un correo valido, por ejemplo nombre@correo.com.';
  }
  if (key === 'password' && (text.includes('min') || text.includes('8'))) {
    return 'La contrasena debe tener al menos 8 caracteres.';
  }
  if (key === 'password' && text.includes('confirm')) {
    return 'La contrasena y su confirmacion deben ser iguales.';
  }
  if (key === 'password_actual') {
    return 'La contrasena actual no es correcta.';
  }
  if (text.includes('max')) {
    return `El campo ${label} es demasiado largo.`;
  }
  if (key === 'precio' && (text.includes('numeric') || text.includes('number') || text.includes('numero'))) {
    return 'Ingresa un precio valido.';
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
