/**
 * Seletor de data novo, datas no dia certo (fuso) e adoção com os dados do membro.
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Alert, Text} from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async k => (k === 'auth_token' ? 'tok-membro' : null)),
  setItem: jest.fn(async () => {}),
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('../src/config/apiConfig', () => ({API_BASE_PATH: 'https://api.test/api'}));
const mockUser = {name: 'Ana Souza', email: 'ana@x.com', phone: '14999998888'};
jest.mock('../src/services/AuthService', () => ({useAuth: () => ({user: mockUser, token: 'tok-membro'})}));

import DateField from '../src/components/DateField';
import AnimalDetailScreen, {buildAdoptionRequest} from '../src/screens/AnimalDetailScreen';
import EventDetailScreen from '../src/screens/EventDetailScreen';
import {ageParts, calendarDate, daysUntil, eventDate, formatBR, formatLong, parseBR, toISODay} from '../src/utils/dates';
import {doseStatus} from '../src/screens/VaccinationCardScreen';
import {formatDateBR} from '../src/partner/PartnerContext';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const textOf = root => root.findAllByType(Text).map(t => [].concat(t.props.children).flat().join('')).join(' | ');
const press = async (root, id) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onPress)[0];
  if (!n) throw new Error(`sem ${id}`);
  await act(async () => n.props.onPress());
};

describe('datas no dia certo', () => {
  test('"2026-10-20" e meia-noite UTC são o dia 20, não 19', () => {
    expect(calendarDate('2026-10-20').getDate()).toBe(20);
    expect(calendarDate('2026-10-20T00:00:00.000Z').getDate()).toBe(20);
    expect(formatBR('2020-05-10T00:00:00.000Z')).toBe('10/05/2020');
    expect(formatLong('2026-10-20', true)).toBe('terça-feira, 20 de outubro de 2026');
    expect(formatDateBR('2026-10-20T00:00:00.000Z')).toBe('20/10/2026'); // App Parceiros
  });
  test('evento com hora é instante exato; só dia é dia de calendário', () => {
    expect(eventDate('2026-10-20').getDate()).toBe(20);
    expect(eventDate('2026-10-20T20:00:00.000Z').getTime()).toBe(Date.parse('2026-10-20T20:00:00.000Z'));
  });
  test('converte e confere', () => {
    expect(toISODay(new Date(2026, 9, 20, 23, 30))).toBe('2026-10-20'); // nada de toISOString (viraria dia 21)
    expect(parseBR('31/02/2026')).toBeNull();
    expect(parseBR('20/10/2026 17:30').getHours()).toBe(17);
    expect(daysUntil('2026-10-20T00:00:00.000Z', new Date(2026, 9, 17, 22, 0).getTime())).toBe(3);
    expect(doseStatus('2026-10-17T00:00:00.000Z', new Date(2026, 9, 17, 22, 0).getTime()).label).toBe('É hoje');
    expect(ageParts('2024-10-18', new Date(2026, 9, 17))).toEqual({years: 1, months: 11, total: 23});
  });
  test('detalhe do evento mostra o dia 20', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(
        <EventDetailScreen navigation={{navigate: jest.fn(), goBack: jest.fn()}} route={{params: {event: {id: 'e1', title: 'Feira', date: '2026-10-20', time: '17:00 - 19:00', location: 'Praça'}}}} />,
      );
    });
    expect(textOf(tree.root)).toMatch(/terça-feira, 20 de outubro/);
    expect(textOf(tree.root)).not.toMatch(/19 de outubro/);
  });
});

describe('seletor de data', () => {
  function Harness({initial = null, ...props}) {
    const [v, setV] = React.useState(initial);
    return (
      <>
        <DateField value={v} onChange={setV} testID="d" {...props} />
        <Text testID="valor">{v ? formatBR(v) : 'vazio'}</Text>
      </>
    );
  }
  const valor = tree => tree.root.findByProps({testID: 'valor'}).props.children;

  test('escolhe dia, mês e ano nas rodinhas e confirma', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<Harness minDate={new Date(2000, 0, 1)} maxDate={new Date(2030, 11, 31)} />);
    });
    await press(tree.root, 'd');
    await press(tree.root, 'd-ano-2019');
    await press(tree.root, 'd-mes-3');
    await press(tree.root, 'd-dia-15');
    expect(tree.root.findByProps({testID: 'd-previa'}).props.children.join('')).toMatch(/15 de março de 2019/);
    await press(tree.root, 'd-confirmar');
    expect(valor(tree)).toBe('15/03/2019');
  });

  test('31 de janeiro → fevereiro vira 28 (o mês certo)', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<Harness initial={new Date(2026, 0, 31, 12)} maxDate={new Date(2030, 0, 1)} />);
    });
    await press(tree.root, 'd');
    await press(tree.root, 'd-mes-2');
    expect(tree.root.findAll(x => x.props.testID === 'd-dia-31').length).toBe(0);
    await press(tree.root, 'd-confirmar');
    expect(valor(tree)).toBe('28/02/2026');
  });

  test('não passa do limite (nascimento não pode ser no futuro) e cancelar não muda nada', async () => {
    const max = new Date(2026, 9, 17, 12);
    let tree;
    await act(async () => {
      tree = renderer.create(<Harness initial={new Date(2026, 9, 1, 12)} maxDate={max} minDate={new Date(2000, 0, 1)} />);
    });
    await press(tree.root, 'd');
    await press(tree.root, 'd-dia-30');
    expect(textOf(tree.root)).toMatch(/Ajustado para o limite/);
    await press(tree.root, 'd-cancelar');
    expect(valor(tree)).toBe('01/10/2026');
    await press(tree.root, 'd');
    await press(tree.root, 'd-dia-30');
    await press(tree.root, 'd-confirmar');
    expect(valor(tree)).toBe('17/10/2026');
  });

  test('opcional: limpar apaga a data', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<Harness initial={new Date(2026, 9, 1, 12)} optional />);
    });
    await press(tree.root, 'd-apagar');
    expect(valor(tree)).toBe('vazio');
  });

  test('data e hora (achados e perdidos)', async () => {
    let tree;
    const onChange = jest.fn();
    await act(async () => {
      tree = renderer.create(<DateField mode="datetime" value={new Date(2026, 9, 10, 8, 0)} onChange={onChange} testID="q" maxDate={new Date(2026, 9, 17, 23, 0)} />);
    });
    await press(tree.root, 'q');
    await press(tree.root, 'q-hora-18');
    await press(tree.root, 'q-minuto-30');
    await press(tree.root, 'q-confirmar');
    const d = onChange.mock.calls[0][0];
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([10, 18, 30]);
  });
});

describe('adoção', () => {
  test('monta o pedido e confere os dados', () => {
    expect(buildAdoptionRequest({name: 'Ana', email: 'x', phone: '14999998888'}, 'a1').error).toMatch(/e-mail/);
    expect(buildAdoptionRequest({name: 'Ana Souza', email: 'ana@x.com', phone: '1499'}, 'a1').error).toMatch(/telefone/);
    expect(
      buildAdoptionRequest({name: ' Ana Souza ', email: 'ANA@x.com', phone: '(14) 99999-8888', visitDate: new Date(2026, 9, 25, 12), period: 'Tarde', message: ' Tenho quintal '}, 'a1').body,
    ).toEqual({animalId: 'a1', name: 'Ana Souza', email: 'ana@x.com', phone: '14999998888', visitDate: '25/10/2026', period: 'Tarde', message: 'Tenho quintal'});
  });

  test('"Quero adotar" já vem com nome, e-mail e telefone da conta', async () => {
    global.fetch = jest.fn(async () => ({ok: true, status: 201, json: async () => ({message: 'ok'})}));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let tree;
    await act(async () => {
      tree = renderer.create(
        <AnimalDetailScreen navigation={{goBack: jest.fn(), navigate: jest.fn()}} route={{params: {animal: {id: 'a1', name: 'Bob', photos: ['x']}}}} />,
      );
    });
    const btn = tree.root.findAll(x => x.props.onPress && [].concat(x.props.children || []).length && textOf(x).includes('Quero Adotar'))[0];
    await act(async () => btn.props.onPress());
    const card = textOf(tree.root.findByProps({testID: 'adocao-meus-dados'}));
    expect(card).toMatch(/Ana Souza/);
    expect(card).toMatch(/ana@x\.com/);
    expect(card).toMatch(/\(14\) 99999-8888/);
    await press(tree.root, 'adocao-periodo-Manhã');
    await press(tree.root, 'adocao-enviar');
    await flush();
    const [url, init] = global.fetch.mock.calls.find(c => String(c[0]).includes('/adoptions/request'));
    expect(url).toBe('https://api.test/api/adoptions/request');
    expect(init.headers.Authorization).toBe('Bearer tok-membro');
    expect(JSON.parse(init.body)).toMatchObject({animalId: 'a1', name: 'Ana Souza', email: 'ana@x.com', phone: '14999998888', period: 'Manhã'});
  });
});
