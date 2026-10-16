/**
 * Avisos: sininho do App Parceiros + registro do aparelho para pop-ups com o app fechado.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {DeviceEventEmitter, Text} from 'react-native';

const mockStore = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v;
  }),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
const mockNav = {navigate: jest.fn(), setOptions: jest.fn(), addListener: jest.fn(() => () => {})};
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
  },
  useNavigation: () => mockNav,
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/config/appVariant', () => ({APP_VARIANT: 'partner'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({})}));
const mockMessaging = {
  getToken: jest.fn(async () => 'fcm-1'),
  registerDeviceForRemoteMessages: jest.fn(async () => {}),
  requestPermission: jest.fn(async () => 1),
  onTokenRefresh: jest.fn(() => () => {}),
};
jest.mock('@react-native-firebase/messaging', () => {
  const fn = () => mockMessaging;
  fn.AuthorizationStatus = {AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0};
  return fn;
});
const mockCtx = {api: jest.fn()};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import PartnerBell from '../src/partner/components/PartnerBell';
import PartnerNotificationsScreen, {partnerTarget} from '../src/partner/screens/PartnerNotificationsScreen';
import NotificationService, {NOTIFICATION_EVENT} from '../src/services/NotificationService';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const textOf = root => root.findAllByType(Text).map(t => [].concat(t.props.children).join('')).join(' | ');

const NOTES = [
  {id: 'n1', title: 'Novo pedido de orçamento', message: '3 itens', isRead: false, sentAt: '2026-10-16T12:00:00Z', data: {screen: 'QuoteRespond', requestId: 'q1', audience: 'partner'}},
  {id: 'n2', title: 'Sua notificação foi enviada! 🎉', message: 'Chegou a 120 membros', isRead: true, sentAt: '2026-10-15T12:00:00Z', data: {screen: 'PushCampaigns', audience: 'partner'}},
];

test('rota do aviso no App Parceiros', () => {
  expect(partnerTarget({screen: 'QuoteRespond', requestId: 'q1', audience: 'partner'})).toEqual({name: 'QuoteRespond', params: {requestId: 'q1'}});
  expect(partnerTarget({screen: 'Reservations'})).toEqual({name: 'Reservations', params: {}});
  expect(partnerTarget({screen: 'QuoteDetail'})).toBeNull();
  expect(partnerTarget(null)).toBeNull();
});

test('sininho mostra os não lidos e recarrega quando chega aviso', async () => {
  mockCtx.api.mockReset();
  mockCtx.api.mockResolvedValueOnce({notifications: NOTES, unreadCount: 1}).mockResolvedValue({notifications: NOTES, unreadCount: 4});
  let tree;
  await act(async () => {
    tree = renderer.create(<PartnerBell />);
  });
  await flush();
  expect(mockCtx.api).toHaveBeenCalledWith('GET', '/user/notifications?app=partner');
  expect(textOf(tree.root)).toBe('1');
  await act(async () => DeviceEventEmitter.emit(NOTIFICATION_EVENT, {}));
  await flush();
  expect(textOf(tree.root)).toBe('4');
  const bell = tree.root.findAll(n => n.props.testID === 'sininho' && n.props.onPress)[0];
  bell.props.onPress();
  expect(mockNav.navigate).toHaveBeenCalledWith('PartnerNotifications');
  tree.unmount();
});

test('lista de avisos: abre a tela certa e marca como lido', async () => {
  mockCtx.api.mockReset();
  mockNav.navigate.mockReset();
  mockCtx.api.mockImplementation(async (method, path) => (method === 'GET' ? {notifications: NOTES} : {}));
  let tree;
  await act(async () => {
    tree = renderer.create(<PartnerNotificationsScreen navigation={mockNav} />);
  });
  await flush();
  expect(textOf(tree.root)).toMatch(/Novo pedido de orçamento/);
  const item = tree.root.findAll(n => n.props.testID === 'aviso-n1' && n.props.onPress)[0];
  await act(async () => item.props.onPress());
  expect(mockCtx.api).toHaveBeenCalledWith('POST', '/user/notifications/read', {notificationId: 'n1'});
  expect(mockNav.navigate).toHaveBeenCalledWith('QuoteRespond', {requestId: 'q1'});
  // "Ler todas" só aparece com não lidos e respeita o app
  const lastOpts = mockNav.setOptions.mock.calls.at(-1)[0];
  expect(lastOpts.headerRight()).toBeNull();
  tree.unmount();
});

test('registra o aparelho ao abrir logado (com throttle) e mesmo sem permissão', async () => {
  global.fetch = jest.fn(async () => ({ok: true, json: async () => ({})}));
  mockMessaging.requestPermission.mockResolvedValueOnce(0); // negou
  expect(await NotificationService.ensureRegistered('jwt-aaaa')).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body).toMatchObject({token: 'fcm-1', app: 'partner', provider: 'fcm'});
  // mesmo token, mesma conta, mesmo dia → não chama de novo
  await NotificationService.ensureRegistered('jwt-aaaa');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  // token novo do Firebase → registra de novo
  mockMessaging.getToken.mockResolvedValueOnce('fcm-2').mockResolvedValueOnce('fcm-2');
  await NotificationService.ensureRegistered('jwt-aaaa');
  expect(global.fetch).toHaveBeenCalledTimes(2);
  // outra conta no mesmo aparelho → registra de novo
  mockMessaging.getToken.mockResolvedValue('fcm-2');
  await NotificationService.ensureRegistered('jwt-bbbb');
  expect(global.fetch).toHaveBeenCalledTimes(3);
});
