/**
 * Unificação de casos no app: sugestão aparece com as duas fotos; quem pode confirma ou recusa;
 * qualquer um sugere "é o mesmo animal"; link antigo abre o caso unificado.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Text} from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k === 'auth_token' ? 'tok' : null)),
  setItem: jest.fn(async () => {}),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-webview', () => ({WebView: 'WebView'}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), [cb]);
  },
}));
jest.mock('@react-native-community/geolocation', () => ({setRNConfiguration: jest.fn(), getCurrentPosition: jest.fn(), requestAuthorization: jest.fn()}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {}})}));

import LostFoundDetailScreen from '../src/screens/LostFoundDetailScreen';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root => root.findAllByType(Text).map(t => [].concat(t.props.children).flat().join('')).join(' | ');
const press = async (root, id) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onPress)[0];
  if (!n) throw new Error(`sem botão ${id}`);
  await act(async () => n.props.onPress());
  await flush();
};
const json = (body, ok = true, status = 200) => ({ok, status, json: async () => body});
const now = new Date().toISOString();
const LOST = {id: 'lost1', type: 'LOST', status: 'ACTIVE', species: 'DOG', petName: 'Thor', colors: 'caramelo', size: 'MEDIO', sex: 'MACHO', lat: -22.88, lng: -48.44, happenedAt: now, createdAt: now, photos: ['/p/1'], author: 'Ana', mine: true};
const SEEN = {id: 'seen1', type: 'SIGHTED', status: 'ACTIVE', species: 'DOG', colors: 'caramelo', lat: -22.881, lng: -48.44, happenedAt: now, createdAt: now, photos: ['/p/2'], author: 'Bia'};

let alertSpy;
beforeEach(() => {
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  alertSpy.mockClear();
});
const confirmLastAlert = async () => {
  const buttons = alertSpy.mock.calls.at(-1)[2];
  await act(async () => buttons[buttons.length - 1].onPress());
  await flush();
};

async function render(fetchImpl, params = {id: 'lost1'}) {
  const nav = {navigate: jest.fn(), setOptions: jest.fn(), push: jest.fn(), replace: jest.fn(), goBack: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<LostFoundDetailScreen navigation={nav} route={{params}} fetchImpl={fetchImpl} openUrl={jest.fn()} share={jest.fn()} />);
  });
  await flush();
  return {tree, nav};
}

test('tutora vê a sugestão com as duas fotos e confirma', async () => {
  const fetchImpl = jest.fn(async (url, init = {}) => {
    if (url.endsWith('/lostfound/lost1')) return json({report: LOST, timeline: [], pendingMerges: 1, commentsCount: 0, following: true});
    if (url.endsWith('/lost1/merges')) return json({merges: [{id: 'm1', auto: true, canConfirm: true, waitingFor: 'o tutor do animal perdido', source: SEEN, target: LOST}]});
    if (url.endsWith('/merges/m1/confirm')) return json({message: 'Pronto! Os casos foram unificados.', status: 'CONFIRMED', targetId: 'lost1'});
    if (url.endsWith('/matches')) return json({matches: []});
    return json({});
  });
  const {tree} = await render(fetchImpl);
  expect(allText(tree.root)).toMatch(/Pode ser o mesmo animal\?/);
  expect(allText(tree.root)).toMatch(/Achamos outro aviso muito parecido/);
  expect(allText(tree.root)).toMatch(/Outro aviso · Visto solto/);
  await press(tree.root, 'sim-e-m1');
  await confirmLastAlert();
  expect(fetchImpl.mock.calls.some(c => c[0].endsWith('/merges/m1/confirm') && c[1].method === 'POST')).toBe(true);
  expect(alertSpy.mock.calls.at(-1)[1]).toMatch(/unificados/);
});

test('quem não pode confirmar só vê "aguardando"', async () => {
  const fetchImpl = jest.fn(async url => {
    if (url.endsWith('/lostfound/seen1')) return json({report: {...SEEN, mine: false}, timeline: [], pendingMerges: 1});
    if (url.endsWith('/seen1/merges')) return json({merges: [{id: 'm1', canConfirm: false, waitingFor: 'o tutor do animal perdido', source: SEEN, target: LOST}]});
    return json({});
  });
  const {tree} = await render(fetchImpl, {id: 'seen1'});
  expect(allText(tree.root)).toMatch(/Aguardando a confirmação de o tutor do animal perdido/);
  expect(tree.root.findAll(x => x.props.testID === 'sim-e-m1').length).toBe(0);
});

test('"Acho que é o mesmo animal": escolhe o outro aviso e sugere', async () => {
  const fetchImpl = jest.fn(async (url, init = {}) => {
    if (url.endsWith('/lostfound/seen1')) return json({report: {...SEEN, mine: false}, timeline: [], pendingMerges: 0});
    if (url.endsWith('/lostfound/similar')) return json({similar: [{...SEEN}, {...LOST, distanceKm: 0.2}]});
    if (url.endsWith('/seen1/merge')) return json({message: 'Obrigado! Vamos pedir para o tutor do animal confirmar.', status: 'PENDING'}, true, 201);
    return json({});
  });
  const {tree} = await render(fetchImpl, {id: 'seen1'});
  await press(tree.root, 'mesmo-animal');
  expect(tree.root.findAll(x => x.props.testID === 'e-o-mesmo-seen1').length).toBe(0); // não lista ele mesmo
  await press(tree.root, 'e-o-mesmo-lost1');
  await confirmLastAlert();
  const call = fetchImpl.mock.calls.find(c => c[0].endsWith('/seen1/merge'));
  expect(JSON.parse(call[1].body)).toEqual({otherId: 'lost1'});
  expect(alertSpy.mock.calls.at(-1)[1]).toMatch(/tutor do animal confirmar/);
});

test('link de um caso unificado abre o caso que ficou', async () => {
  const fetchImpl = jest.fn(async url => (url.endsWith('/lostfound/seen1') ? json({redirectTo: 'lost1', merged: true}) : json({})));
  const {nav} = await render(fetchImpl, {id: 'seen1'});
  expect(nav.replace).toHaveBeenCalledWith('LostFoundDetail', {id: 'lost1', mergedFrom: 'seen1'});
});
