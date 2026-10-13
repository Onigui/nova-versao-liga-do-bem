/**
 * App Parceiros → Painel: indicadores, gráfico por semana, dias de movimento e promoções.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text} from 'react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-svg', () => ({__esModule: true, default: 'svg', Path: 'path', Line: 'line', Text: 'text'}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
  },
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({})}));
const mockCtx = {api: jest.fn()};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import DashboardScreen, {delta, niceMax} from '../src/partner/screens/DashboardScreen';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const allText = root =>
  root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).join(''))
    .join(' | ');

const weeks = Array.from({length: 12}, (_, i) => {
  const d = new Date(Date.UTC(2026, 6, 20 + i * 7));
  return {week: d.toISOString().slice(0, 10), validations: [3, 5, 4, 8, 6, 9, 7, 12, 10, 14, 11, 16][i], withDiscount: i % 3};
});
const DATA = {
  weeks,
  kpis: {
    current: {validations: 48, members: 31, discountsUsed: 20, amount: 2450.5},
    previous: {validations: 40, members: 33, discountsUsed: 20, amount: 2000},
  },
  topDiscounts: [
    {id: 'a', name: 'Banho e tosa', kind: 'PERCENT', percentage: 20, badge: '20% OFF', uses: 12},
    {id: 'b', name: 'Ração Gold 20 kg', kind: 'FINAL_PRICE', promoPrice: 69.9, badge: 'Por R$ 69,90', uses: 5},
  ],
  byWeekday: [2, 10, 8, 9, 12, 20, 15],
  peakHour: 17,
  push: {sent: 1, recipients: 812},
  showAmounts: true,
};

test('helpers', () => {
  expect(delta(48, 40)).toBe(20);
  expect(delta(31, 33)).toBe(-6);
  expect(delta(5, 0)).toBeNull();
  expect(delta(0, 0)).toBe(0);
  expect(niceMax(3)).toBe(4);
  expect(niceMax(16)).toBe(20);
  expect(niceMax(73)).toBe(100);
});

test('painel com dados: indicadores, comparação, gráficos e promoções', async () => {
  mockCtx.api.mockResolvedValue(DATA);
  let tree;
  await act(async () => {
    tree = renderer.create(<DashboardScreen />);
  });
  await flush();
  const t = allText(tree.root);
  expect(t).toContain('+20% vs. 30 dias antes');
  expect(t).toContain('-6% vs. 30 dias antes');
  expect(t).toContain('R$ 2.450,50');
  expect(t).toContain('horário de pico: 17h');
  expect(t).toContain('Por R$ 69,90');
  expect(t).toContain('12x');
  // a semana mais recente aparece selecionada; tocar numa coluna mostra a dela
  expect(t).toContain(`Semana de ${weeks[11].week.slice(8, 10)}/${weeks[11].week.slice(5, 7)}: 16 validação(ões)`);
  const col = tree.root.findAll(n => n.props.testID === 'coluna-3' && n.props.onPress)[0];
  await act(async () => col.props.onPress());
  expect(allText(tree.root)).toContain('8 validação(ões)');
  // colunas: 12 barras com no máximo 24px de largura
  const paths = tree.root.findAllByType('path');
  expect(paths.length).toBe(12 + 7);
  // exporta o SVG para conferência visual
  const fs = require('fs');
  const toSvg = node => {
    if (typeof node === 'string') return node;
    if (!node) return '';
    const kids = (node.children || []).map(toSvg).join('');
    if (!['svg', 'path', 'line', 'text'].includes(node.type)) return kids;
    const attrs = Object.entries(node.props)
      .filter(([k, v]) => v != null && typeof v !== 'object' && typeof v !== 'function')
      .map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}="${v}"`)
      .join(' ');
    return `<${node.type} ${node.type === 'svg' ? 'xmlns="http://www.w3.org/2000/svg" ' : ''}${attrs}>${kids}</${node.type}>`;
  };
  const svgs = [];
  const walk = n => {
    if (!n || typeof n === 'string') return;
    if (n.type === 'svg') svgs.push(toSvg(n));
    else (n.children || []).forEach(walk);
  };
  walk(tree.toJSON());
  if (process.env.DASH_SVG_OUT) fs.writeFileSync(process.env.DASH_SVG_OUT, svgs.join('\n<br>\n'));
  expect(svgs.length).toBe(2);
});

test('funcionário não vê valores; sem validações mostra a explicação', async () => {
  mockCtx.api.mockResolvedValue({
    ...DATA,
    weeks: weeks.map(w => ({...w, validations: 0, withDiscount: 0})),
    kpis: {current: {validations: 0, members: 0, discountsUsed: 0, amount: null}, previous: {validations: 0, members: 0, discountsUsed: 0, amount: null}},
    topDiscounts: [],
    showAmounts: false,
  });
  let tree;
  await act(async () => {
    tree = renderer.create(<DashboardScreen />);
  });
  await flush();
  const t = allText(tree.root);
  expect(t).not.toContain('Compras registradas');
  expect(t).toContain('Notificações enviadas');
  expect(t).toContain('Ainda não há validações');
});
