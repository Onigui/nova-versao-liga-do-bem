/**
 * Card de uma vaquinha: capa, título, barra de progresso e "R$ X de R$ Y".
 * Usado na lista de vaquinhas, no Início e na página do animal.
 */
import React from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {C, F} from '../theme/home';

/** "R$ 3.500,00" (com separador de milhar; sem depender do Intl do aparelho). */
export function brl(v) {
  const [int, dec] = Number(v || 0).toFixed(2).split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

export function ProgressBar({percent, height = 8}) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <View style={[styles.bar, {height}]} accessibilityRole="progressbar" accessibilityValue={{min: 0, max: 100, now: p}}>
      <View style={[styles.barFill, {width: `${p}%`}]} />
    </View>
  );
}

export function campaignStatusText(c) {
  if (c.status === 'ENDED') return c.closedReason === 'GOAL' ? 'Meta alcançada 🎉' : 'Encerrada';
  if (c.daysLeft === 0) return 'Último dia';
  if (c.daysLeft != null) return `${c.daysLeft} ${c.daysLeft === 1 ? 'dia restante' : 'dias restantes'}`;
  return 'Aberta';
}

export default function CampaignCard({campaign: c, onPress, compact = false, testID}) {
  return (
    <Pressable style={[styles.card, compact && styles.compact]} onPress={onPress} testID={testID || `vaquinha-${c.id}`}>
      {c.coverUrl ? (
        <Image source={{uri: c.coverUrl}} style={[styles.cover, compact && {height: 110}]} resizeMode="cover" />
      ) : (
        <View style={[styles.cover, styles.coverEmpty, compact && {height: 110}]}>
          <Ionicons name="heart" size={36} color={C.primary} />
        </View>
      )}
      <View style={styles.body}>
        <Text style={[styles.title, F.heavy]} numberOfLines={2}>
          {c.title}
        </Text>
        {!compact && c.summary ? (
          <Text style={[styles.summary, F.regular]} numberOfLines={2}>
            {c.summary}
          </Text>
        ) : null}
        <ProgressBar percent={c.percent} />
        <View style={styles.row}>
          <Text style={[styles.raised, F.heavy]}>{brl(c.raised)}</Text>
          <Text style={[styles.meta, F.regular]}> de {brl(c.goal)}</Text>
        </View>
        <Text style={[styles.meta, F.semibold]}>
          {c.percent}% · {campaignStatusText(c)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {backgroundColor: C.card, borderRadius: 16, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: C.line},
  compact: {width: 240, marginRight: 12, marginBottom: 0},
  cover: {width: '100%', height: 160, backgroundColor: C.primarySoft},
  coverEmpty: {alignItems: 'center', justifyContent: 'center'},
  body: {padding: 14, gap: 6},
  title: {fontSize: 16, color: C.ink},
  summary: {fontSize: 13, color: C.muted},
  bar: {backgroundColor: C.line, borderRadius: 999, overflow: 'hidden', marginTop: 4},
  barFill: {height: '100%', backgroundColor: C.primary, borderRadius: 999},
  row: {flexDirection: 'row', alignItems: 'baseline'},
  raised: {fontSize: 16, color: C.ink},
  meta: {fontSize: 12, color: C.muted},
});
