/**
 * Dicas de primeira vez ("balões"): destacam um elemento da tela (o resto escurece de leve) e
 * explicam em uma frase o que ele faz. Regras para não poluir:
 *  - cada tela tem no máximo 3 dicas (o Início, que tem muita coisa, pode ter mais) e aparece
 *    UMA vez (fica salvo no aparelho);
 *  - só começa quando a tela terminou de carregar, e nunca duas ao mesmo tempo;
 *  - "Pular" sempre visível; tocar fora ou no botão voltar também fecha;
 *  - elemento que ainda não existe é ignorado; se estiver mais abaixo e a tela informar a
 *    rolagem (tour.scrollProps no ScrollView), a tela desce sozinha até ele e volta ao topo no fim.
 * Em Perfil > "Rever as dicas do app" dá para ver tudo de novo.
 *
 * Uso numa tela:
 *   const tour = useTour('home@1', [{id: 'card', title: 'Sua carteirinha', text: '…'}], {ready: !!data});
 *   <View ref={tour.ref('card')}>…</View>
 */
import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Animated, BackHandler, Dimensions, Pressable, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

const STORE_KEY = 'tours_seen_v1';
const START_DELAY_MS = 700;
const PAD = 6;
const MAX_STEPS = 3;
const SCROLL_SETTLE_MS = 380;
const TOP_MARGIN = 90;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function storage() {
  try {
    const m = require('@react-native-async-storage/async-storage');
    return m.default || m;
  } catch {
    return null;
  }
}

async function readSeen() {
  try {
    return JSON.parse((await storage()?.getItem(STORE_KEY)) || '{}') || {};
  } catch {
    return {};
  }
}

export async function markTourSeen(tourId) {
  const seen = await readSeen();
  seen[tourId] = Date.now();
  try {
    await storage()?.setItem(STORE_KEY, JSON.stringify(seen));
  } catch {
    /* sem armazenamento: aparece de novo, sem problema */
  }
}

/** Perfil > "Rever as dicas do app". */
export async function resetTours() {
  try {
    await storage()?.removeItem(STORE_KEY);
  } catch {
    /* ignora */
  }
}

export async function isTourSeen(tourId) {
  return !!(await readSeen())[tourId];
}

const TourContext = createContext(null);

function measure(node, timeoutMs = 600) {
  return new Promise(resolve => {
    if (!node || typeof node.measureInWindow !== 'function') return resolve(null);
    // se a medida não vier (elemento sumiu, tela trocou), desiste em vez de travar
    const t = setTimeout(() => resolve(null), timeoutMs);
    try {
      node.measureInWindow((x, y, w, h) => {
        clearTimeout(t);
        resolve(Number.isFinite(x) && w > 0 && h > 0 ? {x, y, w, h} : null);
      });
    } catch {
      clearTimeout(t);
      resolve(null);
    }
  });
}

/** Posição do balão: embaixo do destaque se couber, senão em cima. */
export function bubblePlacement(hole, screen, bubbleH = 170) {
  const below = hole.y + hole.h + PAD + 12;
  const fitsBelow = below + bubbleH < screen.height - 16;
  const top = fitsBelow ? below : Math.max(16, hole.y - PAD - 12 - bubbleH);
  const width = Math.min(screen.width - 32, 340);
  const center = hole.x + hole.w / 2;
  const left = Math.max(16, Math.min(screen.width - width - 16, center - width / 2));
  const arrowLeft = Math.max(18, Math.min(width - 30, center - left - 6));
  return {top, left, width, below: fitsBelow, arrowLeft};
}

