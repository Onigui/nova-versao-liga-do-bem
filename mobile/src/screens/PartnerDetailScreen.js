import React from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function PartnerDetailScreen({ route, navigation }) {
  const { partner } = route.params || {};

  const partnerData = partner || {
    id: '1',
    name: 'Pet Shop Exemplo',
    category: 'Pet Shop',
    discount: '20%',
    description: 'Desconto de 20% em todos os produtos para membros da Liga do Bem.',
    address: 'Rua Exemplo, 123 - Centro',
    phone: '(14) 3811-1234',
    whatsapp: '14981234567',
    hours: 'Seg-Sex: 9h-18h | Sáb: 9h-13h',
    logo: 'https://via.placeholder.com/100',
  };

  const openPhone = () => {
    Linking.openURL(`tel:${partnerData.phone}`);
  };

  const openWhatsApp = () => {
    Linking.openURL(`https://wa.me/55${partnerData.whatsapp}`);
  };

  const openMaps = () => {
    const address = encodeURIComponent(partnerData.address);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${address}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header com Gradient */}
        <LinearGradient
          colors={['#8B5CF6', '#EC4899']}
          style={styles.header}
        >
          <View style={styles.logoContainer}>
            <Image
              source={{ uri: partnerData.logo }}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{partnerData.discount} OFF</Text>
          </View>
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

          {/* Contact Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contato</Text>
            
            {/* Phone */}
            <TouchableOpacity style={styles.contactItem} onPress={openPhone}>
              <View style={[styles.contactIcon, { backgroundColor: '#DBEAFE' }]}>
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
              <View style={[styles.contactIcon, { backgroundColor: '#D1FAE5' }]}>
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
                <Text style={styles.locationAddress}>{partnerData.address}</Text>
                <Text style={styles.locationAction}>Abrir no Google Maps</Text>
              </View>
              <Ionicons name="navigate" size={24} color="#8B5CF6" />
            </TouchableOpacity>
          </View>

          {/* Hours */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Horário de Funcionamento</Text>
            <View style={styles.hoursCard}>
              <Ionicons name="time-outline" size={20} color="#6B7280" />
              <Text style={styles.hoursText}>{partnerData.hours}</Text>
            </View>
          </View>

          {/* How to Use */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Como Utilizar o Benefício</Text>
            <View style={styles.howToCard}>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>Apresente seu cartão de membro</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>Informe o desconto da Liga do Bem</Text>
              </View>
              <View style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>Aproveite o desconto exclusivo!</Text>
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
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  hoursText: {
    fontSize: 14,
    color: '#6B7280',
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

