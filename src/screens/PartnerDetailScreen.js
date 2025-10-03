import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const PartnerDetailScreen = ({ route, navigation }) => {
  const { partner } = route.params;
  const [isFavorite, setIsFavorite] = useState(false);

  const handleCall = () => {
    const phoneNumber = '14999876543'; // Mock phone number
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleDirections = () => {
    const address = encodeURIComponent(partner.address);
    const url = `https://maps.google.com/maps?q=${address}`;
    Linking.openURL(url);
  };

  const handleShowQRCode = () => {
    Alert.alert(
      'Mostrar Carteirinha',
      'Mostre sua carteirinha digital para o atendente validar seu desconto.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Mostrar Carteirinha', onPress: () => navigation.navigate('MembershipCard') }
      ]
    );
  };

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header com imagem do parceiro */}
      <View style={styles.header}>
        <Image source={{ uri: partner.image }} style={styles.partnerImage} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerInfo}>
              <Text style={styles.partnerName}>{partner.name}</Text>
              <Text style={styles.partnerCategory}>{partner.category}</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.ratingText}>{partner.rating}</Text>
                <Text style={styles.distanceText}>• {partner.distance}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={toggleFavorite}
            >
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={24}
                color={isFavorite ? "#E91E63" : "white"}
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      {/* Oferta exclusiva */}
      <View style={styles.exclusiveOfferCard}>
        <View style={styles.offerHeader}>
          <Ionicons name="gift" size={20} color="#FF9800" />
          <Text style={styles.offerTitle}>Oferta Exclusiva</Text>
        </View>
        <Text style={styles.offerText}>{partner.exclusiveOffer}</Text>
        <View style={styles.discountContainer}>
          <Text style={styles.discountText}>{partner.discount} de desconto</Text>
        </View>
      </View>

      {/* Informações do parceiro */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Informações</Text>
        
        <View style={styles.infoItem}>
          <Ionicons name="location" size={20} color="#4CAF50" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Endereço</Text>
            <Text style={styles.infoValue}>{partner.address}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="time" size={20} color="#4CAF50" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Horário de Funcionamento</Text>
            <Text style={styles.infoValue}>{partner.hours}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Ionicons name="call" size={20} color="#4CAF50" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Telefone</Text>
            <Text style={styles.infoValue}>(14) 99876-5432</Text>
          </View>
        </View>
      </View>

      {/* Serviços oferecidos */}
      <View style={styles.servicesSection}>
        <Text style={styles.sectionTitle}>Serviços Oferecidos</Text>
        <View style={styles.servicesGrid}>
          {partner.services.map((service, index) => (
            <View key={index} style={styles.serviceItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.serviceText}>{service}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Ações */}
      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={handleShowQRCode}
        >
          <Ionicons name="qr-code" size={20} color="white" />
          <Text style={styles.primaryActionText}>Mostrar Carteirinha</Text>
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={handleCall}
          >
            <Ionicons name="call" size={20} color="#4CAF50" />
            <Text style={styles.secondaryActionText}>Ligar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={handleDirections}
          >
            <Ionicons name="navigate" size={20} color="#4CAF50" />
            <Text style={styles.secondaryActionText}>Como Chegar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Termos e condições */}
      <View style={styles.termsSection}>
        <Text style={styles.termsTitle}>Termos e Condições</Text>
        <Text style={styles.termsText}>
          • Desconto válido apenas para membros ativos da Liga do Bem{'\n'}
          • Apresente sua carteirinha digital no momento do pagamento{'\n'}
          • Desconto não acumulativo com outras promoções{'\n'}
          • Válido até 31/12/2024
        </Text>
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
    height: 250,
    position: 'relative',
  },
  partnerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  headerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    justifyContent: 'flex-end',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 20,
  },
  headerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  partnerCategory: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: 'white',
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 8,
  },
  favoriteButton: {
    padding: 8,
  },
  exclusiveOfferCard: {
    backgroundColor: '#FFF3E0',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E65100',
    marginLeft: 8,
  },
  offerText: {
    fontSize: 14,
    color: '#E65100',
    marginBottom: 12,
  },
  discountContainer: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  discountText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  infoSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    color: '#666',
  },
  servicesSection: {
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
  servicesGrid: {
    gap: 12,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  actionsSection: {
    padding: 16,
    gap: 12,
  },
  primaryAction: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    gap: 8,
  },
  secondaryActionText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  termsSection: {
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
  termsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  termsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default PartnerDetailScreen;
