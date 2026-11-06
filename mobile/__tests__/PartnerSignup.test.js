/**
 * App Parceiros por ONG: "Quero ser parceiro" (escolhe a ONG e manda os dados) e o nome da ONG na empresa.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text} from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({getItem: jest.fn(async () => null), setItem: jest.fn(async () => {})}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {}, token: 'tok-parceiro'})}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('react-native-device-info', () => ({getVersion: () => '1.0.24'}), {virtual: true});
const mockCtx = {partner: {name: 'Pet Shop Central', category: 'Pet shop'}, isOwner: true, logout: jest.fn(), org: {id: 'org_b', name: 'Patinhas Felizes'}};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import PartnerSignupScreen from '../src/partner/screens/PartnerSignupScreen';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const ORGS = [
  {id: 'org_liga', slug: 'liga-do-bem', name: 'Liga do Bem', city: 'Botucatu', state: 'SP', branding: {primary: '#6D28D9'}},
  {id: 'org_b', slug: 'patinhas', name: 'Patinhas Felizes', city: 'Bauru', state: 'SP', branding: {}},
];
const textOf = tree => tree.root.findAllByType(Text).map(t => [].concat(t.props.children).join('')).join(' | ');

test('escolhe a ONG, preenche e envia: o pedido vai com a ONG escolhida', async () => {
  const calls = [];
  const fetchImpl = jest.fn(async (url, init) => {
    calls.push({url, init});
    if (url.endsWith('/orgs')) return {ok: true, json: async () => ({orgs: ORGS})};
    return {ok: true, status: 201, json: async () => ({ok: true, message: 'Pedido enviado! A equipe do SóciONG vai falar com você para concluir a parceria com a Patinhas Felizes.'})};
  });
  const nav = {goBack: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<PartnerSignupScreen navigation={nav} fetchImpl={fetchImpl} />);
  });
  await flush();
  expect(textOf(tree)).toContain('Patinhas Felizes');
  // sem escolher a ONG não envia
  await act(async () => tree.root.findByProps({testID: 'signup-submit'}).props.onPress());
  expect(textOf(tree)).toContain('Escolha a ONG.');
  expect(calls.filter(c => c.init?.method === 'POST')).toHaveLength(0);

  await act(async () => tree.root.findByProps({testID: 'org-patinhas'}).props.onPress());
  const type = (id, v) => act(async () => tree.root.findByProps({testID: id}).props.onChangeText(v));
  await type('f-company', 'Pet Shop Central');
  await type('f-contact', 'Carla');
  await type('f-email', 'Carla@PetShop.com.br ');
  await type('f-phone', '(14) 99999-0000');
  await act(async () => tree.root.findByProps({testID: 'signup-submit'}).props.onPress());
  await flush();
  const post = calls.find(c => c.init?.method === 'POST');
  expect(post.url).toBe('https://api.test/api/public/partner-requests');
  const body = JSON.parse(post.init.body);
  expect(body).toMatchObject({orgId: 'org_b', company: 'Pet Shop Central', email: 'carla@petshop.com.br'});
  expect(tree.root.findByProps({testID: 'signup-done'}).props.children).toMatch(/Patinhas Felizes/);
});

test('erro do servidor aparece no campo certo', async () => {
  const fetchImpl = jest.fn(async url =>
    url.endsWith('/orgs')
      ? {ok: true, json: async () => ({orgs: [ORGS[0]]})}
      : {ok: false, status: 400, json: async () => ({error: 'CNPJ inválido', field: 'cnpj'})},
  );
  let tree;
  await act(async () => {
    tree = renderer.create(<PartnerSignupScreen navigation={{}} fetchImpl={fetchImpl} />);
  });
  await flush();
  // só uma ONG: já vem escolhida
  const type = (id, v) => act(async () => tree.root.findByProps({testID: id}).props.onChangeText(v));
  await type('f-company', 'Loja');
  await type('f-contact', 'Ana');
  await type('f-email', 'ana@loja.com');
  await type('f-phone', '14999990000');
  await act(async () => tree.root.findByProps({testID: 'signup-submit'}).props.onPress());
  await flush();
  expect(textOf(tree)).toContain('CNPJ inválido');
});

test('a empresa mostra de qual ONG é parceira', async () => {
  const CompanyScreen = require('../src/partner/screens/CompanyScreen').default;
  let tree;
  await act(async () => {
    tree = renderer.create(<CompanyScreen navigation={{navigate: jest.fn()}} />);
  });
  expect([].concat(tree.root.findByProps({testID: 'partner-org'}).props.children).join('')).toBe('Parceiro da Patinhas Felizes');
});
