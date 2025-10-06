import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';

const HomeScreen = ({ navigation }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [memberStatus, setMemberStatus] = useState({
    isMember: true,
    isUpToDate: true,
    nextPaymentDate: '2024-02-15',
    memberSince: '2023-06-15',
  });

  // Mock data para parceiros
  const [partners] = useState([
    {
      id: 1,
      name: 'Pet Shop Amigo',
      category: 'Pet Shop',
      discount: '15%',
      distance: '1.2 km',
      rating: 4.8,
      image: 'https://via.placeholder.com/100x100/4CAF50/ffffff?text=PS',
      services: ['Banho e tosa', 'Veterinário', 'Ração'],
      hours: '08:00 - 18:00',
      address: 'Rua das Flores, 123',
      exclusiveOffer: 'Desconto especial para membros da Liga do Bem!'
    },
    {
      id: 2,
      name: 'Clínica Veterinária Vida',
      category: 'Veterinário',
      discount: '20%',
      distance: '2.5 km',
      rating: 4.9,
      image: 'https://via.placeholder.com/100x100/FF9800/ffffff?text=CV',
      services: ['Consultas', 'Vacinas', 'Cirurgias'],
      hours: '24h',
      address: 'Av. Principal, 456',
      exclusiveOffer: 'Primeira consulta gratuita para novos membros!'
    },
    {
      id: 3,
      name: 'Farmácia Pet',
      category: 'Farmácia',
      discount: '10%',
      distance: '0.8 km',
      rating: 4.6,
      image: 'https://via.placeholder.com/100x100/2196F3/ffffff?text=FP',
      services: ['Medicamentos', 'Suplementos', 'Produtos'],
      hours: '07:00 - 22:00',
      address: 'Rua Central, 789',
      exclusiveOffer: 'Frete grátis para pedidos acima de R$ 50!'
    },
  ]);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Precisamos da sua localização para mostrar parceiros próximos.');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
    } catch (error) {
      console.error('Erro ao obter localização:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await getCurrentLocation();
    setRefreshing(false);
  };

  const renderPartnerCard = ({ item }) => (
    <TouchableOpacity
      style={styles.partnerCard}
      onPress={() => navigation.navigate('PartnerDetail', { partner: item })}
    >
      <Image source={{ uri: item.image }} style={styles.partnerImage} />
      <View style={styles.partnerInfo}>
        <Text style={styles.partnerName}>{item.name}</Text>
        <Text style={styles.partnerCategory}>{item.category}</Text>
        <View style={styles.partnerDetails}>
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{item.discount}</Text>
          </View>
          <Text style={styles.distanceText}>{item.distance}</Text>
        </View>
        <Text style={styles.exclusiveOffer}>{item.exclusiveOffer}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header com saudação */}
      <LinearGradient
        colors={['#4CAF50', '#45a049']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Olá, Membro!</Text>
            <Text style={styles.subtitle}>Liga do Bem Botucatu</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => Alert.alert('Notificações', 'Você não tem novas notificações.')}
          >
            <Ionicons name="notifications-outline" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Status do membro */}
      <View style={styles.memberStatusCard}>
        <View style={styles.memberStatusHeader}>
          <Text style={styles.memberStatusTitle}>Status da Carteirinha</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: memberStatus.isUpToDate ? '#4CAF50' : '#FF5722' }
          ]}>
            <Text style={styles.statusText}>
              {memberStatus.isUpToDate ? 'Em dia' : 'Pendente'}
            </Text>
          </View>
        </View>
        
        <View style={styles.memberInfo}>
          <Text style={styles.memberInfoText}>
            Próximo pagamento: {memberStatus.nextPaymentDate}
          </Text>
          <Text style={styles.memberInfoText}>
            Membro desde: {memberStatus.memberSince}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.viewCardButton}
          onPress={() => navigation.navigate('MembershipCard')}
        >
          <Text style={styles.viewCardButtonText}>Ver Carteirinha Digital</Text>
          <Ionicons name="chevron-forward" size={20} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* Banner promocional */}
      <View style={styles.promotionalBanner}>
        <LinearGradient
          colors={['#FF9800', '#FF5722']}
          style={styles.bannerGradient}
        >
          <View style={styles.bannerContent}>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>Desconto Exclusivo!</Text>
              <Text style={styles.bannerSubtitle}>
                Mostre sua carteirinha digital e ganhe descontos especiais em nossos parceiros!
              </Text>
            </View>
            <View style={styles.bannerIcon}>
              <Ionicons name="gift" size={40} color="white" />
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* Seção de parceiros */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Parceiros Próximos</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={partners}
          renderItem={renderPartnerCard}
          keyExtractor={(item) => item.id.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.partnersList}
        />
      </View>

      {/* Ações rápidas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações Rápidas</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('Partners')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="location" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.quickActionText}>Parceiros Próximos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('SearchPartner')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="search" size={24} color="#06B6D4" />
            </View>
            <Text style={styles.quickActionText}>Buscar Parceiro</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('QRScanner')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="qr-code" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.quickActionText}>Escanear QR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('DonationScreen')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="heart" size={24} color="#E91E63" />
            </View>
            <Text style={styles.quickActionText}>Doar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('AdoptionScreen')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="paw" size={24} color="#FF9800" />
            </View>
            <Text style={styles.quickActionText}>Adotar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('EventsScreen')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="calendar" size={24} color="#2196F3" />
            </View>
            <Text style={styles.quickActionText}>Eventos</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  notificationButton: {
    padding: 8,
  },
  memberStatusCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  memberStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberStatusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  memberInfo: {
    marginBottom: 16,
  },
  memberInfoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  viewCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  viewCardButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  promotionalBanner: {
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerGradient: {
    padding: 20,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  bannerIcon: {
    marginLeft: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  partnersList: {
    paddingHorizontal: 16,
  },
  partnerCard: {
    backgroundColor: 'white',
    marginRight: 12,
    borderRadius: 12,
    padding: 16,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  partnerImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  partnerCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  partnerDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  discountBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  discountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  distanceText: {
    fontSize: 12,
    color: '#666',
  },
  exclusiveOffer: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickActionButton: {
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    width: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionIcon: {
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
});

export default HomeScreen;
