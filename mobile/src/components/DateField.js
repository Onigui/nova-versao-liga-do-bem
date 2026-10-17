/**
 * Campo de data do app inteiro: mostra a data escolhida e, ao tocar, abre uma folha que sobe
 * de baixo com rodinhas de Dia / Mês / Ano (e Hora / Minuto quando mode="datetime").
 * Cabe em qualquer celular (altura fixa ~ metade da tela) e é rápido para datas antigas,
 * como nascimento: é só girar o ano.
 *
 * value: Date | null   ·   onChange(Date | null)
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {MONTHS_PT, MONTHS_SHORT, daysInMonth, formatBR, formatBRTime, formatLong, sameDay} from '../utils/dates';

const ITEM = 44;
const VISIBLE = 5; // linhas visíveis em cada rodinha
const pad = n => String(n).padStart(2, '0');

function Wheel({items, index, onIndex, width, testID, accent}) {
  const ref = useRef(null);
  const last = useRef(index);

  useEffect(() => {
    last.current = index;
    ref.current?.scrollTo?.({y: index * ITEM, animated: false});
  }, [index, items.length]);

  const settle = e => {
    const y = e?.nativeEvent?.contentOffset?.y || 0;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(y / ITEM)));
    if (i !== last.current) {
      last.current = i;
      onIndex(i);
    }
  };

  return (
    <View style={{width, height: ITEM * VISIBLE}}>
      <View pointerEvents="none" style={[styles.band, {borderColor: accent}]} />
      <ScrollView
        ref={ref}
        testID={testID}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        nestedScrollEnabled
        contentOffset={{x: 0, y: index * ITEM}}
        contentContainerStyle={{paddingVertical: ITEM * ((VISIBLE - 1) / 2)}}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}>
        {items.map((it, i) => (
          <Pressable
            key={it.key}
            style={styles.item}
            onPress={() => {
              last.current = i;
              onIndex(i);
              ref.current?.scrollTo?.({y: i * ITEM, animated: true});
            }}
            testID={`${testID}-${it.key}`}>
            <Text style={[styles.itemText, i === index && {color: accent, fontWeight: '800', fontSize: 18}]}>{it.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function clamp(d, min, max) {
  if (min && d < min) return new Date(min);
  if (max && d > max) return new Date(max);
  return d;
}

export function DatePickerSheet({visible, title = 'Escolha a data', value, onConfirm, onCancel, onClear, mode = 'date', minDate, maxDate, accent = '#6D28D9', testID = 'data'}) {
  const now = new Date();
  const start = clamp(value || now, minDate, maxDate);
  const [draft, setDraft] = useState(start);

  useEffect(() => {
    if (visible) setDraft(clamp(value || new Date(), minDate, maxDate));
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const minYear = minDate ? minDate.getFullYear() : now.getFullYear() - 30;
  const maxYear = maxDate ? maxDate.getFullYear() : now.getFullYear() + 5;
  const years = useMemo(() => {
    const out = [];
    for (let y = maxYear; y >= minYear; y--) out.push({key: String(y), label: String(y), value: y});
    return out;
  }, [minYear, maxYear]);
  const months = useMemo(() => MONTHS_SHORT.map((m, i) => ({key: String(i + 1), label: m, value: i})), []);
  const nDays = daysInMonth(draft.getFullYear(), draft.getMonth());
  const days = useMemo(() => Array.from({length: nDays}, (_, i) => ({key: String(i + 1), label: pad(i + 1), value: i + 1})), [nDays]);
  const hours = useMemo(() => Array.from({length: 24}, (_, i) => ({key: String(i), label: pad(i), value: i})), []);
  const minutes = useMemo(() => Array.from({length: 12}, (_, i) => ({key: String(i * 5), label: pad(i * 5), value: i * 5})), []);

  const change = patch => {
    const y = patch.year ?? draft.getFullYear();
    const mo = patch.month ?? draft.getMonth();
    const d = Math.min(patch.day ?? draft.getDate(), daysInMonth(y, mo));
    const h = patch.hour ?? (mode === 'datetime' ? draft.getHours() : 12);
    const mi = patch.minute ?? (mode === 'datetime' ? draft.getMinutes() : 0);
    setDraft(new Date(y, mo, d, h, mi));
  };

  const shown = clamp(draft, minDate, maxDate);
  const outOfRange = shown.getTime() !== draft.getTime();
  const shortcut = (label, date) => {
    const ok = (!minDate || date >= new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) && (!maxDate || date <= maxDate);
    if (!ok) return null;
    const active = sameDay(draft, date);
    return (
      <Pressable
        key={label}
        onPress={() => change({year: date.getFullYear(), month: date.getMonth(), day: date.getDate()})}
        style={[styles.chip, active && {backgroundColor: accent, borderColor: accent}]}
        testID={`${testID}-atalho-${label}`}>
        <Text style={[styles.chipText, active && {color: '#FFFFFF'}]}>{label}</Text>
      </Pressable>
    );
  };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const yesterday = new Date(today.getTime() - 864e5);
  const tomorrow = new Date(today.getTime() + 864e5);
  const minuteIdx = Math.min(11, Math.round(draft.getMinutes() / 5));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.overlay} onPress={onCancel} testID={`${testID}-fundo`} />
      <View style={styles.sheet} testID={`${testID}-folha`}>
        <View style={styles.grip} />
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.preview, {color: accent}]} testID={`${testID}-previa`}>
          {formatLong(shown, true)}
          {mode === 'datetime' ? ` · ${pad(shown.getHours())}:${pad(shown.getMinutes())}` : ''}
        </Text>
        {outOfRange ? <Text style={styles.warn}>Ajustado para o limite permitido</Text> : null}

        <View style={styles.chips}>{[shortcut('Hoje', today), shortcut('Ontem', yesterday), shortcut('Amanhã', tomorrow)]}</View>

        <View style={styles.wheels}>
          <Wheel items={days} index={draft.getDate() - 1} onIndex={i => change({day: i + 1})} width={56} testID={`${testID}-dia`} accent={accent} />
          <Wheel items={months} index={draft.getMonth()} onIndex={i => change({month: i})} width={70} testID={`${testID}-mes`} accent={accent} />
          <Wheel
            items={years}
            index={Math.max(0, years.findIndex(y => y.value === draft.getFullYear()))}
            onIndex={i => change({year: years[i].value})}
            width={76}
            testID={`${testID}-ano`}
            accent={accent}
          />
          {mode === 'datetime' ? (
            <>
              <View style={{width: 10}} />
              <Wheel items={hours} index={draft.getHours()} onIndex={i => change({hour: i})} width={52} testID={`${testID}-hora`} accent={accent} />
              <Text style={styles.colon}>:</Text>
              <Wheel items={minutes} index={minuteIdx} onIndex={i => change({minute: i * 5})} width={52} testID={`${testID}-minuto`} accent={accent} />
            </>
          ) : null}
        </View>

        <View style={styles.buttons}>
          {onClear ? (
            <Pressable onPress={onClear} style={styles.btnGhost} testID={`${testID}-limpar`}>
              <Text style={styles.btnGhostText}>Limpar</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onCancel} style={styles.btnGhost} testID={`${testID}-cancelar`}>
            <Text style={styles.btnGhostText}>Cancelar</Text>
          </Pressable>
          <Pressable onPress={() => onConfirm(shown)} style={[styles.btn, {backgroundColor: accent}]} testID={`${testID}-confirmar`}>
            <Text style={styles.btnText}>Confirmar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Campo que abre o seletor. */
