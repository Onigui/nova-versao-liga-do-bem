/**
 * Orçamento em tempo real: membro monta a lista e compara; parceiro responde às cegas e confere a reserva.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Text} from 'react-native';

const mockStore = {auth_token: 'tok-membro'};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v;
  }),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
  },
  createNavigationContainerRef: () => {
    const ref = {
      ready: false,
      state: null,
      isReady: () => ref.ready,
      getRootState: () => ref.state,
      navigate: jest.fn(),
    };
    return ref;
  },
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {}, token: 'tok-parceiro'})}));
const mockCtx = {api: jest.fn(), token: 'tok-parceiro'};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import QuoteNewScreen from '../src/screens/QuoteNewScreen';
import QuoteDetailScreen from '../src/screens/QuoteDetailScreen';
import QuotesInboxScreen from '../src/partner/screens/QuotesInboxScreen';
import QuoteRespondScreen from '../src/partner/screens/QuoteRespondScreen';
import ReservationsScreen from '../src/partner/screens/ReservationsScreen';
import VetQuoteScreen from '../src/partner/screens/VetQuoteScreen';
import {buildResponseBody, groupPerItemByStore, parseMoney, responseTotal, timeLeft} from '../src/utils/quotes';
import {navigationRef, openFromNotification, targetFromMessage} from '../src/services/pushNavigation';

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
const type = async (root, id, text) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onChangeText)[0];
  await act(async () => n.props.onChangeText(text));
};
const json = (body, ok = true, status = 200) => ({ok, status, json: async () => body});

const COMPARISON = {
  request: {id: 'q1', status: 'OPEN', expiresAt: new Date(Date.now() + 5 * 3600e3).toISOString(), species: 'Gato', petWeight: 3.2, targets: 3, quotes: 2},
  items: [
    {id: 'i1', itemId: 'v10', label: 'Vacina V10', category: 'VACINAS', quantity: 2},
    {id: 'i2', itemId: 'brav', label: 'Bravecto 10–20 kg', category: 'ANTIPULGAS', quantity: 1},
  ],
  stores: [
    {
      partner: {id: 'p3', name: 'Agro Pet'},
      hasQuote: true,
      quoteNote: 'Entrego no bairro',
      validUntil: new Date(Date.now() + 48 * 3600e3).toISOString(),
      complete: true,
      covered: 2,
      total: 375,
      reservation: null,
      lines: [
        {requestItemId: 'i1', unitPrice: 80, total: 160, source: 'QUOTE'},
        {requestItemId: 'i2', unitPrice: 215, total: 215, source: 'QUOTE'},
      ],
    },
    {
      partner: {id: 'p2', name: 'Clínica Amigo'},
      hasQuote: false,
      complete: false,
      covered: 1,
      total: 150,
      reservation: null,
      lines: [
        {requestItemId: 'i1', unitPrice: 75, total: 150, source: 'TABLE'},
        {requestItemId: 'i2', unitPrice: null, total: null, source: null},
      ],
    },
  ],
  bestStore: {partnerId: 'p3', total: 375},
  perItem: {
    lines: [
      {requestItemId: 'i1', best: {unitPrice: 75, total: 150, source: 'TABLE', partnerId: 'p2', partnerName: 'Clínica Amigo'}},
      {requestItemId: 'i2', best: {unitPrice: 215, total: 215, source: 'QUOTE', partnerId: 'p3', partnerName: 'Agro Pet'}},
    ],
    total: 365,
    stores: 2,
    covered: 2,
  },
};

describe('utilitários', () => {
  test('dinheiro, prazo, proposta e agrupamento', () => {
    expect(parseMoney('R$ 1.250,50')).toBe(1250.5);
    expect(parseMoney('')).toBeNull();
    const now = Date.parse('2026-10-14T12:00:00Z');
    expect(timeLeft('2026-10-14T12:20:00Z', now)).toBe('faltam 20 min');
    expect(timeLeft('2026-10-15T12:00:00Z', now)).toBe('faltam 24 h');
    expect(timeLeft('2026-10-14T11:00:00Z', now)).toBe('encerrado');
    const items = [
      {id: 'a', label: 'V10', quantity: 2},
      {id: 'b', label: 'Bravecto', quantity: 1},
    ];
    expect(buildResponseBody(items, {a: {price: ''}, b: {price: '10'}}).error).toMatch(/V10/);
    expect(buildResponseBody(items, {a: {unavailable: true}, b: {unavailable: true}}).error).toMatch(/pelo menos um/);
    expect(buildResponseBody(items, {a: {price: '80,00'}, b: {unavailable: true}}, {validHours: 72, note: ' oi '}).body).toEqual({
      lines: [
        {requestItemId: 'a', unitPrice: 80, available: true, note: undefined},
        {requestItemId: 'b', available: false},
      ],
      validHours: 72,
      note: 'oi',
    });
    expect(responseTotal(items, {a: {price: '80'}, b: {price: '215'}})).toEqual({total: 375, count: 2});
    const g = groupPerItemByStore(COMPARISON.perItem, COMPARISON.items);
    expect(g.map(x => [x.partnerId, x.requestItemIds, x.total])).toEqual([
      ['p3', ['i2'], 215],
      ['p2', ['i1'], 150],
    ]);
  });

  test('toque na notificação abre a tela certa depois do login', () => {
    jest.useFakeTimers();
    expect(targetFromMessage({data: {screen: 'QuoteDetail', id: 'q1'}})).toEqual({name: 'QuoteDetail', params: {id: 'q1'}});
    expect(targetFromMessage({data: {screen: 'MembershipCard'}})).toEqual({name: 'MainTabs', params: {screen: 'Cartão', params: {}}});
    expect(targetFromMessage({data: {screen: 'Parceiros', partnerId: 'p1'}})).toEqual({name: 'MainTabs', params: {screen: 'Parceiros', params: {partnerId: 'p1'}}});
    expect(targetFromMessage({data: {}})).toBeNull();
    openFromNotification({data: {screen: 'QuoteRespond', requestId: 'q9'}});
    expect(navigationRef.navigate).not.toHaveBeenCalled();
    navigationRef.ready = true;
    navigationRef.state = {routes: [{name: 'App'}]};
    jest.advanceTimersByTime(600);
    expect(navigationRef.navigate).toHaveBeenCalledWith('QuoteRespond', {requestId: 'q9'});
    jest.useRealTimers();
  });
});

describe('app dos membros', () => {
  test('monta a lista (catálogo + item escrito), escolhe pet e prazo e envia', async () => {
    const fetchImpl = jest.fn(async (url, init = {}) => {
      if (url.endsWith('/user/pets')) return json({pets: [{id: 'pet1', name: 'Mia', species: 'Gato', weight: 3.2}]});
      if (url.includes('/catalog?')) return json({items: [{id: 'v10', label: 'Vacina V10', category: 'VACINAS', categoryLabel: 'Vacinas'}]});
      if (url.endsWith('/quotes') && init.method === 'POST') return json({request: {id: 'q1'}}, true, 201);
      throw new Error('inesperado ' + url);
    });
    const nav = {replace: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<QuoteNewScreen navigation={nav} route={{}} fetchImpl={fetchImpl} />);
    });
    await flush();
    await press(tree.root, 'pet-pet1');
    jest.useFakeTimers();
    await type(tree.root, 'busca-item', 'v10');
    await act(async () => jest.advanceTimersByTime(400));
    jest.useRealTimers();
    await flush();
    expect(fetchImpl.mock.calls.find(c => c[0].includes('/catalog?'))[0]).toBe('https://api.test/api/catalog?search=v10&species=CAT');
    await press(tree.root, 'add-v10');
    // item escrito à mão
    jest.useFakeTimers();
    await type(tree.root, 'busca-item', 'Ração renal 2 kg');
    await act(async () => jest.advanceTimersByTime(400));
    jest.useRealTimers();
    await flush();
    await press(tree.root, 'livre-RACAO');
    await press(tree.root, 'prazo-2');
    await type(tree.root, 'observacoes', 'Até sexta');
    expect(allText(tree.root)).toContain('Pedir orçamento (2 itens)');
    await press(tree.root, 'enviar-orcamento');
    const post = fetchImpl.mock.calls.find(c => c[1]?.method === 'POST');
    expect(post[1].headers.Authorization).toBe('Bearer tok-membro');
    expect(JSON.parse(post[1].body)).toEqual({
      items: [
        {itemId: 'v10', quantity: 1},
        {label: 'Ração renal 2 kg', category: 'RACAO', quantity: 1},
      ],
      petId: 'pet1',
      expiresInHours: 2,
      notes: 'Até sexta',
    });
    expect(nav.replace).toHaveBeenCalledWith('QuoteDetail', {id: 'q1', initial: {request: {id: 'q1'}}});
  });

  test('compara: melhor loja, item a item e reserva com código', async () => {
    let reserved = false;
    const fetchImpl = jest.fn(async (url, init = {}) => {
      if (url.endsWith('/reserve')) {
        reserved = true;
        return json({reservation: {code: 'K7PX2M'}}, true, 201);
      }
      if (reserved) {
        const c = JSON.parse(JSON.stringify(COMPARISON));
        c.stores[0].reservation = {id: 'r1', code: 'K7PX2M', status: 'RESERVED', total: 375};
        return json(c);
      }
      return json(COMPARISON);
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let tree;
    await act(async () => {
      tree = renderer.create(<QuoteDetailScreen navigation={{navigate: jest.fn()}} route={{params: {id: 'q1'}}} fetchImpl={fetchImpl} />);
    });
    await flush();
    let t = allText(tree.root);
    expect(t).toContain('3 lojas avisadas · 2 propostas');
    expect(t).toContain('MELHOR PREÇO');
    expect(t).toContain('Tem 1 de 2 itens');
    expect(t).toContain('Entrego no bairro');
    expect(t).toContain('R$ 375,00');
    await press(tree.root, 'aba-item');
    t = allText(tree.root);
    expect(t).toContain('R$ 365,00');
    expect(t).toContain('R$ 10,00 a menos que a melhor loja');
    expect(t).toContain('Reservar 1 item em Clínica Amigo · R$ 150,00');
    await press(tree.root, 'aba-store');
    await press(tree.root, 'reservar-p3');
    expect(fetchImpl.mock.calls.find(c => c[0].endsWith('/reserve'))[1].body).toBe(JSON.stringify({partnerId: 'p3'}));
    expect(allText(tree.root)).toContain('K7PX2M');
    tree.unmount();
  });
});

describe('App Parceiros', () => {
  beforeEach(() => jest.clearAllMocks());

  test('caixa de entrada: pendente em destaque', async () => {
    mockCtx.api.mockResolvedValue({
      pending: 1,
      quotes: [
        {id: 'q1', open: true, answered: false, items: 4, preview: 'Vacina V10, Bravecto, Ração', species: 'Gato', district: 'Centro', expiresAt: new Date(Date.now() + 3 * 3600e3).toISOString()},
        {id: 'q2', open: false, answered: true, reservationStatus: 'RESERVED', items: 1, preview: 'Consulta', expiresAt: new Date().toISOString()},
      ],
    });
    const nav = {navigate: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<QuotesInboxScreen navigation={nav} />);
    });
    await flush();
    const t = allText(tree.root);
    expect(t).toContain('Responder');
    expect(t).toContain('Vacina V10, Bravecto, Ração +1');
    expect(t).toContain('Reservado com você');
    await press(tree.root, 'pedido-q1');
    expect(nav.navigate).toHaveBeenCalledWith('QuoteRespond', {requestId: 'q1'});
  });

  test('responde pré-preenchido pela tabela, confirma e fica travado', async () => {
    let sent = false;
    const base = {
      request: {id: 'q1', open: true, expiresAt: new Date(Date.now() + 3 * 3600e3).toISOString(), species: 'Gato', district: 'Centro'},
      items: [
        {id: 'i1', itemId: 'v10', label: 'Vacina V10', quantity: 2, myTablePrice: 90},
        {id: 'i2', itemId: null, label: 'Ração renal 2 kg', quantity: 1, myTablePrice: null},
      ],
      myResponse: null,
      reservation: null,
    };
    mockCtx.api.mockImplementation(async (m, path, body) => {
      if (m === 'POST') {
        sent = body;
        return {message: 'ok'};
      }
      return sent
        ? {...base, myResponse: {status: 'SUBMITTED', validUntil: new Date().toISOString(), lines: [{requestItemId: 'i1', unitPrice: 85, available: true}, {requestItemId: 'i2', available: false}]}}
        : base;
    });
    jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      const send = (buttons || []).find(b => b.text === 'Enviar');
      if (send) send.onPress();
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<QuoteRespondScreen navigation={{}} route={{params: {requestId: 'q1'}}} />);
    });
    await flush();
    const priceInput = tree.root.findAll(x => x.props.testID === 'preco-i1' && x.props.onChangeText)[0];
    expect(priceInput.props.value).toBe('90,00');
    expect(allText(tree.root)).toContain('sua tabela: R$ 90,00');
    await type(tree.root, 'preco-i1', '85');
    await press(tree.root, 'naotenho-i2');
    expect(allText(tree.root)).toContain('R$ 170,00');
    await press(tree.root, 'validade-72');
    await press(tree.root, 'enviar-proposta');
    await flush();
    expect(Alert.alert.mock.calls[0][1]).toMatch(/NÃO pode ser alterada/);
    expect(sent).toEqual({lines: [{requestItemId: 'i1', unitPrice: 85, available: true, note: undefined}, {requestItemId: 'i2', available: false}], validHours: 72, note: undefined});
    const t = allText(tree.root);
    expect(t).toContain('Proposta enviada');
    expect(t).toContain('não tenho');
    expect(tree.root.findAll(x => x.props.testID === 'enviar-proposta').length).toBe(0);
    expect(tree.root.findAll(x => x.props.testID === 'retirar').length).toBeGreaterThan(0);
  });

  test('reservas: busca pelo código e conclui', async () => {
    mockCtx.api.mockImplementation(async (m, path) =>
      m === 'GET'
        ? {
            reservations: [
              {id: 'r1', code: 'K7PX2M', status: 'RESERVED', total: 375, memberFirstName: 'Ana', memberActive: true, createdAt: new Date().toISOString(), validUntil: new Date().toISOString(), lines: [{requestItemId: 'i1', label: 'Vacina V10', quantity: 2, total: 160}]},
              {id: 'r2', code: 'ABC234', status: 'DONE', total: 50, memberFirstName: 'Bia', memberActive: false, createdAt: new Date().toISOString(), lines: []},
            ],
          }
        : {message: 'ok'},
    );
    let tree;
    await act(async () => {
      tree = renderer.create(<ReservationsScreen />);
    });
    await flush();
    await type(tree.root, 'busca-codigo', 'k7p');
    const t = allText(tree.root);
    expect(t).toContain('K7PX2M');
    expect(t).not.toContain('ABC234');
    expect(t).toContain('Ana · membro ativo');
    await press(tree.root, 'concluir-K7PX2M');
    expect(mockCtx.api).toHaveBeenCalledWith('POST', '/partner/reservations/r1/done');
  });

  test('veterinário monta a lista do pet e envia ao tutor', async () => {
    mockCtx.api.mockResolvedValue({id: 'q5', targets: 3});
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const fetchImpl = jest.fn(async () => json({items: [{id: 'v10', label: 'Vacina V10', category: 'VACINAS', categoryLabel: 'Vacinas'}]}));
    global.fetch = fetchImpl;
    const nav = {goBack: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<VetQuoteScreen navigation={nav} route={{params: {visitId: 'v1', pet: {name: 'Bob', species: 'Cão'}}}} />);
    });
    jest.useFakeTimers();
    await type(tree.root, 'busca-item', 'v10');
    await act(async () => jest.advanceTimersByTime(400));
    jest.useRealTimers();
    await flush();
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/api/catalog?search=v10&species=DOG');
    await press(tree.root, 'add-v10');
    await press(tree.root, 'enviar-lista');
    expect(mockCtx.api).toHaveBeenCalledWith('POST', '/partner/pets/visits/v1/quote', {items: [{itemId: 'v10', quantity: 1}], notes: undefined, expiresInHours: 24});
    expect(Alert.alert.mock.calls[0][1]).toMatch(/3 lojas foram avisadas/);
    expect(nav.goBack).toHaveBeenCalled();
  });
});
