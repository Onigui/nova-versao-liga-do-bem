/**
 * App Parceiros: notificação paga (criar → pagar com PIX → confirmação).
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
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-webview', () => ({WebView: 'WebView'}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
  },
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({})}));
const mockCtx = {api: jest.fn(), partner: {name: 'Pet Shop Central'}, isOwner: true};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import PushCampaignsScreen, {validatePush} from '../src/partner/screens/PushCampaignsScreen';
import PushPaymentScreen, {formatTaxId} from '../src/partner/screens/PushPaymentScreen';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const textOf = root => root.findAllByType(Text).map(t => [].concat(t.props.children).join('')).join(' | ');
const press = async (root, testID) => {
  const n = root.findAll(x => x.props.testID === testID && x.props.onPress)[0];
  await act(async () => n.props.onPress());
  await flush();
};
const type = async (root, testID, value) => {
  const n = root.findAllByType(TextInput).find(i => i.props.testID === testID);
  await act(async () => n.props.onChangeText(value));
};

test('validação do texto e máscara CPF/CNPJ', () => {
  expect(validatePush('Oi', 'mensagem longa o bastante')).toMatch(/título/);
  expect(validatePush('Promo boa', 'curta')).toMatch(/mensagem/);
  expect(validatePush('Promo boa', 'Veja em www.golpe.com agora mesmo')).toMatch(/Links/);
  expect(validatePush('Promo boa', 'Banho e tosa com 20% para membros')).toBeNull();
  expect(formatTaxId('11122233344')).toBe('111.222.333-44');
  expect(formatTaxId('12345678000190')).toBe('12.345.678/0001-90');
});

test('cria a notificação com prévia e segue para o pagamento', async () => {
  mockCtx.api.mockReset();
  mockCtx.api.mockImplementation(async (method, path) => {
    if (method === 'GET') {
      return {campaigns: [], settings: {price: 29.9, priceCents: 2990, enabled: true}, audience: 812, nextAllowedAt: null, limits: {titleMax: 50, bodyMax: 180}};
    }
    return {campaign: {id: 'c1'}};
  });
  const nav = {navigate: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<PushCampaignsScreen navigation={nav} />);
  });
  await flush();
  expect(textOf(tree.root)).toContain('812 pessoa(s)');
  expect(textOf(tree.root)).toContain('R$ 29,90');
  await type(tree.root, 'push-titulo', 'Banho 20% OFF');
  await type(tree.root, 'push-mensagem', 'Só nesta semana para membros da Liga!');
  expect(textOf(tree.root)).toContain('Pet Shop Central · Banho 20% OFF');
  await press(tree.root, 'criar-push');
  expect(mockCtx.api).toHaveBeenLastCalledWith('POST', '/partner/push-campaigns', {title: 'Banho 20% OFF', body: 'Só nesta semana para membros da Liga!'});
  expect(nav.navigate).toHaveBeenCalledWith('PushPayment', {campaignId: 'c1'});
});

test('limite semanal esconde o formulário', async () => {
  mockCtx.api.mockReset();
  mockCtx.api.mockResolvedValue({campaigns: [], settings: {price: 29.9, enabled: true}, audience: 10, nextAllowedAt: '2026-10-18T12:00:00Z'});
  let tree;
  await act(async () => {
    tree = renderer.create(<PushCampaignsScreen navigation={{navigate: jest.fn()}} />);
  });
  await flush();
  expect(textOf(tree.root)).toContain('limite desta semana');
  expect(tree.root.findAll(n => n.props.testID === 'criar-push').length).toBe(0);
});

test('pagamento PIX: gera, mostra o QR e confirma pelo polling', async () => {
  jest.useFakeTimers();
  mockCtx.api.mockReset();
  let status = 'AWAITING_PAYMENT';
  const campaign = () => ({id: 'c1', title: 'Banho', body: 'msg', price: 29.9, status});
  let paymentState = null;
  mockCtx.api.mockImplementation(async (method, path, body) => {
    if (method === 'GET') return {campaign: campaign(), payment: paymentState};
    if (path.endsWith('/checkout')) {
      expect(body).toEqual({method: 'PIX', taxId: '12345678000190'});
      paymentState = {id: 'p1', status: 'PENDING', method: 'PIX', pixCopyPaste: '00020126PIX'};
      return {campaign: campaign(), payment: paymentState, message: 'PIX gerado.'};
    }
    return {};
  });
  let tree;
  await act(async () => {
    tree = renderer.create(<PushPaymentScreen route={{params: {campaignId: 'c1'}}} navigation={{goBack: jest.fn()}} />);
  });
  await act(async () => {});
  await type(tree.root, 'taxid', '12345678000190');
  await act(async () => {
    tree.root.findAll(x => x.props.testID === 'gerar-pagamento' && x.props.onPress)[0].props.onPress();
  });
  await act(async () => {});
  expect(tree.root.findAll(n => n.type === 'QRCode' && n.props.value === '00020126PIX').length).toBe(1);
  expect(mockStore.partner_tax_id_v1).toBe('12345678000190');
  // PagBank confirma; o polling de 5 s percebe
  status = 'PENDING_REVIEW';
  paymentState = {...paymentState, status: 'APPROVED'};
  await act(async () => {
    jest.advanceTimersByTime(5000);
  });
  await act(async () => {});
  expect(textOf(tree.root)).toContain('Pagamento confirmado');
  jest.useRealTimers();
});
