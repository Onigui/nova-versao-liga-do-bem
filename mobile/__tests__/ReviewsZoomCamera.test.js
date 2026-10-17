/**
 * Avaliações discretas na página da empresa, zoom da receita e permissão da câmera.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, PermissionsAndroid, Platform, Text} from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k === 'auth_token' ? 'tok' : null)),
  setItem: jest.fn(async () => {}),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-webview', () => ({WebView: 'WebView'}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
const mockPicker = {launchCamera: jest.fn(async () => ({assets: [{base64: 'abc', uri: 'file://x.jpg', type: 'image/jpeg'}]})), launchImageLibrary: jest.fn(async () => ({didCancel: true}))};
jest.mock('react-native-image-picker', () => mockPicker);
const mockApi = jest.fn();
jest.mock('../src/utils/quotes', () => {
  const actual = jest.requireActual('../src/utils/quotes');
  return {...actual, memberApi: () => mockApi};
});

import PartnerDetailScreen from '../src/screens/PartnerDetailScreen';
import ZoomImageModal, {zoomHtml} from '../src/components/ZoomImageModal';
import {launchPicker} from '../src/utils/photoPicker';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const textOf = root => root.findAllByType(Text).map(t => [].concat(t.props.children).flat().join('')).join(' | ');
const PARTNER = {id: 'p1', name: 'Pet Shop Central', category: 'Pet shop', description: '10% em tudo', discounts: []};

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ok: true, json: async () => ({prices: []})}));
});

test('página da empresa mostra só a média e leva para a página de avaliações', async () => {
  mockApi.mockResolvedValue({
    summary: {count: 23, rating: 4.66, distribution: {5: 18, 4: 3, 3: 1, 2: 1, 1: 0}, tags: []},
    reviews: [{id: 'r1', author: 'Ana', rating: 5, comment: 'Ótimo atendimento', createdAt: '2026-10-01'}],
    tags: [],
    me: {canReview: true},
  });
  const nav = {navigate: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<PartnerDetailScreen route={{params: {partner: PARTNER}}} navigation={nav} />);
  });
  await flush();
  expect(mockApi).toHaveBeenCalledWith('GET', '/partners/p1/reviews?limit=1');
  const txt = textOf(tree.root);
  expect(txt).toMatch(/4,7/);
  expect(txt).toMatch(/· 23 avaliações/);
  expect(txt).not.toMatch(/Ótimo atendimento/); // comentários ficam na página separada
  const pill = tree.root.findAll(n => n.props.testID === 'avaliacoes' && n.props.onPress)[0];
  pill.props.onPress();
  expect(nav.navigate).toHaveBeenCalledWith('PartnerReviews', {partnerId: 'p1', partnerName: 'Pet Shop Central'});
});

test('sem avaliações: convite discreto', async () => {
  mockApi.mockResolvedValue({summary: {count: 0, rating: 0, distribution: {}}, reviews: [], tags: [], me: {canReview: true}});
  let tree;
  await act(async () => {
    tree = renderer.create(<PartnerDetailScreen route={{params: {partner: PARTNER}}} navigation={{navigate: jest.fn()}} />);
  });
  await flush();
  expect(textOf(tree.root)).toMatch(/Seja o primeiro a avaliar/);
});

test('receita em tela cheia com zoom (baixa com o token)', async () => {
  const blob = {size: 3};
  const fetchImpl = jest.fn(async () => ({ok: true, blob: async () => blob}));
  global.FileReader = class {
    readAsDataURL() {
      this.result = 'data:image/jpeg;base64,AAA';
      this.onload();
    }
  };
  let tree;
  await act(async () => {
    tree = renderer.create(<ZoomImageModal visible uri="https://api.test/api/partner/quotes/q1/prescription" headers={{Authorization: 'Bearer t'}} onClose={() => {}} fetchImpl={fetchImpl} />);
  });
  await flush();
  expect(fetchImpl).toHaveBeenCalledWith('https://api.test/api/partner/quotes/q1/prescription', {headers: {Authorization: 'Bearer t'}});
  const wv = tree.root.findByProps({testID: 'zoom-webview'});
  expect(wv.props.source.html).toContain('data:image/jpeg;base64,AAA');
  expect(zoomHtml('x')).toMatch(/user-scalable=yes/);
  expect(zoomHtml('x')).toMatch(/maximum-scale=8/);
});

describe('câmera no Android', () => {
  const origOS = Platform.OS;
  beforeAll(() => {
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = origOS;
  });

  test('pede a permissão antes de abrir a câmera', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const req = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    const res = await launchPicker('camera', {mediaType: 'photo', includeBase64: true});
    expect(req).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.CAMERA, expect.any(Object));
    expect(mockPicker.launchCamera).toHaveBeenCalledWith(expect.objectContaining({mediaType: 'photo', saveToPhotos: false}));
    expect(res.assets[0].base64).toBe('abc');
  });

  test('permissão negada: não abre a câmera; bloqueada: oferece abrir as configurações', async () => {
    mockPicker.launchCamera.mockClear();
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    expect(await launchPicker('camera', {})).toBeNull();
    expect(mockPicker.launchCamera).not.toHaveBeenCalled();
    expect(alert.mock.calls[0][0]).toBe('Câmera bloqueada');
  });

  test('galeria não pede permissão de câmera', async () => {
    const req = jest.spyOn(PermissionsAndroid, 'request').mockClear();
    await launchPicker('library', {});
    expect(req).not.toHaveBeenCalled();
    expect(mockPicker.launchImageLibrary).toHaveBeenCalled();
  });
});
