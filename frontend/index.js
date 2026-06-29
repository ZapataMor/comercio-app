/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { configurarMensajesBackground } from './src/pushNotifications';

configurarMensajesBackground();

AppRegistry.registerComponent(appName, () => App);
