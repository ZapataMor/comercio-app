// URL base de la API (backend Laravel).
//
// IMPORTANTE según dónde corras la app:
//  • Emulador Android  -> 10.0.2.2 es el "localhost" de tu PC desde el emulador.
//  • Teléfono físico   -> usa la IP de tu PC en la red, p. ej. http://192.168.1.10:8000
//                         (mírala con `ipconfig` en Windows; el teléfono debe estar
//                         en la misma red WiFi y el server con `php artisan serve --host=0.0.0.0`).
export const API_URL = 'http://10.0.2.2:8000';
