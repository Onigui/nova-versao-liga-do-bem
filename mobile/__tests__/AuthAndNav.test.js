/**
 * CPF obrigatório e válido no cadastro, completar CPF de contas antigas, novo login
 * e os botões de "Todos os serviços" que abrem abas da barra inferior.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Text} from 'react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k === 'auth_token' ? 'tok' : null)),
  setItem: jest.fn(async () => {}),
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
const mockAuth = {register: jest.fn(), login: jest.fn(), updateUser: jest.fn(), logout: jest.fn(), user: {name: 'Ana Souza', cpf: null}};
jest.mock('../src/services/AuthService', () => ({useAuth: () => mockAuth}));
jest.mock('../src/services/BiometricService', () => ({
  __esModule: true,
  default: {isAvailable: jest.fn(async () => ({available: false})), isEnabled: jest.fn(async () => false), authenticate: jest.fn(), enableBiometric: jest.fn()},
}));

import RegisterScreen, {validateRegister} from '../src/screens/RegisterScreen';
import LoginScreen from '../src/screens/LoginScreen';
import CompleteCpfScreen from '../src/screens/CompleteCpfScreen';
import ServicesScreen from '../src/screens/ServicesScreen';
import {cpfHint, formatCpf, isValidCpf} from '../src/utils/cpf';
import navigateTo, {tabTarget} from '../src/navigation/navigateTo';
import {SERVICE_GROUPS} from '../src/theme/home';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root =>
  root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).join(''))
    .join(' | ');
const press = async (root, id) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onPress)[0];
  if (!n) throw new Error(`sem botão ${id}`);
  await act(async () => n.props.onPress());
  await flush();
};
const type = async (root, id, text) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onChangeText)[0];
  await act(async () => n.props.onChangeText(text));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('CPF: máscara, dígitos verificadores e números de exemplo', () => {
  expect(formatCpf('86815330028')).toBe('868.153.300-28');
  expect(isValidCpf('868.153.300-28')).toBe(true);
  expect(isValidCpf('868.153.300-27')).toBe(false);
  expect(isValidCpf('111.111.111-11')).toBe(false);
  expect(isValidCpf('123.456.789-09')).toBe(false); // exemplo famoso
  expect(cpfHint('868.153')).toBeNull();
  expect(cpfHint('868.153.300-27')).toMatch(/inválido/);
  expect(cpfHint('868.153.300-28')).toBe('ok');
});

test('cadastro: valida tudo antes de enviar', () => {
  const ok = {name: 'Ana Souza', cpf: '868.153.300-28', email: 'ana@x.com', phone: '(14) 99812-3456', password: 'segredo', confirm: 'segredo', terms: true};
  expect(validateRegister(ok)).toEqual({});
  expect(Object.keys(validateRegister({...ok, cpf: ''}))).toEqual(['cpf']);
  expect(validateRegister({...ok, cpf: '123.456.789-00'}).cpf).toMatch(/inválido/);
  expect(validateRegister({...ok, name: 'Ana'}).name).toMatch(/sobrenome/);
  expect(validateRegister({...ok, confirm: 'x'}).confirm).toBeTruthy();
  expect(validateRegister({...ok, terms: false}).terms).toBeTruthy();
});

test('cadastro: envia CPF só números e mostra "CPF já tem conta" no campo', async () => {
  mockAuth.register.mockResolvedValue({success: false, error: 'Este CPF já tem uma conta. Entre com o seu e-mail ou use "Esqueci minha senha".'});
  let tree;
  await act(async () => {
    tree = renderer.create(<RegisterScreen navigation={{navigate: jest.fn(), goBack: jest.fn()}} />);
  });
  await type(tree.root, 'nome', 'Ana  Souza');
  await type(tree.root, 'cpf', '86815330028');
  expect(tree.root.findAll(x => x.props.testID === 'cpf' && x.props.onChangeText)[0].props.value).toBe('868.153.300-28');
  await type(tree.root, 'email', 'Ana@X.com ');
  await type(tree.root, 'celular', '14998123456');
  await type(tree.root, 'senha', 'segredo1');
  await type(tree.root, 'confirmar-senha', 'segredo1');
  await press(tree.root, 'criar');
  expect(mockAuth.register).not.toHaveBeenCalled(); // faltou aceitar os termos
  await press(tree.root, 'aceito-termos');
  await press(tree.root, 'criar');
  expect(mockAuth.register).toHaveBeenCalledWith({name: 'Ana Souza', email: 'ana@x.com', phone: '14998123456', cpf: '86815330028', password: 'segredo1'});
  expect(allText(tree.root)).toContain('Este CPF já tem uma conta');
});

test('login: erro de senha aparece no campo', async () => {
  mockAuth.login.mockResolvedValue({success: false, error: 'E-mail ou senha incorretos'});
  let tree;
  await act(async () => {
    tree = renderer.create(<LoginScreen navigation={{navigate: jest.fn(), addListener: () => () => {}}} />);
  });
  await flush();
  await press(tree.root, 'entrar');
  expect(allText(tree.root)).toContain('Digite um e-mail válido');
  await type(tree.root, 'email', 'ana@x.com');
  await type(tree.root, 'senha', 'errada');
  await press(tree.root, 'entrar');
  expect(mockAuth.login).toHaveBeenCalledWith('ana@x.com', 'errada');
  expect(allText(tree.root)).toContain('E-mail ou senha incorretos');
});

test('conta antiga sem CPF: completa e entra', async () => {
  const fetchImpl = jest.fn(async () => ({ok: true, status: 200, json: async () => ({})}));
  let tree;
  await act(async () => {
    tree = renderer.create(<CompleteCpfScreen fetchImpl={fetchImpl} />);
  });
  expect(allText(tree.root)).toContain('Falta só o seu CPF');
  await type(tree.root, 'cpf', '86815330028');
  await press(tree.root, 'salvar-cpf');
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe('https://api.test/api/user/profile');
  expect(init.method).toBe('PUT');
  expect(JSON.parse(init.body)).toEqual({cpf: '86815330028'});
  expect(mockAuth.updateUser).toHaveBeenCalledWith(expect.objectContaining({cpf: '86815330028'}));
});

test('Todos os serviços: abas da barra abrem pelo navegador das abas', async () => {
  expect(tabTarget('Pets')).toEqual({name: 'MainTabs', params: {screen: 'Pets', params: undefined}});
  expect(tabTarget('QuotesList')).toEqual({name: 'QuotesList', params: undefined});
  const nav = {navigate: jest.fn(), goBack: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<ServicesScreen navigation={nav} route={{}} />);
  });
  for (const id of ['qr', 'parceiros', 'pets', 'vacinas', 'perfil']) await press(tree.root, `servico-${id}`);
  expect(nav.navigate.mock.calls).toEqual([
    ['MainTabs', {screen: 'Cartão', params: undefined}],
    ['MainTabs', {screen: 'Parceiros', params: undefined}],
    ['MainTabs', {screen: 'Pets', params: undefined}],
    ['MainTabs', {screen: 'Pets', params: undefined}],
    ['MainTabs', {screen: 'Perfil', params: undefined}],
  ]);
  // Todas as rotas usadas pelos serviços existem no app
  const src = require('fs').readFileSync(require('path').join(__dirname, '../src/navigation/AppNavigator.js'), 'utf8');
  for (const s of SERVICE_GROUPS.flatMap(g => g.items)) {
    expect([s.screen, src.includes(`name="${s.screen}"`)]).toEqual([s.screen, true]);
  }
  const n2 = {navigate: jest.fn()};
  navigateTo(n2, 'Donation', {x: 1});
  expect(n2.navigate).toHaveBeenCalledWith('Donation', {x: 1});
});
