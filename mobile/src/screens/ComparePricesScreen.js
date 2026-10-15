/**
 * Comparar preços: busca no catálogo padrão da Liga (o mesmo item em todas as lojas)
 * e mostra a partir de quanto sai e em quantos parceiros.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {API_BASE_PATH} from '../config/apiConfig';
import {PRICE_CATEGORIES, brl} from '../utils/priceCompare';
import {F} from '../theme/home';

const SPECIES = [
  {id: null, label: 'Todos'},
  {id: 'DOG', label: 'Cães'},
  {id: 'CAT', label: 'Gatos'},
];

export default function ComparePricesScreen({navigation, route, fetchImpl = fetch}) {
  const [search, setSearch] = useState(route?.params?.search || '');
  const [category, setCategory] = useState(route?.params?.category || null);
  const [species, setSpecies] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const debounce = useRef(null);

  const load = useCallback(
    async (opts = {}) => {
      const s = opts.search ?? search;
      const c = opts.category !== undefined ? opts.category : category;
      const sp = opts.species !== undefined ? opts.species : species;
      const qs = ['offered=1', c ? `category=${c}` : null, sp ? `species=${sp}` : null, s.trim() ? `search=${encodeURIComponent(s.trim())}` : null]
        .filter(Boolean)
        .join('&');
      try {
        const r = await fetchImpl(`${API_BASE_PATH}/catalog?${qs}`);
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Erro ao carregar');
        setItems(data.items || []);
        setError('');
      } catch (e) {
        setError('Não foi possível carregar os preços. Verifique a internet.');
        setItems([]);
      }
    },
    [fetchImpl, search, category, species],
  );

  useEffect(() => {
    load();
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = t => {
    setSearch(t);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load({search: t}), 350);
  };

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Castração, consulta, V10, Bravecto…"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={onSearch}
            testID="busca-precos"
          />
          {search ? (
            <TouchableOpacity onPress={() => onSearch('')} accessibilityLabel="Limpar busca">
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {SPECIES.map(sp => (
            <TouchableOpacity
              key={String(sp.id)}
              style={[styles.chip, species === sp.id && styles.chipActive]}
              onPress={() => {
                setSpecies(sp.id);
                load({species: sp.id});
              }}
              testID={`especie-${sp.id || 'todos'}`}>
              <Text style={[styles.chipText, species === sp.id && styles.chipTextActive]}>{sp.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.divider} />
          {PRICE_CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, category === c.id && styles.chipActive]}
              onPress={() => {
                const next = category === c.id ? null : c.id;
                setCategory(next);
                load({category: next});
              }}
              testID={`categoria-${c.id}`}>
              <Ionicons name={c.icon} size={14} color={category === c.id ? '#FFFFFF' : '#6B7280'} />
              <Text style={[styles.chipText, category === c.id && styles.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {items == null ? (
        <ActivityIndicator style={{marginTop: 40}} color="#6D28D9" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{padding: 16, paddingBottom: 32}}
          ListHeaderComponent={
            <View>
              <TouchableOpacity style={styles.quoteBanner} onPress={() => navigation.navigate('QuotesList')} testID="orcamento-tempo-real">
                <Ionicons name="flash" size={22} color="#FFFFFF" />
                <View style={{flex: 1}}>
                  <Text style={styles.quoteTitle}>Orçamento em tempo real</Text>
                  <Text style={styles.quoteText}>Monte sua lista e receba propostas das lojas, às cegas</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.hint}>
                {error || 'Preços informados pelos parceiros. O preço de membro vale mostrando a carteirinha.'}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="pricetags-outline" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Nenhum preço encontrado</Text>
              <Text style={styles.emptyText}>Os parceiros estão cadastrando os preços aos poucos. Tente outra busca.</Text>
            </View>
          }
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('PriceOffers', {item})}
              testID={`item-${item.id}`}>
              <View style={{flex: 1}}>
                <Text style={styles.itemName}>{item.label}</Text>
                <Text style={styles.itemMeta}>
                  {item.categoryLabel} · {item.offers} {item.offers === 1 ? 'parceiro' : 'parceiros'}
                </Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.from}>a partir de</Text>
                <Text style={styles.price}>{brl(item.minMemberPrice)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F6F5FB'},
  top: {backgroundColor: '#FFFFFF', paddingTop: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB'},
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
  },
  searchInput: {
    ...F.regular, flex: 1, fontSize: 15, color: '#1F2937', paddingVertical: 12},
  chips: {paddingHorizontal: 16, paddingVertical: 10, gap: 6, alignItems: 'center'},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {backgroundColor: '#6D28D9', borderColor: '#6D28D9'},
  chipText: {fontSize: 13, ...F.semibold, color: '#4B5563'},
  chipTextActive: {color: '#FFFFFF'},
  divider: {width: 1, height: 20, backgroundColor: '#E5E7EB', marginHorizontal: 4},
  hint: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginBottom: 10},
  quoteBanner: {flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#7C3AED', borderRadius: 14, padding: 14, marginBottom: 12},
  quoteTitle: {color: '#FFFFFF', fontSize: 15, ...F.heavy, },
  quoteText: {
    ...F.regular, color: '#EDE9FE', fontSize: 12, marginTop: 2},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  itemName: {fontSize: 15, ...F.bold, color: '#1F2937'},
  itemMeta: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginTop: 2},
  from: {
    ...F.regular, fontSize: 11, color: '#6B7280'},
  price: {fontSize: 17, ...F.heavy, color: '#6D28D9'},
  empty: {alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24},
  emptyTitle: {fontSize: 17, ...F.bold, color: '#1F2937', marginTop: 12},
  emptyText: {
    ...F.regular, fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 6},
});
