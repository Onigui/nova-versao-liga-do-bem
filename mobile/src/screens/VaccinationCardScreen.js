import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function VaccinationCardScreen({navigation, route}) {
  const {petId} = route.params || {};
  const [pet, setPet] = useState(null);
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (petId) {
      loadPetData();
    }
  }, [petId]);

  const loadPetData = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_BASE_PATH}/user/pets/${petId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPet(data.pet);
        setVaccinations(data.pet.vaccinations || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do pet:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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

  const handleDeleteVaccination = (vaccination) => {
    Alert.alert(
      'Confirmar exclusão',
      `Tem certeza que deseja excluir a vacinação de ${vaccination.vaccineName}?`,
      [
        {text: 'Cancelar', style: 'cancel'},
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');
              if (!token) return;

              const response = await fetch(
                `${API_BASE_PATH}/user/pets/${petId}/vaccinations/${vaccination.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                },
              );

              if (response.ok) {
                Alert.alert('Sucesso', 'Vacinação excluída com sucesso');
                loadPetData();
              } else {
                Alert.alert('Erro', 'Não foi possível excluir a vacinação');
              }
            } catch (error) {
              Alert.alert('Erro', 'Erro ao excluir vacinação');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Carregando carteirinha...</Text>
      </View>
    );
  }

  if (!pet) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Pet não encontrado</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonHeader}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => navigation.navigate('AddPet', {pet, onSave: loadPetData})}>
          <Ionicons name="create-outline" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Carteirinha de Vacinação */}
        <View style={styles.cardContainer}>
          <LinearGradient
            colors={['#FFFFFF', '#F9FAFB']}
            style={styles.vaccinationCard}>
            {/* Header da Carteirinha */}
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderLeft}>
                {pet.photo ? (
                  <Image source={{uri: pet.photo}} style={styles.petPhotoCard} />
                ) : (
                  <View style={styles.petPhotoPlaceholderCard}>
                    <Ionicons name="paw" size={32} color="#8B5CF6" />
                  </View>
                )}
                <View style={styles.petInfoCard}>
                  <Text style={styles.petNameCard}>{pet.name}</Text>
                  <Text style={styles.petDetailsCard}>
                    {pet.species}
                    {pet.breed && ` • ${pet.breed}`}
                    {pet.birthDate && ` • ${calculateAge(pet.birthDate)}`}
                  </Text>
                  {(pet.gender || pet.color || pet.weight) && (
                    <Text style={styles.petAdditionalInfo}>
                      {pet.gender && `${pet.gender}`}
                      {pet.gender && pet.color && ` • `}
                      {pet.color && `${pet.color}`}
                      {pet.weight && (pet.gender || pet.color) && ` • `}
                      {pet.weight && `${pet.weight} kg`}
                    </Text>
                  )}
                  {pet.microchip && (
                    <Text style={styles.microchipText}>Microchip: {pet.microchip}</Text>
                  )}
                  {pet.notes && (
                    <Text style={styles.petNotesText} numberOfLines={2}>
                      {pet.notes}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.cardBadge}>
                <Ionicons name="medical" size={24} color="#10B981" />
              </View>
            </View>

            {/* Título */}
            <View style={styles.cardTitleSection}>
              <Text style={styles.cardTitle}>CARTEIRA DE VACINAÇÃO</Text>
              <Text style={styles.cardSubtitle}>Liga do Bem - Botucatu</Text>
            </View>

            {/* Lista de Vacinações */}
            <View style={styles.vaccinationsList}>
              {vaccinations.length === 0 ? (
                <View style={styles.emptyVaccinations}>
                  <Ionicons name="medical-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.emptyVaccinationsText}>
                    Nenhuma vacinação registrada
                  </Text>
                  <Text style={styles.emptyVaccinationsSubtext}>
                    Toque no botão abaixo para adicionar a primeira vacinação
                  </Text>
                </View>
              ) : (
                vaccinations.map((vaccination, index) => (
                  <View key={vaccination.id} style={styles.vaccinationStamp}>
                    <View style={styles.stampHeader}>
                      <View style={styles.stampIcon}>
                        <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                      </View>
                      <View style={styles.stampInfo}>
                        <Text style={styles.stampVaccineName}>{vaccination.vaccineName}</Text>
                        {vaccination.vaccineType && (
                          <Text style={styles.stampVaccineType}>{vaccination.vaccineType}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteVaccination(vaccination)}>
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.stampDetails}>
                      <View style={styles.stampDetailRow}>
                        <Ionicons name="calendar" size={16} color="#6B7280" />
                        <Text style={styles.stampDetailText}>
                          Aplicada em: {formatDate(vaccination.applicationDate)}
                        </Text>
                      </View>
                      {vaccination.nextDoseDate && (
                        <View style={styles.stampDetailRow}>
                          <Ionicons name="calendar-outline" size={16} color="#F59E0B" />
                          <Text style={styles.stampDetailText}>
                            Próxima dose: {formatDate(vaccination.nextDoseDate)}
                          </Text>
                        </View>
                      )}
                      {vaccination.batchNumber && (
                        <View style={styles.stampDetailRow}>
                          <Ionicons name="barcode" size={16} color="#6B7280" />
                          <Text style={styles.stampDetailText}>
                            Lote: {vaccination.batchNumber}
                          </Text>
                        </View>
                      )}
                      {vaccination.veterinarian && (
                        <View style={styles.stampDetailRow}>
                          <Ionicons name="person" size={16} color="#6B7280" />
                          <Text style={styles.stampDetailText}>
                            Veterinário: {vaccination.veterinarian}
                            {vaccination.veterinarianCRMV && ` - CRMV: ${vaccination.veterinarianCRMV}`}
                          </Text>
                        </View>
                      )}
                      {vaccination.clinicName && (
                        <View style={styles.stampDetailRow}>
                          <Ionicons name="business" size={16} color="#6B7280" />
                          <Text style={styles.stampDetailText}>
                            Clínica: {vaccination.clinicName}
                          </Text>
                        </View>
                      )}
                      {vaccination.isVerified && (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                          <Text style={styles.verifiedText}>
                            Verificado por veterinário parceiro
                          </Text>
                        </View>
                      )}
                      {vaccination.notes && (
                        <View style={styles.stampNotes}>
                          <Text style={styles.stampNotesText}>{vaccination.notes}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Botão Adicionar Vacinação */}
        <TouchableOpacity
          style={styles.addVaccinationButton}
          onPress={() => navigation.navigate('AddVaccination', {petId, onSave: loadPetData})}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.addVaccinationButtonGradient}>
            <Ionicons name="add-circle" size={24} color="#FFFFFF" />
            <Text style={styles.addVaccinationButtonText}>Adicionar Vacinação</Text>
          </LinearGradient>
        </TouchableOpacity>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButtonHeader: {
    padding: 8,
  },
  editButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  cardContainer: {
    marginBottom: 20,
  },
  vaccinationCard: {
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#E5E7EB',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  petPhotoCard: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
    borderWidth: 3,
    borderColor: '#8B5CF6',
  },
  petPhotoPlaceholderCard: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 3,
    borderColor: '#8B5CF6',
  },
  petInfoCard: {
    flex: 1,
  },
  petNameCard: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  petDetailsCard: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  petAdditionalInfo: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  microchipText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  petNotesText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  cardBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitleSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  vaccinationsList: {
    gap: 16,
  },
  emptyVaccinations: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyVaccinationsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyVaccinationsSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  vaccinationStamp: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  stampHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stampIcon: {
    marginRight: 12,
  },
  stampInfo: {
    flex: 1,
  },
  stampVaccineName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 2,
  },
  stampVaccineType: {
    fontSize: 14,
    color: '#6B7280',
  },
  deleteButton: {
    padding: 8,
  },
  stampDetails: {
    gap: 8,
  },
  stampDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stampDetailText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  stampNotes: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  stampNotesText: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  addVaccinationButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  addVaccinationButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  addVaccinationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

