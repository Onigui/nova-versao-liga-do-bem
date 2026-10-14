/**
 * Nota Fiscal Paulista: passo a passo, copiar CNPJ, "já fiz" (com CPF) e situações.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Text} from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => 'tok-membro'),
  setItem: jest.fn(async () => {}),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
  },
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));

import NotaFiscalScreen, {formatCpfInput} from '../src/screens/NotaFiscalScreen';

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
const json = body => ({ok: true, status: 200, json: async () => body});
const INFO = {enabled: true, entityName: 'Liga do Bem', cnpj: '11.222.333/0001-81', siteUrl: 'https://www.nfp.fazenda.sp.gov.br', supporters: 37};

async function render(me, onPost) {
  const fetchImpl = jest.fn(async (url, init = {}) => {
    if (url.endsWith('/nfp')) return json(INFO);
    if (init.method === 'POST') return json(onPost(JSON.parse(init.body)));
    return json(me);
  });
  const clipboard = {setString: jest.fn()};
  const openUrl = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(<NotaFiscalScreen navigation={{}} fetchImpl={fetchImpl} clipboard={clipboard} openUrl={openUrl} />);
  });
  await flush();
  return {tree, fetchImpl, clipboard, openUrl};
}

beforeEach(() => jest.spyOn(Alert, 'alert').mockImplementation(() => {}));

test('máscara de CPF', () => {
  expect(formatCpfInput('12345678909')).toBe('123.456.789-09');
  expect(formatCpfInput('1234')).toBe('123.4');
});

test('passo a passo: abre o site, copia o CNPJ e marca "já fiz" com o CPF do cadastro', async () => {
  const {tree, fetchImpl, clipboard, openUrl} = await render({status: 'NONE', hasCpf: true, cpfMasked: '***.982.247-**'}, () => ({status: 'DECLARED', waitingDays: 0, hasCpf: true}));
  let t = allText(tree.root);
  expect(t).toContain('37 pessoas já apoiam');
  expect(t).toContain('11.222.333/0001-81');
  expect(t).toContain('CPF do seu cadastro (***.982.247-**)');
  await press(tree.root, 'abrir-nfp');
  expect(openUrl).toHaveBeenCalledWith('https://www.nfp.fazenda.sp.gov.br');
  await press(tree.root, 'copiar-cnpj');
  expect(clipboard.setString).toHaveBeenCalledWith('11222333000181');
  expect(allText(tree.root)).toContain('Copiado!');
  await press(tree.root, 'ja-fiz');
  const post = fetchImpl.mock.calls.find(c => c[1]?.method === 'POST');
  expect(post[0]).toBe('https://api.test/api/nfp/me');
  expect(JSON.parse(post[1].body)).toEqual({});
  t = allText(tree.root);
  expect(t).toContain('Aguardando conferência');
});

test('sem CPF no cadastro: pede o CPF antes', async () => {
  const {tree, fetchImpl} = await render({status: 'NONE', hasCpf: false}, body => ({status: 'DECLARED', hasCpf: true, body}));
  const btn = () => tree.root.findAll(x => x.props.testID === 'ja-fiz' && x.props.onPress)[0];
  expect(btn().props.disabled).toBe(true);
  const input = tree.root.findAll(x => x.props.testID === 'cpf' && x.props.onChangeText)[0];
  await act(async () => input.props.onChangeText('12345678909'));
  expect(tree.root.findAll(x => x.props.testID === 'cpf' && x.props.onChangeText)[0].props.value).toBe('123.456.789-09');
  expect(btn().props.disabled).toBe(false);
  await press(tree.root, 'ja-fiz');
  expect(JSON.parse(fetchImpl.mock.calls.find(c => c[1]?.method === 'POST')[1].body)).toEqual({cpf: '123.456.789-09'});
});

test('confirmado: selo, sem passo a passo', async () => {
  const {tree} = await render({status: 'CONFIRMED', confirmedAt: '2026-10-14T12:00:00Z', hasCpf: true}, () => ({}));
  const t = allText(tree.root);
  expect(t).toContain('Apoiador Nota Fiscal');
  expect(t).not.toContain('Passo a passo');
});

test('não encontrado na última conferência', async () => {
  const {tree} = await render({status: 'LAPSED', hasCpf: true}, () => ({}));
  expect(allText(tree.root)).toContain('Doação não encontrada');
  expect(allText(tree.root)).toContain('Passo a passo');
});
