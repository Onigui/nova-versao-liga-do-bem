/**
 * Fase 4: histórico de saúde do pet e avaliações dos parceiros.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Text} from 'react-native';

const mockStore = {auth_token: 'tok-membro'};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async () => {}),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-svg', () => ({__esModule: true, default: 'svg', Path: 'path', Line: 'line', Text: 'text', Circle: 'circle'}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: cb => {
    const R = require('react');
    R.useEffect(() => cb(), []); // eslint-disable-line react-hooks/exhaustive-deps
  },
}));
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {}, token: 'tok-parceiro'})}));
const mockCtx = {api: jest.fn(), token: 'tok-parceiro', partner: {name: 'Pet Shop Central'}};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});

import PetHealthScreen from '../src/screens/PetHealthScreen';
import HealthEntryFormScreen from '../src/screens/HealthEntryFormScreen';
import ReviewFormScreen from '../src/screens/ReviewFormScreen';
import PartnerListCard from '../src/components/PartnerListCard';
import ReviewsScreen from '../src/partner/screens/ReviewsScreen';
import VetNoteScreen from '../src/partner/screens/VetNoteScreen';
import {buildEntryBody} from '../src/components/HealthEntryForm';
import {filterHistory, groupByMonth, parseDateInput, ratingLabel, weightChart} from '../src/utils/health';
import {toMemberPartner} from '../src/utils/partnerView';

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

const HISTORY = {
  pet: {id: 'pet1', name: 'Mia'},
  items: [
    {id: 'e1', type: 'ENTRY', kind: 'CONSULTA', date: '2026-10-14T12:00:00Z', title: 'Coceira', details: 'Dermatite alérgica', guidance: 'Shampoo 2x/semana', weight: 3.8, returnDate: '2026-10-29T12:00:00Z', source: 'VET', verified: true, vetName: 'Carla Lima', vetCrmv: 'SP 12345', clinicName: 'Clínica Amigo'},
    {id: 'v1', type: 'VACCINATION', kind: 'VACCINE', date: '2026-10-14T10:00:00Z', title: 'V4 felina', verified: true, source: 'VET'},
    {id: 'e2', type: 'ENTRY', kind: 'EXAME', date: '2026-09-10T12:00:00Z', title: 'Hemograma', source: 'TUTOR', verified: false, hasPhoto: true},
    {id: 'e3', type: 'ENTRY', kind: 'PESO', date: '2026-08-01T12:00:00Z', title: 'Pesagem', weight: 3.5, source: 'TUTOR', verified: false},
  ],
  weights: [
    {date: '2026-08-01', weight: 3.5, source: 'TUTOR'},
    {date: '2026-10-14', weight: 3.8, source: 'VET'},
  ],
  nextReturn: {date: '2026-10-29T12:00:00Z', title: 'Coceira', type: 'ENTRY'},
  counts: {consultas: 1, vacinas: 1, exames: 1},
};

describe('utilitários', () => {
  test('histórico, datas, gráfico e notas', () => {
    expect(groupByMonth(HISTORY.items).map(g => [g.title, g.items.length])).toEqual([
      ['outubro de 2026', 2],
      ['setembro de 2026', 1],
      ['agosto de 2026', 1],
    ]);
    expect(filterHistory(HISTORY.items, 'VACINAS').map(i => i.id)).toEqual(['v1']);
    expect(filterHistory(HISTORY.items, 'PESO').map(i => i.id)).toEqual(['e1', 'e3']);
    expect(filterHistory(HISTORY.items, 'EXAME').map(i => i.id)).toEqual(['e2']);
    expect(parseDateInput('5/3/2026')).toBe('2026-03-05');
    expect(parseDateInput('2026-03-05')).toBe('2026-03-05');
    expect(parseDateInput('31-12')).toBeNull();
    expect(parseDateInput('31/02/2026')).toBeNull();
    const c = weightChart(HISTORY.weights, 300, 110);
    expect(c.change).toBe(0.3);
    expect(c.points[0].y).toBeGreaterThan(c.points[1].y);
    expect(weightChart([HISTORY.weights[0]])).toBeNull();
    expect(ratingLabel(4.25, 12)).toBe('4,3 · 12 avaliações');
    expect(ratingLabel(null, 0)).toBe('Sem avaliações ainda');
    expect(buildEntryBody({kind: 'PESO', date: '01/08/2026', weight: ''}).error).toMatch(/peso/);
    expect(buildEntryBody({kind: 'CONSULTA', date: '32/13/2026', title: 'x'}).error).toMatch(/Data/);
    expect(buildEntryBody({kind: 'MEDICACAO', date: '14/10/2026', title: 'Apoquel', guidance: ' 1x ao dia ', details: ''}).body).toEqual({
      kind: 'MEDICACAO',
      date: '2026-10-14',
      title: 'Apoquel',
      weight: null,
      details: null,
      guidance: '1x ao dia',
      clinicName: null,
      returnDate: null,
    });
  });
});

describe('app dos membros', () => {
  test('histórico: retorno, peso, filtros, conferido e edição só do que é do tutor', async () => {
    const fetchImpl = jest.fn(async () => json(HISTORY));
    const nav = {navigate: jest.fn(), setOptions: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<PetHealthScreen navigation={nav} route={{params: {petId: 'pet1'}}} fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/api/user/pets/pet1/history');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-membro');
    expect(nav.setOptions).toHaveBeenCalledWith({title: 'Saúde de Mia'});
    let t = allText(tree.root);
    expect(t).toContain('Retorno em 29/10/2026 · Coceira');
    expect(t).toContain('+0,3 kg desde 01/08/2026');
    expect(t).toContain('VETERINÁRIO');
    expect(t).toContain('OUTUBRO DE 2026'.toLowerCase());
    await press(tree.root, 'hist-e1');
    t = allText(tree.root);
    expect(t).toContain('Shampoo 2x/semana');
    expect(t).toContain('Carla Lima · CRMV SP 12345');
    expect(tree.root.findAll(x => x.props.testID === 'editar-e1').length).toBe(0);
    await press(tree.root, 'hist-e2');
    await press(tree.root, 'editar-e2');
    expect(nav.navigate).toHaveBeenCalledWith('HealthEntryForm', {petId: 'pet1', entry: expect.objectContaining({id: 'e2'})});
    await press(tree.root, 'filtro-VACINAS');
    t = allText(tree.root);
    expect(t).toContain('V4 felina');
    expect(t).not.toContain('Hemograma');
    await press(tree.root, 'novo-registro');
    expect(nav.navigate).toHaveBeenLastCalledWith('HealthEntryForm', {petId: 'pet1'});
  });

  test('novo registro do tutor (medicação com orientações)', async () => {
    const fetchImpl = jest.fn(async () => json({entry: {id: 'n1'}}, true, 201));
    const nav = {goBack: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<HealthEntryFormScreen navigation={nav} route={{params: {petId: 'pet1'}}} fetchImpl={fetchImpl} />);
    });
    await press(tree.root, 'tipo-MEDICACAO');
    await type(tree.root, 'campo-date', '10/10/2026');
    await type(tree.root, 'campo-title', 'Apoquel 5,4 mg');
    await type(tree.root, 'campo-guidance', '1 comprimido por dia');
    await press(tree.root, 'salvar-registro');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.test/api/user/pets/pet1/history');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({kind: 'MEDICACAO', date: '2026-10-10', title: 'Apoquel 5,4 mg', guidance: '1 comprimido por dia'});
    expect(nav.goBack).toHaveBeenCalled();
  });

  test('avaliar: estrelas, tags, comentário obrigatório em nota baixa', async () => {
    const fetchImpl = jest.fn(async (url, init = {}) =>
      init.method === 'POST'
        ? json({review: {id: 'r1'}}, true, 201)
        : json({summary: {count: 0}, reviews: [], tags: [{id: 'ATENDIMENTO', label: 'Bom atendimento'}, {id: 'PRECO', label: 'Preço justo'}], me: {review: null, canReview: true}}),
    );
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const nav = {goBack: jest.fn(), setOptions: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<ReviewFormScreen navigation={nav} route={{params: {partnerId: 'p1', partnerName: 'Pet Shop Central'}}} fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(allText(tree.root)).toContain('Como foi na Pet Shop Central?');
    const send = () => tree.root.findAll(x => x.props.testID === 'enviar-avaliacao' && x.props.onPress)[0];
    expect(send().props.disabled).toBe(true);
    await press(tree.root, 'estrela-2');
    expect(allText(tree.root)).toContain('Conte o que aconteceu');
    expect(send().props.disabled).toBe(true);
    await type(tree.root, 'comentario', 'Demoraram muito e cobraram errado');
    expect(send().props.disabled).toBe(false);
    await press(tree.root, 'estrela-5');
    await press(tree.root, 'tag-ATENDIMENTO');
    await press(tree.root, 'enviar-avaliacao');
    const post = fetchImpl.mock.calls.find(c => c[1]?.method === 'POST');
    expect(post[0]).toBe('https://api.test/api/partners/p1/reviews');
    expect(JSON.parse(post[1].body)).toEqual({rating: 5, tags: ['ATENDIMENTO'], comment: 'Demoraram muito e cobraram errado'});
    expect(nav.goBack).toHaveBeenCalled();
  });

  test('sem visita comprovada: explica como avaliar', async () => {
    const fetchImpl = jest.fn(async () => json({summary: {count: 0}, reviews: [], tags: [], me: {review: null, canReview: false, reason: 'NO_VISIT'}}));
    let tree;
    await act(async () => {
      tree = renderer.create(<ReviewFormScreen navigation={{setOptions: jest.fn()}} route={{params: {partnerId: 'p1'}}} fetchImpl={fetchImpl} />);
    });
    await flush();
    expect(allText(tree.root)).toContain('Só quem foi atendido pode avaliar');
  });

  test('cartão do parceiro mostra a nota', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<PartnerListCard partner={toMemberPartner({id: 'p1', name: 'Pet Shop Central', category: 'PETSHOP', rating: 4.5, reviewCount: 12})} onPress={() => {}} />);
    });
    expect(allText(tree.root)).toContain('4,5 (12)');
  });
});

describe('App Parceiros', () => {
  beforeEach(() => jest.clearAllMocks());

  test('avaliações: responde em público e denuncia', async () => {
    mockCtx.api.mockImplementation(async (m, path) =>
      m === 'GET'
        ? {
            summary: {rating: 3, count: 2, distribution: {1: 0, 2: 1, 3: 0, 4: 1, 5: 0}, tags: []},
            canReply: true,
            reviews: [
              {id: 'a', rating: 2, comment: 'Não respeitaram o desconto', tags: [], author: 'Caio', createdAt: new Date().toISOString(), reply: null, reported: false},
              {id: 'b', rating: 4, comment: 'Bom', tags: ['ATENDIMENTO'], author: 'Bia L.', createdAt: new Date().toISOString(), reply: {text: 'Obrigado!'}, reported: true},
            ],
          }
        : {message: 'ok'},
    );
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let tree;
    await act(async () => {
      tree = renderer.create(<ReviewsScreen />);
    });
    await flush();
    let t = allText(tree.root);
    expect(t).toContain('2 avaliações');
    expect(t).toContain('Resposta de Pet Shop Central');
    expect(t).toContain('Em análise pela Liga');
    expect(t).toContain('Bom atendimento');
    await press(tree.root, 'responder-a');
    await type(tree.root, 'texto-avaliacao', 'Sentimos muito, já corrigimos!');
    await press(tree.root, 'enviar-texto');
    expect(mockCtx.api).toHaveBeenCalledWith('POST', '/partner/reviews/a/reply', {text: 'Sentimos muito, já corrigimos!'});
    await press(tree.root, 'denunciar-a');
    await type(tree.root, 'texto-avaliacao', 'Este cliente nunca esteve aqui');
    await press(tree.root, 'enviar-texto');
    expect(mockCtx.api).toHaveBeenCalledWith('POST', '/partner/reviews/a/report', {reason: 'Este cliente nunca esteve aqui'});
  });

  test('veterinário registra a consulta no atendimento', async () => {
    mockCtx.api.mockResolvedValue({entry: {id: 'x'}});
    const nav = {goBack: jest.fn()};
    let tree;
    await act(async () => {
      tree = renderer.create(<VetNoteScreen navigation={nav} route={{params: {visitId: 'v1', pet: {name: 'Mia'}}}} />);
    });
    expect(allText(tree.root)).toContain('Atendimento de Mia');
    expect(tree.root.findAll(x => x.props.testID === 'tipo-SINTOMA').length).toBe(0);
    await type(tree.root, 'campo-title', 'Coceira');
    await type(tree.root, 'campo-details', 'Dermatite');
    await type(tree.root, 'campo-weight', '3,8');
    await type(tree.root, 'campo-returnDate', '29/10/2026');
    await press(tree.root, 'salvar-registro');
    const [m, path, body] = mockCtx.api.mock.calls[0];
    expect([m, path]).toEqual(['POST', '/partner/pets/visits/v1/history']);
    expect(body).toMatchObject({kind: 'CONSULTA', title: 'Coceira', details: 'Dermatite', weight: '3.8', returnDate: '2026-10-29'});
    expect(nav.goBack).toHaveBeenCalled();
  });
});
