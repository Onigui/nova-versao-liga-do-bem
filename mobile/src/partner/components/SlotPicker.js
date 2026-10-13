/**
 * Escolha do dia e horário da notificação paga. Cada horário recebe só uma empresa:
 * os ocupados aparecem riscados, então ninguém dispara junto com outra loja.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {COLORS, usePartner} from '../PartnerContext';

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "qui, 16/10 às 18:00" (horário de Brasília) */
export function formatSlot(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() - 3 * 3600e3);
  const p = n => String(n).padStart(2, '0');
  return `${WEEKDAY[d.getUTCDay()]}, ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} às ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export default function SlotPicker({value, onChange, campaignId, refreshKey}) {
  const {api} = usePartner();
  const [days, setDays] = useState(null);
  const [day, setDay] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const qs = campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : '';
      const r = await api('GET', `/partner/push-campaigns/slots${qs}`);
      const list = r?.days || [];
      setDays(list);
      setError('');
      setDay(cur => {
        if (cur && list.some(d => d.date === cur)) return cur;
        const withFree = list.find(d => d.slots.some(s => s.available));
        return withFree?.date || list[0]?.date || null;
      });
      // O horário escolhido foi ocupado enquanto a tela estava aberta
      if (value && !list.some(d => d.slots.some(s => s.at === value && s.available))) onChange(null);
    } catch (e) {
      setError(e.message);
    }
  }, [api, campaignId, value, onChange]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, refreshKey]);

  if (error) return <Text style={{color: COLORS.bad, marginBottom: 10}}>{error}</Text>;
  if (!days) return <ActivityIndicator color={COLORS.primary} style={{marginVertical: 12}} />;
  if (!days.length) return <Text style={styles.muted}>Nenhum horário disponível nas próximas 2 semanas.</Text>;

  const current = days.find(d => d.date === day) || days[0];
  return (
    <View testID="horarios">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingBottom: 10}}>
        {days.map(d => {
          const free = d.slots.filter(s => s.available).length;
          const active = d.date === current.date;
          return (
            <Pressable
              key={d.date}
              testID={`dia-${d.date}`}
              onPress={() => setDay(d.date)}
              style={[styles.day, active && styles.dayActive, !free && styles.dayFull]}>
              <Text style={[styles.dayLabel, active && {color: '#FFFFFF'}]}>{d.label}</Text>
              <Text style={[styles.dayFree, active && {color: '#CCFBF1'}]}>
                {free ? `${free} livre${free > 1 ? 's' : ''}` : 'lotado'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.grid}>
        {current.slots.map(s => {
          const active = s.at === value;
          return (
            <Pressable
              key={s.at}
              testID={`slot-${s.time}`}
              disabled={!s.available}
              onPress={() => onChange(s.at)}
              accessibilityState={{disabled: !s.available, selected: active}}
              style={[styles.slot, active && styles.slotActive, !s.available && styles.slotTaken]}>
              <Text
                style={[
                  styles.slotTime,
                  active && {color: '#FFFFFF'},
                  !s.available && {color: '#94A3B8', textDecorationLine: 'line-through'},
                ]}>
                {s.time}
              </Text>
              <Text style={[styles.slotNote, active && {color: '#CCFBF1'}]}>
                {s.available ? (active ? 'escolhido' : 'livre') : 'ocupado'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.muted}>
        Um horário por empresa: assim os membros não recebem várias notificações ao mesmo tempo.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    minWidth: 92,
  },
  dayActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  dayFull: {opacity: 0.55},
  dayLabel: {fontWeight: '800', color: COLORS.text, fontSize: 13},
  dayFree: {fontSize: 11, color: COLORS.muted, marginTop: 2},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8},
  slot: {
    width: '31%',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  slotActive: {backgroundColor: COLORS.primary, borderColor: COLORS.primary},
  slotTaken: {backgroundColor: '#F1F5F9'},
  slotTime: {fontSize: 16, fontWeight: '800', color: COLORS.text},
  slotNote: {fontSize: 11, color: COLORS.muted, marginTop: 2},
  muted: {color: COLORS.muted, fontSize: 12, marginBottom: 10},
});
