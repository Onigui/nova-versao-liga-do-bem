/**
 * Nova tela inicial (estilo app de banco) e "Todos os serviços".
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {PermissionsAndroid, Platform, Text} from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k === 'auth_token' ? 'tok' : null)),
  setItem: jest.fn(async () => {}),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), [cb]);
  },
}));
jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  getCurrentPosition: jest.fn(ok => ok({coords: {latitude: -22.8859, longitude: -48.4435, accuracy: 10}})),
  requestAuthorization: jest.fn(),
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {name: 'Ana Souza', locationEnabled: true}})}));

import HomeScreen from '../src/screens/HomeScreen';
import ServicesScreen from '../src/screens/ServicesScreen';
import {SERVICE_GROUPS, greeting, planName, searchServices} from '../src/theme/home';

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
const json = body => ({ok: true, status: 200, json: async () => body});

const MEMBER = {
  user: {firstName: 'Ana'},
  membership: {active: true, status: 'ACTIVE', endDate: '2027-08-12T12:00:00Z', planMonths: 12, memberIdMasked: 'MEM•••9178', usesThisYear: 7},
  counters: {unreadNotifications: 2, lostFoundNearby: 3},
  forYou: [
    {kind: 'VACCINE', urgent: false, title: 'Vacina de Mia em 7 dias', subtitle: 'V4 felina', action: {screen: 'VaccinationCard', params: {petId: 'pet1'}}},
    {kind: 'REVIEW', title: 'Como foi na Pet Shop Central?', subtitle: 'Avalie em 10 segundos', action: {screen: 'ReviewForm', params: {partnerId: 'p1', partnerName: 'Pet Shop Central'}}},
  ],
  pets: [{id: 'pet1', name: 'Mia', species: 'Gato', breed: 'SRD', vaccine: {status: 'SOON', label: 'V4 felina em 7 dias'}}],
  promos: [{id: 'p1', name: 'Pet Shop Central', category: 'PETSHOP', distanceKm: 0.35, badge: '15% OFF', discounts: [{badge: '15% OFF', percentage: 15}]}],
  nextEvent: {id: 'e1', title: 'Feira de adoção', startDate: '2026-10-25T13:00:00Z'},
  adoption: {available: 12},
  plan: null,
};

beforeAll(() => {
  Platform.OS = 'android';
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
});
afterAll(() => {
  Platform.OS = 'ios';
});

test('utilitários', () => {
  expect(greeting(new Date(2026, 9, 14, 9))).toBe('Bom dia,');
  expect(greeting(new Date(2026, 9, 14, 15))).toBe('Boa tarde,');
  expect(greeting(new Date(2026, 9, 14, 21))).toBe('Boa noite,');
  expect(planName(12)).toBe('Plano Anual');
  expect(planName(1)).toBe('Plano Mensal');
  expect(searchServices('vacinacao').flatMap(g => g.items.map(i => i.id))).toContain('vacinas');
  expect(searchServices('PERDI').flatMap(g => g.items.map(i => i.id))).toEqual(['achados', 'meusavisos']);
  expect(searchServices('xyzw')).toEqual([]);
  // nenhum serviço repetido
  const ids = SERVICE_GROUPS.flatMap(g => g.items.map(i => i.id));
  expect(new Set(ids).size).toBe(ids.length);
});

test('membro ativo: carteirinha, atalhos, para você, pets, promoções, evento e adoção', async () => {
  const fetchImpl = jest.fn(async () => json(MEMBER));
  const nav = {navigate: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<HomeScreen navigation={nav} fetchImpl={fetchImpl} />);
  });
  await flush();
  await flush();
  expect(fetchImpl.mock.calls.some(c => c[0] === 'https://api.test/api/home?lat=-22.8859&lng=-48.4435')).toBe(true);
  const t = allText(tree.root);
  expect(t).toContain('Ana');
  expect(t).toContain('CARTEIRINHA LIGA DO BEM');
  expect(t).toContain('Plano Anual');
  expect(t).toContain('ID MEM•••9178');
  expect(t).toContain('Você usou a carteirinha 7 vezes em');
  expect(t).toContain('Vacina de Mia em 7 dias');
  expect(t).toContain('V4 felina em 7 dias');
  expect(t).toContain('350 m');
  expect(t).toContain('Feira de adoção');
  expect(t).toContain('12 amigos esperando um lar');
  expect(t).not.toContain('Quero ser membro');
  // contador de achados e perdidos perto no atalho
  expect(t).toContain('3');
  await press(tree.root, 'mostrar-qr');
  expect(nav.navigate).toHaveBeenLastCalledWith('Cartão', undefined);
  await press(tree.root, 'para-voce-REVIEW');
  expect(nav.navigate).toHaveBeenLastCalledWith('ReviewForm', {partnerId: 'p1', partnerName: 'Pet Shop Central'});
  await press(tree.root, 'atalho-achados');
  expect(nav.navigate).toHaveBeenLastCalledWith('LostFound', undefined);
  await press(tree.root, 'atalho-tudo');
  expect(nav.navigate).toHaveBeenLastCalledWith('Services', undefined);
  await press(tree.root, 'pet-pet1');
  expect(nav.navigate).toHaveBeenLastCalledWith('VaccinationCard', {petId: 'pet1'});
  await press(tree.root, 'promo-p1');
  expect(nav.navigate.mock.calls[nav.navigate.mock.calls.length - 1][0]).toBe('PartnerDetail');
  await press(tree.root, 'notificacoes');
  expect(nav.navigate).toHaveBeenLastCalledWith('Notifications', undefined);
});

test('visitante: convite com preço, carteira de vacinação grátis', async () => {
  const fetchImpl = jest.fn(async () =>
    json({user: {firstName: 'Bia'}, membership: {active: false}, counters: {}, forYou: [], pets: [], promos: [], nextEvent: null, adoption: {available: 0}, plan: {fromPerMonth: 17.08, partners: 24}}),
  );
  const nav = {navigate: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<HomeScreen navigation={nav} fetchImpl={fetchImpl} />);
  });
  await flush();
  await flush();
  const t = allText(tree.root);
  expect(t).toContain('SEJA MEMBRO DA LIGA DO BEM');
  expect(t).toContain('Descontos em 24 lojas');
  expect(t).toContain('a partir de R$ 17,08/mês');
  expect(t).toContain('Carteira de vacinação digital');
  expect(t).not.toContain('Para você');
  await press(tree.root, 'quero-ser-membro');
  expect(nav.navigate).toHaveBeenLastCalledWith('MembershipCheckout', undefined);
  await press(tree.root, 'cadastrar-pet');
  expect(nav.navigate).toHaveBeenLastCalledWith('AddPet', undefined);
});

test('carteirinha vencida: convite para renovar', async () => {
  const fetchImpl = jest.fn(async () => json({...MEMBER, membership: {active: false, status: 'ACTIVE', endDate: '2026-01-01'}, plan: {fromPerMonth: 19.9}}));
  let tree;
  await act(async () => {
    tree = renderer.create(<HomeScreen navigation={{navigate: jest.fn()}} fetchImpl={fetchImpl} />);
  });
  await flush();
  await flush();
  const t = allText(tree.root);
  expect(t).toContain('SUA CARTEIRINHA VENCEU');
  expect(t).toContain('Renovar carteirinha');
});

test('todos os serviços: busca sem acento e navegação', async () => {
  const nav = {navigate: jest.fn(), goBack: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<ServicesScreen navigation={nav} route={{}} />);
  });
  expect(allText(tree.root)).toContain('MEUS PETS');
  const input = tree.root.findAll(x => x.props.testID === 'busca-servicos' && x.props.onChangeText)[0];
  await act(async () => input.props.onChangeText('orcamento'));
  const t = allText(tree.root);
  expect(t).toContain('Orçamento');
  expect(t).not.toContain('Doar');
  await press(tree.root, 'servico-orcamento');
  expect(nav.navigate).toHaveBeenCalledWith('QuotesList');
  await act(async () => input.props.onChangeText('zzz'));
  expect(allText(tree.root)).toContain('Nada encontrado');
});
