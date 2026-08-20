import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  PermissionsAndroid,
  RefreshControl,
} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_PATH } from '../config/apiConfig';

const deg2rad = deg => deg * (Math.PI / 180);

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Raio da Terra em km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function PartnersScreen({navigation, route}) {
  const [partners, setPartners] = useState([]);
  const [filteredPartners, setFilteredPartners] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Se vier filtro via route params, usar ele, senão 'all'
  const filterFromRoute = route?.params?.filter || route?.params?.initialCategory;
  const resolvedInitialCategory =
    filterFromRoute === 'veterinario' ||
    filterFromRoute === 'veterinária' ||
    filterFromRoute === 'veterinaria'
      ? 'veterinária'
      : 'all';
  const [selectedCategory, setSelectedCategory] = useState(resolvedInitialCategory);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    const nextFilter = route?.params?.filter || route?.params?.initialCategory;
    if (
      nextFilter === 'veterinario' ||
      nextFilter === 'veterinária' ||
      nextFilter === 'veterinaria'
    ) {
      setSelectedCategory('veterinária');
    }
  }, [route?.params?.filter, route?.params?.initialCategory]);

  const requestLocationPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Permissão de Localização',
            message:
              'A Liga do Bem utiliza sua localização para mostrar parceiros próximos.',
            buttonPositive: 'Permitir',
            buttonNegative: 'Negar',
          },
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Permissão de localização negada');
          return;
        }
      } else {
        const status = await Geolocation.requestAuthorization('whenInUse');
        if (status !== 'granted') {
          console.log('Permissão de localização negada');
          return;
        }
      }

      Geolocation.getCurrentPosition(
        position => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        error => {
          console.error('Erro ao obter localização:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
    } catch (error) {
      console.error('Erro ao solicitar permissão de localização:', error);
    }
  }, []);

  const loadPartners = useCallback(async () => {
    try {
      console.log('🔄 Carregando parceiros da API...');
      console.log('🔗 URL:', `${API_BASE_PATH}/partners`);

      const response = await fetch(`${API_BASE_PATH}/partners`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const apiData = await response.json();
      const apiPartners = apiData.partners || [];
      console.log('✅ Parceiros carregados:', apiPartners.length);

      // Converter dados da API para formato esperado pelo app
      const formattedPartners = apiPartners.map(partner => ({
        id: partner.id,
        name: partner.name,
        category: partner.category,
        discount: partner.discount || 'Sem desconto',
        description: partner.description || 'Parceiro da Liga do Bem',
        address: partner.address || `${partner.city || ''}${partner.state ? ` - ${partner.state}` : ''}`.trim(),
        phone: partner.phone,
        whatsapp: partner.phone?.replace(/\D/g, ''), // Remove caracteres não numéricos
        latitude: partner.latitude,
        longitude: partner.longitude,
        hours: partner.hours || 'Seg-Sex: 09:00-18:00 | Sáb: 09:00-13:00',
        logo: partner.logo || null,
      }));

      setPartners(formattedPartners);
      setFilteredPartners(formattedPartners);
    } catch (error) {
      console.error('❌ Erro ao carregar parceiros:', error);

      // Fallback para dados mockados em caso de erro
      const fallbackPartners = [
        {
          id: 'fallback-1',
          name: 'Pet Shop Central',
          category: 'Pet Shop',
          discount: '15%',
          description: 'Desconto em rações, acessórios e produtos veterinários',
          address: 'Rua Amando de Barros, 1234 - Centro, Botucatu - SP',
          phone: '(14) 3811-1234',
          whatsapp: '14981234567',
          latitude: -22.8858,
          longitude: -48.445,
          hours: 'Seg-Sex: 09:00-18:00 | Sáb: 09:00-13:00',
          logo: null,
        },
      ];

      setPartners(fallbackPartners);
      setFilteredPartners(fallbackPartners);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const filterPartners = useCallback(() => {
    let filtered = partners;

    if (searchQuery) {
      filtered = filtered.filter(
        partner =>
          partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          partner.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          partner.address.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(
        partner =>
          partner.category.toLowerCase() === selectedCategory.toLowerCase(),
      );
    }

    // Ordenar por distância se tivermos a localização do usuário
    if (userLocation) {
      filtered = filtered
        .map(partner => ({
          ...partner,
          distance: calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            partner.latitude,
            partner.longitude,
          ),
        }))
        .sort((a, b) => a.distance - b.distance);
    }

    setFilteredPartners(filtered);
  }, [partners, searchQuery, selectedCategory, userLocation]);

  useEffect(() => {
    requestLocationPermission();
    loadPartners();
  }, [requestLocationPermission, loadPartners]);

  useEffect(() => {
    filterPartners();
  }, [filterPartners]);

  const openMaps = partner => {
    const address = encodeURIComponent(partner.address);
    const url = Platform.select({
      ios: `maps:0,0?q=${address}`,
      android: `geo:0,0?q=${address}`,
    });
    Linking.openURL(url);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPartners();
  };

  const categories = [
    {id: 'all', label: 'Todos', icon: 'apps'},
    {id: 'pet shop', label: 'Pet Shop', icon: 'basket'},
    {id: 'veterinária', label: 'Veterinária', icon: 'medical'},
    {id: 'estética', label: 'Estética', icon: 'cut'},
  ];

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar parceiros..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}>
          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.filterButton,
                selectedCategory === category.id && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedCategory(category.id)}>
              <Ionicons
                name={category.icon}
                size={18}
                color={selectedCategory === category.id ? '#FFFFFF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.filterText,
                  selectedCategory === category.id && styles.filterTextActive,
                ]}>
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Partners List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {filteredPartners.map(partner => (
          <TouchableOpacity
            key={partner.id}
            style={styles.partnerCard}
            onPress={() => navigation.navigate('PartnerDetail', {partner})}>
            <LinearGradient
              colors={['#8B5CF6', '#7C3AED']}
              style={styles.discountBadge}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}>
              <Text style={styles.discountText}>{partner.discount}</Text>
            </LinearGradient>

            <View style={styles.partnerInfo}>
              <Text style={styles.partnerName}>{partner.name}</Text>
              <View style={styles.partnerMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="pricetag" size={14} color="#8B5CF6" />
                  <Text style={styles.metaText}>{partner.category}</Text>
                </View>
                {partner.distance && (
                  <View style={styles.metaItem}>
                    <Ionicons name="location" size={14} color="#10B981" />
                    <Text style={styles.metaText}>
                      {partner.distance.toFixed(1)} km
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.partnerAddress} numberOfLines={1}>
                {partner.address}
              </Text>
            </View>

            <View style={styles.partnerActions}>
              <TouchableOpacity
                style={styles.actionIcon}
                onPress={e => {
                  e.stopPropagation();
                  openMaps(partner);
                }}>
                <Ionicons name="navigate" size={20} color="#8B5CF6" />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </View>
          </TouchableOpacity>
        ))}

        {filteredPartners.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhum parceiro encontrado</Text>
            <Text style={styles.emptyText}>
              Tente ajustar os filtros ou buscar por outro termo
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 8,
  },
  filtersContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
    height: 36,
  },
  filterButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
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
  discountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  partnerMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  partnerAddress: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  partnerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F3FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
