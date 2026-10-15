/**
 * Aba Pets: abre na hora com os pets da última visita, não pede a lista duas vezes ao abrir
 * e recarrega quando a pessoa volta para a aba.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text} from 'react-native';

const mockStore = {auth_token: 'tok'};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v;
  }),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {id: 'u1'}, isAuthenticated: true})}));

import PetsListScreen from '../src/screens/PetsListScreen';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root =>
  root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).join(''))
    .join(' | ');

test('pets: cache na hora, um pedido ao abrir, recarrega ao voltar', async () => {
  mockStore['pets_cache_v1:u1'] = JSON.stringify([{id: 'p0', name: 'Guardado', species: 'Cão'}]);
  let release;
  global.fetch = jest.fn(() => new Promise(r => (release = () => r({ok: true, json: async () => ({pets: [{id: 'p1', name: 'Thor', species: 'Cão'}]})}))));
  let onFocus;
  const navigation = {navigate: jest.fn(), addListener: (ev, cb) => ((onFocus = cb), () => {})};
  let tree;
  await act(async () => {
    tree = renderer.create(<PetsListScreen navigation={navigation} route={{params: {asTab: true}}} />);
  });
  await flush();
  act(() => onFocus()); // o primeiro foco vem junto com a abertura
  await flush();
  expect(allText(tree.root)).toContain('Guardado');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  await act(async () => release());
  await flush();
  expect(allText(tree.root)).toContain('Thor');
  expect(allText(tree.root)).not.toContain('Guardado');
  expect(JSON.parse(mockStore['pets_cache_v1:u1'])[0].name).toBe('Thor');
  global.fetch = jest.fn(async () => ({ok: true, json: async () => ({pets: []})}));
  await act(async () => onFocus()); // voltou para a aba
  await flush();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
