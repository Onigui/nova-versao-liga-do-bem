/**
 * Achados e perdidos: mapa/lista, publicar aviso, detalhe com WhatsApp, alertas.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, PermissionsAndroid, Platform, Text} from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k === 'auth_token' ? 'tok' : null)),
  setItem: jest.fn(async () => {}),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-webview', () => ({WebView: 'WebView'}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), [cb]); // como o real: roda de novo quando o callback muda
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

import LostFoundScreen from '../src/screens/LostFoundScreen';
import LostFoundNewScreen from '../src/screens/LostFoundNewScreen';
import LostFoundDetailScreen from '../src/screens/LostFoundDetailScreen';
import LostFoundAlertsScreen from '../src/screens/LostFoundAlertsScreen';
import {buildMapHtml} from '../src/components/LeafletMap';
import {buildReportBody, distanceLabel, formatPhone, parseDateTime, photoUrl, timeAgo, toMarkers, whatsappUrl} from '../src/utils/lostfound';

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
const json = (body, ok = true, status = 200) => ({ok, status, json: async () => body});

const REPORT = {
  id: 'r1',
  type: 'FOUND',
  status: 'ACTIVE',
  species: 'DOG',
  colors: 'caramelo',
  size: 'MEDIO',
  sex: 'MACHO',
  hasCollar: true,
  currentlyWith: 'COMIGO',
  lat: -22.89,
  lng: -48.44,
  approximate: false,
  district: 'Centro',
  locationNote: 'Perto da praça',
  happenedAt: new Date(Date.now() - 2 * 3600e3).toISOString(),
  createdAt: new Date(Date.now() - 3600e3).toISOString(),
  photos: ['/api/lostfound/r1/photos/0'],
  distanceKm: 0.6,
  whatsapp: '5514997001122',
  author: 'Bia',
  mine: false,
};

beforeAll(() => {
  Platform.OS = 'android';
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
});
afterAll(() => {
  Platform.OS = 'ios';
});
beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));

describe('utilitários', () => {
  test('links, datas, telefone, validação e marcadores', () => {
    expect(photoUrl('/api/lostfound/r1/photos/0')).toBe('https://api.test/api/lostfound/r1/photos/0');
    expect(whatsappUrl(REPORT)).toMatch(/^https:\/\/wa\.me\/5514997001122\?text=Oi/);
    expect(whatsappUrl({...REPORT, whatsapp: undefined})).toBeNull();
    expect(distanceLabel(0.6)).toBe('600 m');
    expect(distanceLabel(2.35)).toBe('2,4 km');
    expect(timeAgo(Date.now() - 30 * 60e3)).toBe('há 30 min');
    expect(formatPhone('14998123456')).toBe('(14) 99812-3456');
    expect(parseDateTime('31/02/2026 10:00')).toBeNull();
    expect(parseDateTime('14/10/2026 18:30').getHours()).toBe(18);
    const ok = {type: 'LOST', photos: [{data: 'data:x'}], species: 'DOG', colors: 'preto', location: {lat: 1, lng: 2}, when: '14/10/2026 10:00', whatsapp: '(14) 99812-3456', petName: 'Thor', petId: 'p1'};
    expect(buildReportBody({...ok, photos: []}).error).toMatch(/foto/);
    expect(buildReportBody({...ok, location: null}).error).toMatch(/mapa/);
    expect(buildReportBody({...ok, whatsapp: '123'}).error).toMatch(/WhatsApp/);
    expect(buildReportBody({...ok, when: '01/01/2099 10:00'}, Date.parse('2026-10-14T12:00:00Z')).error).toMatch(/futuro/);
    const b = buildReportBody(ok, Date.parse('2026-10-15T12:00:00Z')).body;
    expect(b).toMatchObject({type: 'LOST', species: 'DOG', petName: 'Thor', petId: 'p1', whatsapp: '14998123456', photos: ['data:x'], lat: 1, lng: 2});
    expect(toMarkers([{...REPORT, type: 'LOST', approximate: true}])[0]).toMatchObject({color: '#DC2626', label: 'P', approximate: true});
    const still = buildMapHtml({center: {lat: -22.9, lng: -48.4}, pick: true, interactive: false});
    expect(still).toContain('dragging:false');
    expect(still).not.toContain('draggable:true');
    const html = buildMapHtml({center: {lat: -22.9, lng: -48.4}, pick: true});
    expect(html).toContain('tile.openstreetmap.org');
    expect(html).toContain('setPick');
  });
});

describe('app', () => {
  test('mapa e lista: filtros, contador de reencontros, prévia do marcador', async () => {
    const fetchImpl = jest.fn(async () => json({reports: [REPORT, {...REPORT, id: 'r2', type: 'LOST', petName: 'Thor', distanceKm: 2.4}], counts: {LOST: 1, FOUND: 1, SIGHTED: 0}, reunited: 7}));
    const nav = {navigate: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<LostFoundScreen navigation={nav} fetchImpl={fetchImpl} />);
    });
    await flush();
    await flush();
    const urls = fetchImpl.mock.calls.map(c => c[0]);
    expect(urls.some(u => /\/lostfound\?lat=-22\.8859&lng=-48\.4435&radiusKm=20/.test(u))).toBe(true);
    let t = allText(tree.root);
    expect(t).toContain('7 animais voltaram para casa pelo app');
    expect(t).toContain('Perdidos 1');
    const map = tree.root.findAll(x => x.props.testID === 'mapa' && x.props.onMarkerPress)[0];
    await act(async () => map.props.onMarkerPress('r2'));
    expect(allText(tree.root)).toContain('Cachorro · Thor · caramelo');
    await press(tree.root, 'aviso-r2');
    expect(nav.navigate).toHaveBeenCalledWith('LostFoundDetail', {id: 'r2'});
    await press(tree.root, 'filtro-LOST');
    expect(fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1][0]).toMatch(/type=LOST/);
    await press(tree.root, 'modo-list');
    t = allText(tree.root);
    expect(t).toContain('600 m · Centro');
    await press(tree.root, 'publicar');
    await press(tree.root, 'novo-SIGHTED');
    expect(nav.navigate).toHaveBeenCalledWith('LostFoundNew', {type: 'SIGHTED'});
  });

  test('publicar "perdi": escolhe o pet, local do GPS, WhatsApp do cadastro', async () => {
    const fetchImpl = jest.fn(async (url, init = {}) => {
      if (url.endsWith('/user/pets')) return json({pets: [{id: 'p1', name: 'Thor', species: 'Cão', breed: 'SRD', color: 'caramelo'}]});
      if (init.method === 'POST') return json({report: {id: 'new1'}, alerts: {nearby: 4, matched: 1}}, true, 201);
      return json({});
    });
    const nav = {replace: jest.fn(), setOptions: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<LostFoundNewScreen navigation={nav} route={{params: {type: 'LOST'}}} fetchImpl={fetchImpl} />);
    });
    await flush();
    await flush();
    expect(nav.setOptions).toHaveBeenCalledWith({title: 'Perdi meu pet'});
    expect(allText(tree.root)).toContain('região aproximada');
    await press(tree.root, 'pet-p1');
    expect(tree.root.findAll(x => x.props.testID === 'campo-colors' && x.props.onChangeText)[0].props.value).toBe('caramelo');
    expect(tree.root.findAll(x => x.props.testID === 'campo-whatsapp' && x.props.onChangeText)[0].props.value).toBe('(14) 99812-3456');
    await press(tree.root, 'publicar-aviso');
    expect(Alert.alert.mock.calls[0][1]).toMatch(/foto/);
    // simula a foto escolhida (o seletor de imagem é nativo)
    require('react-native-image-picker').launchCamera.mockResolvedValue({assets: [{uri: 'file://a.jpg', type: 'image/jpeg', base64: 'AAAA'}]});
    await press(tree.root, 'foto-camera');
    await press(tree.root, 'porte-MEDIO');
    // a miniatura não pega o toque (não briga com a rolagem); tocar abre o mapa em tela cheia
    const preview = tree.root.findAll(x => x.props.testID === 'mapa-escolher' && x.props.onPress)[0];
    expect(preview.findAll(x => x.props.interactive === false && x.props.markers).length).toBeGreaterThan(0);
    expect(tree.root.findAll(x => x.props.pick && x.props.onPick && x.props.zoomControl).length).toBe(0);
    await press(tree.root, 'mapa-escolher');
    const picker = tree.root.findAll(x => x.props.pick && x.props.onPick && x.props.zoomControl)[0];
    await act(async () => picker.props.onPick({lat: -22.9, lng: -48.45}));
    await press(tree.root, 'confirmar-local');
    expect(tree.root.findAll(x => x.props.pick && x.props.onPick && x.props.zoomControl).length).toBe(0);
    await press(tree.root, 'publicar-aviso');
    const post = fetchImpl.mock.calls.find(c => c[1]?.method === 'POST');
    const body = JSON.parse(post[1].body);
    expect(body).toMatchObject({type: 'LOST', species: 'DOG', petId: 'p1', petName: 'Thor', size: 'MEDIO', colors: 'caramelo', lat: -22.9, lng: -48.45, whatsapp: '14998123456', photos: ['data:image/jpeg;base64,AAAA']});
    expect(Alert.alert.mock.calls[Alert.alert.mock.calls.length - 1][1]).toBe('Avisamos 5 pessoas por perto.');
    expect(nav.replace).toHaveBeenCalledWith('LostFoundDetail', {id: 'new1'});
  });

  test('detalhe: WhatsApp com mensagem pronta, como chegar, compartilhar e denunciar', async () => {
    const fetchImpl = jest.fn(async (url, init = {}) => (init.method === 'POST' ? json({message: 'Obrigado!'}, true, 201) : json({report: REPORT})));
    const openUrl = jest.fn();
    const share = jest.fn();
    let tree;
    await act(async () => {
      tree = renderer.create(<LostFoundDetailScreen navigation={{setOptions: jest.fn()}} route={{params: {id: 'r1'}}} fetchImpl={fetchImpl} openUrl={openUrl} share={share} />);
    });
    await flush();
    const t = allText(tree.root);
    expect(t).toContain('ENCONTRADO');
    expect(t).toContain('Está comigo');
    expect(t).toContain('Perto da praça · Centro');
    expect(t).toContain('Nunca faça PIX');
    await press(tree.root, 'whatsapp');
    expect(openUrl.mock.calls[0][0]).toMatch(/^https:\/\/wa\.me\/5514997001122/);
    await press(tree.root, 'como-chegar');
    expect(openUrl.mock.calls[1][0]).toContain('destination=-22.89,-48.44');
    await press(tree.root, 'mapa-aviso');
    await press(tree.root, 'como-chegar-mapa');
    expect(openUrl.mock.calls[2][0]).toContain('destination=-22.89,-48.44');
    await press(tree.root, 'fechar-mapa');
    await press(tree.root, 'compartilhar');
    expect(share.mock.calls[0][0].message).toContain('https://api.test/api/public/lostfound/r1');
    await press(tree.root, 'denunciar');
    await act(async () => tree.root.findAll(x => x.props.testID === 'motivo-denuncia' && x.props.onChangeText)[0].props.onChangeText('Pediu PIX'));
    await press(tree.root, 'enviar-denuncia');
    const flag = fetchImpl.mock.calls.find(c => c[1]?.method === 'POST');
    expect(flag[0]).toBe('https://api.test/api/lostfound/r1/flag');
    expect(JSON.parse(flag[1].body)).toEqual({reason: 'Pediu PIX'});
  });

  test('detalhe do dono: possíveis encontros e "encontrei meu pet"', async () => {
    const mine = {...REPORT, id: 'm1', type: 'LOST', mine: true, petName: 'Thor', whatsapp: '5514998123456'};
    const fetchImpl = jest.fn(async (url, init = {}) => {
      if (url.endsWith('/matches')) return json({matches: [{...REPORT, score: 80}]});
      if (init.method === 'POST') return json({message: 'Que notícia boa!'});
      return json({report: mine});
    });
    jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      const yes = (buttons || []).find(b => b.text === 'Sim!');
      if (yes) yes.onPress();
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<LostFoundDetailScreen navigation={{setOptions: jest.fn(), push: jest.fn()}} route={{params: {id: 'm1'}}} fetchImpl={fetchImpl} openUrl={jest.fn()} share={jest.fn()} />);
    });
    await flush();
    await flush();
    const t = allText(tree.root);
    expect(t).toContain('Pode ser o seu?');
    expect(tree.root.findAll(x => x.props.testID === 'whatsapp').length).toBe(0);
    await press(tree.root, 'resolver');
    expect(fetchImpl.mock.calls.find(c => c[1]?.method === 'POST')[0]).toBe('https://api.test/api/lostfound/m1/resolve');
  });

  test('alertas: raio, espécie e localização', async () => {
    const fetchImpl = jest.fn(async (url, init = {}) => (init.method === 'PUT' ? json({alerts: {}}) : json({alerts: null})));
    const nav = {goBack: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<LostFoundAlertsScreen navigation={nav} fetchImpl={fetchImpl} />);
    });
    await flush();
    await flush();
    await press(tree.root, 'raio-5');
    await press(tree.root, 'especie-CAT');
    await press(tree.root, 'salvar-alertas');
    const put = fetchImpl.mock.calls.find(c => c[1]?.method === 'PUT');
    expect(JSON.parse(put[1].body)).toMatchObject({enabled: true, radiusKm: 5, species: 'CAT', notifyFound: true, notifyLost: true, lat: -22.8859, lng: -48.4435});
    expect(nav.goBack).toHaveBeenCalled();
  });
});