export function TourProvider({children}) {
  // {id, steps: [{id, title, text, absY}], index, rect, scroller}
  const [active, setActive] = useState(null);
  const rootRef = useRef(null);
  const fade = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const run = useRef(null); // dados da dica atual fora do estado (nós, rolagem)

  const finish = useCallback(async () => {
    const cur = run.current;
    run.current = null;
    setActive(null);
    busy.current = false;
    if (cur?.scrolled && cur.scroller?.ref?.current?.scrollTo) {
      try {
        cur.scroller.ref.current.scrollTo({y: 0, animated: true});
      } catch {
        /* ignora */
      }
    }
    if (cur?.id) await markTourSeen(cur.id);
  }, []);

  /** Mostra a dica i: rola até o elemento se precisar e mede onde ele ficou. */
  const show = useCallback(
    async i => {
      const cur = run.current;
      if (!cur) return;
      if (i >= cur.steps.length) {
        finish();
        return;
      }
      const step = cur.steps[i];
      const screen = Dimensions.get('window');
      const node = cur.nodes[step.id];
      let rect = await measureRel(node, cur.origin);
      const offscreen = r => !r || r.y < TOP_MARGIN / 2 || r.y + Math.min(r.h, 120) > screen.height - 200;
      if (offscreen(rect) && cur.scroller?.ref?.current?.scrollTo) {
        const y0 = cur.scroller.offset();
        const target = rect ? y0 + rect.y - TOP_MARGIN : step.absY - TOP_MARGIN;
        setActive(a => (a ? {...a, index: i, rect: null} : a)); // esconde o balão enquanto rola
        try {
          cur.scroller.ref.current.scrollTo({y: Math.max(0, target), animated: true});
          cur.scrolled = true;
        } catch {
          /* ignora */
        }
        await sleep(SCROLL_SETTLE_MS);
        if (run.current !== cur) return;
        rect = await measureRel(node, cur.origin);
      }
      if (run.current !== cur) return;
      if (!rect || rect.y + Math.min(rect.h, 60) > screen.height || rect.y + rect.h < 0) {
        // não deu para mostrar este: tira da lista e vai para o próximo
        cur.steps.splice(i, 1);
        setActive(a => (a ? {...a, steps: [...cur.steps]} : a));
        show(i);
        return;
      }
      setActive(a => (a ? {...a, steps: [...cur.steps], index: i, rect} : a));
    },
    [finish],
  );

  const next = useCallback(() => {
    const cur = run.current;
    if (!cur) return;
    cur.index += 1;
    show(cur.index);
  }, [show]);

  useEffect(() => {
    if (!active?.rect) return undefined;
    fade.setValue(0);
    Animated.timing(fade, {toValue: 1, duration: 180, useNativeDriver: true}).start();
    return undefined;
  }, [active?.index, active?.rect]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      finish();
      return true;
    });
    return () => sub.remove();
  }, [!!active]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(
    async (id, steps, nodes, stillHere = () => true, opts = {}) => {
      if (busy.current) return false;
      busy.current = true;
      if (await isTourSeen(id)) {
        busy.current = false;
        return false;
      }
      const origin = (await measure(rootRef.current)) || {x: 0, y: 0};
      const screen = Dimensions.get('window');
      const max = opts.maxSteps || MAX_STEPS;
      const scroller = opts.scroller || null;
      const y0 = scroller ? scroller.offset() : 0;
      const list = [];
      for (const st of steps) {
        if (!nodes[st.id]) continue;
        const r = await measureRel(nodes[st.id], origin);
        if (!r) continue;
        const visible = r.y >= 0 && r.y + Math.min(r.h, 60) <= screen.height;
        // sem rolagem informada, só o que já está na tela
        if (!visible && !scroller) continue;
        list.push({...st, absY: y0 + r.y});
        if (list.length >= max) break;
      }
      if (!list.length || !stillHere()) {
        busy.current = false;
        return false;
      }
      run.current = {id, steps: list, nodes, origin, scroller, index: 0, scrolled: false};
      setActive({id, steps: list, index: 0, rect: null});
      await show(0);
      return true;
    },
    [show],
  );

  const value = useMemo(() => ({start, activeId: active?.id || null}), [start, active?.id]);
  const step = active?.rect ? active.steps[active.index] : null;
  const screen = Dimensions.get('window');

  return (
    <TourContext.Provider value={value}>
      <View ref={rootRef} style={{flex: 1}} collapsable={false}>
        {children}
        {active && !step ? <View style={StyleSheet.absoluteFill} testID="dica-rolando" /> : null}
        {step ? (
          <Animated.View style={[StyleSheet.absoluteFill, {opacity: fade, zIndex: 9999, elevation: 9999}]} testID="dica">
            <TourOverlay step={{...step, rect: active.rect}} index={active.index} total={active.steps.length} screen={screen} onNext={next} onSkip={finish} />
          </Animated.View>
        ) : null}
      </View>
    </TourContext.Provider>
  );
}

async function measureRel(node, origin) {
  const r = await measure(node);
  return r ? {x: r.x - origin.x, y: r.y - origin.y, w: r.w, h: r.h} : null;
}

