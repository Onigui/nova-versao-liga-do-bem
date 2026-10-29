/**
 * Achados e perdidos como "casos": "Pode ser um destes?" antes de publicar, avistamento com foto
 * obrigatória, linha do tempo e trajeto no mapa.
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
jest.mock('react-native-image-picker', () => ({launchCamera: jest.fn(), launchImageLibrary: jest.fn()}));
jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  getCurrentPosition: jest.fn(ok => ok({coords: {latitude: -22.8859, longitude: -48.4435, accuracy: 10}})),
  requestAuthorization: jest.fn(),
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {phone: '14998123456', locationEnabled: true}})}));

import LostFoundNewScreen from '../src/screens/LostFoundNewScreen';
import LostFoundDetailScreen from '../src/screens/LostFoundDetailScreen';
import LostFoundSightingScreen from '../src/screens/LostFoundSightingScreen';
import {buildMapHtml} from '../src/components/LeafletMap';
import {buildSightingBody, caseSituation, caseTrack, sightingFromReportForm, toMarkers} from '../src/utils/lostfound';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root => root.findAllByType(Text).map(t => [].concat(t.props.children).flat().join('')).join(' | ');
const press = async (root, id) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onPress)[0];
  if (!n) throw new Error(`sem botão ${id}`);
  await act(async () => n.props.onPress());
  await flush();
};
const json = (body, ok = true, status = 200) => ({ok, status, json: async () => body});
const H = 3600e3;

const CASE = {
  id: 'c1', type: 'LOST', status: 'ACTIVE', species: 'DOG', petName: 'Thor', colors: 'caramelo', size: 'MEDIO',
  lat: -22.8859, lng: -48.4435, approximate: true, happenedAt: new Date(Date.now() - 48 * H).toISOString(), createdAt: new Date(Date.now() - 48 * H).toISOString(),
  photos: ['/api/lostfound/c1/photos/0'], author: 'Ana', mine: false, whatsapp: '5514998123456', sightings: 2,
  lastSeen: {lat: -22.88, lng: -48.44, at: new Date(Date.now() - 2 * H).toISOString(), kind: 'SEEN'},
};
const TIMELINE = [
  {id: 's1', kind: 'SEEN', author: 'Bia', happenedAt: new Date(Date.now() - 20 * H).toISOString(), lat: -22.884, lng: -48.442, locationNote: 'Mercado', photo: '/api/lostfound/c1/sightings/s1/photo', canRemove: false},
  {id: 's2', kind: 'SEEN', author: 'Caio', happenedAt: new Date(Date.now() - 2 * H).toISOString(), lat: -22.88, lng: -48.44, note: 'Assustado', photo: '/api/lostfound/c1/sightings/s2/photo', canRemove: true, mine: true},
];

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  Alert.alert.mockClear();
});

describe('utilitários', () => {
  test('trajeto numerado em ordem e situação atual', () => {
    const {markers, track} = caseTrack(CASE, [TIMELINE[1], TIMELINE[0]]);
    expect(markers.map(m => m.label)).toEqual(['1', '2', '3']);
    expect(markers[1].id).toBe('s1');
    expect(track).toHaveLength(3);
    expect(caseSituation(CASE).text).toBe('Visto por último há 2 h');
    expect(toMarkers([CASE])[0]).toMatchObject({lat: -22.88, lng: -48.44}); // mapa geral: onde foi visto por último
  });
  test('mapa desenha a linha do trajeto', () => {
    expect(buildMapHtml({center: {lat: 0, lng: 0}})).toContain('setTrack');
  });
  test('avistamento: foto obrigatória; publicar vira avistamento do jeito certo', () => {
    expect(buildSightingBody({kind: 'SEEN', location: {lat: 1, lng: 1}, when: '10/10/2026 10:00'}).error).toMatch(/foto é obrigatória/);
    expect(buildSightingBody({kind: 'SEEN', photo: {data: 'x'}, when: '10/10/2026 10:00'}).error).toMatch(/mapa/);
    const f = {type: 'FOUND', currentlyWith: 'CLINICA', photos: [{data: 'data:image/jpeg;base64,AAA'}], location: {lat: 1, lng: 2}, when: '10/10/2026 10:00', description: 'Machucado na pata'};
    expect(sightingFromReportForm(f)).toMatchObject({kind: 'CLINIC', photo: 'data:image/jpeg;base64,AAA', lat: 1, lng: 2, note: 'Machucado na pata'});
    expect(sightingFromReportForm({...f, type: 'SIGHTED'}).kind).toBe('SEEN');
    expect(sightingFromReportForm({...f, currentlyWith: 'COMIGO'}).kind).toBe('WITH_ME');
  });
});

describe('publicar: "Pode ser um destes?"', () => {
  async function fillSighted(fetchImpl, nav) {
    let tree;
    await act(async () => {
      tree = renderer.create(<LostFoundNewScreen navigation={nav} route={{params: {type: 'SIGHTED'}}} fetchImpl={fetchImpl} />);
    });
    await flush();
    require('react-native-image-picker').launchCamera.mockResolvedValue({assets: [{uri: 'file://a.jpg', type: 'image/jpeg', base64: 'AAAA'}]});
    await press(tree.root, 'foto-camera');
    await press(tree.root, 'especie-DOG');
    const colors = tree.root.findAll(x => x.props.testID === 'campo-colors' && x.props.onChangeText)[0];
    await act(async () => colors.props.onChangeText('caramelo'));
    return tree;
  }

  test('achou parecido → "É este!" adiciona avistamento ao caso, sem criar aviso novo', async () => {
    const fetchImpl = jest.fn(async (url, init = {}) => {
      if (url.endsWith('/lostfound/similar')) return json({similar: [{...CASE, distanceKm: 0.4, score: 78}]});
      if (url.endsWith('/lostfound/c1/sightings')) return json({sighting: {id: 's9'}, notified: 3}, true, 201);
      return json({}, false, 500);
    });
    const nav = {replace: jest.fn(), navigate: jest.fn(), setOptions: jest.fn()};
    const tree = await fillSighted(fetchImpl, nav);
    await press(tree.root, 'publicar-aviso');
    expect(allText(tree.root)).toMatch(/Pode ser um destes\?/);
    expect(allText(tree.root)).toMatch(/Thor/);
    await press(tree.root, 'e-este-c1');
    const [, , buttons] = Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1];
    await act(async () => buttons[1].onPress());
    await flush();
    const call = fetchImpl.mock.calls.find(c => c[0].endsWith('/lostfound/c1/sightings'));
    expect(JSON.parse(call[1].body)).toMatchObject({kind: 'SEEN', photo: 'data:image/jpeg;base64,AAAA', lat: -22.8859, lng: -48.4435});
    expect(fetchImpl.mock.calls.some(c => c[0].endsWith('/api/lostfound') && c[1]?.method === 'POST')).toBe(false);
    expect(nav.replace).toHaveBeenCalledWith('LostFoundDetail', {id: 'c1'});
  });

  test('"Não é nenhum" publica o aviso novo normalmente', async () => {
    const fetchImpl = jest.fn(async (url, init = {}) => {
      if (url.endsWith('/lostfound/similar')) return json({similar: [{...CASE, distanceKm: 0.4, score: 50}]});
      if (url.endsWith('/api/lostfound') && init.method === 'POST') return json({report: {id: 'novo'}, alerts: {}}, true, 201);
      return json({});
    });
    const nav = {replace: jest.fn(), navigate: jest.fn(), setOptions: jest.fn()};
    const tree = await fillSighted(fetchImpl, nav);
    await press(tree.root, 'publicar-aviso');
    await press(tree.root, 'nenhum-publicar');
    expect(nav.replace).toHaveBeenCalledWith('LostFoundDetail', {id: 'novo'});
  });

  test('sem parecidos (ou sem internet na checagem): publica direto', async () => {
    const fetchImpl = jest.fn(async (url, init = {}) => {
      if (url.endsWith('/lostfound/similar')) throw new Error('offline');
      if (init.method === 'POST') return json({report: {id: 'novo2'}, alerts: {}}, true, 201);
      return json({});
    });
    const nav = {replace: jest.fn(), navigate: jest.fn(), setOptions: jest.fn()};
    const tree = await fillSighted(fetchImpl, nav);
    await press(tree.root, 'publicar-aviso');
    expect(nav.replace).toHaveBeenCalledWith('LostFoundDetail', {id: 'novo2'});
  });
});

describe('caso', () => {
  test('mostra situação, trajeto e linha do tempo; "Vi este animal" leva para o avistamento', async () => {
    const fetchImpl = jest.fn(async () => json({report: CASE, timeline: TIMELINE}));
    const nav = {navigate: jest.fn(), setOptions: jest.fn(), push: jest.fn(), goBack: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<LostFoundDetailScreen navigation={nav} route={{params: {id: 'c1'}}} fetchImpl={fetchImpl} openUrl={jest.fn()} share={jest.fn()} />);
    });
    await flush();
    const txt = allText(tree.root);
    expect(txt).toMatch(/Visto por último há 2 h/);
    expect(txt).toMatch(/2 avistamentos/);
    expect(txt).toMatch(/Por onde passou/);
    expect(txt).toMatch(/Vi de novo · Bia/);
    expect(txt).toMatch(/Assustado/);
    const map = tree.root.findAll(x => x.props.testID === 'mapa-aviso' && x.props.track)[0];
    expect(map.props.track).toHaveLength(3);
    expect(map.props.markers.map(m => m.label)).toEqual(['1', '2', '3']);
    // só dá para tirar o que pode
    expect(tree.root.findAll(x => x.props.testID === 'avistamento-s1-tirar').length).toBe(0);
    expect(tree.root.findAll(x => x.props.testID === 'avistamento-s2-tirar' && x.props.onPress).length).toBeGreaterThan(0);
    await press(tree.root, 'vi-este-animal');
    expect(nav.navigate).toHaveBeenCalledWith('LostFoundSighting', {report: CASE});
  });

  test('registrar avistamento: sem foto não vai; com foto envia e volta', async () => {
    const fetchImpl = jest.fn(async () => json({sighting: {id: 's3'}, notified: 2}, true, 201));
    const nav = {goBack: jest.fn(), setOptions: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<LostFoundSightingScreen navigation={nav} route={{params: {report: CASE}}} fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(allText(tree.root)).toMatch(/Obrigatória: é ela que confirma que é o mesmo animal/);
    await press(tree.root, 'registrar-avistamento');
    expect(Alert.alert.mock.calls[0][1]).toMatch(/foto é obrigatória/);
    expect(fetchImpl).not.toHaveBeenCalled();
    require('react-native-image-picker').launchCamera.mockResolvedValue({assets: [{uri: 'file://b.jpg', type: 'image/jpeg', base64: 'BBBB'}]});
    await press(tree.root, 'foto-camera');
    await press(tree.root, 'tipo-CLINIC');
    const nota = tree.root.findAll(x => x.props.testID === 'campo-observacao' && x.props.onChangeText)[0];
    await act(async () => nota.props.onChangeText('Clínica Amigo'));
    await press(tree.root, 'registrar-avistamento');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.test/api/lostfound/c1/sightings');
    expect(JSON.parse(init.body)).toMatchObject({kind: 'CLINIC', photo: 'data:image/jpeg;base64,BBBB', lat: -22.8859, lng: -48.4435, note: 'Clínica Amigo'});
    expect(nav.goBack).toHaveBeenCalled();
  });
});
