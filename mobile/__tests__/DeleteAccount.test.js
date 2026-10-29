/**
 * Excluir minha conta: link discreto no Perfil, explicação, senha + confirmação, sai da conta ao terminar.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Text, TextInput} from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({getItem: jest.fn(async k => (k === 'auth_token' ? 'tok' : null)), setItem: jest.fn()}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
const mockAuth = {logout: jest.fn()};
jest.mock('../src/services/AuthService', () => ({useAuth: () => mockAuth}));
jest.mock('../src/services/session', () => ({reportUnauthorized: jest.fn()}));

import DeleteAccountScreen from '../src/screens/DeleteAccountScreen';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const byId = (root, id) => root.findAll(x => x.props.testID === id && (x.props.onPress || x.props.onChangeText))[0];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

const mount = async fetchImpl => {
  let tree;
  await act(async () => {
    tree = renderer.create(<DeleteAccountScreen navigation={{goBack: jest.fn()}} fetchImpl={fetchImpl} />);
  });
  return tree.root;
};

test('explica o que é apagado e o que fica', async () => {
  const root = await mount(jest.fn());
  const txt = root.findAllByType(Text).map(t => [].concat(t.props.children).join('')).join(' | ');
  expect(txt).toMatch(/O que é apagado/);
  expect(txt).toMatch(/CPF/);
  expect(txt).toMatch(/pagamentos e doações, sem identificar você/);
});

test('sem senha não envia', async () => {
  const fetchImpl = jest.fn();
  const root = await mount(fetchImpl);
  await act(async () => byId(root, 'confirmar-excluir').props.onPress());
  expect(fetchImpl).not.toHaveBeenCalled();
  expect(Alert.alert.mock.calls[0][0]).toBe('Falta a senha');
});

test('com senha pede confirmação, exclui e sai da conta', async () => {
  const fetchImpl = jest.fn(async () => ({ok: true, status: 200, json: async () => ({ok: true})}));
  const root = await mount(fetchImpl);
  await act(async () => root.findByType(TextInput).props.onChangeText('segredo1'));
  await act(async () => byId(root, 'confirmar-excluir').props.onPress());
  const [title, , buttons] = Alert.alert.mock.calls[0];
  expect(title).toBe('Excluir de vez?');
  await act(async () => buttons.find(b => b.style === 'destructive').onPress());
  await flush();
  expect(fetchImpl).toHaveBeenCalledWith('https://api.test/api/user/account/delete', expect.objectContaining({method: 'POST', body: JSON.stringify({password: 'segredo1'})}));
  expect(mockAuth.logout).toHaveBeenCalled();
});

test('senha errada mostra o erro e não sai da conta', async () => {
  const fetchImpl = jest.fn(async () => ({ok: false, status: 403, json: async () => ({error: 'Senha incorreta.'})}));
  const root = await mount(fetchImpl);
  await act(async () => root.findByType(TextInput).props.onChangeText('x'));
  await act(async () => byId(root, 'confirmar-excluir').props.onPress());
  await act(async () => Alert.alert.mock.calls[0][2].find(b => b.style === 'destructive').onPress());
  await flush();
  expect(Alert.alert.mock.calls[1]).toEqual(['Não foi possível excluir', 'Senha incorreta.']);
  expect(mockAuth.logout).not.toHaveBeenCalled();
});
