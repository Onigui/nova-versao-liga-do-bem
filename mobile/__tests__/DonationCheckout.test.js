/**
 * Checkout compartilhado em modo doação + formulário de endereço do boleto.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Text, TouchableOpacity} from 'react-native';

const mockStore = {auth_token: 'tok-123'};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v;
  }),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-webview', () => ({WebView: 'WebView'}));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));

import MembershipCheckoutScreen from '../src/screens/MembershipCheckoutScreen';
import {fromViaCep, validateAddress, formatCep} from '../src/components/BoletoAddressForm';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));

function findPressableByText(root, label) {
  return root
    .findAllByType(TouchableOpacity)
    .find(t => t.findAllByType(Text).some(x => [].concat(x.props.children).join('').includes(label)));
}

describe('helpers do endereço', () => {
  test('formatCep', () => expect(formatCep('18600000')).toBe('18600-000'));
  test('ViaCEP → formulário', () => {
    expect(fromViaCep({logradouro: 'Rua Curuzu', bairro: 'Centro', localidade: 'Botucatu', uf: 'sp'})).toEqual({
      street: 'Rua Curuzu', locality: 'Centro', city: 'Botucatu', regionCode: 'SP',
    });
    expect(fromViaCep({erro: true})).toBeNull();
  });
  test('validateAddress', () => {
    expect(validateAddress({postalCode: '123'})).toMatch(/CEP/);
    expect(validateAddress({postalCode: '18600-000', regionCode: 'SP', street: 'R', number: '1', locality: 'C', city: 'B'})).toBeNull();
  });
});

describe('checkout em modo doação', () => {
  let calls;
  beforeEach(() => {
    calls = [];
    global.fetch = jest.fn(async (url, init = {}) => {
      calls.push({url, init});
      return {
        ok: true,
        json: async () => ({
          payment: {id: 'pay-1', status: 'PENDING', method: JSON.parse(init.body || '{}').method, amount: 25, pixCopyPaste: '000201...'},
        }),
      };
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  async function renderScreen(params) {
    let tree;
    await act(async () => {
      tree = renderer.create(
        <MembershipCheckoutScreen navigation={{goBack: jest.fn()}} route={{params}} />,
      );
    });
    await flush();
    return tree;
  }

  test('PIX: chama /donations/checkout com valor, CPF e sem planos', async () => {
    mockStore.billing_cpf_v1 = '11122233344';
    const tree = await renderScreen({kind: 'donation', amount: 25, method: 'PIX', recurring: true});
    expect(calls.some(c => c.url.includes('/membership/plans'))).toBe(false);
    const pay = findPressableByText(tree.root, 'Doar R$');
    expect(pay).toBeTruthy();
    await act(async () => pay.props.onPress());
    await flush();
    const checkout = calls.find(c => c.url.endsWith('/donations/checkout'));
    expect(checkout).toBeTruthy();
    const body = JSON.parse(checkout.init.body);
    expect(body).toMatchObject({amount: 25, method: 'PIX', cpf: '11122233344', recurring: true});
    expect(body.address).toBeUndefined();
    expect(checkout.init.headers.Authorization).toBe('Bearer tok-123');
    // QR gerado no aparelho a partir do copia-e-cola devolvido pela API
    const qr = tree.root.findAll(n => n.type === 'QRCode');
    expect(qr.length).toBe(1);
    expect(qr[0].props.value).toBe('000201...');
    tree.unmount();
  });

  test('Boleto sem endereço é bloqueado antes de chamar a API', async () => {
    mockStore.billing_cpf_v1 = '11122233344';
    delete mockStore.billing_address_v1;
    const tree = await renderScreen({kind: 'donation', amount: 50, method: 'BOLETO'});
    await act(async () => findPressableByText(tree.root, 'Doar R$').props.onPress());
    expect(Alert.alert).toHaveBeenCalledWith('Endereço', expect.stringMatching(/CEP/));
    expect(calls.some(c => c.url.endsWith('/donations/checkout'))).toBe(false);
    tree.unmount();
  });

  test('Boleto com endereço salvo envia o endereço', async () => {
    mockStore.billing_cpf_v1 = '11122233344';
    mockStore.billing_address_v1 = JSON.stringify({
      postalCode: '18600-000', street: 'Rua Curuzu', number: '100', complement: '',
      locality: 'Centro', city: 'Botucatu', regionCode: 'SP',
    });
    const tree = await renderScreen({kind: 'donation', amount: 50, method: 'BOLETO'});
    await flush();
    await act(async () => findPressableByText(tree.root, 'Doar R$').props.onPress());
    await flush();
    const body = JSON.parse(calls.find(c => c.url.endsWith('/donations/checkout')).init.body);
    expect(body).toMatchObject({amount: 50, method: 'BOLETO', address: {postalCode: '18600-000', city: 'Botucatu', regionCode: 'SP'}});
    tree.unmount();
  });
});
