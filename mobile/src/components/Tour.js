/**
 * Dicas de primeira vez ("balões"): destacam um elemento da tela (o resto escurece de leve) e
 * explicam em uma frase o que ele faz. Regras para não poluir:
 *  - cada tela tem no máximo 3 dicas e aparece UMA vez (fica salvo no aparelho);
 *  - só começa quando a tela terminou de carregar, e nunca duas ao mesmo tempo;
 *  - "Pular" sempre visível; tocar fora ou no botão voltar também fecha;
 *  - elemento que não está na tela (fora da rolagem, ainda não existe) é ignorado.
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
  const [active, setActive] = useState(null); // {id, steps: [{title, text, rect}], index}
  const rootRef = useRef(null);
  const fade = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);

  const finish = useCallback(async () => {
    const id = active?.id;
    setActive(null);
    busy.current = false;
    if (id) await markTourSeen(id);
  }, [active?.id]);

  const next = useCallback(() => {
    setActive(a => {
      if (!a) return a;
      if (a.index + 1 >= a.steps.length) return {...a, done: true};
      return {...a, index: a.index + 1};
    });
  }, []);

  useEffect(() => {
    if (active?.done) finish();
  }, [active?.done, finish]);

  useEffect(() => {
    if (!active) return undefined;
    fade.setValue(0);
    Animated.timing(fade, {toValue: 1, duration: 180, useNativeDriver: true}).start();
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      finish();
      return true;
    });
    return () => sub.remove();
  }, [active?.id, active?.index]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(async (id, steps, nodes, stillHere = () => true) => {
    if (busy.current) return false;
    busy.current = true;
    if (await isTourSeen(id)) {
      busy.current = false;
      return false;
    }
    const origin = (await measure(rootRef.current)) || {x: 0, y: 0};
    const screen = Dimensions.get('window');
    const ready = [];
    for (const s of steps) {
      const r = await measure(nodes[s.id]);
      if (!r) continue;
      const rect = {x: r.x - origin.x, y: r.y - origin.y, w: r.w, h: r.h};
      // fora da tela (ex.: lá embaixo na rolagem): pula esta dica
      if (rect.y < 0 || rect.y + Math.min(rect.h, 60) > screen.height) continue;
      ready.push({...s, rect});
      if (ready.length >= MAX_STEPS) break;
    }
    if (!ready.length || !stillHere()) {
      busy.current = false;
      return false;
    }
    setActive({id, steps: ready, index: 0});
    return true;
  }, []);

  const value = useMemo(() => ({start, activeId: active?.id || null}), [start, active?.id]);
  const step = active && !active.done ? active.steps[active.index] : null;
  const screen = Dimensions.get('window');

  return (
    <TourContext.Provider value={value}>
      <View ref={rootRef} style={{flex: 1}} collapsable={false}>
        {children}
        {step ? (
          <Animated.View style={[StyleSheet.absoluteFill, {opacity: fade, zIndex: 9999, elevation: 9999}]} testID="dica">
            <TourOverlay step={step} index={active.index} total={active.steps.length} screen={screen} onNext={next} onSkip={finish} />
          </Animated.View>
        ) : null}
      </View>
    </TourContext.Provider>
  );
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

export function useTour(tourId, steps, {ready = true, delay = START_DELAY_MS} = {}) {
  const ctx = useContext(TourContext);
  const focused = useFocusedSafe();
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const nodes = useRef({});
  const refs = useRef({});
  const started = useRef(false);

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
      const ok = await ctx.start(tourId, steps.slice(0, MAX_STEPS + 2), nodes.current, () => focusedRef.current);
      if (ok) started.current = true;
    }, delay);
    return () => clearTimeout(t);
  }, [ctx, ready, focused, tourId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {ref};
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