function TourOverlay({step, index, total, screen, onNext, onSkip}) {
  const h = {x: step.rect.x - PAD, y: step.rect.y - PAD, w: step.rect.w + PAD * 2, h: step.rect.h + PAD * 2};
  const b = bubblePlacement(h, screen);
  const last = index + 1 >= total;
  const dim = 'rgba(15, 10, 40, 0.62)';
  return (
    <View style={StyleSheet.absoluteFill}>
      {/* quatro faixas escuras em volta do destaque (o elemento continua visível) */}
      <Pressable style={{position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, h.y), backgroundColor: dim}} onPress={onNext} />
      <Pressable style={{position: 'absolute', left: 0, right: 0, top: h.y + h.h, bottom: 0, backgroundColor: dim}} onPress={onNext} />
      <Pressable style={{position: 'absolute', left: 0, width: Math.max(0, h.x), top: h.y, height: h.h, backgroundColor: dim}} onPress={onNext} />
      <Pressable style={{position: 'absolute', left: h.x + h.w, right: 0, top: h.y, height: h.h, backgroundColor: dim}} onPress={onNext} />
      <Pressable style={[styles.ring, {left: h.x, top: h.y, width: h.w, height: h.h}]} onPress={onNext} accessibilityLabel="Próxima dica" />

      <View style={[styles.bubble, {top: b.top, left: b.left, width: b.width}]} accessibilityLiveRegion="polite" testID="dica-balao">
        <View style={[styles.arrow, b.below ? {top: -6} : {bottom: -6}, {left: b.arrowLeft}]} />
        <Text style={styles.count}>
          {total > 1 ? `${index + 1} de ${total}` : 'Dica'}
        </Text>
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.text}>{step.text}</Text>
        <View style={styles.row}>
          {!last ? (
            <TouchableOpacity onPress={onSkip} hitSlop={10} testID="dica-pular">
              <Text style={styles.skip}>Pular</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
            {total > 1 ? (
              <View style={{flexDirection: 'row', gap: 4}}>
                {Array.from({length: total}, (_, i) => (
                  <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
                ))}
              </View>
            ) : null}
            <TouchableOpacity style={styles.btn} onPress={onNext} testID="dica-proximo">
              <Text style={styles.btnText}>{last ? 'Entendi' : 'Próximo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Registra os elementos da tela e começa as dicas quando `ready` (dados carregados).
 * Sem TourProvider (ex.: testes), não faz nada.
 */
function useFocusedSafe() {
  // Fora de um navegador (ex.: testes) considera a tela em foco
  try {
    const nav = require('@react-navigation/native');
    return typeof nav.useIsFocused === 'function' ? nav.useIsFocused() : true;
  } catch {
    return true;
  }
}

export function useTour(tourId, steps, {ready = true, delay = START_DELAY_MS, maxSteps = MAX_STEPS} = {}) {
  const ctx = useContext(TourContext);
  const focused = useFocusedSafe();
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const nodes = useRef({});
  const refs = useRef({});
  const started = useRef(false);
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const onScroll = useCallback(e => {
    scrollY.current = e?.nativeEvent?.contentOffset?.y || 0;
  }, []);

  const ref = useCallback(id => {
    if (!refs.current[id]) {
      refs.current[id] = node => {
        nodes.current[id] = node;
      };
    }
    return refs.current[id];
  }, []);

  useEffect(() => {
    if (!ctx || !ready || !focused || started.current) return undefined;
    const t = setTimeout(async () => {
      // saiu da tela antes de começar: tenta de novo quando voltar
      if (!focusedRef.current) return;
      const ok = await ctx.start(tourId, steps, nodes.current, () => focusedRef.current, {
        maxSteps,
        scroller: hasScroll.current ? {ref: scrollRef, offset: () => scrollY.current} : null,
      });
      if (ok) started.current = true;
    }, delay);
    return () => clearTimeout(t);
  }, [ctx, ready, focused, tourId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Para telas com rolagem: <ScrollView {...tour.scrollProps}> deixa a dica descer até o elemento
  const hasScroll = useRef(false);
  const setScrollRef = useCallback(node => {
    scrollRef.current = node;
    hasScroll.current = !!node;
  }, []);
  const scrollProps = useMemo(() => ({ref: setScrollRef, onScroll, scrollEventThrottle: 32}), [setScrollRef, onScroll]);

  return {ref, scrollProps};
}

const styles = StyleSheet.create({
  ring: {position: 'absolute', borderRadius: 14, borderWidth: 2, borderColor: '#FFFFFF'},
  bubble: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 12,
  },
  arrow: {position: 'absolute', width: 12, height: 12, backgroundColor: '#FFFFFF', transform: [{rotate: '45deg'}]},
  count: {fontSize: 11, fontWeight: '800', color: '#7C3AED', letterSpacing: 0.4, textTransform: 'uppercase'},
  title: {fontSize: 16, fontWeight: '800', color: '#1E1B2E', marginTop: 4},
  text: {fontSize: 14, color: '#4B4862', marginTop: 4, lineHeight: 20},
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14},
  skip: {fontSize: 14, fontWeight: '700', color: '#6B6880'},
  dot: {width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD6FE'},
  dotOn: {backgroundColor: '#6D28D9', width: 14},
  btn: {backgroundColor: '#6D28D9', borderRadius: 12, paddingHorizontal: 16, height: 40, alignItems: 'center', justifyContent: 'center'},
  btnText: {color: '#FFFFFF', fontSize: 14, fontWeight: '800'},
});
