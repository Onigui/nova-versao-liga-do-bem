import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  RefreshControl,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_PATH } from '../config/apiConfig';

const API_BASE_URL = API_BASE_PATH;

export default function AdoptionsScreen({navigation}) {
  const [animals, setAnimals] = useState([]);
  const [filteredAnimals, setFilteredAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    loadAnimals();
  }, []);

  useEffect(() => {
    filterAnimals();
  }, [searchQuery, selectedFilter, animals]);

  const loadAnimals = async () => {
    try {
      console.log('🔄 Carregando animais da API...');
      const response = await fetch(`${API_BASE_PATH}/animals`);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }

      const apiData = await response.json();
      const apiAnimals = apiData.animals || [];
      console.log('✅ Animais carregados:', apiAnimals.length);

      // Converter dados da API para formato esperado pelo app
      const formattedAnimals = apiAnimals.map(animal => ({
        id: animal.id,
        name: animal.name,
        species: animal.species,
        breed: animal.breed || 'Vira-Lata',
        age: animal.age,
        gender: animal.gender,
        size: animal.size,
        photo: animal.photo || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400',
        photos: animal.photos || [animal.photo || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'],
        vaccinated: animal.vaccinated || false,
        neutered: animal.neutered || false,
        description: animal.description || 'Este animal está procurando um lar cheio de amor!',
        color: animal.color || 'Não informado',
        rescueDate: animal.rescueDate || new Date().toISOString().split('T')[0],
        hasSpecialNeeds: animal.hasSpecialNeeds || false,
        specialNeeds: animal.specialNeeds || null,
      }));

      setAnimals(formattedAnimals);
      setFilteredAnimals(formattedAnimals);
    } catch (error) {
      console.error('❌ Erro ao carregar animais:', error);
      
      // Fallback para dados mockados em caso de erro
      const fallbackAnimals = [
        {
          id: 'fallback-1',
          name: 'Rex',
          species: 'Cachorro',
          breed: 'Vira-Lata',
          age: '2 anos',
          gender: 'Macho',
          size: 'Médio',
          photo: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400',
          photos: ['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'],
          vaccinated: true,
          neutered: true,
          description: 'Rex é um cachorro muito carinhoso e brincalhão.',
          color: 'Caramelo',
          rescueDate: new Date().toISOString().split('T')[0],
        },
      ];
      setAnimals(fallbackAnimals);
      setFilteredAnimals(fallbackAnimals);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterAnimals = () => {
    let filtered = animals;

    if (searchQuery) {
      filtered = filtered.filter(
        animal =>
          animal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          animal.breed.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    if (selectedFilter !== 'all') {
      filtered = filtered.filter(
        animal => animal.species.toLowerCase() === selectedFilter.toLowerCase(),
      );
    }

    setFilteredAnimals(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnimals();
  };

  const filters = [
    {id: 'all', label: 'Todos', icon: 'apps'},
    {id: 'cachorro', label: 'Cachorros', icon: 'paw'},
    {id: 'gato', label: 'Gatos', icon: 'paw'},
  ];

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome ou raça..."
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
          {filters.map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterButton,
                selectedFilter === filter.id && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter(filter.id)}>
              <Ionicons
                name={filter.icon}
                size={18}
                color={selectedFilter === filter.id ? '#FFFFFF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === filter.id && styles.filterTextActive,
                ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Animals List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <View style={styles.grid}>
          {filteredAnimals.map(animal => (
            <TouchableOpacity
              key={animal.id}
              style={styles.animalCard}
              onPress={() => navigation.navigate('AnimalDetail', {animal})}>
              <Image
                source={{uri: animal.photo}}
                style={styles.animalPhoto}
                resizeMode="cover"
              />

              {/* Badges */}
              <View style={styles.badges}>
                {animal.vaccinated && (
                  <View style={[styles.badge, {backgroundColor: '#10B981'}]}>
                    <Ionicons
                      name="shield-checkmark"
                      size={12}
                      color="#FFFFFF"
                    />
                  </View>
                )}
                {animal.neutered && (
                  <View style={[styles.badge, {backgroundColor: '#3B82F6'}]}>
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color="#FFFFFF"
                    />
                  </View>
                )}
              </View>

              <View style={styles.animalInfo}>
                <Text style={styles.animalName}>{animal.name}</Text>
                <Text style={styles.animalBreed}>{animal.breed}</Text>
                <View style={styles.animalMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color="#6B7280" />
                    <Text style={styles.metaText}>{animal.age}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Ionicons
                      name={animal.gender === 'Macho' ? 'male' : 'female'}
                      size={14}
                      color={animal.gender === 'Macho' ? '#3B82F6' : '#EC4899'}
                    />
                    <Text style={styles.metaText}>{animal.gender}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.adoptButton}>
                  <Text style={styles.adoptButtonText}>Conhecer</Text>
                  <Ionicons name="arrow-forward" size={16} color="#8B5CF6" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {filteredAnimals.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhum animal encontrado</Text>
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
  grid: {
    padding: 16,
    paddingTop: 12,
    gap: 12,
  },
  animalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  animalPhoto: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
  },
  badges: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animalInfo: {
    padding: 16,
  },
  animalName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  animalBreed: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  animalMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
  },
  adoptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F3FF',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  adoptButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8B5CF6',
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
