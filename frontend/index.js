/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { conReporteErrores, iniciarReporteErrores } from './src/errores';
import { configurarMensajesBackground } from './src/pushNotifications';
import { registrarServicioUbicacion } from './src/servicioUbicacion';

iniciarReporteErrores();
configurarMensajesBackground();
// GPS del domiciliario con la app en segundo plano (ver src/servicioUbicacion.ts).
registrarServicioUbicacion();

AppRegistry.registerComponent(appName, () => conReporteErrores(App));
