/**
 * Limite por promoção (balcão do parceiro e app do associado), vaquinhas e aviso de vencimento.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text, TextInput} from 'react-native';

const mockStore = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k, v) => {
    mockStore[k] = v;
  }),
  removeItem: jest.fn(async k => {
    delete mockStore[k];
  }),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@react-navigation/native', () => {
  const R = require('react');
  return {useFocusEffect: cb => R.useEffect(cb, [cb]), useIsFocused: () => true};
});
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
const mockCtx = {api: jest.fn(), refresh: jest.fn(), isOwner: true};
jest.mock('../src/partner/PartnerContext', () => {
  const actual = jest.requireActual('../src/partner/PartnerContext');
  return {...actual, usePartner: () => mockCtx};
});
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: {id: 'u1', name: 'Ana Souza'}})}));

import ValidationResultScreen from '../src/partner/screens/ValidationResultScreen';
import {buildDiscountPayload} from '../src/partner/screens/DiscountFormScreen';
import PromoCard from '../src/components/PromoCard';
import CampaignsScreen from '../src/screens/CampaignsScreen';
import CampaignDetailScreen from '../src/screens/CampaignDetailScreen';
import DonationScreen from '../src/screens/DonationScreen';
import RenewReminder, {reminderKey, reminderText, resetRenewReminderSession} from '../src/components/RenewReminder';
import {brl} from '../src/components/CampaignCard';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const textOf = root =>
  root
    .findAllByType(Text)
    .map(t => [].concat(t.props.children).flat().join(''))
    .join(' | ');
const byId = (root, id) => root.findAll(n => n.props.testID === id && (n.props.onPress || n.props.onChangeText))[0];
const press = async (root, id) => {
  const n = byId(root, id);
  if (!n) throw new Error(`sem ${id}`);
  await act(async () => n.props.onPress());
};
const nav = {navigate: jest.fn(), replace: jest.fn(), popToTop: jest.fn(), goBack: jest.fn()};

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
});

describe('promoção com limite', () => {
  const base = {name: 'Ração', description: '', type: 'PERCENT', value: '10', validFrom: '', validUntil: '', isActive: true};

  test('formulário: padrão 1 por associado; total opcional; valida números', () => {
    expect(buildDiscountPayload(base).body).toMatchObject({perMemberLimit: 1, totalLimit: null});
    expect(buildDiscountPayload({...base, perMemberLimit: '3', totalLimit: '50'}).body).toMatchObject({perMemberLimit: 3, totalLimit: 50});
    expect(buildDiscountPayload({...base, perMemberLimit: '0'}).error).toMatch(/1 a 99/);
  });

  test('balcão: promoção já usada fica bloqueada; marca outras (com quantidade) e envia os itens', async () => {
    mockCtx.api.mockImplementation(async (method, path) => {
      if (path === '/partner/validate') {
        return {
          valid: true,
          message: 'Carteirinha ATIVA.',
          validationId: 'v9',
          member: {memberId: 'MEM1', name: 'Ana', endDate: '2026-12-31'},
          discounts: [
            {id: 'usada', name: 'Lanche grátis', label: 'Brinde', available: false, remainingForMember: 0, lastUsedAt: '2026-11-02T15:00:00Z', unavailableReason: 'MEMBER_LIMIT'},
            {id: 'racao', name: 'Ração 10%', label: '10% de desconto', available: true, remainingForMember: 1, limitLabel: '1 por associado'},
            {id: 'banho', name: 'Banho', label: 'R$ 10 de desconto', available: true, remainingForMember: 2, perMemberLimit: 2},
          ],
        };
      }
      return {message: 'ok'};
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<ValidationResultScreen route={{params: {code: 'x'}}} navigation={nav} />);
    });
    await flush();
    const root = tree.root;
    expect(textOf(root)).toContain('Já usou em 02/11/2026');
    const blocked = root.findAll(n => n.props.testID === 'promo-usada' && n.props.disabled !== undefined)[0];
    expect(blocked.props.disabled).toBe(true);

    await press(root, 'promo-racao');
    await press(root, 'promo-banho');
    await press(root, 'mais-banho');
    expect(byId(root, 'mais-banho').props.disabled).toBe(true); // chegou no máximo (2)
    await press(root, 'registrar');
    await flush();
    expect(mockCtx.api).toHaveBeenLastCalledWith('PATCH', '/partner/validations/v9', {
      items: [
        {discountId: 'racao', quantity: 1},
        {discountId: 'banho', quantity: 2},
      ],
      discountId: 'racao',
      amount: 0,
    });
  });

  test('servidor recusa (limite): mostra a mensagem e não marca como registrado', async () => {
    mockCtx.api.mockImplementation(async (method, path) => {
      if (path === '/partner/validate') {
        return {valid: true, validationId: 'v1', member: {name: 'Ana'}, discounts: [{id: 'd1', name: 'Ração', label: '10%', available: true, remainingForMember: 1}]};
      }
      throw new Error('Este associado já usou "Ração".');
    });
    let tree;
    await act(async () => {
      tree = renderer.create(<ValidationResultScreen route={{params: {code: 'x'}}} navigation={nav} />);
    });
    await flush();
    await press(tree.root, 'promo-d1');
    await press(tree.root, 'registrar');
    await flush();
    expect(textOf(tree.root)).toContain('já usou');
    expect(textOf(tree.root)).not.toContain('Atendimento registrado');
  });

  test('app do associado: "Você já usou" e limite no cartão da promoção', () => {
    const used = renderer.create(
      <PromoCard discount={{id: 'a', name: 'Lanche', kind: 'OTHER', benefitText: 'Lanche grátis', limitLabel: '1 por associado', available: false, lastUsedAt: '2026-11-02T15:00:00Z'}} />,
    );
    expect(textOf(used.root)).toContain('Você já usou em 02/11/2026');
    expect(textOf(used.root)).toContain('1 por associado');
    const free = renderer.create(<PromoCard discount={{id: 'b', name: 'Ração', kind: 'PERCENT', percentage: 10, limitLabel: '1 por associado', available: true}} />);
    expect(textOf(free.root)).not.toContain('Você já usou');
  });
});

describe('vaquinhas', () => {
  const camp = {
    id: 'c1', title: 'Cirurgia do Thor', summary: 'Pata traseira', goal: 3500, raised: 1250.5, percent: 36, remaining: 2249.5,
    donorsCount: 12, daysLeft: 9, status: 'ACTIVE', acceptingDonations: true, coverUrl: null,
    animal: {id: 'a1', name: 'Thor'}, showDonors: true,
    story: 'O Thor foi atropelado…', updates: [{id: 'u1', text: 'Exames feitos', createdAt: '2026-11-10T12:00:00Z'}],
    donors: [{name: 'Maria S.', amount: 50}, {name: 'Anônimo', amount: null}],
  };
  const fetchOk = data => jest.fn(async () => ({ok: true, status: 200, json: async () => data}));

  test('formata reais com milhar', () => {
    expect(brl(3500)).toBe('R$ 3.500,00');
    expect(brl(1250.5)).toBe('R$ 1.250,50');
  });

  test('lista: mostra progresso e abre a vaquinha', async () => {
    const f = fetchOk({campaigns: [camp]});
    let tree;
    await act(async () => {
      tree = renderer.create(<CampaignsScreen navigation={nav} fetchImpl={f} />);
    });
    await flush();
    expect(f).toHaveBeenCalledWith('https://api.test/api/campaigns', expect.anything());
    expect(textOf(tree.root)).toContain('Cirurgia do Thor');
    expect(textOf(tree.root)).toContain('R$ 1.250,50');
    expect(textOf(tree.root)).toContain('9 dias restantes');
    await press(tree.root, 'vaquinha-c1');
    expect(nav.navigate).toHaveBeenCalledWith('CampaignDetail', {campaignId: 'c1'});
  });

  test('detalhe: história, atualizações, apoiadores e doar leva ao checkout com a campanha', async () => {
    const f = fetchOk({campaign: camp});
    let tree;
    await act(async () => {
      tree = renderer.create(<CampaignDetailScreen route={{params: {campaignId: 'c1'}}} navigation={nav} fetchImpl={f} />);
    });
    await flush();
    const t = textOf(tree.root);
    expect(t).toContain('Faltam R$ 2.249,50 para a meta');
    expect(t).toContain('Exames feitos');
    expect(t).toContain('Maria S.');
    expect(t).toContain('Anônimo');
    await press(tree.root, 'vaquinha-doar');
    expect(nav.navigate).toHaveBeenCalledWith('Donation', {campaign: {id: 'c1', title: 'Cirurgia do Thor'}});
  });

  test('encerrada: sem botão de doar', async () => {
    const f = fetchOk({campaign: {...camp, status: 'ENDED', closedReason: 'GOAL', acceptingDonations: false}});
    let tree;
    await act(async () => {
      tree = renderer.create(<CampaignDetailScreen route={{params: {campaignId: 'c1'}}} navigation={nav} fetchImpl={f} />);
    });
    await flush();
    expect(tree.root.findAll(n => n.props.testID === 'vaquinha-doar').length).toBe(0);
    expect(textOf(tree.root)).toContain('Meta alcançada');
  });

  test('doação para a vaquinha manda campaignId para o checkout (sem opção mensal)', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<DonationScreen navigation={nav} route={{params: {campaign: {id: 'c1', title: 'Cirurgia do Thor'}}}} />);
    });
    expect(textOf(tree.root)).toContain('Doar para a vaquinha');
    expect(textOf(tree.root)).not.toContain('Mensal');
    const amount = tree.root.findAll(n => n.props.onPress && textOf(n).includes('R$ 50'))[0];
    await act(async () => amount.props.onPress());
    const pix = tree.root.findAll(n => n.props.onPress && /PIX/i.test(textOf(n)))[0];
    await act(async () => pix.props.onPress());
    const donate = tree.root.findAll(n => n.props.onPress && /Doar R\$|Confirmar|Continuar|Doar agora/i.test(textOf(n))).pop();
    await act(async () => donate.props.onPress());
    expect(nav.navigate).toHaveBeenCalledWith(
      'MembershipCheckout',
      expect.objectContaining({kind: 'donation', amount: 50, campaignId: 'c1', campaignTitle: 'Cirurgia do Thor', recurring: false}),
    );
  });
});

describe('aviso de carteirinha vencendo', () => {
  const m = {active: true, renewSoon: true, daysLeft: 3, endDate: '2026-11-24T02:59:59.000Z'};
  beforeEach(() => resetRenewReminderSession());

  test('textos', () => {
    expect(reminderText(0, '2026-11-24T02:59:59.000Z')).toMatch(/vence hoje/);
    expect(reminderText(1, '2026-11-24T02:59:59.000Z')).toMatch(/vence amanhã/);
    expect(reminderText(5, '2026-11-24T02:59:59.000Z')).toMatch(/vence em 5 dias \(23\/11\/2026\)/);
  });

  test('aparece uma vez por abertura; "Renovar" leva ao checkout', async () => {
    const onRenew = jest.fn();
    let tree;
    await act(async () => {
      tree = renderer.create(<RenewReminder membership={m} userId="u1" onRenew={onRenew} />);
    });
    await flush();
    expect(tree.root.findAll(n => n.props.testID === 'aviso-vencimento').length).toBeGreaterThan(0);
    await press(tree.root, 'aviso-renovar');
    expect(onRenew).toHaveBeenCalled();
    // volta ao Início: não abre de novo nesta sessão
    let again;
    await act(async () => {
      again = renderer.create(<RenewReminder membership={m} userId="u1" onRenew={onRenew} />);
    });
    await flush();
    expect(again.root.findAll(n => n.props.testID === 'aviso-vencimento').length).toBe(0);
  });

  test('"Não avisar de novo" vale só para este vencimento', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<RenewReminder membership={m} userId="u1" />);
    });
    await flush();
    await press(tree.root, 'aviso-nao-avisar');
    await press(tree.root, 'aviso-fechar');
    await flush();
    expect(mockStore[reminderKey('u1', m.endDate)]).toBe('1');

    resetRenewReminderSession(); // abriu o app de novo
    let reopened;
    await act(async () => {
      reopened = renderer.create(<RenewReminder membership={m} userId="u1" />);
    });
    await flush();
    expect(reopened.root.findAll(n => n.props.testID === 'aviso-vencimento').length).toBe(0);

    // renovou: novo vencimento volta a avisar
    let next;
    await act(async () => {
      next = renderer.create(<RenewReminder membership={{...m, endDate: '2026-12-24T02:59:59.000Z'}} userId="u1" />);
    });
    await flush();
    expect(next.root.findAll(n => n.props.testID === 'aviso-vencimento').length).toBeGreaterThan(0);
  });

  test('longe do vencimento ou vencida: sem aviso', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<RenewReminder membership={{...m, renewSoon: false, daysLeft: 20}} userId="u1" />);
    });
    await flush();
    expect(tree.root.findAll(n => n.props.testID === 'aviso-vencimento').length).toBe(0);
  });
});
