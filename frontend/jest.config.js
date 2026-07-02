module.exports = {
  preset: '@react-native/jest-preset',
  // Estas librerías publican ESM sin compilar: hay que dejar que Babel las
  // transforme (por defecto jest ignora todo node_modules).
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|@react-navigation|@notifee|react-native-.*)',
  ],
  setupFiles: ['<rootDir>/jest.setup.js'],
};
