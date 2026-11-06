/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { conReporteErrores, iniciarReporteErrores } from './src/errores';
import { configurarMensajesBackground } from './src/pushNotifications';

iniciarReporteErrores();
configurarMensajesBackground();

AppRegistry.registerComponent(appName, () => conReporteErrores(App));
