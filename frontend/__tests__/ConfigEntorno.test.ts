describe('URL de API segun la variante Android', () => {
  const originalDev = __DEV__;

  afterEach(() => {
    Object.defineProperty(globalThis, '__DEV__', {value: originalDev, configurable: true});
    jest.dontMock('react-native');
    jest.resetModules();
  });

  function loadConfig(dev: boolean, apiUrl?: string) {
    Object.defineProperty(globalThis, '__DEV__', {value: dev, configurable: true});
    jest.doMock('react-native', () => ({
      NativeModules: apiUrl === undefined ? {} : {EnvironmentConfig: {apiUrl}},
    }));
    let result: typeof import('../src/config');
    jest.isolateModules(() => {
      result = require('../src/config');
    });
    return result!;
  }

  it('staging usa HTTPS local aunque sea una compilacion sin debug', () => {
    const config = loadConfig(false, 'https://localhost:8443');
    expect(config.API_URL).toBe('https://localhost:8443');
    expect(config.WEB_URL).toBe(config.API_URL);
  });

  it('release conserva la API de produccion', () => {
    expect(loadConfig(false, '').API_URL).toBe('https://api.vitrina.example');
  });

  it('desarrollo conserva la API del emulador sin modulo nativo', () => {
    expect(loadConfig(true).API_URL).toBe('http://10.0.2.2:8000');
  });
});
