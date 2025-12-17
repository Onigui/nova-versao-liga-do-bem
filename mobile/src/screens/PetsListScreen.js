import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../services/AuthService';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PetsListScreen({navigation}) {
  const {user, isAuthenticated} = useAuth();
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadPets();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadPets = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_PATH}/user/pets`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPets(data.pets || []);
      }
    } catch (error) {
      console.error('Erro ao carregar pets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPets();
  }, []);

  const handleDeletePet = (pet) => {
    Alert.alert(
      'Confirmar exclusão',
      `Tem certeza que deseja excluir ${pet.name}? Todas as vacinações também serão excluídas.`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');
              if (!token) return;

              const response = await fetch(`${API_BASE_PATH}/user/pets/${pet.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                Alert.alert('Sucesso', 'Pet excluído com sucesso');
                loadPets();
              } else {
                Alert.alert('Erro', 'Não foi possível excluir o pet');
              }
            } catch (error) {
              Alert.alert('Erro', 'Erro ao excluir pet');
            }
          },
        },
      ],
    );
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    const years = today.getFullYear() - birth.getFullYear();
    const months = today.getMonth() - birth.getMonth();
    if (months < 0) {
      return `${years - 1} anos`;
    }
    if (years === 0) {
      return `${months} meses`;
    }
    return `${years} anos`;
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.loginPromptContainer}>
          <Ionicons name="paw" size={64} color="#FFFFFF" />
          <Text style={styles.loginPromptTitle}>Cartão de Vacinas</Text>
          <Text style={styles.loginPromptText}>
            Faça login para gerenciar os cartões de vacinação dos seus pets
          </Text>
          <TouchableOpacity
            style={styles.loginPromptButton}
            onPress={() => navigation.navigate('Auth')}>
            <Text style={styles.loginPromptButtonText}>Fazer Login</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Carregando pets...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meus Pets</Text>
        <Text style={styles.headerSubtitle}>Gerencie os cartões de vacinação</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}>
        {pets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="paw-outline" size={80} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhum pet cadastrado</Text>
            <Text style={styles.emptyText}>
              Adicione seu primeiro pet para começar a gerenciar o cartão de vacinação
            </Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigation.navigate('AddPet', {onSave: loadPets})}>
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.addButtonGradient}>
                <Ionicons name="add" size={24} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Adicionar Pet</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.addPetCard}
              onPress={() => navigation.navigate('AddPet', {onSave: loadPets})}>
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.addPetCardGradient}>
                <Ionicons name="add-circle" size={32} color="#FFFFFF" />
                <Text style={styles.addPetCardText}>Adicionar Novo Pet</Text>
              </LinearGradient>
            </TouchableOpacity>

            {pets.map((pet) => (
              <TouchableOpacity
                key={pet.id}
                style={styles.petCard}
                onPress={() => navigation.navigate('VaccinationCard', {petId: pet.id})}
                onLongPress={() => handleDeletePet(pet)}>
                <View style={styles.petCardContent}>
                  {pet.photo ? (
                    <Image source={{uri: pet.photo}} style={styles.petPhoto} />
                  ) : (
                    <View style={styles.petPhotoPlaceholder}>
                      <Ionicons name="paw" size={40} color="#8B5CF6" />
                    </View>
                  )}
                  <View style={styles.petInfo}>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petDetails}>
                      {pet.species}
                      {pet.breed && ` • ${pet.breed}`}
                      {pet.birthDate && ` • ${calculateAge(pet.birthDate)}`}
                    </Text>
                    <View style={styles.vaccinationBadge}>
                      <Ionicons name="medical" size={16} color="#10B981" />
                      <Text style={styles.vaccinationCount}>
                        {pet.vaccinations?.length || 0} vacinações
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
          </>
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
  loginPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loginPromptTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 8,
  },
  loginPromptText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    marginBottom: 32,
  },
  loginPromptButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  loginPromptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 40,
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addPetCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  addPetCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  addPetCardText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  petCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  petCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  petPhoto: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 16,
  },
  petPhotoPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  petInfo: {
    flex: 1,
  },
  petName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  petDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  vaccinationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vaccinationCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
  },
});

