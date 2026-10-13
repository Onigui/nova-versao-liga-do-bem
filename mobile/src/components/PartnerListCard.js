/**
 * Cartão de um parceiro na lista do app dos membros (também usado na prévia do App Parceiros).
 */
import React from 'react';
import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

export default function PartnerListCard({partner, onPress, onNavigate, disabled}) {
  const hasDiscount = partner.discount && partner.discount !== 'Sem desconto';
  return (
    <TouchableOpacity style={styles.partnerCard} onPress={onPress} disabled={disabled} activeOpacity={0.8}>
      {hasDiscount ? (
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          style={styles.discountBadge}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 0}}>
          <Text style={styles.discountText}>{partner.discount}</Text>
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
          {partner.distance ? (
            <View style={styles.metaItem}>
              <Ionicons name="location" size={14} color="#10B981" />
              <Text style={styles.metaText}>{partner.distance.toFixed(1)} km</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.partnerAddress} numberOfLines={1}>
          {partner.address}
        </Text>
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
  discountText: {color: '#FFFFFF', fontSize: 12, fontWeight: '700'},
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
  partnerMeta: {flexDirection: 'row', gap: 12, marginBottom: 6},
  metaItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  metaText: {fontSize: 12, color: '#6B7280'},
  partnerAddress: {fontSize: 13, color: '#9CA3AF'},
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
