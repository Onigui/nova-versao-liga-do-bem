import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Linking,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SearchPartnerScreen() {
  const [cnpj, setCnpj] = useState('');
  const [searching, setSearching] = useState(false);
  const [partnerData, setPartnerData] = useState(null);

  // Função para formatar CNPJ
  const formatCNPJ = (value) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  // Função para validar CNPJ
  const validateCNPJ = (cnpj) => {
    const numbers = cnpj.replace(/\D/g, '');
    return numbers.length === 14;
  };

  // Função para buscar dados do parceiro por CNPJ
  const searchPartner = async () => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    
    if (!validateCNPJ(cnpj)) {
      Alert.alert('CNPJ Inválido', 'Por favor, digite um CNPJ válido.');
      return;
    }

    setSearching(true);

    try {
      // Simular busca na API (em produção, seria uma chamada real)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Dados simulados baseados no CNPJ
      const mockPartnerData = {
        cnpj: cnpj,
        name: "Pet Shop Central",
        fantasyName: "Petshop Central",
        category: "Pet Shop",
        address: "Rua das Flores, 123, Botucatu - SP",
        phone: "(14) 3882-1234",
        email: "contato@petshopcentral.com",
        website: "https://petshopcentral.com",
        hours: "Seg-Sex: 08:00-18:00\nSáb: 08:00-12:00",
        discount: "15% de desconto",
        description: "Pet shop completo com produtos de qualidade e serviços de banho e tosa.",
        services: ["Produtos para pets", "Banho e tosa", "Veterinário", "Hotel para pets"],
        latitude: -22.8858,
        longitude: -48.4449,
        isOpen: true,
        rating: 4.8,
        reviews: 127,
        memberSince: "2023-01-15",
        totalSavings: "R$ 2.450,00"
      };

      setPartnerData(mockPartnerData);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível buscar os dados do parceiro.');
      console.error('Erro na busca:', error);
    } finally {
      setSearching(false);
    }
  };

  const openInMaps = () => {
    if (!partnerData) return;
    
    const url = `https://www.google.com/maps/dir/?api=1&destination=${partnerData.latitude},${partnerData.longitude}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir o aplicativo de mapas.');
      }
    });
  };

  const callPartner = () => {
    if (!partnerData) return;
    
    const url = `tel:${partnerData.phone}`;
    Linking.openURL(url);
  };

  const openWebsite = () => {
    if (!partnerData?.website) return;
    
    Linking.canOpenURL(partnerData.website).then(supported => {
      if (supported) {
        Linking.openURL(partnerData.website);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir o site.');
      }
    });
  };

  const renderPartnerCard = () => {
    if (!partnerData) return null;

    return (
      <View style={styles.partnerCard}>
        <View style={styles.cardHeader}>
          <View style={styles.partnerTitle}>
            <Ionicons name="storefront" size={32} color="#8B5CF6" />
            <View style={styles.titleText}>
              <Text style={styles.partnerName}>{partnerData.name}</Text>
              <Text style={styles.fantasyName}>{partnerData.fantasyName}</Text>
              <Text style={styles.partnerCategory}>{partnerData.category}</Text>
            </View>
          </View>
          
          <View style={styles.partnerStatus}>
            <View style={[styles.statusDot, { backgroundColor: partnerData.isOpen ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.statusText}>
              {partnerData.isOpen ? 'Aberto' : 'Fechado'}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <View style={styles.discountContainer}>
            <Text style={styles.discountText}>{partnerData.discount}</Text>
          </View>
          
          <Text style={styles.description}>{partnerData.description}</Text>
          
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Informações de Contato</Text>
            
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#6B7280" />
              <Text style={styles.infoText}>{partnerData.address}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="call" size={20} color="#6B7280" />
              <Text style={styles.infoText}>{partnerData.phone}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="mail" size={20} color="#6B7280" />
              <Text style={styles.infoText}>{partnerData.email}</Text>
            </View>
            
            {partnerData.website && (
              <TouchableOpacity style={styles.infoRow} onPress={openWebsite}>
                <Ionicons name="globe" size={20} color="#8B5CF6" />
                <Text style={[styles.infoText, styles.linkText]}>
                  {partnerData.website}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Horários de Funcionamento</Text>
            <Text style={styles.hoursText}>{partnerData.hours}</Text>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Serviços Oferecidos</Text>
            <View style={styles.servicesContainer}>
              {partnerData.services.map((service, index) => (
                <View key={index} style={styles.serviceTag}>
                  <Text style={styles.serviceText}>{service}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Avaliações</Text>
            <View style={styles.ratingContainer}>
              <View style={styles.ratingStars}>
                <Ionicons name="star" size={20} color="#F59E0B" />
                <Text style={styles.ratingText}>{partnerData.rating}</Text>
                <Text style={styles.reviewsText}>({partnerData.reviews} avaliações)</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Parceiro da Liga do Bem</Text>
            <View style={styles.memberInfo}>
              <Text style={styles.memberText}>
                Membro desde: {new Date(partnerData.memberSince).toLocaleDateString('pt-BR')}
              </Text>
              <Text style={styles.memberText}>
                Total economizado pelos membros: {partnerData.totalSavings}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.mapButton]} 
            onPress={openInMaps}
          >
            <Ionicons name="map" size={20} color="white" />
            <Text style={styles.actionButtonText}>Como chegar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.callButton]} 
            onPress={callPartner}
          >
            <Ionicons name="call" size={20} color="white" />
            <Text style={styles.actionButtonText}>Ligar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Buscar Parceiro</Text>
        <Text style={styles.headerSubtitle}>
          Digite o CNPJ para encontrar um parceiro
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="search" size={24} color="#8B5CF6" />
            <TextInput
              style={styles.input}
              placeholder="Digite o CNPJ (ex: 12.345.678/0001-90)"
              value={cnpj}
              onChangeText={(value) => setCnpj(formatCNPJ(value))}
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={18}
            />
          </View>
          
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={searchPartner}
            disabled={searching || !cnpj.trim()}
          >
            {searching ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Ionicons name="search" size={20} color="white" />
                <Text style={styles.searchButtonText}>Buscar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.helpContainer}>
          <Ionicons name="information-circle" size={20} color="#6B7280" />
          <Text style={styles.helpText}>
            Digite o CNPJ completo do parceiro para ver informações detalhadas, 
            localização e como chegar até o estabelecimento.
          </Text>
        </View>

        {renderPartnerCard()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
  },
  searchButton: {
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  helpContainer: {
    backgroundColor: 'white',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  helpText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  partnerCard: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  partnerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleText: {
    marginLeft: 16,
    flex: 1,
  },
  partnerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  fantasyName: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  partnerCategory: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  partnerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardContent: {
    padding: 20,
  },
  discountContainer: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  discountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 20,
  },
  infoSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 12,
    flex: 1,
  },
  linkText: {
    color: '#8B5CF6',
    textDecorationLine: 'underline',
  },
  hoursText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  servicesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  serviceTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  serviceText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  reviewsText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  memberInfo: {
    backgroundColor: '#F0F9FF',
    padding: 12,
    borderRadius: 8,
  },
  memberText: {
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 4,
  },
  cardActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  mapButton: {
    backgroundColor: '#8B5CF6',
  },
  callButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
