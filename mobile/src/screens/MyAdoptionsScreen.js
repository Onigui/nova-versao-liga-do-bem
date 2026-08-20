import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useAuth} from '../services/AuthService';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MyAdoptionsScreen({navigation}) {
  const {user} = useAuth();
  const [adoptions, setAdoptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadAdoptions();
  }, []);

  const loadAdoptions = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_PATH}/user/adoptions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAdoptions(data.adoptions || []);
        setTotal(data.total || 0);
      } else {
        console.error('Erro ao carregar adoções:', response.status);
      }
    } catch (error) {
      console.error('Erro ao carregar adoções:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAdoptions();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return '#10B981';
      case 'APPROVED':
        return '#3B82F6';
      case 'PENDING':
        return '#F59E0B';
      case 'REJECTED':
        return '#EF4444';
      case 'CANCELLED':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'Concluída';
      case 'APPROVED':
        return 'Aprovada';
      case 'PENDING':
        return 'Pendente';
      case 'REJECTED':
        return 'Rejeitada';
      case 'CANCELLED':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'checkmark-circle';
      case 'APPROVED':
        return 'checkmark';
      case 'PENDING':
        return 'time';
      case 'REJECTED':
        return 'close-circle';
      case 'CANCELLED':
        return 'ban';
      default:
        return 'help-circle';
    }
  };

  const getSpeciesLabel = (species) => {
    switch (species) {
      case 'DOG':
        return 'Cachorro';
      case 'CAT':
        return 'Gato';
      case 'BIRD':
        return 'Pássaro';
      case 'RABBIT':
        return 'Coelho';
      case 'OTHER':
        return 'Outro';
      default:
        return species;
    }
  };

  const getSpeciesIcon = (species) => {
    switch (species) {
      case 'DOG':
        return '🐕';
      case 'CAT':
        return '🐈';
      case 'BIRD':
        return '🐦';
      case 'RABBIT':
        return '🐰';
      default:
        return '🐾';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Minhas Adoções</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Carregando adoções...</Text>
        </View>
      </View>
    );
  }

  const completedAdoptions = adoptions.filter(a => a.status === 'COMPLETED').length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Minhas Adoções</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total de Solicitações</Text>
            <Text style={styles.summaryValue}>{adoptions.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Adoções Concluídas</Text>
            <Text style={styles.summaryValue}>{completedAdoptions}</Text>
          </View>
        </View>

        {/* Adoptions List */}
        {adoptions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="paw-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Nenhuma adoção encontrada</Text>
            <Text style={styles.emptySubtitle}>
              Suas solicitações de adoção aparecerão aqui
            </Text>
            <TouchableOpacity
              style={styles.adoptButton}
              onPress={() => navigation.navigate('Adoptions')}>
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED']}
                style={styles.adoptButtonGradient}>
                <Ionicons name="paw" size={20} color="#FFFFFF" />
                <Text style={styles.adoptButtonText}>Ver Animais para Adoção</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.adoptionsList}>
            {adoptions.map((adoption) => (
              <TouchableOpacity
                key={adoption.id}
                style={styles.adoptionCard}
                onPress={() => {
                  if (adoption.animal) {
                    navigation.navigate('AnimalDetail', {
                      animalId: adoption.animal.id,
                      animal: {
                        id: adoption.animal.id,
                        name: adoption.animal.name,
                        species:
                          adoption.animal.species === 'DOG'
                            ? 'Cachorro'
                            : adoption.animal.species === 'CAT'
                              ? 'Gato'
                              : adoption.animal.species || 'Animal',
                        breed: adoption.animal.breed || 'Vira-Lata',
                        photo: adoption.animal.image,
                        photos: adoption.animal.image
                          ? [adoption.animal.image]
                          : [],
                      },
                    });
                  }
                }}>
                {/* Animal Image */}
                {adoption.animal?.image ? (
                  <Image
                    source={{uri: adoption.animal.image}}
                    style={styles.animalImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.animalImagePlaceholder}>
                    <Text style={styles.animalImageEmoji}>
                      {getSpeciesIcon(adoption.animal?.species)}
                    </Text>
                  </View>
                )}

                <View style={styles.adoptionContent}>
                  <View style={styles.adoptionHeader}>
                    <View style={styles.adoptionInfo}>
                      <Text style={styles.animalName}>
                        {adoption.animal?.name || 'Animal'}
                      </Text>
                      <View style={styles.animalDetails}>
                        <Text style={styles.animalSpecies}>
                          {getSpeciesLabel(adoption.animal?.species)}
                        </Text>
                        {adoption.animal?.breed && (
                          <>
                            <Text style={styles.animalDetailsSeparator}>•</Text>
                            <Text style={styles.animalBreed}>
                              {adoption.animal.breed}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {backgroundColor: getStatusColor(adoption.status) + '20'},
                      ]}>
                      <Ionicons
                        name={getStatusIcon(adoption.status)}
                        size={16}
                        color={getStatusColor(adoption.status)}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          {color: getStatusColor(adoption.status)},
                        ]}>
                        {getStatusLabel(adoption.status)}
                      </Text>
                    </View>
                  </View>

                  {adoption.notes && (
                    <Text style={styles.adoptionNotes} numberOfLines={2}>
                      {adoption.notes}
                    </Text>
                  )}

                  <View style={styles.adoptionFooter}>
                    <View style={styles.adoptionDate}>
                      <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                      <Text style={styles.adoptionDateText}>
                        Solicitado em {formatDate(adoption.applicationDate)}
                      </Text>
                    </View>
                    {adoption.approvedDate && (
                      <View style={styles.adoptionDate}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#6B7280" />
                        <Text style={styles.adoptionDateText}>
                          Aprovado em {formatDate(adoption.approvedDate)}
                        </Text>
                      </View>
                    )}
                    {adoption.completedDate && (
                      <View style={styles.adoptionDate}>
                        <Ionicons name="star-outline" size={14} color="#6B7280" />
                        <Text style={styles.adoptionDateText}>
                          Concluído em {formatDate(adoption.completedDate)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },
  backButton: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 14,
  },
  content: {
    padding: 24,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  adoptButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  adoptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  adoptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  adoptionsList: {
    gap: 16,
  },
  adoptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  animalImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
  },
  animalImagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animalImageEmoji: {
    fontSize: 64,
  },
  adoptionContent: {
    padding: 16,
  },
  adoptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  adoptionInfo: {
    flex: 1,
    marginRight: 12,
  },
  animalName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  animalDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  animalSpecies: {
    fontSize: 14,
    color: '#6B7280',
  },
  animalDetailsSeparator: {
    fontSize: 14,
    color: '#9CA3AF',
    marginHorizontal: 6,
  },
  animalBreed: {
    fontSize: 14,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  adoptionNotes: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  adoptionFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  adoptionDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adoptionDateText: {
    fontSize: 12,
    color: '#6B7280',
  },
});

