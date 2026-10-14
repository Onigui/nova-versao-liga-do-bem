/**
 * Meus orçamentos: pedidos abertos primeiro, com quantas propostas já chegaram.
 */
import React, {useCallback, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {STATUS_LABEL, memberApi, timeLeft} from '../utils/quotes';

const PURPLE = '#8B5CF6';

export default function QuotesListScreen({navigation, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const [quotes, setQuotes] = useState(null);
  const [error, setError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      api('GET', '/quotes')
        .then(d => alive && (setQuotes(d.quotes || []), setError('')))
        .catch(e => alive && (setQuotes([]), setError(e.message)));
      return () => {
        alive = false;
      };
    }, [api]),
  );

  if (!quotes) return <ActivityIndicator style={{marginTop: 40}} color={PURPLE} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={quotes}
        keyExtractor={q => q.id}
        contentContainerStyle={{padding: 16, paddingBottom: 100}}
        ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="flash-outline" size={56} color="#C4B5FD" />
            <Text style={styles.emptyTitle}>Orçamento em tempo real</Text>
            <Text style={styles.emptyText}>
              Monte uma lista (vacinas, consulta, remédios, ração…) e as lojas parceiras mandam propostas. Uma não vê o preço
              da outra, então cada uma manda o melhor que pode.
            </Text>
          </View>
        }
        renderItem={({item: q}) => {
          const st = STATUS_LABEL[q.status] || STATUS_LABEL.CLOSED;
          const open = q.status === 'OPEN';
          return (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('QuoteDetail', {id: q.id})} testID={`orcamento-${q.id}`}>
              <View style={{flex: 1}}>
                <Text style={styles.preview} numberOfLines={2}>
                  {q.preview}
                  {q.items > 3 ? ` +${q.items - 3}` : ''}
                </Text>
                <Text style={styles.meta}>
                  {open ? `${st.text} · ${timeLeft(q.expiresAt)}` : st.text}
                  {q.fromVet ? ' · lista do veterinário' : ''}
                </Text>
              </View>
              <View style={[styles.count, q.quotes ? {backgroundColor: '#DCFCE7'} : null]}>
                <Text style={[styles.countN, q.quotes ? {color: '#166534'} : null]}>{q.quotes}</Text>
                <Text style={styles.countL}>{q.quotes === 1 ? 'proposta' : 'propostas'}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('QuoteNew')} testID="novo-orcamento">
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.fabText}>Novo orçamento</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F9FAFB'},
  error: {color: '#B91C1C', marginBottom: 10},
  empty: {alignItems: 'center', paddingVertical: 50, paddingHorizontal: 24},
  emptyTitle: {fontSize: 18, fontWeight: '800', color: '#1F2937', marginTop: 12},
  emptyText: {fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20},
  card: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10},
  preview: {fontSize: 15, fontWeight: '700', color: '#1F2937'},
  meta: {fontSize: 12, color: '#6B7280', marginTop: 4},
  count: {alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, minWidth: 74},
  countN: {fontSize: 20, fontWeight: '900', color: '#4B5563'},
  countL: {fontSize: 10, color: '#6B7280'},
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PURPLE,
    borderRadius: 28,
    paddingHorizontal: 20,
    height: 52,
    elevation: 4,
  },
  fabText: {color: '#FFFFFF', fontSize: 15, fontWeight: '800'},
});
