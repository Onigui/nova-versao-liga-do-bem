import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {parseOpeningHours, getTodayHours, openStatus} from '../utils/openingHours';
import PromoCard from '../components/PromoCard';
import {partnerBadge} from '../utils/promo';
import {formatDistance} from '../utils/geo';
import {brl} from '../utils/priceCompare';
import {API_BASE_PATH} from '../config/apiConfig';

const {width} = Dimensions.get('window');

/**
 * Página da empresa no app dos membros. Com `preview` (App Parceiros → "Como os membros veem")
 * os botões de telefone, WhatsApp e mapa ficam inativos.
 */
export default function PartnerDetailScreen({route, navigation, partner: partnerProp, preview: previewProp}) {
  const partner = partnerProp || route?.params?.partner;
  const preview = previewProp || route?.params?.preview;
  const [prices, setPrices] = useState(null);
  const [showAllPrices, setShowAllPrices] = useState(false);
  const partnerId = partnerProp?.id || route?.params?.partner?.id;
  useEffect(() => {
    if (preview || !partnerId || String(partnerId).startsWith('fallback')) return;
    let alive = true;
    fetch(`${API_BASE_PATH}/partners/${partnerId}/prices`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => alive && d && setPrices(d.prices || []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [partnerId, preview]);

  const partnerData = partner || {
    id: '1',
    name: 'Pet Shop Exemplo',
    category: 'Pet Shop',
    discount: '20%',
    description:
      'Desconto de 20% em todos os produtos para membros da Liga do Bem.',
    address: 'Rua Exemplo, 123 - Centro',
    phone: '(14) 3811-1234',
    whatsapp: '14981234567',
    hours: 'Seg-Sex: 09:00-18:00 | Sáb: 09:00-13:00',
    logo: null,
  };

  const hasHours = !!String(partnerData.hours || '').trim();
  const weekHours = parseOpeningHours(partnerData.hours);
  const todayHours = getTodayHours(partnerData.hours);
  const nowStatus = hasHours ? openStatus(partnerData.hours) : null;
  const badge = partnerData.badge || partnerBadge(partnerData, partnerData.discounts);
  const distance = formatDistance(partnerData.distanceKm ?? null);

  const openPhone = () => {
    if (preview) return;
    Linking.openURL(`tel:${partnerData.phone}`);
  };

  const openWhatsApp = () => {
    if (preview) return;
    Linking.openURL(`https://wa.me/55${partnerData.whatsapp}`);
  };

  const openMaps = () => {
    if (preview) return;
    const address = encodeURIComponent(partnerData.address);
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${address}`,
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
        {/* Header com Gradient */}
        <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
          <View style={styles.logoContainer}>
            {partnerData.logo ? (
              <Image
                source={{uri: partnerData.logo}}
                style={styles.logo}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.logoFallback}>
                <Ionicons name="storefront" size={42} color="#8B5CF6" />
              </View>
            )}
          </View>
          {badge ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText} testID="selo-detalhe">
                {badge}
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* Content */}
        <View style={styles.content}>
          {/* Title */}
          <Text style={styles.name}>{partnerData.name}</Text>
          <View style={styles.categoryBadge}>
            <Ionicons name="storefront" size={14} color="#8B5CF6" />
            <Text style={styles.categoryText}>{partnerData.category}</Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Benefício</Text>
            <Text style={styles.description}>{partnerData.description}</Text>
          </View>

          {/* Promoções cadastradas pelo parceiro no App Parceiros */}
          {partnerData.discounts?.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Promoções para membros</Text>
              {partnerData.discounts.map(d => (
                <PromoCard key={d.id} discount={d} />
              ))}
              <Text style={styles.promoHint}>
                Mostre o QR da sua carteirinha no caixa para usar.
              </Text>
            </View>
          ) : null}

          {/* Tabela de preços do parceiro */}
          {prices?.length ? (
            <View style={styles.section} testID="tabela-precos">
              <Text style={styles.sectionTitle}>Tabela de preços</Text>
              {(showAllPrices ? prices : prices.slice(0, 6)).map(p => (
                <View key={p.item.id} style={[styles.priceRow, !p.available && {opacity: 0.5}]}>
                  <View style={{flex: 1}}>
                    <Text style={styles.priceName}>{p.item.label}</Text>
                    <Text style={styles.priceMeta}>
                      {p.item.categoryLabel}
                      {!p.available ? ' · indisponível' : ''}
                      {p.note ? ` · ${p.note}` : ''}
                    </Text>
                  </View>
                  <View style={{alignItems: 'flex-end'}}>
                    {p.price ? <Text style={styles.priceOld}>{brl(p.price)}</Text> : null}
                    <Text style={styles.priceValue}>{brl(p.memberPrice)}</Text>
                  </View>
                </View>
              ))}
              {prices.length > 6 ? (
                <TouchableOpacity onPress={() => setShowAllPrices(v => !v)}>
                  <Text style={styles.priceMore}>{showAllPrices ? 'Mostrar menos' : `Ver todos (${prices.length})`}</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.promoHint}>Preço de membro em destaque. Mostre a carteirinha no caixa.</Text>
            </View>
          ) : null}

          {/* Contact Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contato</Text>

            {/* Phone */}
            <TouchableOpacity style={styles.contactItem} onPress={openPhone}>
              <View style={[styles.contactIcon, {backgroundColor: '#DBEAFE'}]}>
                <Ionicons name="call" size={20} color="#3B82F6" />
              </View>
              <View style={styles.contactText}>
                <Text style={styles.contactLabel}>Telefone</Text>
                <Text style={styles.contactValue}>{partnerData.phone}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* WhatsApp */}
            <TouchableOpacity style={styles.contactItem} onPress={openWhatsApp}>
              <View style={[styles.contactIcon, {backgroundColor: '#D1FAE5'}]}>
                <Ionicons name="logo-whatsapp" size={20} color="#10B981" />
              </View>
              <View style={styles.contactText}>
                <Text style={styles.contactLabel}>WhatsApp</Text>
                <Text style={styles.contactValue}>Enviar mensagem</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Localização</Text>

            <TouchableOpacity style={styles.locationCard} onPress={openMaps}>
              <View style={styles.locationIcon}>
                <Ionicons name="location" size={24} color="#8B5CF6" />
              </View>
              <View style={styles.locationText}>
                <Text style={styles.locationAddress}>
                  {partnerData.address}
                </Text>
                <Text style={styles.locationAction}>
                  {distance ? `A ${distance} de você · abrir no mapa` : 'Abrir no Google Maps'}
                </Text>
              </View>
              <Ionicons name="navigate" size={24} color="#8B5CF6" />
            </TouchableOpacity>
          </View>

          {/* Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Horário de Funcionamento</Text>
            {!hasHours ? (
              <View style={styles.hoursCard}>
                <View style={styles.hoursToday}>
                  <View style={styles.hoursTodayIcon}>
                    <Ionicons name="help-circle-outline" size={18} color="#7C3AED" />
                  </View>
                  <View style={{flex: 1}}>
                    <Text style={styles.hoursTodayLabel}>Horário não informado</Text>
                    <Text style={styles.hoursTodayValue}>Ligue ou chame no WhatsApp antes de ir</Text>
                  </View>
                </View>
              </View>
            ) : (
            <View style={styles.hoursCard}>
              <View style={styles.hoursToday}>
                <View style={styles.hoursTodayIcon}>
                  <Ionicons
                    name={todayHours.closed ? 'moon-outline' : 'time-outline'}
                    size={18}
                    color="#7C3AED"
                  />
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.hoursTodayLabel}>
                    {nowStatus ? (nowStatus.open ? 'Aberto agora' : 'Fechado agora') : 'Hoje'}
                  </Text>
                  <Text
                    style={[
                      styles.hoursTodayValue,
                      todayHours.closed && styles.hoursClosed,
                    ]}>
                    {todayHours.closed ? 'Fechado' : todayHours.range}
                  </Text>
                </View>
              </View>
              {weekHours.map(day => (
                <View
                  key={day.key}
                  style={[
                    styles.hoursRow,
                    day.key === todayHours.key && styles.hoursRowToday,
                  ]}>
                  <Text
                    style={[
                      styles.hoursDay,
                      day.key === todayHours.key && styles.hoursDayToday,
                    ]}>
                    {day.label}
                  </Text>
                  <Text
                    style={[
                      styles.hoursRange,
                      day.closed && styles.hoursClosed,
                      day.key === todayHours.key && styles.hoursDayToday,
                    ]}>
                    {day.range}
                  </Text>
                </View>
              ))}
            </View>
            )}
          </View>

          {/* How to Use */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Como Utilizar o Benefício</Text>
            <View style={styles.howToCard}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>
                  Apresente seu cartão de membro
                </Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Informe o desconto da Liga do Bem
                </Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  Aproveite o desconto exclusivo!
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
  },
  logoFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  promoLabel: {fontSize: 18, fontWeight: '800', color: '#7C3AED'},
  promoName: {fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2},
  promoDesc: {fontSize: 13, color: '#6B7280', marginTop: 2},
  promoHint: {fontSize: 12, color: '#6B7280', marginTop: 4},
  priceRow: {flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'},
  priceName: {fontSize: 14, fontWeight: '600', color: '#1F2937'},
  priceMeta: {fontSize: 12, color: '#6B7280', marginTop: 2},
  priceOld: {fontSize: 12, color: '#9CA3AF', textDecorationLine: 'line-through'},
  priceValue: {fontSize: 16, fontWeight: '800', color: '#6D28D9'},
  priceMore: {color: '#7C3AED', fontWeight: '700', marginTop: 10},
  discountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    padding: 24,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  categoryText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactText: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    padding: 16,
    borderRadius: 12,
  },
  locationIcon: {
    marginRight: 12,
  },
  locationText: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  locationAction: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  hoursCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  hoursToday: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  hoursTodayIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursTodayLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  hoursTodayValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '700',
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  hoursRowToday: {
    backgroundColor: '#EDE9FE',
  },
  hoursDay: {
    fontSize: 14,
    color: '#4B5563',
  },
  hoursDayToday: {
    color: '#5B21B6',
    fontWeight: '700',
  },
  hoursRange: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  hoursClosed: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  howToCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
});
