/**
 * Mural de conversa do caso: comentar, responder, foto, acompanhar, denunciar, ocultar.
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
jest.mock('@react-native-community/geolocation', () => ({setRNConfiguration: jest.fn(), getCurrentPosition: jest.fn(), requestAuthorization: jest.fn()}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {phone: '14998123456'}})}));

import LostFoundCommentsScreen from '../src/screens/LostFoundCommentsScreen';
import LostFoundDetailScreen from '../src/screens/LostFoundDetailScreen';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root => root.findAllByType(Text).map(t => [].concat(t.props.children).flat().join('')).join(' | ');
const press = async (root, id) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onPress)[0];
  if (!n) throw new Error(`sem botão ${id}`);
  await act(async () => n.props.onPress());
  await flush();
};
const type = async (root, id, v) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onChangeText)[0];
  await act(async () => n.props.onChangeText(v));
};
const json = (body, ok = true, status = 200) => ({ok, status, json: async () => body});
const now = new Date().toISOString();

const THREADS = {
  following: false,
  total: 2,
  comments: [
    {
      id: 'c1', author: 'Bia', body: 'Vi perto do mercado [telefone escondido]', createdAt: now, mine: false, canHide: true, canDelete: false, isCaseAuthor: false,
      replies: [{id: 'c2', parentId: 'c1', author: 'Ana', body: 'Obrigada!', createdAt: now, mine: true, canHide: false, canDelete: true, isCaseAuthor: true}],
    },
  ],
};

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  Alert.alert.mockClear();
});

test('mostra o mural com respostas e selo do autor do caso; comenta respondendo e com foto', async () => {
  const fetchImpl = jest.fn(async (url, init = {}) => {
    if (init.method === 'POST' && url.endsWith('/comments')) return json({comment: {id: 'c3'}, message: 'Publicado. Telefone/e-mail foram escondidos: para contato, use o WhatsApp do aviso.'}, true, 201);
    return json(THREADS);
  });
  const nav = {setOptions: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<LostFoundCommentsScreen navigation={nav} route={{params: {id: 'case1', title: 'Thor'}}} fetchImpl={fetchImpl} />);
  });
  await flush();
  const txt = allText(tree.root);
  expect(txt).toMatch(/Vi perto do mercado/);
  expect(txt).toMatch(/autor do caso/);
  expect(txt).toMatch(/Nunca faça PIX/);
  expect(nav.setOptions.mock.calls.at(-1)[0].title).toBe('Conversa · Thor');
  // só aparece o que pode
  expect(tree.root.findAll(x => x.props.testID === 'ocultar-c1' && x.props.onPress).length).toBeGreaterThan(0);
  expect(tree.root.findAll(x => x.props.testID === 'apagar-c1').length).toBe(0);
  expect(tree.root.findAll(x => x.props.testID === 'apagar-c2' && x.props.onPress).length).toBeGreaterThan(0);
  expect(tree.root.findAll(x => x.props.testID === 'denunciar-c2').length).toBe(0);

  await press(tree.root, 'responder-c1');
  expect(allText(tree.root)).toMatch(/Respondendo a Bia/);
  require('react-native-image-picker').launchImageLibrary.mockResolvedValue({assets: [{uri: 'file://f.jpg', type: 'image/jpeg', base64: 'FFFF'}]});
  await press(tree.root, 'anexar-foto');
  await type(tree.root, 'campo-comentario', 'Tinha coleira azul? me chama 14 99999-0000');
  await press(tree.root, 'enviar-comentario');
  const post = fetchImpl.mock.calls.find(c => c[1]?.method === 'POST');
  expect(post[0]).toBe('https://api.test/api/lostfound/case1/comments');
  expect(JSON.parse(post[1].body)).toEqual({body: 'Tinha coleira azul? me chama 14 99999-0000', parentId: 'c1', photo: 'data:image/jpeg;base64,FFFF'});
  expect(Alert.alert.mock.calls.at(-1)[1]).toMatch(/escondidos/);
});

test('golpe bloqueado pelo servidor: mostra o motivo e mantém o texto', async () => {
  const fetchImpl = jest.fn(async (url, init = {}) =>
    init.method === 'POST' ? json({error: 'Por segurança, não é permitido falar de PIX…', code: 'SCAM_BLOCKED'}, false, 400) : json({...THREADS, comments: []}),
  );
  let tree;
  await act(async () => {
    tree = renderer.create(<LostFoundCommentsScreen navigation={{setOptions: jest.fn()}} route={{params: {id: 'case1'}}} fetchImpl={fetchImpl} />);
  });
  await flush();
  expect(allText(tree.root)).toMatch(/Ninguém comentou ainda/);
  await type(tree.root, 'campo-comentario', 'faz um pix');
  await press(tree.root, 'enviar-comentario');
  expect(Alert.alert.mock.calls.at(-1)[1]).toMatch(/PIX/);
  expect(tree.root.findAll(x => x.props.testID === 'campo-comentario' && x.props.onChangeText)[0].props.value).toBe('faz um pix');
});

test('acompanhar e denunciar', async () => {
  const fetchImpl = jest.fn(async (url, init = {}) => {
    if (url.endsWith('/follow')) return json({following: true});
    if (url.endsWith('/flag')) return json({message: 'Obrigado! A Liga vai revisar este comentário.'}, true, 201);
    return json(THREADS);
  });
  let tree;
  await act(async () => {
    tree = renderer.create(<LostFoundCommentsScreen navigation={{setOptions: jest.fn()}} route={{params: {id: 'case1'}}} fetchImpl={fetchImpl} />);
  });
  await flush();
  await press(tree.root, 'acompanhar');
  expect(fetchImpl.mock.calls.some(c => c[0].endsWith('/case1/follow') && c[1].method === 'POST')).toBe(true);
  expect(allText(tree.root)).toMatch(/Acompanhando/);
  await press(tree.root, 'denunciar-c1');
  await type(tree.root, 'motivo-denuncia', 'pediu dinheiro');
  await press(tree.root, 'enviar-denuncia');
  const flag = fetchImpl.mock.calls.find(c => c[0].endsWith('/comments/c1/flag'));
  expect(JSON.parse(flag[1].body)).toEqual({reason: 'pediu dinheiro'});
});

test('página do caso: Acompanhar e atalho para a conversa com o total', async () => {
  const REPORT = {
    id: 'case1', type: 'LOST', status: 'ACTIVE', species: 'DOG', petName: 'Thor', colors: 'caramelo', lat: -22.88, lng: -48.44,
    happenedAt: now, createdAt: now, photos: [], author: 'Ana', mine: false,
  };
  const fetchImpl = jest.fn(async (url, init = {}) => (url.endsWith('/follow') ? json({following: false}) : json({report: REPORT, timeline: [], commentsCount: 4, following: true})));
  const nav = {navigate: jest.fn(), setOptions: jest.fn(), push: jest.fn(), goBack: jest.fn()};
  let tree;
  await act(async () => {
    tree = renderer.create(<LostFoundDetailScreen navigation={nav} route={{params: {id: 'case1'}}} fetchImpl={fetchImpl} openUrl={jest.fn()} share={jest.fn()} />);
  });
  await flush();
  expect(allText(tree.root)).toMatch(/Conversa \(4\)/);
  expect(allText(tree.root)).toMatch(/Acompanhando/);
  await press(tree.root, 'abrir-conversa');
  expect(nav.navigate).toHaveBeenCalledWith('LostFoundComments', {id: 'case1', title: 'Thor'});
  await press(tree.root, 'acompanhar');
  expect(fetchImpl.mock.calls.some(c => c[0].endsWith('/case1/follow') && c[1].method === 'DELETE')).toBe(true);
});
