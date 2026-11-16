/**
 * Textos e dados da ONG vindos do painel: nada de nome de ONG fixo no app.
 * Sobre a ONG (texto + contatos configurados) e Termos/Privacidade/Adoção em abas.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text} from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k === 'auth_token' ? 'tok' : null)),
  setItem: jest.fn(async () => {}),
  multiRemove: jest.fn(async () => {}),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api', API_BASE_URL: 'https://api.test'}));

import AboutScreen, {contactRows} from '../src/screens/AboutScreen';
import LegalScreen from '../src/screens/LegalScreen';
import {parseMarkdown, parseInline} from '../src/components/MarkdownText';
import {clearOrgCache} from '../src/utils/org';

const ORG = {
  id: 'org_x', slug: 'patas-unidas', name: 'Patas Unidas', legalName: 'Associação Patas Unidas', cnpj: '11.222.333/0001-81',
  city: 'Bauru', state: 'SP', contacts: {whatsapp: '5514988887777', email: 'oi@patas.org', instagram: 'https://instagram.com/patas'},
};
const DOCS = {
  about: {kind: 'about', title: 'Sobre a Patas Unidas', body: 'Cuidamos de **gatos** em Bauru.\n\n## Missão\n- Resgatar\n- Castrar', webUrl: '/api/sobre?org=patas-unidas'},
  terms: {kind: 'terms', title: 'Termos de uso', body: 'Regras da Patas Unidas.', webUrl: '/api/termos?org=patas-unidas'},
  privacy: {kind: 'privacy', title: 'Política de privacidade', body: 'Dúvidas: oi@patas.org', webUrl: '/api/privacidade?org=patas-unidas'},
  adoption: {kind: 'adoption', title: 'Termos de adoção', body: '1. Vacinar\n2. Castrar', webUrl: '/api/termos-adocao?org=patas-unidas'},
};
const api = jest.fn(async url => {
  if (url.endsWith('/app/org')) return {ok: true, json: async () => ({org: ORG})};
  const kind = url.split('/').pop();
  return {ok: true, json: async () => ({...DOCS[kind], org: ORG})};
});

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root => root.findAllByType(Text).map(t => [].concat(t.props.children).flat().join('')).join(' | ');

beforeEach(async () => {
  jest.clearAllMocks();
  await clearOrgCache();
});

test('Markdown simples: títulos, itens, numerados, negrito, links e e-mails', () => {
  const b = parseMarkdown('# T\ntexto\nquebrado\n\n## S\n- a\n1. b');
  expect(b.map(x => x.type)).toEqual(['h1', 'p', 'h2', 'li', 'oli']);
  expect(b[1].text).toBe('texto quebrado');
  const p = parseInline('Veja **isto** e [site](https://x.org) ou oi@x.org.');
  expect(p.find(x => x.bold).t).toBe('isto');
  expect(p.find(x => x.url === 'https://x.org').t).toBe('site');
  expect(p.find(x => String(x.url).startsWith('mailto:')).url).toBe('mailto:oi@x.org');
});

test('Sobre: nome, texto e contatos da ONG da pessoa (nada da Liga)', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(<AboutScreen fetchImpl={api} />);
  });
  await flush();
  const t = allText(tree.root);
  expect(t).toContain('Sobre a Patas Unidas');
  expect(t).toContain('gatos');
  expect(t).toContain('Fale com a Patas Unidas');
  expect(t).toContain('(14) 98888-7777');
  expect(t).toContain('Associação Patas Unidas');
  expect(t).not.toMatch(/Liga do Bem/);
  // Contato não configurado não aparece
  expect(tree.root.findAll(x => x.props.testID === 'contato-facebook')).toHaveLength(0);
  expect(api).toHaveBeenCalledWith('https://api.test/api/app/docs/about', expect.objectContaining({headers: {Authorization: 'Bearer tok'}}));
});

test('contatos: WhatsApp vira link wa.me e Instagram vira @', () => {
  const rows = contactRows(ORG);
  expect(rows.find(r => r.key === 'whatsapp').url).toBe('https://wa.me/5514988887777');
  expect(rows.find(r => r.key === 'instagram').value).toBe('@patas');
  expect(rows.find(r => r.key === 'address').value).toBe('Bauru - SP');
});

test('Termos e privacidade: abas carregam o texto de cada uma', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(<LegalScreen route={{params: {section: 'both'}}} fetchImpl={api} />);
  });
  await flush();
  expect(allText(tree.root)).toContain('Regras da Patas Unidas.');
  await act(async () => tree.root.findAll(x => x.props.testID === 'aba-adoption' && x.props.onPress)[0].props.onPress());
  await flush();
  const t = allText(tree.root);
  expect(t).toContain('Termos de adoção');
  expect(t).toContain('Castrar');
  expect(t).toContain('Associação Patas Unidas');
});

test('abre direto na privacidade quando pedido', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(<LegalScreen route={{params: {section: 'privacy'}}} fetchImpl={api} />);
  });
  await flush();
  expect(allText(tree.root)).toContain('Política de privacidade');
  expect(allText(tree.root)).toContain('Excluir minha conta');
});

test('app dos parceiros: só Termos e Privacidade, e antes do login usa a ONG escolhida', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(<LegalScreen route={{params: {section: 'terms', tabs: ['terms', 'privacy'], org: 'patas-unidas'}}} fetchImpl={api} />);
  });
  await flush();
  expect(tree.root.findAll(x => x.props.testID === 'aba-adoption')).toHaveLength(0);
  expect(api).toHaveBeenCalledWith('https://api.test/api/app/docs/terms?org=patas-unidas', {headers: {}});
  expect(allText(tree.root)).toContain('Associação Patas Unidas');
});
