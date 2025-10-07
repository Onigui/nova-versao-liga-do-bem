import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../services/AuthService';

const API_BASE_URL = 'https://liga-do-bem-backend.onrender.com/api';

export default function PartnersScreen() {
  const { isAuthenticated } = useAuth();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/partners`);
      if (response.ok) {
        const data = await response.json();
        setPartners(data.partners || []);
      } else {
        // Usar dados mockados em caso de erro
        setPartners([
          {
            id: 1,
            name: 'Pet Shop Amigo',
            category: 'Pet Shop',
            discount: '15%',
            address: 'Rua das Flores, 123',
            phone: '(14) 99999-9999',
            isActive: true,
          },
          {
            id: 2,
            name: 'Clínica Veterinária Saúde',
            category: 'Veterinária',
            discount: '20%',
            address: 'Av. Principal, 456',
            phone: '(14) 88888-8888',
            isActive: true,
          },
          {
            id: 3,
            name: 'Farmácia Pet',
            category: 'Farmácia',
            discount: '10%',
            address: 'Rua do Comércio, 789',
            phone: '(14) 77777-7777',
            isActive: true,
          },
        ]);
      }
    } catch (error) {
      console.error('Erro ao carregar parceiros:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPartners = partners.filter(partner => {
    if (filter === 'all') return true;
    return partner.category.toLowerCase() === filter.toLowerCase();
  });

  const categories = [
    { key: 'all', label: 'Todos', icon: 'grid-outline' },
    { key: 'pet shop', label: 'Pet Shop', icon: 'storefront-outline' },
    { key: 'veterinária', label: 'Veterinária', icon: 'medical-outline' },
    { key: 'farmácia', label: 'Farmácia', icon: 'medkit-outline' },
  ];

  const PartnerCard = ({ partner }) => (
    <TouchableOpacity style={styles.partnerCard}>
      <View style={styles.partnerHeader}>
        <View style={styles.partnerInfo}>
          <Text style={styles.partnerName}>{partner.name}</Text>
          <Text style={styles.partnerCategory}>{partner.category}</Text>
        </View>
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{partner.discount}</Text>
        </View>
      </View>
      
      <View style={styles.partnerDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="location-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{partner.address}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="call-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{partner.phone}</Text>
        </View>
      </View>

      <View style={styles.partnerActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDirections(partner)}
        >
          <Ionicons name="navigate-outline" size={16} color="#8B5CF6" />
          <Text style={styles.actionButtonText}>Como chegar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => handleCall(partner)}
        >
          <Ionicons name="call-outline" size={16} color="#10B981" />
          <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Ligar</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const handleDirections = (partner) => {
    Alert.alert(
      'Navegação',
      `Abrir direções para ${partner.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Abrir', onPress: () => console.log('Abrir navegação') }
      ]
    );
  };

  const handleCall = (partner) => {
    Alert.alert(
      'Ligar',
      `Ligar para ${partner.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ligar', onPress: () => console.log('Fazer ligação') }
      ]
    );
  };

  const CategoryFilter = ({ category }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === category.key && styles.activeFilter
      ]}
      onPress={() => setFilter(category.key)}
    >
      <Ionicons 
        name={category.icon} 
        size={20} 
        color={filter === category.key ? '#8B5CF6' : '#6B7280'} 
      />
      <Text style={[
        styles.filterText,
        filter === category.key && styles.activeFilterText
      ]}>
        {category.label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando parceiros...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parceiros</Text>
        <Text style={styles.headerSubtitle}>
          Estabelecimentos que oferecem descontos exclusivos
        </Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={categories}
          renderItem={({ item }) => <CategoryFilter category={item} />}
          keyExtractor={(item) => item.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
        />
      </View>

      {/* Lista de Parceiros */}
      <FlatList
        data={filteredPartners}
        renderItem={({ item }) => <PartnerCard partner={item} />}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.partnersList}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  filtersList: {
    paddingRight: 20,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activeFilter: {
    backgroundColor: '#8B5CF6',
  },
  filterText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeFilterText: {
    color: 'white',
  },
  partnersList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  partnerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  partnerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  partnerCategory: {
    fontSize: 14,
    color: '#6B7280',
  },
  discountBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  discountText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  partnerDetails: {
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  partnerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4,
  },
  secondaryButton: {
    backgroundColor: '#ECFDF5',
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#8B5CF6',
  },
  secondaryButtonText: {
    color: '#10B981',
  },
});