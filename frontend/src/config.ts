// URL base de la API (backend Laravel), según cómo se compile la app.
//
// • Desarrollo (`npm run android`, Metro): API_URL_DESARROLLO.
//     - Emulador Android  -> 10.0.2.2 es el "localhost" de tu PC desde el emulador.
//     - Teléfono físico   -> usa la IP de tu PC en la red, p. ej. http://192.168.1.10:8000
//                            (mírala con `ipconfig`; el teléfono en la misma WiFi y el server
//                            con `php artisan serve --host=0.0.0.0`).
// • Versión final (release, la que va a Play Store): API_URL_PRODUCCION.
//     Debe ser HTTPS: Android bloquea http en release. Cámbiala por el dominio
//     real del servidor antes de compilar (ver DESPLIEGUE.md en la raíz del repo).
const API_URL_DESARROLLO = 'http://10.0.2.2:8000';
const API_URL_PRODUCCION = 'https://api.vitrina.example';

export const API_URL = __DEV__ ? API_URL_DESARROLLO : API_URL_PRODUCCION;

// Páginas públicas del servidor (política de privacidad, eliminar cuenta).
export const WEB_URL = API_URL;
