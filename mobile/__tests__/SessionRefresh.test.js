/**
 * Sessão vencida: o app renova o token sozinho; enquanto isso não mostra "Quero ser membro"
 * a quem já é membro nem "Conecte-se à internet" no QR. Se não der para renovar, leva ao login.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {DeviceEventEmitter, Text} from 'react-native';

const mockStore = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = String(v);
  }),
  removeItem: jest.fn(async k => {
    delete mockStore[k];
  }),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
  },
}));
jest.mock('@react-native-community/geolocation', () => ({getCurrentPosition: jest.fn(), requestAuthorization: jest.fn()}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {id: 'm1', name: 'Ana Souza', locationEnabled: false}})}));

import {SESSION_EVENT, ensureFreshSession, refreshSession, REFRESH_EVERY_MS} from '../src/services/session';
import useCardCode from '../src/services/useCardCode';
import HomeScreen from '../src/screens/HomeScreen';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const textOf = root => root.findAllByType(Text).map(t => [].concat(t.props.children).flat().join('')).join(' | ');
const res = (status, body) => ({ok: status >= 200 && status < 300, status, json: async () => body});

beforeEach(() => {
  Object.keys(mockStore).forEach(k => delete mockStore[k]);
  mockStore.auth_token = 'velho';
  mockStore.user_data = JSON.stringify({id: 'm1', name: 'Ana Souza'});
});

describe('renovar sessão', () => {
  test('troca o token, guarda e avisa o app', async () => {
    const events = [];
    const sub = DeviceEventEmitter.addListener(SESSION_EVENT, e => events.push(e));
    const fetchImpl = jest.fn(async () => res(200, {token: 'novo', user: {id: 'm1', name: 'Ana Souza'}}));
    const r = await refreshSession(fetchImpl);
    sub.remove();
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/api/auth/refresh', expect.objectContaining({method: 'POST', headers: expect.objectContaining({Authorization: 'Bearer velho'})}));
    expect(r.ok).toBe(true);
    expect(mockStore.auth_token).toBe('novo');
    expect(events).toEqual([{type: 'refreshed', token: 'novo', user: {id: 'm1', name: 'Ana Souza'}}]);
  });

  test('servidor não aceita mais: avisa "expired" (o app leva ao login)', async () => {
    const events = [];
    const sub = DeviceEventEmitter.addListener(SESSION_EVENT, e => events.push(e));
    const r = await refreshSession(jest.fn(async () => res(401, {error: 'Sessão expirada. Faça login novamente.'})));
    sub.remove();
    expect(r.reason).toBe('expired');
    expect(events[0]).toEqual({type: 'expired', message: 'Sessão expirada. Faça login novamente.'});
    expect(mockStore.auth_token).toBe('velho'); // quem limpa é o logout do AuthProvider
  });

  test('sem internet: não desloga ninguém', async () => {
    const events = [];
    const sub = DeviceEventEmitter.addListener(SESSION_EVENT, e => events.push(e));
    const r = await refreshSession(jest.fn(async () => Promise.reject(new Error('offline'))));
    sub.remove();
    expect(r.reason).toBe('offline');
    expect(events).toEqual([]);
  });

  test('várias telas pedindo juntas → uma chamada só; ao abrir, renova no máximo a cada 6 h', async () => {
    const fetchImpl = jest.fn(async () => res(200, {token: 'novo'}));
    await Promise.all([refreshSession(fetchImpl), refreshSession(fetchImpl), refreshSession(fetchImpl)]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const now = Number(mockStore.auth_refreshed_at);
    expect((await ensureFreshSession(fetchImpl, now + 60 * 1000)).skipped).toBe(true);
    await ensureFreshSession(fetchImpl, now + REFRESH_EVERY_MS + 1000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('QR da carteirinha', () => {
  function Probe({fetchImpl, token}) {
    const s = useCardCode({token, enabled: true, fetchImpl});
    return <Text testID="src">{s.source}</Text>;
  }
  test('401 → renova a sessão (não diz "conecte-se") e com o token novo gera o QR', async () => {
    const fetchImpl = jest.fn(async (url, init) => {
      if (url.endsWith('/auth/refresh')) return res(200, {token: 'novo'});
      return init.headers.Authorization === 'Bearer novo'
        ? res(200, {code: 'LDB2.x', expiresAt: new Date(Date.now() + 600e3).toISOString(), shortCode: '123456'})
        : res(401, {error: 'Sessão expirada. Faça login novamente.'});
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<Probe fetchImpl={fetchImpl} token="velho" />);
    });
    await flush();
    expect(tree.root.findByProps({testID: 'src'}).props.children).toBe('session');
    expect(fetchImpl.mock.calls.some(c => c[0].endsWith('/auth/refresh'))).toBe(true);
    await act(async () => tree.update(<Probe fetchImpl={fetchImpl} token="novo" />));
    await flush();
    expect(tree.root.findByProps({testID: 'src'}).props.children).toBe('live');
    tree.unmount();
  });
});

describe('Início', () => {
  test('sessão recusada: não mostra "Quero ser membro" e renova; com o token novo mostra a carteirinha', async () => {
    const MEMBER = {user: {firstName: 'Ana'}, membership: {active: true, endDate: '2026-11-14T15:30:00.000Z', planMonths: 1, memberIdMasked: 'MEM•••0001'}, counters: {}, forYou: [], pets: [], promos: []};
    const VISITOR = {user: null, membership: null, counters: {}, forYou: [], pets: [], promos: [], plan: {fromPerMonth: 17, partners: 3}};
    const fetchImpl = jest.fn(async (url, init) => {
      if (url.endsWith('/auth/refresh')) return res(200, {token: 'novo'});
      return res(200, init.headers.Authorization === 'Bearer novo' ? MEMBER : VISITOR);
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<HomeScreen navigation={{navigate: jest.fn()}} fetchImpl={fetchImpl} />);
    });
    await flush();
    await flush();
    // a renovação já aconteceu e a tela recarregou sozinha
    expect(fetchImpl.mock.calls.some(c => c[0].endsWith('/auth/refresh'))).toBe(true);
    expect(tree.root.findAll(x => x.props.testID === 'quero-ser-membro').length).toBe(0);
    expect(tree.root.findAll(x => x.props.testID === 'carteirinha').length).toBeGreaterThan(0);
    expect(textOf(tree.root)).toMatch(/Válida até 14\/11/);
  });

  test('sem internet e sem cache: mostra "Sem conexão", não o convite', async () => {
    const fetchImpl = jest.fn(async () => Promise.reject(new Error('offline')));
    let tree;
    await act(async () => {
      tree = renderer.create(<HomeScreen navigation={{navigate: jest.fn()}} fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(tree.root.findAll(x => x.props.testID === 'quero-ser-membro').length).toBe(0);
    expect(textOf(tree.root)).toMatch(/Sem conexão/);
  });
});
