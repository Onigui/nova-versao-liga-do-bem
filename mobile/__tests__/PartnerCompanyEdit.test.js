/**
 * App Parceiros → Dados da empresa: grade de horários, logo por foto e prévia como o membro vê.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Switch, Text, TextInput} from 'react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({})}));
const mockPicker = {launchImageLibrary: jest.fn()};
jest.mock('react-native-image-picker', () => mockPicker);
const mockCtx = {api: jest.fn(), setPartner: jest.fn(), partner: null};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import {
  emptyWeek,
  maskTime,
  normalizeTime,
  parseWeek,
  presetWeek,
  serializeWeek,
  validateWeek,
} from '../src/utils/hoursGrid';
import {toMemberPartner} from '../src/utils/partnerView';
import CompanyEditScreen, {
  composeAddress,
  currentDiscounts,
  maskPhone,
} from '../src/partner/screens/CompanyEditScreen';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root =>
  root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).join(''))
    .join(' | ');
const byID = (root, id) => root.findAll(x => x.props.testID === id)[0];
const press = async (root, id) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onPress)[0];
  await act(async () => n.props.onPress());
  await flush();
};
const type = async (root, id, text) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onChangeText)[0];
  await act(async () => n.props.onChangeText(text));
};

const PARTNER = {
  id: 'p1',
  name: 'Pet Feliz',
  category: 'Pet shop',
  description: 'Banho e tosa',
  phone: '(14) 3811-1234',
  email: 'contato@pet.com',
  website: '',
  address: 'Rua A, 10 - Centro',
  city: 'Botucatu',
  state: 'SP',
  zipCode: '18600-000',
  hours: 'Seg-Sex: 08:00-18:00 | Sáb: 08:00-12:00',
  logo: null,
};

describe('grade de horários', () => {
  test('lê e grava no mesmo formato do app dos membros', () => {
    const w = parseWeek(PARTNER.hours);
    expect(w[1]).toEqual({open: true, from: '08:00', to: '18:00'});
    expect(w[6]).toEqual({open: true, from: '08:00', to: '12:00'});
    expect(w[0].open).toBe(false);
    expect(serializeWeek(w)).toBe(PARTNER.hours);
    expect(serializeWeek(presetWeek('everyday'))).toBe('Seg-Dom: 08:00-20:00');
    expect(serializeWeek(presetWeek('commercial'))).toBe('Seg-Sex: 08:00-18:00 | Sáb: 08:00-12:00');
    expect(serializeWeek(emptyWeek())).toBe('');
  });

  test('aceita variações comuns e recusa texto livre', () => {
    expect(parseWeek('Seg a Sex: 8h-18h')[3]).toEqual({open: true, from: '08:00', to: '18:00'});
    expect(parseWeek('Sábado: 09:00 às 13:00')[6]).toEqual({open: true, from: '09:00', to: '13:00'});
    expect(parseWeek('Atendimento com hora marcada')).toBeNull();
    expect(parseWeek('')).toBeNull();
  });

  test('máscara e validação', () => {
    expect(maskTime('0830')).toBe('08:30');
    expect(normalizeTime('8')).toBe('08:00');
    expect(normalizeTime('2561')).toBeNull();
    const w = presetWeek('commercial');
    w[2] = {open: true, from: '18:00', to: '08:00'};
    w[3] = {open: true, from: '99', to: '10:00'};
    const e = validateWeek(w);
    expect(e[2]).toMatch(/depois/);
    expect(e[3]).toMatch(/inválido/);
    expect(e[1]).toBeUndefined();
  });
});

describe('helpers da edição', () => {
  test('endereço, telefone e promoções vigentes', () => {
    expect(composeAddress({street: 'Rua B', number: '20', complement: 'Sala 2', district: 'Centro'})).toBe(
      'Rua B, 20 - Sala 2 - Centro',
    );
    expect(composeAddress({street: 'Rua B'})).toBe('Rua B');
    expect(maskPhone('14998123456')).toBe('(14) 99812-3456');
    expect(maskPhone('1438111234')).toBe('(14) 3811-1234');
    const now = Date.parse('2026-10-13T12:00:00Z');
    const list = [
      {id: 'a', isActive: true},
      {id: 'b', isActive: false},
      {id: 'c', isActive: true, validUntil: '2026-10-01T00:00:00Z'},
      {id: 'd', isActive: true, validFrom: '2026-11-01T00:00:00Z'},
    ];
    expect(currentDiscounts(list, now).map(d => d.id)).toEqual(['a']);
  });

  test('toMemberPartner usa a primeira promoção como selo', () => {
    const m = toMemberPartner(PARTNER, [{id: 'x', percentage: 15}]);
    expect(m.discount).toBe('15%');
    expect(m.whatsapp).toBe('1438111234');
    expect(toMemberPartner(PARTNER, []).discount).toBe('Sem desconto');
  });
});

describe('tela Dados da empresa', () => {
  let nav;
  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx.partner = {...PARTNER};
    mockCtx.api.mockImplementation(async (method, path) => {
      if (path === '/partner/discounts') return {discounts: [{id: 'd1', name: 'Banho', percentage: 10, label: '10% OFF', isActive: true}]};
      if (path === '/partner/me') return {partner: {...PARTNER, name: 'Pet Feliz Centro'}};
      if (path === '/partner/logo') return {partner: {...PARTNER, logo: 'https://api.test/api/partners/p1/logo?v=1'}};
      return {};
    });
    nav = {goBack: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn()};
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    global.fetch = jest.fn(async () => ({json: async () => []}));
  });

  const mount = async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<CompanyEditScreen navigation={nav} />);
    });
    await flush();
    return tree;
  };

  test('prévia ao vivo acompanha o que é digitado e salvar só manda o que mudou', async () => {
    const tree = await mount();
    const root = tree.root;
    expect(allText(root)).toContain('Tudo salvo');
    expect(byID(root, 'salvar-empresa').props.disabled).toBe(true);

    await type(root, 'campo-nome', 'Pet Feliz Centro');
    expect(allText(root)).toContain('Pet Feliz Centro');
    expect(allText(root)).toContain('Alterações não salvas');
    // O selo da prévia vem da promoção ativa
    expect(allText(root)).toContain('10%');

    await press(root, 'salvar-empresa');
    expect(mockCtx.api).toHaveBeenCalledWith('PUT', '/partner/me', {name: 'Pet Feliz Centro'});
    expect(mockCtx.setPartner).toHaveBeenCalled();
    expect(nav.goBack).toHaveBeenCalled();
  });

  test('horário pela grade: desligar o sábado grava o texto certo', async () => {
    const tree = await mount();
    const root = tree.root;
    const sat = root.findAllByType(Switch).find(sw => sw.props.testID === 'dia-6');
    await act(async () => sat.props.onValueChange(false));
    expect(byID(root, 'horario-texto')).toBeTruthy();
    await press(root, 'salvar-empresa');
    expect(mockCtx.api).toHaveBeenCalledWith('PUT', '/partner/me', {hours: 'Seg-Sex: 08:00-18:00'});
  });

  test('horário inválido bloqueia o salvamento', async () => {
    const tree = await mount();
    const root = tree.root;
    await type(root, 'hora-1-de', '1900');
    await press(root, 'salvar-empresa');
    expect(allText(root)).toMatch(/fechamento precisa ser depois/);
    expect(mockCtx.api).not.toHaveBeenCalledWith('PUT', '/partner/me', expect.anything());
  });

  test('mudar o endereço monta o texto e busca as coordenadas', async () => {
    global.fetch = jest.fn(async () => ({json: async () => [{lat: '-22.88', lon: '-48.44'}]}));
    const tree = await mount();
    const root = tree.root;
    await type(root, 'campo-numero', '55');
    await press(root, 'salvar-empresa');
    expect(mockCtx.api).toHaveBeenCalledWith('PUT', '/partner/me', {
      address: 'Rua A, 10 - Centro, 55',
      latitude: -22.88,
      longitude: -48.44,
    });
  });

  test('trocar o logo envia a foto na hora', async () => {
    mockPicker.launchImageLibrary.mockResolvedValue({assets: [{base64: 'AAAA', type: 'image/png'}]});
    const tree = await mount();
    await press(tree.root, 'trocar-logo');
    expect(mockPicker.launchImageLibrary).toHaveBeenCalledWith(
      expect.objectContaining({includeBase64: true, maxWidth: 512}),
    );
    expect(mockCtx.api).toHaveBeenCalledWith('PUT', '/partner/logo', {imageBase64: 'data:image/png;base64,AAAA'});
    expect(mockCtx.setPartner).toHaveBeenCalledWith(expect.objectContaining({logo: expect.stringContaining('/logo')}));
  });

  test('aba "Como os membros veem" mostra a página da empresa', async () => {
    const tree = await mount();
    const root = tree.root;
    await press(root, 'aba-preview');
    expect(byID(root, 'previa')).toBeTruthy();
    const t = allText(root);
    expect(t).toContain('Promoções para membros');
    expect(t).toContain('Horário de Funcionamento');
    expect(t).toContain('Pet Feliz');
  });

  test('sair com alterações pede confirmação', async () => {
    let listener;
    nav.addListener = jest.fn((ev, fn) => {
      listener = fn;
      return () => {};
    });
    const tree = await mount();
    await type(tree.root, 'campo-nome', 'Outro nome');
    const e = {preventDefault: jest.fn(), data: {action: {type: 'GO_BACK'}}};
    act(() => listener(e));
    expect(e.preventDefault).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Descartar alterações?', expect.any(String), expect.any(Array));
  });
});