export default function DateField({
  label,
  value,
  onChange,
  mode = 'date',
  minDate,
  maxDate,
  placeholder = 'Toque para escolher',
  optional = false,
  accent = '#6D28D9',
  testID = 'data',
  style,
  labelStyle,
  fieldStyle,
  textStyle,
}) {
  const [open, setOpen] = useState(false);
  const text = value ? (mode === 'datetime' ? formatBRTime(value) : formatBR(value)) : '';
  return (
    <View style={style}>
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.field, fieldStyle]}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label || 'Data'}: ${text || 'não escolhida'}`}>
        <Ionicons name={mode === 'datetime' ? 'time-outline' : 'calendar-outline'} size={18} color={accent} />
        <Text style={[styles.fieldText, !text && styles.placeholder, textStyle]} numberOfLines={1}>
          {text || placeholder}
        </Text>
        {optional && value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={10} testID={`${testID}-apagar`} accessibilityLabel="Apagar data">
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </Pressable>
        ) : (
          <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
        )}
      </Pressable>
      <DatePickerSheet
        visible={open}
        title={label || 'Escolha a data'}
        value={value}
        mode={mode}
        minDate={minDate}
        maxDate={maxDate}
        accent={accent}
        testID={testID}
        onCancel={() => setOpen(false)}
        onClear={
          optional
            ? () => {
                setOpen(false);
                onChange(null);
              }
            : undefined
        }
        onConfirm={d => {
          setOpen(false);
          onChange(d);
        }}
      />
    </View>
  );
}

export {MONTHS_PT};

const styles = StyleSheet.create({
  label: {fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6},
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  fieldText: {flex: 1, fontSize: 15, color: '#1F2937', fontWeight: '600'},
  placeholder: {color: '#9CA3AF', fontWeight: '400'},
  overlay: {flex: 1, backgroundColor: 'rgba(15,23,42,0.45)'},
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 10,
  },
  grip: {alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 12},
  title: {fontSize: 13, color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5},
  preview: {fontSize: 18, fontWeight: '800', marginTop: 4},
  warn: {fontSize: 12, color: '#B45309', marginTop: 2},
  chips: {flexDirection: 'row', gap: 8, marginTop: 12},
  chip: {paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB'},
  chipText: {fontSize: 13, fontWeight: '700', color: '#374151'},
  wheels: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12},
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM * ((VISIBLE - 1) / 2),
    height: ITEM,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
  },
  item: {height: ITEM, alignItems: 'center', justifyContent: 'center'},
  itemText: {fontSize: 16, color: '#9CA3AF', fontWeight: '600'},
  colon: {fontSize: 18, fontWeight: '800', color: '#374151'},
  buttons: {flexDirection: 'row', gap: 10, marginTop: 16, justifyContent: 'flex-end'},
  btnGhost: {height: 48, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center'},
  btnGhostText: {fontSize: 15, fontWeight: '700', color: '#6B7280'},
  btn: {height: 48, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexGrow: 1},
  btnText: {fontSize: 15, fontWeight: '800', color: '#FFFFFF'},
});
