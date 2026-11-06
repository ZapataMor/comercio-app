/* eslint-env jest */
/**
 * Mocks de módulos NATIVOS para Jest: en los tests no hay dispositivo, así
 * que Firebase/Notifee/AsyncStorage se reemplazan por versiones inertes.
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  let almacen = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(clave => Promise.resolve(almacen[clave] ?? null)),
      setItem: jest.fn((clave, valor) => {
        almacen[clave] = valor;
        return Promise.resolve();
      }),
      removeItem: jest.fn(clave => {
        delete almacen[clave];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        almacen = {};
        return Promise.resolve();
      }),
    },
  };
});

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn().mockResolvedValue('pedidos'),
    displayNotification: jest.fn().mockResolvedValue(undefined),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    getDisplayedNotifications: jest.fn().mockResolvedValue([]),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
  },
  AndroidCategory: { ALARM: 'alarm' },
  AndroidImportance: { HIGH: 4 },
  AndroidVisibility: { PUBLIC: 1 },
  EventType: { PRESS: 1, ACTION_PRESS: 2 },
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn().mockResolvedValue([]),
  types: { images: 'image/*' },
  isErrorWithCode: jest.fn(() => false),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
}));

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(() => ({})),
  getInitialNotification: jest.fn().mockResolvedValue(null),
  getToken: jest.fn().mockResolvedValue('token-de-prueba'),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  onTokenRefresh: jest.fn(() => jest.fn()),
  requestPermission: jest.fn().mockResolvedValue(1),
  setBackgroundMessageHandler: jest.fn(),
}));

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(() => 1),
    clearWatch: jest.fn(),
    setRNConfiguration: jest.fn(),
  },
}));

// El mapa es una vista nativa: en los tests basta con contenedores vacíos.
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  class MapView extends React.Component {
    animateToRegion() {}
    fitToCoordinates() {}
    render() {
      return React.createElement(View, this.props, this.props.children);
    }
  }
  const Marker = props => React.createElement(View, null, props.children);
  return { __esModule: true, default: MapView, Marker, PROVIDER_GOOGLE: 'google' };
});
