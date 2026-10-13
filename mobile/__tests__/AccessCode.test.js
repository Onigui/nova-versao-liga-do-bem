/**
 * Primeiro acesso sem depender de e-mail: "Já tenho um código" + código do funcionário no App Parceiros.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Share, Text, TextInput} from 'react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({})}));
const mockCtx = {api: jest.fn(), account: {id: 'owner-acc'}};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import ForgotPasswordScreen from '../src/screens/ForgotPasswordScreen';
import StaffScreen from '../src/partner/screens/StaffScreen';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root => root.findAllByType(Text).map(t => [].concat(t.props.children).join('')).join(' | ');
const pressID = async (root, id) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onPress)[0];
  await act(async () => n.props.onPress());
  await flush();
};

describe('Esqueci a senha / Primeiro acesso', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  test('"Já tenho um código" pula o e-mail e troca a senha com o código recebido', async () => {
    global.fetch.mockResolvedValue({ok: true, json: async () => ({message: 'ok'})});
    let tree;
    await act(async () => {
      tree = renderer.create(<ForgotPasswordScreen navigation={{navigate: jest.fn(), goBack: jest.fn()}} route={{params: {firstAccess: true}}} />);
    });
    const inputs = () => tree.root.findAllByType(TextInput);
    await act(async () => inputs()[0].props.onChangeText('Onigui@Gmail.com'));
    await pressID(tree.root, 'ja-tenho-codigo');
    expect(global.fetch).not.toHaveBeenCalled(); // não depende do e-mail
    expect(allText(tree.root)).toContain('72 horas');
    const [codeIn, pass1, pass2] = inputs();
    await act(async () => codeIn.props.onChangeText('482913'));
    await act(async () => pass1.props.onChangeText('MinhaSenha1'));
    await act(async () => pass2.props.onChangeText('MinhaSenha1'));
    const submit = tree.root.findAll(n => n.props.onPress && allText(n).includes('senha'));
    await act(async () => submit[submit.length - 1].props.onPress());
    await flush();
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/auth/reset-password');
    expect(JSON.parse(init.body)).toEqual({email: 'onigui@gmail.com', code: '482913', newPassword: 'MinhaSenha1'});
  });

  test('e-mail indisponível oferece "Já tenho um código" no próprio aviso', async () => {
    global.fetch.mockResolvedValue({ok: false, json: async () => ({error: 'Não conseguimos enviar o e-mail agora.', code: 'EMAIL_UNAVAILABLE'})});
    let tree;
    await act(async () => {
      tree = renderer.create(<ForgotPasswordScreen navigation={{navigate: jest.fn(), goBack: jest.fn()}} route={{params: {firstAccess: true}}} />);
    });
    await act(async () => tree.root.findAllByType(TextInput)[0].props.onChangeText('onigui@gmail.com'));
    const send = tree.root.findAll(n => n.props.onPress && allText(n).includes('Enviar código por e-mail'));
    await act(async () => send[send.length - 1].props.onPress());
    await flush();
    const [title, , buttons] = Alert.alert.mock.calls[0];
    expect(title).toBe('Não foi possível enviar o e-mail');
    const haveCode = buttons.find(b => b.text === 'Já tenho um código');
    await act(async () => haveCode.onPress());
    expect(allText(tree.root)).toContain('Digite o código que você recebeu');
  });

  test('sem e-mail digitado, "Já tenho um código" pede o e-mail', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<ForgotPasswordScreen navigation={{navigate: jest.fn(), goBack: jest.fn()}} route={{}} />);
    });
    await pressID(tree.root, 'ja-tenho-codigo');
    expect(Alert.alert).toHaveBeenCalledWith('Atenção', 'Digite primeiro o seu e-mail.');
  });
});

describe('Funcionários no App Parceiros', () => {
  test('cadastrar funcionário mostra o código e compartilha a mensagem pronta', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({});
    mockCtx.api.mockReset();
    mockCtx.api.mockImplementation(async (method, path) => {
      if (method === 'GET') return {accounts: []};
      return {email: 'caixa@pet.com', accessCode: '135790', shareMessage: 'Olá! Código: 135790', accountId: 'a2'};
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<StaffScreen />);
    });
    await flush();
    const [emailIn] = tree.root.findAllByType(TextInput);
    await act(async () => emailIn.props.onChangeText('caixa@pet.com'));
    const give = tree.root.findAll(n => n.props.onPress && allText(n) === 'Dar acesso');
    await act(async () => give[0].props.onPress());
    await flush();
    expect(tree.root.findAll(n => n.props.testID === 'codigo-acesso' && n.type === Text)[0].props.children).toBe('135790');
    await pressID(tree.root, 'compartilhar-codigo');
    expect(shareSpy).toHaveBeenCalledWith({message: 'Olá! Código: 135790'});
  });

  test('membro que já tinha conta: sem código, avisa que entra com a senha de sempre', async () => {
    mockCtx.api.mockReset();
    mockCtx.api.mockImplementation(async method => (method === 'GET' ? {accounts: []} : {email: 'ana@x.com', accessCode: null}));
    let tree;
    await act(async () => {
      tree = renderer.create(<StaffScreen />);
    });
    await flush();
    await act(async () => tree.root.findAllByType(TextInput)[0].props.onChangeText('ana@x.com'));
    const give = tree.root.findAll(n => n.props.onPress && allText(n) === 'Dar acesso');
    await act(async () => give[0].props.onPress());
    await flush();
    expect(allText(tree.root)).toContain('senha de sempre');
    expect(tree.root.findAll(n => n.props.testID === 'codigo-acesso').length).toBe(0);
  });
});
