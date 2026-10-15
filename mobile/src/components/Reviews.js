/**
 * Avaliações: estrelas (mostrar e escolher), resumo com distribuição e cartão de avaliação.
 * Usado no app dos membros e no App Parceiros.
 */
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {RATING_WORDS, relativeDay} from '../utils/health';
import {F} from '../theme/home';

const GOLD = '#F59E0B';

export function Stars({rating = 0, size = 14, onChange, testIDPrefix}) {
  return (
    <View style={{flexDirection: 'row', gap: onChange ? 8 : 1}}>
      {[1, 2, 3, 4, 5].map(i => {
        const name = rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half' : 'star-outline';
        const icon = <Ionicons name={name} size={size} color={GOLD} />;
        return onChange ? (
          <Pressable key={i} onPress={() => onChange(i)} hitSlop={6} accessibilityLabel={`${i} estrela${i > 1 ? 's' : ''}`} testID={`${testIDPrefix || 'estrela'}-${i}`}>
            {icon}
          </Pressable>
        ) : (
          <View key={i}>{icon}</View>
        );
      })}
    </View>
  );
}

export function RatingSummary({summary}) {
  if (!summary?.count) {
    return <Text style={styles.none}>Ainda sem avaliações. Só quem usou a carteirinha ou foi atendido pode avaliar.</Text>;
  }
  const max = Math.max(...Object.values(summary.distribution));
  return (
    <View>
      <View style={styles.sumRow}>
        <View style={{alignItems: 'center', width: 96}}>
          <Text style={styles.big}>{String(summary.rating.toFixed(1)).replace('.', ',')}</Text>
          <Stars rating={summary.rating} size={14} />
          <Text style={styles.count}>
            {summary.count} {summary.count === 1 ? 'avaliação' : 'avaliações'}
          </Text>
        </View>
        <View style={{flex: 1, gap: 3}}>
          {[5, 4, 3, 2, 1].map(n => (
            <View key={n} style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Text style={styles.distN}>{n}</Text>
              <View style={styles.barBg}>
                <View style={[styles.bar, {width: `${max ? (summary.distribution[n] / max) * 100 : 0}%`}]} />
              </View>
            </View>
          ))}
        </View>
      </View>
      {summary.tags?.length ? (
        <View style={styles.tags}>
          {summary.tags.slice(0, 4).map(t => (
            <View key={t.id} style={styles.tag}>
              <Text style={styles.tagText}>
                {t.label} · {t.count}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function ReviewCard({review, tagLabels = {}, partnerName, footer}) {
  return (
    <View style={styles.card} testID={`avaliacao-${review.id}`}>
      <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
        <Text style={styles.author}>{review.author}</Text>
        <Text style={styles.when}>
          {relativeDay(review.createdAt)}
          {review.edited ? ' · editada' : ''}
        </Text>
      </View>
      <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2}}>
        <Stars rating={review.rating} size={13} />
        <Text style={styles.word}>{RATING_WORDS[review.rating]}</Text>
      </View>
      {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
      {review.tags?.length ? (
        <View style={styles.tags}>
          {review.tags.map(t => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{tagLabels[t] || t}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {review.reply ? (
        <View style={styles.reply}>
          <Text style={styles.replyTitle}>Resposta {partnerName ? `de ${partnerName}` : 'da empresa'}</Text>
          <Text style={styles.replyText}>{review.reply.text}</Text>
        </View>
      ) : null}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  none: {
    ...F.regular, fontSize: 13, color: '#6B7280'},
  sumRow: {flexDirection: 'row', alignItems: 'center', gap: 14},
  big: {fontSize: 34, ...F.heavy, color: '#1F2937'},
  count: {
    ...F.regular, fontSize: 11, color: '#6B7280', marginTop: 2},
  distN: {
    ...F.regular, width: 10, fontSize: 11, color: '#6B7280'},
  barBg: {flex: 1, height: 7, borderRadius: 4, backgroundColor: '#F3F4F6', overflow: 'hidden'},
  bar: {height: 7, borderRadius: 4, backgroundColor: GOLD},
  tags: {flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8},
  tag: {backgroundColor: '#FEF3C7', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3},
  tagText: {fontSize: 11, color: '#92400E', ...F.semibold, },
  card: {backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#F3F4F6'},
  author: {fontSize: 14, ...F.bold, color: '#1F2937'},
  when: {
    ...F.regular, fontSize: 11, color: '#9CA3AF'},
  word: {
    ...F.regular, fontSize: 12, color: '#6B7280'},
  comment: {
    ...F.regular, fontSize: 14, color: '#374151', marginTop: 6, lineHeight: 20},
  reply: {backgroundColor: '#F9FAFB', borderLeftWidth: 3, borderLeftColor: '#D1D5DB', borderRadius: 6, padding: 8, marginTop: 8},
  replyTitle: {fontSize: 12, ...F.bold, color: '#4B5563'},
  replyText: {
    ...F.regular, fontSize: 13, color: '#374151', marginTop: 2},
});
