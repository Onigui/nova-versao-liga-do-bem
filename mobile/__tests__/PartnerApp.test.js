/**
 * App Liga do Bem Parceiros: helpers, validação de carteirinha, promoções e QR rotativo do membro.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text, TextInput} from 'react-native';

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
jest.mock('@react-navigation/native', () => ({useFocusEffect: () => {}, useIsFocused: () => true}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));

const mockCtx = {api: jest.fn(), refresh: jest.fn(), isOwner: true};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({})}));

import {
  parseDateBR,
  maskDate,
  formatMoney,
  makePartnerApi,
} from '../src/partner/PartnerContext';
import {buildDiscountPayload} from '../src/partner/screens/DiscountFormScreen';
import {buildCompanyPatch} from '../src/partner/screens/CompanyEditScreen';
import {discountStatus} from '../src/partner/screens/DiscountsScreen';
import ValidationResultScreen from '../src/partner/screens/ValidationResultScreen';
import useCardCode, {nextRefreshDelay, isStillValid} from '../src/services/useCardCode';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const textOf = root =>
  root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).join(''))
    .join(' | ');

describe('helpers', () => {
  test('datas dd/mm/aaaa em horário de Brasília', () => {
    expect(parseDateBR('')).toBeNull();
    expect(parseDateBR('31/02/2026')).toBeUndefined();
    expect(parseDateBR('1/2/2026')).toBeUndefined();
    expect(parseDateBR('10/12/2026')).toBe('2026-12-10T03:00:00.000Z');
    expect(parseDateBR('10/12/2026', true)).toBe('2026-12-11T02:59:59.000Z');
    expect(maskDate('10122026')).toBe('10/12/2026');
    expect(maskDate('1012')).toBe('10/12');
    expect(formatMoney(1234.5)).toBe('R$ 1.234,50');
  });

  test('promoção: monta o corpo e valida', () => {
    const base = {name: 'Banho', description: '', type: 'percent', value: '10', validFrom: '', validUntil: '', isActive: true};
    expect(buildDiscountPayload(base).body).toEqual({name: 'Banho', description: null, isActive: true, validUntil: null, percentage: 10});
    expect(buildDiscountPayload({...base, type: 'fixed', value: '15,50'}).body.fixedAmount).toBe(15.5);
    expect(buildDiscountPayload({...base, value: '150'}).error).toMatch(/100%/);
    expect(buildDiscountPayload({...base, name: ' '}).error).toMatch(/nome/);
    expect(buildDiscountPayload({...base, value: ''}).error).toMatch(/valor/);
    expect(buildDiscountPayload({...base, validFrom: '10/12/2026', validUntil: '01/12/2026'}).error).toMatch(/antes/);
    expect(buildDiscountPayload({...base, validUntil: '99/99/2026'}).error).toMatch(/fim inválida/);
  });

  test('empresa: só manda o que mudou e exige campos básicos', () => {
    const orig = {name: 'Pet', category: 'PET', address: 'Rua A', city: 'Botucatu', state: 'SP', zipCode: '18600-000', hours: 'x'};
    expect(buildCompanyPatch(orig, {...orig, hours: ' Seg-Sex '}).patch).toEqual({hours: 'Seg-Sex'});
    expect(buildCompanyPatch(orig, {...orig, name: ''}).error).toMatch(/obrigatórios/);
    expect(buildCompanyPatch(orig, {...orig, state: 'SPP'}).error).toMatch(/UF/);
    expect(buildCompanyPatch(orig, {...orig, email: 'x'}).error).toMatch(/E-mail/);
  });

  test('status da promoção', () => {
    const now = Date.parse('2026-10-11T12:00:00Z');
    expect(discountStatus({isActive: false}, now).text).toBe('Pausada');
    expect(discountStatus({isActive: true, validFrom: '2026-10-20'}, now).text).toBe('Agendada');
    expect(discountStatus({isActive: true, validFrom: '2026-01-01', validUntil: '2026-10-01'}, now).text).toBe('Encerrada');
    expect(discountStatus({isActive: true, validFrom: '2026-01-01'}, now).text).toBe('No ar');
  });

  test('cliente da API traduz erros', async () => {
    const api = makePartnerApi('T', async () => ({ok: false, status: 403, json: async () => ({error: 'Sem acesso', code: 'NOT_PARTNER'})}));
    await expect(api('GET', '/partner/me')).rejects.toMatchObject({status: 403, code: 'NOT_PARTNER', message: 'Sem acesso'});
    const off = makePartnerApi('T', async () => {
      throw new Error('net');
    });
    await expect(off('GET', '/x')).rejects.toMatchObject({status: 0});
  });
});

describe('resultado da validação', () => {
  beforeEach(() => {
    mockCtx.api.mockReset();
    mockCtx.refresh.mockReset();
  });
  const nav = {replace: jest.fn(), popToTop: jest.fn()};

  test('carteirinha ativa: escolhe promoção, informa valor e registra', async () => {
    mockCtx.api.mockImplementation(async (method, path) => {
      if (method === 'POST') {
        return {
          valid: true,
          method: 'SIGNED',
          message: 'Carteirinha ATIVA.',
          validationId: 'v1',
          member: {memberId: 'MEM1', name: 'Ana Souza', endDate: '2026-12-31T12:00:00Z'},
          discounts: [{id: 'd1', name: 'Banho', label: '10% OFF'}],
        };
      }
      return {message: 'ok'};
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<ValidationResultScreen route={{params: {code: 'LDB2.x'}}} navigation={nav} />);
    });
    await flush();
    expect(mockCtx.api).toHaveBeenCalledWith('POST', '/partner/validate', {code: 'LDB2.x'});
    const root = tree.root;
    expect(root.findAllByProps({testID: 'resultado-ativa'}).length).toBeGreaterThan(0);
    expect(textOf(root)).toContain('Ana Souza');
    // escolhe a promoção e informa R$ 120,50
    const chip = root.findAll(n => n.props.onPress && textOf(n).includes('10% OFF'))[0];
    await act(async () => chip.props.onPress());
    const input = root.findAllByType(TextInput).find(i => i.props.placeholder === '0,00');
    await act(async () => input.props.onChangeText('120,50'));
    const btn = root.findAll(n => n.props.testID === 'registrar' && n.props.onPress)[0];
    await act(async () => btn.props.onPress());
    await flush();
    expect(mockCtx.api).toHaveBeenLastCalledWith('PATCH', '/partner/validations/v1', {discountId: 'd1', amount: '120.50'});
    expect(textOf(root)).toContain('Atendimento registrado');
  });

  test('QR expirado: mostra NÃO VÁLIDA e não oferece registro', async () => {
    mockCtx.api.mockResolvedValue({valid: false, reason: 'EXPIRED', message: 'Este QR expirou.'});
    let tree;
    await act(async () => {
      tree = renderer.create(<ValidationResultScreen route={{params: {code: 'velho'}}} navigation={nav} />);
    });
    await flush();
    expect(tree.root.findAllByProps({testID: 'resultado-invalida'}).length).toBeGreaterThan(0);
    expect(textOf(tree.root)).toContain('NÃO VÁLIDA');
    expect(tree.root.findAll(n => n.props.testID === 'registrar').length).toBe(0);
  });

  test('membro vencido: mostra VENCIDA com o nome', async () => {
    mockCtx.api.mockResolvedValue({valid: false, reason: 'MEMBERSHIP_INACTIVE', message: 'Vencida', member: {memberId: 'MEM2', name: 'Bia', endDate: '2026-01-01'}, discounts: []});
    let tree;
    await act(async () => {
      tree = renderer.create(<ValidationResultScreen route={{params: {code: 'x'}}} navigation={nav} />);
    });
    await flush();
    expect(textOf(tree.root)).toContain('CARTEIRINHA VENCIDA');
    expect(textOf(tree.root)).toContain('Bia');
  });
});

describe('QR rotativo do membro', () => {
  test('agenda a renovação antes de vencer', () => {
    const now = Date.parse('2026-10-11T12:00:00Z');
    expect(nextRefreshDelay('2026-10-11T12:10:00Z', now)).toBe(4 * 60 * 1000);
    expect(nextRefreshDelay('2026-10-11T12:02:00Z', now)).toBe(30 * 1000);
    expect(isStillValid({code: 'x', expiresAt: '2026-10-11T12:00:10Z'}, now)).toBe(false);
    expect(isStillValid({code: 'x', expiresAt: '2026-10-11T12:05:00Z'}, now)).toBe(true);
  });

  function Probe(props) {
    const s = useCardCode(props);
    return <Text>{`${s.source}:${s.code}`}</Text>;
  }

  test('online: usa o código assinado do servidor e guarda para uso offline', async () => {
    const exp = new Date(Date.now() + 600e3).toISOString();
    const fetchImpl = jest.fn(async () => ({ok: true, json: async () => ({code: 'LDB2.MEM1.1.sig', expiresAt: exp})}));
    let tree;
    await act(async () => {
      tree = renderer.create(<Probe token="T" enabled legacyCode="LIGADOBEM|MEM1|u" fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(textOf(tree.root)).toBe('live:LDB2.MEM1.1.sig');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/api/membership/card-token');
    expect(JSON.parse(mockStore.card_code_v2).code).toBe('LDB2.MEM1.1.sig');
    await act(async () => tree.unmount());
  });

  test('offline com código guardado ainda válido: usa o guardado', async () => {
    mockStore.card_code_v2 = JSON.stringify({code: 'LDB2.CACHE', expiresAt: new Date(Date.now() + 300e3).toISOString()});
    const fetchImpl = jest.fn(async () => {
      throw new Error('offline');
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<Probe token="T" enabled legacyCode="LIGADOBEM|MEM1|u" fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(textOf(tree.root)).toBe('cached:LDB2.CACHE');
    await act(async () => tree.unmount());
  });

  test('offline sem código válido: cai no formato antigo', async () => {
    mockStore.card_code_v2 = JSON.stringify({code: 'LDB2.OLD', expiresAt: new Date(Date.now() - 1000).toISOString()});
    const fetchImpl = jest.fn(async () => ({ok: false, status: 500}));
    let tree;
    await act(async () => {
      tree = renderer.create(<Probe token="T" enabled legacyCode="LIGADOBEM|MEM1|u" fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(textOf(tree.root)).toBe('legacy:LIGADOBEM|MEM1|u');
    await act(async () => tree.unmount());
  });

  test('membro inativo: nem chama o servidor', async () => {
    const fetchImpl = jest.fn();
    let tree;
    await act(async () => {
      tree = renderer.create(<Probe token="T" enabled={false} legacyCode={null} fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(fetchImpl).not.toHaveBeenCalled();
    await act(async () => tree.unmount());
  });
});

describe('variante do app', () => {
  test('lê o flavor do Android', () => {
    jest.isolateModules(() => {
      const RN = require('react-native');
      RN.NativeModules.ApkInstaller = {APP_VARIANT: 'partner'};
      expect(require('../src/config/appVariant').IS_PARTNER_APP).toBe(true);
    });
    jest.isolateModules(() => {
      const RN = require('react-native');
      RN.NativeModules.ApkInstaller = undefined;
      expect(require('../src/config/appVariant').APP_VARIANT).toBe('member');
    });
  });
});
