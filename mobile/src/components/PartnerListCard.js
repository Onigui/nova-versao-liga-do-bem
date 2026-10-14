/**
 * Cartão de um parceiro na lista do app dos membros (também usado na prévia do App Parceiros).
 */
import React from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {formatDistance} from '../utils/geo';

export default function PartnerListCard({partner, onPress, onNavigate, disabled}) {
  // Selo pronto vindo da promoção ("20% OFF", "Por R$ 69,90"…); dados antigos: "20%" + " OFF"
  const badge =
    partner.badge ||
    (partner.discount && partner.discount !== 'Sem desconto' ? `${partner.discount} OFF` : null);
  const distance = formatDistance(partner.distanceKm ?? partner.distance);
  return (
    <TouchableOpacity style={styles.partnerCard} onPress={onPress} disabled={disabled} activeOpacity={0.8}>
      {badge ? (
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          style={styles.discountBadge}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}>
          <Text style={styles.discountText} numberOfLines={1} testID="selo-promocao">
            {badge}
          </Text>
        </LinearGradient>
      ) : null}

      <View style={styles.logo}>
        {partner.logo ? (
          <Image source={{uri: partner.logo}} style={styles.logoImage} />
        ) : (
          <Text style={styles.logoInitial}>{(partner.name || '?').trim().charAt(0).toUpperCase()}</Text>
        )}
      </View>

      <View style={styles.partnerInfo}>
        <Text style={styles.partnerName} numberOfLines={1}>
          {partner.name}
        </Text>
        <View style={styles.partnerMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="pricetag" size={14} color="#8B5CF6" />
            <Text style={styles.metaText}>{partner.category}</Text>
          </View>
          {partner.reviewCount ? (
            <View style={styles.metaItem} testID="nota">
              <Ionicons name="star" size={13} color="#F59E0B" />
              <Text style={[styles.metaText, {color: '#92400E', fontWeight: '700'}]}>
                {String(Number(partner.rating).toFixed(1)).replace('.', ',')} ({partner.reviewCount})
              </Text>
            </View>
          ) : null}
          {distance ? (
            <View style={styles.metaItem}>
              <Ionicons name="location" size={14} color="#10B981" />
              <Text style={[styles.metaText, styles.distanceText]} testID="distancia">
                {distance}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.partnerAddress} numberOfLines={1}>
          {partner.address}
        </Text>
        {partner.openNow != null ? (
          <View style={styles.metaItem}>
            <View style={[styles.dot, {backgroundColor: partner.openNow ? '#10B981' : '#9CA3AF'}]} />
            <Text style={[styles.metaText, {color: partner.openNow ? '#047857' : '#6B7280'}]} numberOfLines={1}>
              {partner.openLabel || (partner.openNow ? 'Aberto agora' : 'Fechado')}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.partnerActions}>
        <TouchableOpacity style={styles.actionIcon} onPress={onNavigate} disabled={disabled}>
          <Ionicons name="navigate" size={20} color="#8B5CF6" />
        </TouchableOpacity>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  partnerCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 4,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
  },
  discountBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  discountText: {color: '#FFFFFF', fontSize: 12, fontWeight: '700', maxWidth: 170},
  distanceText: {color: '#047857', fontWeight: '700'},
  dot: {width: 7, height: 7, borderRadius: 4},
  logo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  logoImage: {width: '100%', height: '100%'},
  logoInitial: {fontSize: 20, fontWeight: '800', color: '#7C3AED'},
  partnerInfo: {flex: 1},
  partnerName: {fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 6},
  partnerMeta: {flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginBottom: 6},
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  metaText: {fontSize: 12, color: '#6B7280'},
  partnerAddress: {fontSize: 13, color: '#9CA3AF', marginBottom: 4},
  partnerActions: {flexDirection: 'row', alignItems: 'center', gap: 8},
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
