/**
 * Login biométrico com credenciais no Keystore (react-native-keychain).
 * - Regressão: "key permanently invalidated" desliga a biometria (antes: loop de erro).
 * - Segurança: a senha nunca fica em texto aberto no AsyncStorage; o formato antigo é apagado.
 */
const mockStore = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v;
  }),
  removeItem: jest.fn(async k => {
    delete mockStore[k];
  }),
}));

const mockBio = {
  isSensorAvailable: jest.fn(async () => ({
    available: true,
    biometryType: 'Biometrics',
  })),
  deleteKeys: jest.fn(async () => ({keysDeleted: true})),
};
jest.mock('react-native-biometrics', () =>
  jest.fn().mockImplementation(() => mockBio),
);

const mockVault = {};
jest.mock('react-native-keychain', () => ({
  ACCESS_CONTROL: {BIOMETRY_CURRENT_SET: 'BiometryCurrentSet'},
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly',
  },
  STORAGE_TYPE: {RSA: 'KeystoreRSAECB'},
  setGenericPassword: jest.fn(async (username, password, opts) => {
    mockVault[opts.service] = {username, password, opts};
    return {service: opts.service, storage: opts.storage};
  }),
  getGenericPassword: jest.fn(async opts => {
    const v = mockVault[opts.service];
    return v
      ? {username: v.username, password: v.password, service: opts.service}
      : false;
  }),
  resetGenericPassword: jest.fn(async opts => {
    delete mockVault[opts.service];
    return true;
  }),
}));

const Keychain = require('react-native-keychain');
const BiometricService = require('../src/services/BiometricService').default;

beforeEach(() => {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  Object.keys(mockVault).forEach(k => delete mockVault[k]);
  jest.clearAllMocks();
});

test('habilitar guarda no Keystore protegido por biometria, nunca no AsyncStorage', async () => {
  const r = await BiometricService.enableBiometric('a@b.org', 'segredo123');
  expect(r.success).toBe(true);
  const call = Keychain.setGenericPassword.mock.calls[0];
  expect(call[0]).toBe('a@b.org');
  expect(call[2]).toMatchObject({
    accessControl: 'BiometryCurrentSet',
    accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
    storage: 'KeystoreRSAECB',
  });
  expect(JSON.stringify(mockStore)).not.toContain('segredo123');
  expect(mockStore.biometric_enabled).toBe('true');
  // a habilitação exige ler de volta com a digital
  expect(Keychain.getGenericPassword).toHaveBeenCalledWith(
    expect.objectContaining({authenticationPrompt: expect.any(Object)}),
  );
});

test('login biométrico devolve as credenciais lidas do Keystore', async () => {
  await BiometricService.enableBiometric('a@b.org', 'segredo123');
  const r = await BiometricService.authenticate();
  expect(r).toMatchObject({
    success: true,
    email: 'a@b.org',
    password: 'segredo123',
  });
});

test('chave invalidada pelo Android desliga a biometria e limpa o Keystore', async () => {
  await BiometricService.enableBiometric('a@b.org', 'segredo123');
  Keychain.getGenericPassword.mockRejectedValueOnce(
    new Error('Error generating signature: key permanently invalidated'),
  );
  const r = await BiometricService.authenticate();
  expect(r).toMatchObject({success: false, invalidated: true});
  expect(await BiometricService.isEnabled()).toBe(false);
  expect(Keychain.resetGenericPassword).toHaveBeenCalled();
});

test('cancelamento pelo usuário NÃO desliga a biometria', async () => {
  await BiometricService.enableBiometric('a@b.org', 'segredo123');
  Keychain.getGenericPassword.mockRejectedValueOnce(
    new Error('code: 13, msg: Cancel'),
  );
  const r = await BiometricService.authenticate();
  expect(r).toMatchObject({success: false, cancelled: true, error: 'cancel'});
  expect(await BiometricService.isEnabled()).toBe(true);
});

test('erro temporário NÃO desliga a biometria', async () => {
  await BiometricService.enableBiometric('a@b.org', 'segredo123');
  Keychain.getGenericPassword.mockRejectedValueOnce(
    new Error('Too many attempts. Try again later.'),
  );
  const r = await BiometricService.authenticate();
  expect(r.invalidated).toBeUndefined();
  expect(await BiometricService.isEnabled()).toBe(true);
});

test('formato antigo (senha em texto aberto) é apagado e a biometria desligada', async () => {
  mockStore.biometric_enabled = 'true';
  mockStore.biometric_public_key = 'PK';
  mockStore.biometric_credentials = JSON.stringify({
    email: 'a@b.org',
    password: 'segredo123',
  });
  expect(await BiometricService.isEnabled()).toBe(false);
  expect(mockStore.biometric_credentials).toBeUndefined();
  expect(mockStore.biometric_public_key).toBeUndefined();
  expect(mockStore.biometric_enabled).toBeUndefined();
  expect(mockBio.deleteKeys).toHaveBeenCalled();
});

test('cancelar a confirmação ao habilitar não deixa credenciais guardadas', async () => {
  Keychain.getGenericPassword.mockRejectedValueOnce(
    new Error('User canceled the operation'),
  );
  const r = await BiometricService.enableBiometric('a@b.org', 'segredo123');
  expect(r).toMatchObject({
    success: false,
    error: 'Autenticação biométrica cancelada',
  });
  expect(Object.keys(mockVault)).toHaveLength(0);
  expect(mockStore.biometric_enabled).toBeUndefined();
});
