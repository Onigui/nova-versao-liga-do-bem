/**
 * Tabela de preços da empresa: o parceiro escolhe os itens do catálogo padrão da Liga
 * (mesmo nome em todas as lojas, para o membro comparar) e informa o preço para membros.
 */
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, formatMoney, usePartner} from '../PartnerContext';
import {Button, Card, Empty, styles as ui} from '../ui';

function Chip({label, active, onPress, testID}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? COLORS.primary : COLORS.border,
        backgroundColor: active ? COLORS.primary : '#FFFFFF',
      }}>
      <Text style={{fontSize: 13, fontWeight: '600', color: active ? '#FFFFFF' : '#334155'}}>{label}</Text>
    </Pressable>
  );
}

export default function PriceTableScreen({navigation}) {
  const {api} = usePartner();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [mine, setMine] = useState(true);
  const [category, setCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const debounce = useRef(null);

  const load = useCallback(
    async (opts = {}) => {
      const m = opts.mine ?? mine;
      const c = opts.category !== undefined ? opts.category : category;
      const s = opts.search ?? search;
      const qs = [m ? 'mine=1' : null, c ? `category=${c}` : null, s.trim() ? `search=${encodeURIComponent(s.trim())}` : null]
        .filter(Boolean)
        .join('&');
      try {
        const r = await api('GET', `/partner/catalog${qs ? `?${qs}` : ''}`);
        setData(r);
        setError('');
        // Primeira vez sem nenhum preço: já mostra o catálogo inteiro
        if (m && !r.priced && !c && !s.trim()) {
          setMine(false);
          const all = await api('GET', '/partner/catalog');
          setData(all);
        }
      } catch (e) {
        setError(e.message);
      }
    },
    [api, mine, category, search],
  );

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useEffect(() => () => clearTimeout(debounce.current), []);

  const onSearch = t => {
    setSearch(t);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => load({search: t, mine: t.trim() ? false : mine}), 350);
  };

  const canEdit = data?.canEdit !== false;
  const open = item =>
    canEdit && navigation.navigate('PriceEdit', {item});

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      data={data?.items || []}
      keyExtractor={i => i.id}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        <View>
          <Card style={{backgroundColor: COLORS.primarySoft, borderColor: '#99F6E4'}}>
            <Text style={{fontWeight: '800', color: COLORS.primaryDark, fontSize: 16}}>
              {data ? `${data.priced} item(ns) com preço` : 'Tabela de preços'}
            </Text>
            <Text style={{color: COLORS.primaryDark, marginTop: 4}}>
              Os membros comparam o mesmo serviço ou produto entre os parceiros. Preço claro e atualizado traz cliente.
            </Text>
          </Card>
          <View style={[ui.row, {gap: 8, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12, marginBottom: 10}]}>
            <Icon name="search" size={18} color={COLORS.muted} />
            <TextInput
              value={search}
              onChangeText={onSearch}
              placeholder="Buscar: castração, V10, Bravecto…"
              placeholderTextColor="#94A3B8"
              style={{flex: 1, paddingVertical: 11, fontSize: 15, color: COLORS.text}}
              testID="busca-preco"
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingBottom: 12}}>
            <Chip
              label="Meus preços"
              active={mine && !search.trim()}
              onPress={() => {
                setMine(true);
                setCategory(null);
                setSearch('');
                load({mine: true, category: null, search: ''});
              }}
              testID="filtro-meus"
            />
            <Chip
              label="Todo o catálogo"
              active={!mine && !category}
              onPress={() => {
                setMine(false);
                setCategory(null);
                load({mine: false, category: null});
              }}
              testID="filtro-todos"
            />
            {(data?.categories || []).map(c => (
              <Chip
                key={c.id}
                label={c.label}
                active={category === c.id}
                onPress={() => {
                  setMine(false);
                  setCategory(c.id);
                  load({mine: false, category: c.id});
                }}
                testID={`cat-${c.id}`}
              />
            ))}
          </ScrollView>
          {error ? <Text style={[ui.error, {marginBottom: 10}]}>{error}</Text> : null}
          {!canEdit ? (
            <Text style={[ui.muted, {marginBottom: 10}]}>Só o responsável pela empresa altera os preços.</Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={data ? <Empty text={search ? 'Nada encontrado no catálogo.' : 'Nenhum item aqui ainda.'} /> : null}
      renderItem={({item}) => (
        <Pressable onPress={() => open(item)} disabled={!canEdit} testID={`item-${item.id}`}>
          <Card style={{paddingVertical: 12}}>
            <View style={[ui.row, {gap: 10}]}>
              <View style={{flex: 1}}>
                <Text style={{fontWeight: '700', color: COLORS.text}}>{item.label}</Text>
                <Text style={[ui.muted, {fontSize: 12}]}>
                  {item.categoryLabel}
                  {item.custom ? ' · item próprio' : ''}
                </Text>
              </View>
              {item.myPrice ? (
                <View style={{alignItems: 'flex-end'}}>
                  {item.myPrice.price ? (
                    <Text style={{color: COLORS.muted, fontSize: 12, textDecorationLine: 'line-through'}}>
                      {formatMoney(item.myPrice.price)}
                    </Text>
                  ) : null}
                  <Text style={{fontWeight: '900', color: item.myPrice.available ? COLORS.primary : COLORS.muted, fontSize: 16}}>
                    {formatMoney(item.myPrice.memberPrice)}
                  </Text>
                  {!item.myPrice.available ? <Text style={{fontSize: 11, color: COLORS.warn}}>indisponível</Text> : null}
                </View>
              ) : canEdit ? (
                <Text style={{color: COLORS.primary, fontWeight: '700'}}>+ Preço</Text>
              ) : null}
            </View>
          </Card>
        </Pressable>
      )}
      ListFooterComponent={
        canEdit ? (
          <Button
            title="Meu item não está na lista"
            variant="ghost"
            icon={<Icon name="add-circle-outline" size={20} color={COLORS.primary} />}
            onPress={() => navigation.navigate('PriceEdit', {newItem: true, presetName: search.trim()})}
            testID="item-novo"
          />
        ) : null
      }
    />
  );
}
