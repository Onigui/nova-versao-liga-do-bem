/**
 * App raiz: sem conta → login; conta sem CPF → completar CPF; com conta e CPF → app.
 * Não existe modo visitante. As bibliotecas nativas/navegação são simuladas para o teste rodar no Jest.
 */
import React from 'react';
import {Text} from 'react-native';
import renderer, {act} from 'react-test-renderer';
import {it, expect, jest, beforeEach} from '@jest/globals';

const mockAuth: any = {loading: false, isAuthenticated: false, user: null, token: null};

jest.mock('@react-navigation/native', () => ({NavigationContainer: ({children}: any) => children}));
jest.mock('@react-navigation/stack', () => {
  const R = require('react');
  const {Text: T} = require('react-native');
  return {
    createStackNavigator: () => ({
      Navigator: ({children}: any) => {
        const first = R.Children.toArray(children)[0];
        return first ? R.createElement(T, {testID: 'tela'}, first.props.name) : null;
      },
      Screen: () => null,
    }),
  };
});
jest.mock('react-native-paper', () => ({Provider: ({children}: any) => children}));
jest.mock('react-native-gesture-handler', () => ({GestureHandlerRootView: ({children}: any) => children}));
jest.mock('../src/components/Tour', () => ({TourProvider: ({children}: any) => children}));
jest.mock('../src/components/UpdateChecker', () => () => null);
jest.mock('../src/components/ErrorBoundary', () => ({children}: any) => children);
jest.mock('../src/services/NotificationService', () => ({
  ensureRegistered: jest.fn(),
  listenTokenRefresh: jest.fn(() => () => {}),
  setupNotificationListeners: jest.fn(() => () => {}),
}));
jest.mock('../src/services/pushNavigation', () => ({navigationRef: {}, openFromNotification: jest.fn(), flushPendingNavigation: jest.fn()}));
jest.mock('../src/navigation/AppNavigator', () => ({AuthStack: () => null, AppStack: () => null}));
jest.mock('../src/partner/PartnerNavigator', () => ({PartnerAuthStack: () => null, PartnerAppStack: () => null}));
jest.mock('../src/config/appVariant', () => ({IS_PARTNER_APP: false}));
jest.mock('../src/screens/CompleteCpfScreen', () => () => null);
jest.mock('../src/services/AuthService', () => ({AuthProvider: ({children}: any) => children, useAuth: () => mockAuth}));

import App from '../App';

const screen = async () => {
  let tree: any;
  await act(async () => {
    tree = renderer.create(<App />);
  });
  const t = tree.root.findAllByType(Text).find((n: any) => n.props.testID === 'tela');
  return t ? t.props.children : null;
};

beforeEach(() => {
  Object.assign(mockAuth, {loading: false, isAuthenticated: false, user: null, token: null});
});

it('sem conta abre o login (não há modo visitante)', async () => {
  expect(await screen()).toBe('Auth');
});

it('conta sem CPF precisa completar o cadastro antes de entrar', async () => {
  Object.assign(mockAuth, {isAuthenticated: true, token: 't', user: {id: 'u1', cpf: null}});
  expect(await screen()).toBe('CompleteCpf');
});

it('conta com CPF válido entra no app e registra o aparelho para avisos', async () => {
  Object.assign(mockAuth, {isAuthenticated: true, token: 't', user: {id: 'u1', cpf: '86815330028'}});
  expect(await screen()).toBe('App');
  expect(require('../src/services/NotificationService').ensureRegistered).toHaveBeenCalledWith('t');
});
