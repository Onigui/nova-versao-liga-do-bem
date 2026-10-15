/**
 * Perfil: versão real do app, situação da carteirinha (do cache do Início), atalhos e preferências.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Text} from 'react-native';

const mockStore = {auth_token: 'tok'};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v;
  }),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-device-info', () => ({getVersion: () => '1.2.52', getBuildNumber: () => '54'}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
const mockAuth = {
  user: {id: 'u1', name: 'Ana Souza', email: 'ana@x.com', cpf: '86815330028', role: 'MEMBER', notificationsEnabled: true, locationEnabled: true},
  logout: jest.fn(),
  updateUser: jest.fn(),
};
jest.mock('../src/services/AuthService', () => ({useAuth: () => mockAuth}));

import ProfileScreen from '../src/screens/ProfileScreen';
import {appVersionLabel} from '../src/utils/appVersion';

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

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(async url =>
    String(url).endsWith('/user/stats')
      ? {ok: true, json: async () => ({donations: 3, adoptions: 1, volunteerHours: 12})}
      : {ok: true, json: async () => ({user: mockAuth.user})},
  );
});

test('versão vem do app instalado (não fica 1.0.0)', () => {
  expect(appVersionLabel()).toBe('Versão 1.2.52 (build 54)');
});

test('perfil: carteirinha ativa, números, atalhos, preferências e sair', async () => {
  mockStore['home_cache_v1:u1'] = JSON.stringify({membership: {active: true, endDate: '2027-08-12T12:00:00Z', planMonths: 12}});
  const nav = {navigate: jest.fn(), addListener: () => () => {}};
  let tree;
  await act(async () => {
    tree = renderer.create(<ProfileScreen navigation={nav} />);
  });
  await flush();
  const t = allText(tree.root);
  expect(t).toContain('Ana Souza');
  expect(t).toContain('CPF 868.153.300-28');
  expect(t).toContain('Plano Anual · válida até 12/08/2027');
  expect(t).toContain('12h');
  expect(t).toContain('Versão 1.2.52 (build 54)');
  expect(t).not.toContain('1.0.0');

  await press(tree.root, 'situacao-carteirinha');
  expect(nav.navigate).toHaveBeenLastCalledWith('MainTabs', {screen: 'Cartão', params: undefined});
  await press(tree.root, 'minhas-doacoes');
  expect(nav.navigate).toHaveBeenLastCalledWith('MyDonations', undefined);
  await press(tree.root, 'meus-orcamentos');
  expect(nav.navigate).toHaveBeenLastCalledWith('QuotesList', undefined);

  const sw = tree.root.findAll(x => x.props.testID === 'pref-localizacao' && x.props.onValueChange)[0];
  await act(async () => sw.props.onValueChange(false));
  await flush();
  const put = global.fetch.mock.calls.find(c => c[1]?.method === 'PUT');
  expect(JSON.parse(put[1].body)).toEqual({notificationsEnabled: true, locationEnabled: false});

  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await press(tree.root, 'sair');
  expect(Alert.alert.mock.calls[0][0]).toBe('Sair');
});

test('carteirinha vencida: convite para ser membro', async () => {
  mockStore['home_cache_v1:u1'] = JSON.stringify({membership: {active: false, endDate: '2026-01-10T12:00:00Z'}});
  const nav = {navigate: jest.fn(), addListener: () => () => {}};
  let tree;
  await act(async () => {
    tree = renderer.create(<ProfileScreen navigation={nav} />);
  });
  await flush();
  expect(allText(tree.root)).toContain('Carteirinha vencida em 10/01/2026');
  await press(tree.root, 'situacao-carteirinha');
  expect(nav.navigate).toHaveBeenLastCalledWith('MembershipCheckout', undefined);
});
