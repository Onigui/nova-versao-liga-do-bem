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

// Tela com rolagem: o elemento "c" está lá embaixo; a dica rola até ele e volta ao topo no fim
let scrolled = 0;
const scrollCalls = [];
class FakeScroll extends React.Component {
  scrollTo({y}) {
    scrolled = y;
    scrollCalls.push(y);
  }
  render() {
    return <View>{this.props.children}</View>;
  }
}
class ScrollBox extends React.Component {
  measureInWindow(cb) {
    const [x, y, w, h] = RECTS[this.props.k];
    cb(x, y - scrolled, w, h);
  }
  render() {
    return <View />;
  }
}
const LONG = [
  {id: 'a', title: 'Um', text: 'A'},
  {id: 'b', title: 'Dois', text: 'B'},
  {id: 'c', title: 'Três (lá embaixo)', text: 'C'},
  {id: 'd', title: 'Quatro', text: 'D'},
];
function LongScreen() {
  const tour = useTour('longo@1', LONG, {delay: 0, maxSteps: 10});
  const {ref: scrollRef, onScroll} = tour.scrollProps;
  return (
    <FakeScroll ref={scrollRef} onScroll={onScroll}>
      <ScrollBox k="a" ref={tour.ref('a')} />
      <ScrollBox k="b" ref={tour.ref('b')} />
      <ScrollBox k="c" ref={tour.ref('c')} />
      <ScrollBox k="d" ref={tour.ref('d')} />
    </FakeScroll>
  );
}

test('Início: mais de 3 dicas e a tela desce sozinha até o que está lá embaixo', async () => {
  scrolled = 0;
  scrollCalls.length = 0;
  RECTS.d = [20, 2600, 200, 80];
  const tree = await mount(<LongScreen />);
  expect(texts(tree.root)).toEqual(expect.arrayContaining(['1 de 4', 'Um']));
  await press(tree.root, 'dica-proximo');
  expect(texts(tree.root)).toContain('Dois');
  await act(async () => tree.root.findAll(x => x.props.testID === 'dica-proximo' && x.props.onPress)[0].props.onPress());
  await act(() => new Promise(r => setTimeout(r, 450)));
  await flush();
  expect(scrollCalls.at(-1)).toBeGreaterThan(1500); // desceu até o "c"
  expect(texts(tree.root)).toEqual(expect.arrayContaining(['3 de 4', 'Três (lá embaixo)']));
  await act(async () => tree.root.findAll(x => x.props.testID === 'dica-proximo' && x.props.onPress)[0].props.onPress());
  await act(() => new Promise(r => setTimeout(r, 450)));
  await flush();
  expect(texts(tree.root)).toEqual(expect.arrayContaining(['4 de 4', 'Quatro', 'Entendi']));
  await press(tree.root, 'dica-proximo');
  expect(tree.root.findAll(x => x.props.testID === 'dica').length).toBe(0);
  expect(scrollCalls.at(-1)).toBe(0); // voltou ao topo
  delete RECTS.d;
});

test('telas comuns continuam com no máximo 3 dicas', async () => {
  scrolled = 0;
  function Many() {
    const tour = useTour('muitas@1', LONG, {delay: 0});
    return (
      <View>
        {['a', 'b', 'c', 'd'].map(k => (
          <Box key={k} k={k === 'c' || k === 'd' ? 'b' : k} ref={tour.ref(k)} />
        ))}
      </View>
    );
  }
  const tree = await mount(<Many />);
  expect(texts(tree.root)).toContain('1 de 3');
});

test('balão vai embaixo do destaque, ou em cima quando não cabe', () => {
  const screen = {width: 400, height: 800};
  expect(bubblePlacement({x: 20, y: 100, w: 200, h: 60}, screen).below).toBe(true);
  const up = bubblePlacement({x: 20, y: 700, w: 200, h: 60}, screen);
  expect(up.below).toBe(false);
  expect(up.top).toBeLessThan(700);
  expect(bubblePlacement({x: 0, y: 0, w: 10, h: 10}, {width: 320, height: 600}).width).toBe(288);
});

test('textos: curtos; só o Início passa de 4', () => {
  expect(TOURS.home.steps.length).toBeGreaterThanOrEqual(8);
  expect(TOURS.home.maxSteps).toBeGreaterThanOrEqual(8);
  for (const [k, t] of Object.entries(TOURS)) {
    expect(t.id).toMatch(/@\d+$/);
    if (k !== 'home') expect(t.steps.length).toBeLessThanOrEqual(4);
    for (const s of t.steps) expect(s.text.length).toBeLessThanOrEqual(120);
  }
});
