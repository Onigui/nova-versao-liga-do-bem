import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function PartnersScreen() {
  const [partners, setPartners] = useState([]);
  const [filteredPartners, setFilteredPartners] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [sortBy, setSortBy] = useState('distance'); // distance, name, discount

  const categories = ['Todos', 'Veterinário', 'Pet Shop', 'Restaurante', 'Farmácia', 'Hotel'];

  // Dados de exemplo dos parceiros
  const samplePartners = [
    {
      id: 1,
      name: "Pet Shop Central",
      category: "Pet Shop",
      address: "Rua das Flores, 123, Botucatu - SP",
      phone: "(14) 3882-1234",
      email: "contato@petshopcentral.com",
      website: "https://petshopcentral.com",
      cnpj: "12.345.678/0001-90",
      hours: "Seg-Sex: 08:00-18:00\nSáb: 08:00-12:00",
      discount: "15% de desconto",
      description: "Pet shop completo com produtos de qualidade e serviços de banho e tosa.",
      services: ["Produtos para pets", "Banho e tosa", "Veterinário"],
      latitude: -22.8858,
      longitude: -48.4449,
      distance: null,
      isOpen: true,
      rating: 4.8,
      reviews: 127
    },
    {
      id: 2,
      name: "Clínica Veterinária Amigo",
      category: "Veterinário",
      address: "Av. São Paulo, 456, Botucatu - SP",
      phone: "(14) 3882-5678",
      email: "contato@clinicavetamigo.com",
      hours: "Seg-Sex: 07:00-19:00\nSáb: 07:00-13:00",
      cnpj: "23.456.789/0001-01",
      discount: "10% de desconto",
      description: "Clínica veterinária 24h com atendimento especializado.",
      services: ["Consultas", "Cirurgias", "Exames", "Emergência 24h"],
      latitude: -22.8868,
      longitude: -48.4459,
      distance: null,
      isOpen: true,
      rating: 4.9,
      reviews: 89
    },
    {
      id: 3,
      name: "Restaurante Pet Friendly",
      category: "Restaurante",
      address: "Praça da Matriz, 789, Botucatu - SP",
      phone: "(14) 3882-9012",
      email: "contato@petfriendly.com",
      hours: "Seg-Dom: 11:00-22:00",
      cnpj: "34.567.890/0001-12",
      discount: "20% de desconto",
      description: "Restaurante que permite entrada de pets com menu especial para eles.",
      services: ["Comida para humanos", "Menu pet", "Ambiente climatizado"],
      latitude: -22.8848,
      longitude: -48.4439,
      distance: null,
      isOpen: true,
      rating: 4.6,
      reviews: 203
    },
    {
      id: 4,
      name: "Farmácia Animal",
      category: "Farmácia",
      address: "Rua 15 de Novembro, 321, Botucatu - SP",
      phone: "(14) 3882-3456",
      email: "contato@farmaciaanimal.com",
      hours: "Seg-Sex: 08:00-18:00\nSáb: 08:00-12:00",
      cnpj: "45.678.901/0001-23",
      discount: "12% de desconto",
      description: "Farmácia especializada em medicamentos veterinários.",
      services: ["Medicamentos", "Suplementos", "Produtos veterinários"],
      latitude: -22.8878,
      longitude: -48.4469,
      distance: null,
      isOpen: false,
      rating: 4.7,
      reviews: 156
    },
    {
      id: 5,
      name: "Hotel Pet Paradise",
      category: "Hotel",
      address: "Rua dos Animais, 555, Botucatu - SP",
      phone: "(14) 3882-7890",
      email: "contato@hotelpetparadise.com",
      hours: "24 horas",
      cnpj: "56.789.012/0001-34",
      discount: "25% de desconto",
      description: "Hotel para pets com instalações de primeira qualidade.",
      services: ["Hospedagem", "Day care", "Atividades recreativas"],
      latitude: -22.8888,
      longitude: -48.4479,
      distance: null,
      isOpen: true,
      rating: 4.9,
      reviews: 78
    }
  ];

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (userLocation) {
      loadPartners();
    }
  }, [userLocation]);

  useEffect(() => {
    filterAndSortPartners();
  }, [partners, searchQuery, selectedCategory, sortBy]);

  const getCurrentLocation = async () => {
    try {
      setLoading(true);
      
      // Solicitar permissão de localização
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Negada',
          'Precisamos da sua localização para mostrar os parceiros mais próximos.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      // Obter localização atual
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Erro ao obter localização:', error);
      Alert.alert('Erro', 'Não foi possível obter sua localização atual.');
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };

  const loadPartners = () => {
    const partnersWithDistance = samplePartners.map(partner => ({
      ...partner,
      distance: userLocation ? 
        calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          partner.latitude,
          partner.longitude
        ) : null
    }));

    setPartners(partnersWithDistance);
    setLoading(false);
  };

  const filterAndSortPartners = () => {
    let filtered = [...partners];

    // Filtrar por categoria
    if (selectedCategory !== 'Todos') {
      filtered = filtered.filter(partner => partner.category === selectedCategory);
    }

    // Filtrar por busca
    if (searchQuery.trim()) {
      filtered = filtered.filter(partner =>
        partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.cnpj.includes(searchQuery)
      );
    }

    // Ordenar
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          return (a.distance || 0) - (b.distance || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'discount':
          return parseFloat(b.discount) - parseFloat(a.discount);
        default:
          return 0;
      }
    });

    setFilteredPartners(filtered);
  };

  const openInMaps = (partner) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${partner.latitude},${partner.longitude}`;
    
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir o aplicativo de mapas.');
      }
    });
  };

  const callPartner = (phone) => {
    const url = `tel:${phone}`;
    Linking.openURL(url);
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Veterinário':
        return 'medical';
      case 'Pet Shop':
        return 'storefront';
      case 'Restaurante':
        return 'restaurant';
      case 'Farmácia':
        return 'medical-bag';
      case 'Hotel':
        return 'bed';
      default:
        return 'business';
    }
  };

  const renderPartnerCard = ({ item }) => (
    <View style={styles.partnerCard}>
      <View style={styles.cardHeader}>
        <View style={styles.partnerInfo}>
          <View style={styles.partnerTitle}>
            <Ionicons 
              name={getCategoryIcon(item.category)} 
              size={24} 
              color="#8B5CF6" 
            />
            <View style={styles.titleText}>
              <Text style={styles.partnerName}>{item.name}</Text>
              <Text style={styles.partnerCategory}>{item.category}</Text>
            </View>
          </View>
          <View style={styles.partnerStatus}>
            <View style={[styles.statusDot, { backgroundColor: item.isOpen ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.statusText}>
              {item.isOpen ? 'Aberto' : 'Fechado'}
            </Text>
          </View>
        </View>
        
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={16} color="#F59E0B" />
          <Text style={styles.rating}>{item.rating}</Text>
          <Text style={styles.reviews}>({item.reviews})</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.discountContainer}>
          <Text style={styles.discountText}>{item.discount}</Text>
        </View>
        
        <Text style={styles.description}>{item.description}</Text>
        
        <View style={styles.addressContainer}>
          <Ionicons name="location" size={16} color="#6B7280" />
          <Text style={styles.address}>{item.address}</Text>
        </View>
        
        <View style={styles.distanceContainer}>
          <Ionicons name="walk" size={16} color="#6B7280" />
          <Text style={styles.distance}>
            {item.distance ? `${item.distance.toFixed(1)} km de distância` : 'Distância não calculada'}
          </Text>
        </View>

        <View style={styles.hoursContainer}>
          <Ionicons name="time" size={16} color="#6B7280" />
          <Text style={styles.hours}>{item.hours}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.mapButton]} 
          onPress={() => openInMaps(item)}
        >
          <Ionicons name="map" size={20} color="white" />
          <Text style={styles.actionButtonText}>Como chegar</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.callButton]} 
          onPress={() => callPartner(item.phone)}
        >
          <Ionicons name="call" size={20} color="white" />
          <Text style={styles.actionButtonText}>Ligar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCategoryFilter = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.categoryFilter}
    >
      {categories.map((category) => (
        <TouchableOpacity
          key={category}
          style={[
            styles.categoryButton,
            selectedCategory === category && styles.categoryButtonActive
          ]}
          onPress={() => setSelectedCategory(category)}
        >
          <Text style={[
            styles.categoryButtonText,
            selectedCategory === category && styles.categoryButtonTextActive
          ]}>
            {category}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSortOptions = () => (
    <View style={styles.sortContainer}>
      <Text style={styles.sortLabel}>Ordenar por:</Text>
      <TouchableOpacity
        style={[styles.sortButton, sortBy === 'distance' && styles.sortButtonActive]}
        onPress={() => setSortBy('distance')}
      >
        <Text style={[styles.sortButtonText, sortBy === 'distance' && styles.sortButtonTextActive]}>
          Distância
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.sortButton, sortBy === 'name' && styles.sortButtonActive]}
        onPress={() => setSortBy('name')}
      >
        <Text style={[styles.sortButtonText, sortBy === 'name' && styles.sortButtonTextActive]}>
          Nome
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.sortButton, sortBy === 'discount' && styles.sortButtonActive]}
        onPress={() => setSortBy('discount')}
      >
        <Text style={[styles.sortButtonText, sortBy === 'discount' && styles.sortButtonTextActive]}>
          Desconto
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Localizando parceiros próximos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parceiros Próximos</Text>
        <Text style={styles.headerSubtitle}>
          {userLocation ? 
            `Encontrados ${filteredPartners.length} parceiros` : 
            'Ative a localização para ver parceiros próximos'
          }
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, endereço ou CNPJ..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#6B7280"
          />
        </View>
      </View>

      {renderCategoryFilter()}
      {renderSortOptions()}

      <FlatList
        data={filteredPartners}
        renderItem={renderPartnerCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="business-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Nenhum parceiro encontrado</Text>
            <Text style={styles.emptySubtext}>
              Tente ajustar os filtros de busca
            </Text>
          </View>
        }
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
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
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
  searchContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
  },
  categoryFilter: {
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  sortContainer: {
    backgroundColor: 'white',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sortLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 12,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  sortButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: 'white',
  },
  listContainer: {
    padding: 16,
  },
  partnerCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  partnerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  partnerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  titleText: {
    marginLeft: 12,
    flex: 1,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  partnerCategory: {
    fontSize: 14,
    color: '#6B7280',
  },
  partnerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 4,
  },
  reviews: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  cardContent: {
    padding: 16,
  },
  discountContainer: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  discountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  distance: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    fontWeight: '500',
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hours: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
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
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
