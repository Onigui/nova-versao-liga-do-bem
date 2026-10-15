/**
 * Uma promoção como o membro vê na página da empresa. Cada tipo tem o seu destaque:
 *   % ou R$ de desconto → "20%" / "R$ 10" + "de desconto"
 *   Preço promocional   → "De R$ 89,90" riscado + "R$ 69,90" + "preço final para membros"
 *   Outro benefício     → o texto ("Leve 3, pague 2")
 */
import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {describePromo} from '../utils/promo';
import {F} from '../theme/home';

const ICON = {
  PERCENT: 'pricetag',
  AMOUNT_OFF: 'remove-circle',
  FINAL_PRICE: 'cash',
  OTHER: 'gift',
};

export default function PromoCard({discount: d, accent = '#7C3AED', soft = '#F5F3FF'}) {
  const p = describePromo(d);
  const until = d?.validUntil
    ? new Date(d.validUntil).toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo'})
    : null;
  return (
    <View style={[styles.card, {borderColor: soft}]} testID={`promo-${p.kind}`}>
      <View style={[styles.value, {backgroundColor: soft}]}>
        <Ionicons name={ICON[p.kind]} size={16} color={accent} />
        {p.original ? <Text style={styles.original}>De {p.original}</Text> : null}
        <Text
          style={[styles.headline, {color: accent}, p.kind === 'OTHER' && styles.headlineText]}
          numberOfLines={p.kind === 'OTHER' ? 3 : 1}
          adjustsFontSizeToFit>
          {p.kind === 'FINAL_PRICE' && !p.original ? `Por ${p.headline}` : p.original ? `por ${p.headline}` : p.headline}
        </Text>
        <Text style={styles.caption}>{p.caption}</Text>
        {p.savings ? (
          <View style={[styles.savings, {backgroundColor: accent}]}>
            <Text style={styles.savingsText}>economize {p.savings}%</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{d?.name}</Text>
        {d?.description ? <Text style={styles.desc}>{d.description}</Text> : null}
        {until ? <Text style={styles.until}>Válida até {until}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
    overflow: 'hidden',
  },
  value: {
    width: 118,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  original: {
    ...F.regular, fontSize: 12, color: '#6B7280', textDecorationLine: 'line-through', marginTop: 4},
  headline: {fontSize: 22, ...F.heavy, marginTop: 2, textAlign: 'center'},
  headlineText: {
    ...F.regular, fontSize: 15, lineHeight: 19},
  caption: {
    ...F.regular, fontSize: 11, color: '#6B7280', textAlign: 'center', marginTop: 2},
  savings: {borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6},
  savingsText: {color: '#FFFFFF', fontSize: 10, ...F.heavy, },
  info: {flex: 1, padding: 12, justifyContent: 'center'},
  name: {fontSize: 15, ...F.bold, color: '#1F2937'},
  desc: {
    ...F.regular, fontSize: 13, color: '#4B5563', marginTop: 4},
  until: {
    ...F.regular, fontSize: 12, color: '#9CA3AF', marginTop: 6},
});
