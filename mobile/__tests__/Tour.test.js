/**
 * Dicas de primeira vez: aparecem uma vez, em ordem, pulam o que não está na tela e somem com "Pular".
 */
import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {Text, View} from 'react-native';

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

import {TourProvider, bubblePlacement, isTourSeen, resetTours, useTour} from '../src/components/Tour';
import {TOURS} from '../src/tours';

const flush = () => act(() => new Promise(r => setTimeout(r, 0)));
const texts = root => root.findAllByType(Text).map(t => [].concat(t.props.children).join(''));
const press = async (root, id) => {
  const n = root.findAll(x => x.props.testID === id && x.props.onPress)[0];
  if (!n) throw new Error(`sem ${id}`);
  await act(async () => n.props.onPress());
  await flush();
};

// elementos que "se medem" (o renderer de teste não mede nada de verdade)
const RECTS = {a: [20, 100, 200, 60], b: [20, 300, 300, 50], c: [20, 2000, 100, 40]};
class Box extends React.Component {
  measureInWindow(cb) {
    cb(...RECTS[this.props.k]);
  }
  render() {
    return <View />;
  }
}
const mockNode = () => ({});

const STEPS = [
  {id: 'a', title: 'Primeira', text: 'Texto A'},
  {id: 'b', title: 'Segunda', text: 'Texto B'},
  {id: 'c', title: 'Lá embaixo', text: 'Fora da tela'},
];

function Screen({ready = true}) {
  const tour = useTour('teste@1', STEPS, {ready, delay: 0});
  return (
    <View>
      <Box k="a" ref={tour.ref('a')} />
      <Box k="b" ref={tour.ref('b')} />
      <Box k="c" ref={tour.ref('c')} />
    </View>
  );
}

const mount = async (el = <Screen />) => {
  let tree;
  await act(async () => {
    tree = renderer.create(<TourProvider>{el}</TourProvider>, {createNodeMock: mockNode});
  });
  await act(() => new Promise(r => setTimeout(r, 700)));
  await flush();
  return tree;
};

beforeEach(() => Object.keys(mockStore).forEach(k => delete mockStore[k]));

test('mostra as dicas em ordem e pula o que está fora da tela', async () => {
  const tree = await mount();
  expect(texts(tree.root)).toEqual(expect.arrayContaining(['1 de 2', 'Primeira', 'Texto A', 'Próximo', 'Pular']));
  await press(tree.root, 'dica-proximo');
  expect(texts(tree.root)).toEqual(expect.arrayContaining(['2 de 2', 'Segunda', 'Entendi']));
  expect(texts(tree.root)).not.toContain('Pular'); // na última não precisa
  expect(texts(tree.root)).not.toContain('Lá embaixo');
  await press(tree.root, 'dica-proximo');
  expect(tree.root.findAll(x => x.props.testID === 'dica').length).toBe(0);
  expect(await isTourSeen('teste@1')).toBe(true);
});

test('aparece uma vez só; "Rever as dicas" mostra de novo', async () => {
  let tree = await mount();
  await press(tree.root, 'dica-pular');
  expect(tree.root.findAll(x => x.props.testID === 'dica').length).toBe(0);
  tree.unmount();
  tree = await mount();
  expect(tree.root.findAll(x => x.props.testID === 'dica').length).toBe(0);
  tree.unmount();
  await resetTours();
  tree = await mount();
  expect(texts(tree.root)).toContain('Primeira');
});

test('espera a tela carregar', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(
      <TourProvider>
        <Screen ready={false} />
      </TourProvider>,
      {createNodeMock: mockNode},
    );
  });
  await flush();
  expect(tree.root.findAll(x => x.props.testID === 'dica').length).toBe(0);
  await act(async () =>
    tree.update(
      <TourProvider>
        <Screen ready />
      </TourProvider>,
    ),
  );
  await act(() => new Promise(r => setTimeout(r, 700)));
  await flush();
  expect(texts(tree.root)).toContain('Primeira');
});

test('sem TourProvider (ex.: outras telas nos testes) não faz nada', async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(<Screen />);
  });
  await flush();
  expect(tree.root.findAll(x => x.props.testID === 'dica').length).toBe(0);
});

test('balão vai embaixo do destaque, ou em cima quando não cabe', () => {
  const screen = {width: 400, height: 800};
  expect(bubblePlacement({x: 20, y: 100, w: 200, h: 60}, screen).below).toBe(true);
  const up = bubblePlacement({x: 20, y: 700, w: 200, h: 60}, screen);
  expect(up.below).toBe(false);
  expect(up.top).toBeLessThan(700);
  expect(bubblePlacement({x: 0, y: 0, w: 10, h: 10}, {width: 320, height: 600}).width).toBe(288);
});

test('textos: curtos e no máximo 4 opções por tela', () => {
  for (const t of Object.values(TOURS)) {
    expect(t.id).toMatch(/@\d+$/);
    expect(t.steps.length).toBeLessThanOrEqual(4);
    for (const s of t.steps) expect(s.text.length).toBeLessThanOrEqual(120);
  }
});
