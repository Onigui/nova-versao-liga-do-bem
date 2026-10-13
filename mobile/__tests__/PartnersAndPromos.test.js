/**
 * Lista de parceiros (GPS, distância, "Perto de mim", "Aberto agora") e tipos de promoção.
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
  removeItem: jest.fn(async k => {
    delete mockStore[k];
  }),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
const mockAuth = {user: {locationEnabled: true}};
jest.mock('../src/services/AuthService', () => ({useAuth: () => mockAuth}));
jest.mock('@react-native-community/geolocation', () => ({
  setRNConfiguration: jest.fn(),
  getCurrentPosition: jest.fn(),
  requestAuthorization: jest.fn(),
}));
const mockGeo = require('@react-native-community/geolocation');
const mockCtx = {api: jest.fn(), partner: {name: 'Ração Nobre', category: 'Ração', address: 'Rua A'}};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import {describePromo, partnerBadge} from '../src/utils/promo';
import {distanceKm, formatDistance} from '../src/utils/geo';
import {openStatus} from '../src/utils/openingHours';
import {applyPartnerFilters, availableCategories, categoryFromRoute, categoryOf} from '../src/utils/partnerFilters';
import PartnersScreen from '../src/screens/PartnersScreen';
import DiscountFormScreen, {buildDiscountPayload} from '../src/partner/screens/DiscountFormScreen';
import ValidateScreen from '../src/partner/screens/ValidateScreen';

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

// Segunda-feira, 12/10/2026 10:00 (horário local do teste)
const MONDAY_10AM = new Date(2026, 9, 12, 10, 0);

describe('tipos de promoção', () => {
  test('cada tipo tem um selo que não confunde desconto com preço', () => {
    expect(describePromo({kind: 'PERCENT', percentage: 20}).badge).toBe('20% OFF');
    expect(describePromo({kind: 'AMOUNT_OFF', fixedAmount: 10}).badge).toBe('R$ 10 OFF');
    expect(describePromo({kind: 'AMOUNT_OFF', fixedAmount: 10}).label).toBe('R$ 10,00 de desconto');
    const fp = describePromo({kind: 'FINAL_PRICE', promoPrice: 69.9, originalPrice: 89.9});
    expect(fp.badge).toBe('Por R$ 69,90');
    expect(fp.badge).not.toMatch(/OFF/);
    expect(fp.label).toBe('De R$ 89,90 por R$ 69,90');
    expect(fp.savings).toBe(22);
    expect(describePromo({kind: 'FINAL_PRICE', promoPrice: 1299}).badge).toBe('Por R$ 1.299,00');
    expect(describePromo({kind: 'OTHER', benefitText: 'Leve 3, pague 2'}).badge).toBe('Leve 3, pague 2');
    // dados antigos sem "kind"
    expect(describePromo({percentage: 15}).badge).toBe('15% OFF');
    expect(describePromo({fixedAmount: '15.00'}).badge).toBe('R$ 15 OFF');
  });

  test('selo do parceiro: promoção mais recente; API antiga ainda funciona', () => {
    expect(partnerBadge({}, [{kind: 'FINAL_PRICE', promoPrice: 50}])).toBe('Por R$ 50,00');
    expect(partnerBadge({discount: '10%'}, [])).toBe('10% OFF');
    expect(partnerBadge({discount: 'Sem desconto'}, [])).toBeNull();
  });

  test('formulário do parceiro monta o corpo por tipo', () => {
    const base = {name: 'Ração Gold', description: '', type: 'FINAL_PRICE', value: '69,90', originalPrice: '89,90', benefitText: '', validFrom: '', validUntil: '', isActive: true};
    expect(buildDiscountPayload(base).body).toMatchObject({kind: 'FINAL_PRICE', promoPrice: 69.9, originalPrice: 89.9});
    expect(buildDiscountPayload({...base, originalPrice: '50'}).error).toMatch(/maior/);
    expect(buildDiscountPayload({...base, originalPrice: ''}).body.originalPrice).toBeNull();
    expect(buildDiscountPayload({...base, type: 'OTHER', benefitText: ' Brinde '}).body).toMatchObject({kind: 'OTHER', benefitText: 'Brinde'});
    expect(buildDiscountPayload({...base, type: 'OTHER'}).error).toMatch(/benefício/);
    expect(buildDiscountPayload({...base, type: 'AMOUNT_OFF', value: '10'}).body).toMatchObject({kind: 'AMOUNT_OFF', fixedAmount: 10});
  });
});

describe('distância e horário', () => {
  test('distância e formato', () => {
    const d = distanceKm({latitude: -22.8859, longitude: -48.4435}, {latitude: -22.8901, longitude: -48.4418});
    expect(d).toBeGreaterThan(0.4);
    expect(d).toBeLessThan(0.6);
    expect(distanceKm({latitude: 1, longitude: 1}, {latitude: null, longitude: null})).toBeNull();
    expect(distanceKm({latitude: '-22.8', longitude: '-48.4'}, {latitude: '-22.8', longitude: '-48.4'})).toBe(0);
    expect(formatDistance(0.347)).toBe('350 m');
    expect(formatDistance(2.43)).toBe('2,4 km');
    expect(formatDistance(18.6)).toBe('19 km');
    expect(formatDistance(null)).toBeNull();
  });

  test('aberto agora', () => {
    expect(openStatus('Seg-Sex: 08:00-18:00', MONDAY_10AM)).toEqual({open: true, label: 'Aberto agora · fecha às 18:00'});
    expect(openStatus('Seg-Sex: 11:00-18:00', MONDAY_10AM).label).toBe('Fechado · abre hoje às 11:00');
    expect(openStatus('Sáb: 08:00-12:00', MONDAY_10AM).label).toBe('Fechado · abre sábado às 08:00');
    expect(openStatus('Dom: 18:00-02:00', new Date(2026, 9, 12, 1, 0)).open).toBe(true); // madrugada de segunda
    expect(openStatus('Seg-Dom: 00:00-23:59', MONDAY_10AM).label).toBe('Aberto agora · 24 horas');
    expect(openStatus('', MONDAY_10AM)).toBeNull();
    expect(openStatus('Com hora marcada', MONDAY_10AM)).toBeNull();
  });
});

describe('filtros da lista', () => {
  const ME = {latitude: -22.8859, longitude: -48.4435};
  const list = [
    {id: 'a', name: 'Clinica VetVida', category: 'Clinica Veterinaria', latitude: -22.8901, longitude: -48.4418, hours: 'Seg-Sex: 08:00-18:00', address: 'Av. Dom Lucio'},
    {id: 'b', name: 'PetShop Amigo Fiel', category: 'Pet Shop', latitude: -22.8859, longitude: -48.4435, hours: '', address: 'Rua das Flores'},
    {id: 'c', name: 'Empresa teste', category: 'pet-shop', latitude: null, longitude: null, hours: 'Sáb: 08:00-12:00', address: 'Rua teste'},
    {id: 'd', name: 'Ração Nobre', category: 'Loja de Racao', latitude: -22.95, longitude: -48.5, hours: 'Seg-Dom: 00:00-23:59', address: 'Centro'},
  ];

  test('categorias escritas de jeitos diferentes caem no mesmo filtro', () => {
    expect(categoryOf(list[1])).toBe('pet');
    expect(categoryOf(list[2])).toBe('pet');
    expect(categoryOf(list[0])).toBe('vet');
    expect(categoryOf(list[3])).toBe('racao');
    expect(availableCategories(list).map(c => c.id)).toEqual(['pet', 'vet', 'racao']);
    expect(categoryFromRoute('veterinária')).toBe('vet');
    expect(categoryFromRoute('veterinario')).toBe('vet');
  });

  test('perto de mim ordena pela distância e deixa sem localização no fim', () => {
    const r = applyPartnerFilters(list, {nearMe: true, location: ME, now: MONDAY_10AM});
    expect(r.map(p => p.id)).toEqual(['b', 'a', 'd', 'c']);
    expect(r[0].distanceKm).toBe(0);
    expect(r[3].distanceKm).toBeNull();
  });

  test('aberto agora + categoria + busca sem acento', () => {
    expect(applyPartnerFilters(list, {openNow: true, now: MONDAY_10AM}).map(p => p.id)).toEqual(['a', 'd']);
    expect(applyPartnerFilters(list, {category: 'pet', now: MONDAY_10AM}).map(p => p.id)).toEqual(['c', 'b']);
    expect(applyPartnerFilters(list, {query: 'racao', now: MONDAY_10AM}).map(p => p.id)).toEqual(['d']);
  });
});

describe('tela de parceiros com GPS', () => {
  const API = [
    {id: 'a', name: 'Clinica VetVida', category: 'Clinica Veterinaria', latitude: -22.8901, longitude: -48.4418, address: 'Av', hours: null, discounts: [{id: 'x', kind: 'FINAL_PRICE', promoPrice: 69.9}]},
    {id: 'b', name: 'PetShop Amigo Fiel', category: 'Pet Shop', latitude: -22.8859, longitude: -48.4435, address: 'Rua', hours: null, discounts: []},
  ];
  beforeAll(() => {
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = 'ios';
  });
  beforeEach(() => {
    for (const k of Object.keys(mockStore)) delete mockStore[k];
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({ok: true, json: async () => ({partners: API})}));
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  });

  const mount = async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<PartnersScreen navigation={{navigate: jest.fn()}} route={{}} />);
    });
    await flush();
    await flush();
    return tree;
  };

  test('permite → mostra a distância e ordena do mais perto', async () => {
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      'android.permission.ACCESS_FINE_LOCATION': 'granted',
      'android.permission.ACCESS_COARSE_LOCATION': 'granted',
    });
    mockGeo.getCurrentPosition.mockImplementation(ok => ok({coords: {latitude: -22.8859, longitude: -48.4435, accuracy: 10}}));
    const tree = await mount();
    const t = allText(tree.root);
    expect(t).toContain('Ordenado do mais perto');
    expect(t.indexOf('PetShop Amigo Fiel')).toBeLessThan(t.indexOf('Clinica VetVida'));
    expect(t).toContain('500 m');
    // preço final aparece sem "OFF"
    expect(t).toContain('Por R$ 69,90');
    expect(t).not.toContain('69,90 OFF');
  });

  test('GPS demora → usa a localização aproximada', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    mockGeo.getCurrentPosition
      .mockImplementationOnce((ok, err) => err({code: 3, message: 'timeout'}))
      .mockImplementationOnce(ok => ok({coords: {latitude: -22.8859, longitude: -48.4435}}));
    const tree = await mount();
    expect(mockGeo.getCurrentPosition.mock.calls[1][2]).toMatchObject({enableHighAccuracy: false});
    expect(allText(tree.root)).toContain('Ordenado do mais perto');
  });

  test('negou para sempre → aviso com "Abrir configurações"', async () => {
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      'android.permission.ACCESS_FINE_LOCATION': 'never_ask_again',
      'android.permission.ACCESS_COARSE_LOCATION': 'never_ask_again',
    });
    const tree = await mount();
    expect(allText(tree.root)).toContain('Abrir configurações');
    expect(allText(tree.root)).not.toContain('Ordenado do mais perto');
  });

  test('GPS desligado → aviso "Ligar GPS"', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    mockGeo.getCurrentPosition.mockImplementation((ok, err) => err({code: 2, message: 'No location provider available'}));
    const tree = await mount();
    expect(allText(tree.root)).toContain('Ligar GPS');
  });

  test('membro desligou a localização no perfil → não pede sozinho; "Perto de mim" pede', async () => {
    mockAuth.user = {locationEnabled: false};
    const req = jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      'android.permission.ACCESS_FINE_LOCATION': 'granted',
    });
    mockGeo.getCurrentPosition.mockImplementation(ok => ok({coords: {latitude: -22.8859, longitude: -48.4435}}));
    const tree = await mount();
    expect(req).not.toHaveBeenCalled();
    expect(allText(tree.root)).toContain('Permitir');
    await press(tree.root, 'filtro-perto');
    await flush();
    expect(req).toHaveBeenCalled();
    expect(allText(tree.root)).toContain('Ordenado do mais perto');
    mockAuth.user = {locationEnabled: true};
  });

  test('sem internet: usa a última lista baixada', async () => {
    mockStore.partners_cache_v2 = JSON.stringify([{id: 'z', name: 'Guardada', category: 'Pet Shop', address: 'Rua', discounts: []}]);
    global.fetch = jest.fn(async () => {
      throw new Error('offline');
    });
    const tree = await mount();
    expect(allText(tree.root)).toContain('Guardada');
  });
});

describe('App Parceiros', () => {
  test('nova promoção "Preço promocional": prévia mostra De/Por e o selo sem OFF', async () => {
    mockCtx.api.mockResolvedValue({});
    const nav = {goBack: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<DiscountFormScreen navigation={nav} route={{params: {}}} />);
    });
    await press(tree.root, 'tipo-FINAL_PRICE');
    await type(tree.root, 'nome', 'Ração Gold 20 kg');
    await type(tree.root, 'preco-normal', '89,90');
    await type(tree.root, 'valor', '69,90');
    const t = allText(tree.root);
    expect(t).toContain('Por R$ 69,90');
    expect(t).toContain('De R$ 89,90');
    expect(t).toContain('economize 22%');
    expect(t).not.toContain('69,90 OFF');
    await press(tree.root, 'salvar');
    expect(mockCtx.api).toHaveBeenCalledWith('POST', '/partner/discounts', expect.objectContaining({kind: 'FINAL_PRICE', promoPrice: 69.9, originalPrice: 89.9}));
  });

  test('editar promoção antiga de R$ abre no tipo certo', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<DiscountFormScreen navigation={{goBack: jest.fn()}} route={{params: {discount: {id: 'd', name: 'x', fixedAmount: 15, isActive: true, validFrom: '2026-10-01T03:00:00Z'}}}} />);
    });
    const sel = tree.root.findAll(x => x.props.testID === 'tipo-AMOUNT_OFF' && x.props.accessibilityState)[0];
    expect(sel.props.accessibilityState.selected).toBe(true);
    expect(allText(tree.root)).toContain('R$ 15 OFF');
  });

  test('validação digitada exige o código de 6 números', async () => {
    const nav = {navigate: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<ValidateScreen navigation={nav} />);
    });
    await type(tree.root, 'numero', 'mem39089178');
    const btn = () => tree.root.findAll(x => x.props.testID === 'consultar' && x.props.onPress)[0];
    expect(btn().props.disabled).toBe(true);
    await type(tree.root, 'codigo', '482-913');
    expect(btn().props.disabled).toBe(false);
    await press(tree.root, 'consultar');
    expect(nav.navigate).toHaveBeenCalledWith('ValidationResult', {code: 'MEM39089178 482913'});
  });
});
