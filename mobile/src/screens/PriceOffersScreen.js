/**
 * Um item do catálogo em todos os parceiros: menor preço ou mais perto, com distância,
 * "aberto agora" e quando o preço foi atualizado.
 */
import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {API_BASE_PATH} from '../config/apiConfig';
import useUserLocation from '../services/useUserLocation';
import {useAuth} from '../services/AuthService';
import {formatDistance} from '../utils/geo';
import {brl, sortOffers, spread, updatedLabel} from '../utils/priceCompare';
import {toMemberPartner} from '../utils/partnerView';
import {F} from '../theme/home';

function useAuthSafe() {
  try {
    return useAuth();
  } catch {
    return {};
  }
}

export default function PriceOffersScreen({navigation, route, fetchImpl = fetch}) {
  const item = route?.params?.item;
  const {user} = useAuthSafe();
  const location = useUserLocation({autoStart: user?.locationEnabled !== false});
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [by, setBy] = useState('price');

  useEffect(() => {
    navigation?.setOptions?.({title: item?.label || 'Preços'});
    (async () => {
      try {
        const r = await fetchImpl(`${API_BASE_PATH}/catalog/items/${item.id}/offers`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Erro');
        setData(d);
      } catch (e) {
        setError('Não foi possível carregar os preços.');
      }
    })();
  }, [fetchImpl, item?.id, item?.label, navigation]);

  const hasLocation = location.status === 'ok' && !!location.coords;
  const offers = useMemo(
    () => sortOffers(data?.offers, {by, location: hasLocation ? location.coords : null}),
    [data, by, hasLocation, location.coords],
  );
  const diff = spread(data?.offers);

  if (!data && !error) return <ActivityIndicator style={{marginTop: 40}} color="#6D28D9" />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{padding: 16, paddingBottom: 32}}
      data={offers}
      keyExtractor={o => o.partner.id}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>{item?.label}</Text>
          <Text style={styles.subtitle}>
            {data ? `${data.offers.length} ${data.offers.length === 1 ? 'parceiro' : 'parceiros'}` : ''}
            {diff ? ` · diferença de até ${brl(diff)} entre eles` : ''}
          </Text>
          <View style={styles.sortRow}>
            {[
              ['price', 'Menor preço', 'trending-down'],
              ['distance', 'Mais perto', 'navigate'],
            ].map(([id, label, icon]) => (
              <TouchableOpacity
                key={id}
                style={[styles.sortBtn, by === id && styles.sortBtnActive]}
                onPress={() => {
                  setBy(id);
                  if (id === 'distance' && !hasLocation) location.request();
                }}
                testID={`ordenar-${id}`}>
                <Ionicons name={icon} size={16} color={by === id ? '#FFFFFF' : '#4B5563'} />
                <Text style={[styles.sortText, by === id && {color: '#FFFFFF'}]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      }
      renderItem={({item: o}) => (
        <TouchableOpacity
          style={[styles.card, !o.available && {opacity: 0.55}]}
          onPress={() => navigation.navigate('PartnerDetail', {partner: toMemberPartner(o.partner)})}
          testID={`oferta-${o.partner.id}`}>
          <View style={styles.logo}>
            {o.partner.logo ? (
              <Image source={{uri: o.partner.logo}} style={{width: '100%', height: '100%'}} />
            ) : (
              <Text style={styles.logoText}>{(o.partner.name || '?').charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <View style={{flex: 1}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Text style={styles.partner} numberOfLines={1}>
                {o.partner.name}
              </Text>
              {o.cheapest ? (
                <View style={styles.best}>
                  <Text style={styles.bestText}>MENOR PREÇO</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {[formatDistance(o.distanceKm), o.openLabel, !o.available ? 'indisponível no momento' : null].filter(Boolean).join(' · ') ||
                o.partner.address}
            </Text>
            {o.note ? <Text style={styles.note}>{o.note}</Text> : null}
            <Text style={styles.updated}>{updatedLabel(o.updatedAt)}</Text>
          </View>
          <View style={{alignItems: 'flex-end'}}>
            {o.price ? <Text style={styles.old}>{brl(o.price)}</Text> : null}
            <Text style={styles.price}>{brl(o.memberPrice)}</Text>
            <Text style={styles.memberLabel}>{o.savings ? `membro · -${o.savings}%` : 'membro'}</Text>
          </View>
        </TouchableOpacity>
      )}
      ListFooterComponent={
        <View>
          <TouchableOpacity
            style={styles.quoteBtn}
            onPress={() => navigation.navigate('QuoteNew', {item: {id: item?.id, label: item?.label, category: data?.item?.category || item?.category}})}
            testID="pedir-orcamento">
            <Ionicons name="flash" size={18} color="#7C3AED" />
            <Text style={styles.quoteBtnText}>Pedir orçamento: as lojas mandam propostas</Text>
          </TouchableOpacity>
          <Text style={styles.footer}>
            O preço de membro vale mostrando a carteirinha da Liga no caixa. Confirme a disponibilidade com o parceiro.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F6F5FB'},
  title: {fontSize: 20, ...F.heavy, color: '#1F2937'},
  subtitle: {
    ...F.regular, fontSize: 13, color: '#6B7280', marginTop: 4},
  sortRow: {flexDirection: 'row', gap: 8, marginVertical: 14},
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sortBtnActive: {backgroundColor: '#6D28D9', borderColor: '#6D28D9'},
  sortText: {fontSize: 14, ...F.semibold, color: '#4B5563'},
  error: {color: '#B91C1C', marginBottom: 10},
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoText: {fontSize: 18, ...F.heavy, color: '#7C3AED'},
  partner: {fontSize: 15, ...F.bold, color: '#1F2937', flexShrink: 1},
  best: {backgroundColor: '#DCFCE7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2},
  bestText: {fontSize: 9, ...F.heavy, color: '#166534'},
  meta: {
    ...F.regular, fontSize: 12, color: '#6B7280', marginTop: 2},
  note: {
    ...F.regular, fontSize: 12, color: '#4B5563', marginTop: 2},
  updated: {
    ...F.regular, fontSize: 11, color: '#9CA3AF', marginTop: 2},
  old: {
    ...F.regular, fontSize: 12, color: '#9CA3AF', textDecorationLine: 'line-through'},
  price: {fontSize: 18, ...F.heavy, color: '#6D28D9'},
  memberLabel: {
    ...F.regular, fontSize: 11, color: '#6B7280'},
  footer: {
    ...F.regular, fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 10},
  quoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    height: 48,
    marginTop: 6,
  },
  quoteBtnText: {color: '#6D28D9', ...F.bold, fontSize: 14},
});
