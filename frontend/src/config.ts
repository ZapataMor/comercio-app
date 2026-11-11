// URL base de la API (backend Laravel), según cómo se compile la app.
//
// • Desarrollo (`npm run android`, Metro): API_URL_DESARROLLO.
//     - Emulador Android  -> localhost mediante adb reverse tcp:8000 tcp:8000
//                            (lo configura iniciar-emulador.bat).
//     - Teléfono físico   -> usa la IP de tu PC en la red, p. ej. http://192.168.1.10:8000
//                            (mírala con `ipconfig`; el teléfono en la misma WiFi y el server
//                            con `php artisan serve --host=0.0.0.0`).
// • Versión final (release, la que va a Play Store): API_URL_PRODUCCION.
//     Debe ser HTTPS: Android bloquea http en release. Cámbiala por el dominio
//     real del servidor antes de compilar (ver DESPLIEGUE.md en la raíz del repo).
import { NativeModules } from 'react-native';

const API_URL_DESARROLLO = 'http://localhost:8000';
const API_URL_PRODUCCION = 'https://api.vitrina.example';

// La variante Android staging lleva su propia URL y CA local. Release conserva
// exclusivamente la URL de produccion y las autoridades del sistema.
const stagingUrl: string | undefined = NativeModules.EnvironmentConfig?.apiUrl;
export const API_URL = stagingUrl || (__DEV__ ? API_URL_DESARROLLO : API_URL_PRODUCCION);

// Cambios en vivo (WebSockets con Laravel Reverb, ver src/enVivo.ts). La clave
// NO es secreta: identifica la app ante Reverb y debe coincidir con
// REVERB_APP_KEY del backend. El servidor sale de API_URL:
//   • http://host:8000  -> ws://host:8080   (php artisan reverb:start; en el
//                                             emulador, adb reverse tcp:8080)
//   • https://host[:p]  -> wss://host[:p]   (el proxy pasa /app a Reverb)
export const EN_VIVO_KEY = 'vitrina-local';
export const EN_VIVO_PUERTO_DESARROLLO = 8080;

// Páginas públicas del servidor (política de privacidad, eliminar cuenta).
export const WEB_URL = API_URL;

// Reporte de errores de la versión final (ver src/errores.ts y DESPLIEGUE.md §6).
// Vacío = no se envía nada. Esta dirección no es secreta: solo permite enviar errores.
export const SENTRY_DSN = '';
