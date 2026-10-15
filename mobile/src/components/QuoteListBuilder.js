/**
 * Monta a lista do orçamento: busca no catálogo padrão da Liga (o mesmo item em todas as lojas)
 * ou item escrito à mão com categoria; quantidade em cada um.
 * Usado pelo membro (Novo orçamento) e pelo veterinário parceiro (lista no atendimento).
 */
import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {API_BASE_PATH} from '../config/apiConfig';
import {PRICE_CATEGORIES} from '../utils/priceCompare';
import {MAX_ITEMS} from '../utils/quotes';
import {F} from '../theme/home';

let keySeq = 0;
const nextKey = () => `k${++keySeq}`;

export default function QuoteListBuilder({value, onChange, color = '#6D28D9', species = null, fetchImpl = fetch}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounce = useRef(null);
  const list = value || [];
  const full = list.length >= MAX_ITEMS;

  useEffect(() => () => clearTimeout(debounce.current), []);

  const runSearch = async text => {
    const q = text.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const qs = [`search=${encodeURIComponent(q)}`, species ? `species=${species}` : null].filter(Boolean).join('&');
      const r = await fetchImpl(`${API_BASE_PATH}/catalog?${qs}`);
      const d = await r.json();
      setResults((d.items || []).slice(0, 8));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const onSearch = t => {
    setSearch(t);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(t), 300);
  };

  const add = entry => {
    if (full) return;
    if (entry.itemId && list.some(i => i.itemId === entry.itemId)) {
      onChange(list.map(i => (i.itemId === entry.itemId ? {...i, quantity: Math.min(99, i.quantity + 1)} : i)));
    } else {
      onChange([...list, {key: nextKey(), quantity: 1, ...entry}]);
    }
    setSearch('');
    setResults(null);
  };

  const setQty = (key, delta) =>
    onChange(
      list
        .map(i => (i.key === key ? {...i, quantity: i.quantity + delta} : i))
        .filter(i => i.quantity > 0),
    );

  const typed = search.trim();

  return (
    <View>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder={full ? `Máximo de ${MAX_ITEMS} itens` : 'Adicionar: V10, consulta, Bravecto…'}
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={onSearch}
          editable={!full}
          testID="busca-item"
        />
        {loading ? <ActivityIndicator size="small" color={color} /> : null}
      </View>

      {results ? (
        <View style={styles.results}>
          {results.map(it => (
            <Pressable key={it.id} style={styles.result} onPress={() => add({itemId: it.id, label: it.label, category: it.category})} testID={`add-${it.id}`}>
              <Ionicons name="add-circle" size={20} color={color} />
              <View style={{flex: 1}}>
                <Text style={styles.resultName}>{it.label}</Text>
                <Text style={styles.resultMeta}>{it.categoryLabel}</Text>
              </View>
            </Pressable>
          ))}
          {typed.length >= 3 ? (
            <View style={styles.free}>
              <Text style={styles.freeTitle}>
                {results.length ? 'Não é nenhum desses?' : 'Não está no catálogo.'} Adicionar "{typed}" — qual o tipo?
              </Text>
              <View style={styles.chips}>
                {PRICE_CATEGORIES.map(c => (
                  <Pressable
                    key={c.id}
                    style={styles.chip}
                    onPress={() => add({itemId: null, label: typed.slice(0, 80), category: c.id})}
                    testID={`livre-${c.id}`}>
                    <Ionicons name={c.icon} size={13} color="#6B7280" />
                    <Text style={styles.chipText}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {list.length ? (
        list.map(i => (
          <View key={i.key} style={styles.row} testID={`linha-${i.itemId || i.label}`}>
            <View style={{flex: 1}}>
              <Text style={styles.rowName}>{i.label}</Text>
              <Text style={styles.resultMeta}>
                {PRICE_CATEGORIES.find(c => c.id === i.category)?.label || ''}
                {i.itemId ? '' : ' · escrito por você'}
              </Text>
            </View>
            <Pressable style={styles.qtyBtn} onPress={() => setQty(i.key, -1)} accessibilityLabel="Diminuir" testID={`menos-${i.key}`}>
              <Ionicons name={i.quantity === 1 ? 'trash-outline' : 'remove'} size={18} color="#4B5563" />
            </Pressable>
            <Text style={styles.qty}>{i.quantity}</Text>
            <Pressable style={styles.qtyBtn} onPress={() => setQty(i.key, +1)} accessibilityLabel="Aumentar" testID={`mais-${i.key}`}>
              <Ionicons name="add" size={18} color="#4B5563" />
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.empty}>Busque e adicione os itens: serviços, vacinas, remédios, ração…</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
  },
  searchInput: {
    ...F.regular, flex: 1, fontSize: 15, color: '#1F2937', paddingVertical: 12},
  results: {backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginTop: 6, overflow: 'hidden'},
  result: {flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'},
  resultName: {fontSize: 14, ...F.semibold, color: '#1F2937'},
  resultMeta: {
    ...F.regular, fontSize: 12, color: '#6B7280'},
  free: {padding: 12, backgroundColor: '#F9FAFB'},
  freeTitle: {
    ...F.regular, fontSize: 13, color: '#374151', marginBottom: 8},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipText: {fontSize: 12, ...F.semibold, color: '#4B5563'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  rowName: {fontSize: 15, ...F.bold, color: '#1F2937'},
  qtyBtn: {width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center'},
  qty: {minWidth: 22, textAlign: 'center', fontSize: 16, ...F.heavy, color: '#1F2937'},
  empty: {
    ...F.regular, fontSize: 13, color: '#6B7280', marginTop: 12, textAlign: 'center'},
});
