/**
 * Regressão: "Error generating signature: key permanently invalidated" fazia o login
 * biométrico falhar em loop. Agora a biometria é desligada e os dados guardados são apagados.
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
  isSensorAvailable: jest.fn(async () => ({available: true, biometryType: 'Biometrics'})),
  createSignature: jest.fn(),
  deleteKeys: jest.fn(async () => ({keysDeleted: true})),
};
jest.mock('react-native-biometrics', () => jest.fn().mockImplementation(() => mockBio));

const BiometricService = require('../src/services/BiometricService').default;

function enableStored() {
  mockStore.biometric_enabled = 'true';
  mockStore.biometric_public_key = 'PK';
  mockStore.biometric_credentials = JSON.stringify({email: 'a@b.org', password: 'x'});
}

beforeEach(() => {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  jest.clearAllMocks();
});

test('chave invalidada pelo Android desliga a biometria e limpa os dados', async () => {
  enableStored();
  mockBio.createSignature.mockRejectedValueOnce(
    new Error('Error generating signature: key permanently invalidated'),
  );
  const r = await BiometricService.authenticate();
  expect(r).toMatchObject({success: false, invalidated: true});
  expect(await BiometricService.isEnabled()).toBe(false);
  expect(mockStore.biometric_credentials).toBeUndefined();
  expect(mockBio.deleteKeys).toHaveBeenCalled();
});

test('cancelamento pelo usuário NÃO desliga a biometria', async () => {
  enableStored();
  mockBio.createSignature.mockResolvedValueOnce({success: false});
  const r = await BiometricService.authenticate();
  expect(r.success).toBe(false);
  expect(r.invalidated).toBeUndefined();
  expect(await BiometricService.isEnabled()).toBe(true);
});

test('erro temporário NÃO desliga a biometria', async () => {
  enableStored();
  mockBio.createSignature.mockRejectedValueOnce(new Error('Too many attempts. Try again later.'));
  const r = await BiometricService.authenticate();
  expect(r.invalidated).toBeUndefined();
  expect(await BiometricService.isEnabled()).toBe(true);
});

test('login biométrico normal devolve as credenciais', async () => {
  enableStored();
  mockBio.createSignature.mockResolvedValueOnce({success: true, signature: 'sig'});
  const r = await BiometricService.authenticate();
  expect(r).toMatchObject({success: true, email: 'a@b.org'});
});
