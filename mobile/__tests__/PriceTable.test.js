/**
 * Tabela de preços: parceiro cadastra preço; membro compara entre parceiros.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {PermissionsAndroid, Platform, Text} from 'react-native';

const mockStore = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v;
  }),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
  },
}));
jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  getCurrentPosition: jest.fn(ok => ok({coords: {latitude: -22.8859, longitude: -48.4435}})),
  requestAuthorization: jest.fn(),
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {locationEnabled: true}})}));
const mockCtx = {api: jest.fn()};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import PriceTableScreen from '../src/partner/screens/PriceTableScreen';
import PriceEditScreen, {buildPriceBody, parseMoney} from '../src/partner/screens/PriceEditScreen';
import ComparePricesScreen from '../src/screens/ComparePricesScreen';
import PriceOffersScreen from '../src/screens/PriceOffersScreen';
import {sortOffers, spread, updatedLabel} from '../src/utils/priceCompare';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root =>
  root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).join(''))
    .join(' | ');
const press = async (root, id) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onPress)[0];
  await act(async () => n.props.onPress());
  await flush();
};
const type = async (root, id, text) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onChangeText)[0];
  await act(async () => n.props.onChangeText(text));
};

const ITEM = {id: 'cast', label: 'Castração · gato macho', categoryLabel: 'Cirurgias e procedimentos', custom: false, myPrice: null};

describe('utilitários', () => {
  test('dinheiro, validação e comparação', () => {
    expect(parseMoney('1.250,50')).toBe(1250.5);
    expect(parseMoney('99.9')).toBe(99.9);
    expect(parseMoney('')).toBeNull();
    expect(buildPriceBody({price: '200', memberPrice: '', available: true, note: ''}).error).toMatch(/membros/);
    expect(buildPriceBody({price: '200', memberPrice: '250', available: true, note: ''}).error).toMatch(/maior/);
    expect(buildPriceBody({price: '', memberPrice: '180,00', available: false, note: ' x '}).body).toEqual({price: null, memberPrice: 180, available: false, note: 'x'});
    const now = Date.parse('2026-10-14T12:00:00Z');
    expect(updatedLabel('2026-10-14T08:00:00Z', now)).toBe('atualizado hoje');
    expect(updatedLabel('2026-10-04T08:00:00Z', now)).toBe('atualizado há 10 dias');
    expect(updatedLabel('2026-07-04T08:00:00Z', now)).toBe('atualizado há 3 meses');
    const offers = [
      {partner: {id: 'a', name: 'Longe barato', latitude: -22.95, longitude: -48.5}, memberPrice: 180, available: true},
      {partner: {id: 'b', name: 'Perto caro', latitude: -22.886, longitude: -48.4435}, memberPrice: 240, available: true},
      {partner: {id: 'c', name: 'Sem estoque', latitude: null}, memberPrice: 100, available: false},
    ];
    const me = {latitude: -22.8859, longitude: -48.4435};
    expect(sortOffers(offers, {by: 'price', location: me}).map(o => o.partner.id)).toEqual(['a', 'b', 'c']);
    expect(sortOffers(offers, {by: 'distance', location: me}).map(o => o.partner.id)).toEqual(['b', 'a', 'c']);
    expect(sortOffers(offers).find(o => o.cheapest).partner.id).toBe('a');
    expect(spread(offers)).toBe(60);
  });
});

describe('App Parceiros', () => {
  beforeEach(() => jest.clearAllMocks());

  test('sem nenhum preço ainda: abre o catálogo inteiro', async () => {
    mockCtx.api.mockImplementation(async (m, path) =>
      path.includes('mine=1')
        ? {categories: [], priced: 0, canEdit: true, items: []}
        : {categories: [{id: 'PROCEDIMENTOS', label: 'Cirurgias'}], priced: 0, canEdit: true, items: [ITEM]},
    );
    const nav = {navigate: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<PriceTableScreen navigation={nav} />);
    });
    await flush();
    expect(allText(tree.root)).toContain('Castração · gato macho');
    expect(allText(tree.root)).toContain('+ Preço');
    await press(tree.root, 'item-cast');
    expect(nav.navigate).toHaveBeenCalledWith('PriceEdit', {item: ITEM});
  });

  test('preço com desconto calculado e prévia do que o membro vê', async () => {
    mockCtx.api.mockResolvedValue({});
    const nav = {goBack: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<PriceEditScreen navigation={nav} route={{params: {item: ITEM}}} />);
    });
    await type(tree.root, 'preco-normal', '300,00');
    await press(tree.root, 'pct-20');
    expect(allText(tree.root)).toContain('O membro vê: R$ 240,00 (20% abaixo do preço normal de R$ 300,00)');
    await press(tree.root, 'salvar-preco');
    expect(mockCtx.api).toHaveBeenCalledWith('PUT', '/partner/prices/cast', {price: 300, memberPrice: 240, available: true, note: null});
    expect(nav.goBack).toHaveBeenCalled();
  });

  test('item próprio: cria e já dá o preço', async () => {
    mockCtx.api.mockImplementation(async (m, path) => (path === '/partner/catalog-items' ? {item: {id: 'eco', label: 'Ecocardiograma'}} : {}));
    let tree;
    await act(async () => {
      tree = renderer.create(<PriceEditScreen navigation={{goBack: jest.fn()}} route={{params: {newItem: true, presetName: 'Ecocardiograma'}}} />);
    });
    await press(tree.root, 'nova-cat-EXAMES');
    await type(tree.root, 'preco-membro', '180');
    await press(tree.root, 'salvar-preco');
    expect(mockCtx.api.mock.calls[0]).toEqual(['POST', '/partner/catalog-items', {category: 'EXAMES', name: 'Ecocardiograma', variant: '', species: 'ALL'}]);
    expect(mockCtx.api.mock.calls[1]).toEqual(['PUT', '/partner/prices/eco', {price: null, memberPrice: 180, available: true, note: null}]);
  });
});

describe('App dos membros', () => {
  beforeAll(() => {
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = 'ios';
  });

  test('busca no catálogo mostra "a partir de" e abre as ofertas', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({items: [{id: 'cast', label: 'Castração · gato macho', categoryLabel: 'Cirurgias e procedimentos', offers: 3, minMemberPrice: 199.9}]}),
    }));
    const nav = {navigate: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<ComparePricesScreen navigation={nav} route={{}} fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/api/catalog?offered=1');
    const t = allText(tree.root);
    expect(t).toContain('a partir de');
    expect(t).toContain('R$ 199,90');
    expect(t).toContain('3 parceiros');
    await press(tree.root, 'especie-CAT');
    expect(fetchImpl.mock.calls[1][0]).toBe('https://api.test/api/catalog?offered=1&species=CAT');
    await press(tree.root, 'item-cast');
    expect(nav.navigate).toHaveBeenCalledWith('PriceOffers', {item: expect.objectContaining({id: 'cast'})});
  });

  test('ofertas: menor preço em destaque, ordenar por distância', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        item: {id: 'cast', label: 'Castração · gato macho'},
        offers: [
          {partner: {id: 'b', name: 'Clínica Perto', latitude: -22.886, longitude: -48.4435}, price: 300, memberPrice: 240, savings: 20, available: true, updatedAt: new Date().toISOString()},
          {partner: {id: 'a', name: 'Clínica Longe', latitude: -22.95, longitude: -48.5}, price: null, memberPrice: 199.9, available: true, updatedAt: new Date().toISOString(), note: 'Inclui anestesia'},
        ],
      }),
    }));
    const nav = {navigate: jest.fn(), setOptions: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<PriceOffersScreen navigation={nav} route={{params: {item: {id: 'cast', label: 'Castração · gato macho'}}}} fetchImpl={fetchImpl} />);
    });
    await flush();
    await flush();
    let t = allText(tree.root);
    expect(t).toContain('diferença de até R$ 40,10');
    expect(t.indexOf('Clínica Longe')).toBeLessThan(t.indexOf('Clínica Perto'));
    expect(t).toContain('MENOR PREÇO');
    expect(t).toContain('Inclui anestesia');
    expect(t).toContain('membro · -20%');
    await press(tree.root, 'ordenar-distance');
    t = allText(tree.root);
    expect(t.indexOf('Clínica Perto')).toBeLessThan(t.indexOf('Clínica Longe'));
    await press(tree.root, 'oferta-a');
    expect(nav.navigate).toHaveBeenCalledWith('PartnerDetail', {partner: expect.objectContaining({id: 'a', name: 'Clínica Longe'})});
  });
});
