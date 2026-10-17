import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {F} from '../theme/home';
import {calendarDate, daysUntil, formatBR} from '../utils/dates';

const CATEGORY_LABEL = {VACCINE: 'Vacina', DEWORMER: 'Vermífugo', ANTIPARASITIC: 'Antipulgas/carrapatos'};

/** Situação da próxima dose: atrasada, em breve ou em dia. */
export function doseStatus(nextDoseDate, now = Date.now()) {
  if (!nextDoseDate) return null;
  const days = daysUntil(nextDoseDate, now);
  if (days < 0) return {tone: 'late', label: `Atrasada há ${-days} dia${days === -1 ? '' : 's'}`};
  if (days === 0) return {tone: 'soon', label: 'É hoje'};
  if (days <= 30) return {tone: 'soon', label: `Faltam ${days} dia${days === 1 ? '' : 's'}`};
  return {tone: 'ok', label: 'Em dia'};
}

/** Só o registro mais recente de cada vacina conta para "próxima dose". */
export function latestByName(list) {
  const seen = new Set();
  return list.filter(v => {
    const k = String(v.vaccineName || '').toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default function VaccinationCardScreen({navigation, route}) {
  const {petId} = route.params || {};
  const [pet, setPet] = useState(null);
  const [vaccinations, setVaccinations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState(null);
  const [photoFor, setPhotoFor] = useState(null);

  useEffect(() => {
    if (petId) {
      loadPetData();
    }
  }, [petId]);

  const loadPetData = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;
      setAuthToken(token);

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
    return formatBR(dateString);
  };

  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const birth = calendarDate(birthDate);
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

  const shareCard = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const r = await fetch(`${API_BASE_PATH}/user/pets/${petId}/share`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Não foi possível gerar o link');
      setPet(p => (p ? {...p, share: {url: data.url}} : p));
      await Share.share({
        message: `Carteira de vacinação de ${pet?.name || 'meu pet'} (Liga do Bem): ${data.url}`,
      });
    } catch (e) {
      if (e?.message !== 'User did not share') Alert.alert('Compartilhar', e.message);
    }
  }, [petId, pet?.name]);

  const stopSharing = useCallback(() => {
    Alert.alert('Desativar o link?', 'Quem recebeu o link antigo não vai mais conseguir abrir a carteira.', [
      {text: 'Cancelar', style: 'cancel'},
      {
        text: 'Desativar',
        style: 'destructive',
        onPress: async () => {
          const token = await AsyncStorage.getItem('auth_token');
          await fetch(`${API_BASE_PATH}/user/pets/${petId}/share`, {
            method: 'DELETE',
            headers: {Authorization: `Bearer ${token}`},
          }).catch(() => {});
          setPet(p => (p ? {...p, share: null} : p));
        },
      },
    ]);
  }, [petId]);

  const handleDeleteVaccination = (vaccination) => {
    Alert.alert(
      'Confirmar exclusão',
      vaccination.isVerified
        ? `${vaccination.vaccineName} foi carimbada pelo veterinário. Se excluir, o registro sai da carteira e só a clínica pode carimbar de novo. Excluir mesmo assim?`
        : `Tem certeza que deseja excluir a vacinação de ${vaccination.vaccineName}?`,
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
        <ActivityIndicator size="large" color="#6D28D9" />
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
      <LinearGradient colors={['#3B1A78', '#5B21B6']} style={styles.header}>
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
                    <Ionicons name="paw" size={32} color="#6D28D9" />
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

            {/* Resumo */}
            {vaccinations.length ? (
              <View style={styles.summaryRow} testID="resumo-carteira">
                <View style={styles.summaryPill}>
                  <Ionicons name="ribbon" size={14} color="#047857" />
                  <Text style={styles.summaryText}>
                    {vaccinations.filter(v => v.isVerified).length} carimbada(s) por veterinário
                  </Text>
                </View>
                {(() => {
                  const pending = latestByName(vaccinations)
                    .filter(v => v.nextDoseDate)
                    .sort((a, b) => calendarDate(a.nextDoseDate) - calendarDate(b.nextDoseDate))[0];
                  if (!pending) return null;
                  const st = doseStatus(pending.nextDoseDate);
                  return (
                    <View style={[styles.summaryPill, st.tone === 'late' && styles.pillLate, st.tone === 'soon' && styles.pillSoon]}>
                      <Ionicons name="calendar" size={14} color={st.tone === 'late' ? '#B91C1C' : st.tone === 'soon' ? '#B45309' : '#047857'} />
                      <Text style={[styles.summaryText, st.tone === 'late' && {color: '#B91C1C'}, st.tone === 'soon' && {color: '#B45309'}]}>
                        Próxima: {pending.vaccineName} em {formatDate(pending.nextDoseDate)}
                      </Text>
                    </View>
                  );
                })()}
              </View>
            ) : null}

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
                  <View
                    key={vaccination.id}
                    style={[styles.vaccinationStamp, vaccination.isVerified && styles.vaccinationStamped]}
                    testID={vaccination.isVerified ? 'registro-carimbado' : 'registro-tutor'}>
                    <View style={styles.stampHeader}>
                      <View style={styles.stampIcon}>
                        <Ionicons
                          name={vaccination.isVerified ? 'ribbon' : 'checkmark-circle-outline'}
                          size={32}
                          color={vaccination.isVerified ? '#047857' : '#9CA3AF'}
                        />
                      </View>
                      <View style={styles.stampInfo}>
                        <Text style={styles.stampVaccineName}>{vaccination.vaccineName}</Text>
                        <Text style={styles.stampVaccineType}>
                          {CATEGORY_LABEL[vaccination.category] || 'Vacina'}
                          {vaccination.vaccineType ? ` · ${vaccination.vaccineType}` : ''}
                          {vaccination.manufacturer ? ` · ${vaccination.manufacturer}` : ''}
                        </Text>
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
                            {(() => {
                              if (latestByName(vaccinations).find(v => v.id === vaccination.id) == null) return ' · já aplicada';
                              const st = doseStatus(vaccination.nextDoseDate);
                              return st ? ` · ${st.label}` : '';
                            })()}
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
                          <Ionicons name="shield-checkmark" size={16} color="#047857" />
                          <Text style={styles.verifiedText}>
                            CARIMBADA pelo veterinário parceiro
                            {vaccination.correctedAt ? ' · corrigida pela clínica' : ''}
                          </Text>
                        </View>
                      )}
                      {vaccination.hasLabelPhoto && (
                        <TouchableOpacity onPress={() => setPhotoFor(vaccination)} style={styles.stampDetailRow} testID="ver-selo">
                          <Ionicons name="image-outline" size={16} color="#7C3AED" />
                          <Text style={[styles.stampDetailText, {color: '#7C3AED', fontWeight: '600'}]}>Ver foto do selo</Text>
                        </TouchableOpacity>
                      )}
                      {!vaccination.isVerified && (
                        <Text style={styles.selfNote}>Informada por você · não conferida por veterinário</Text>
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

        <TouchableOpacity
          style={styles.addVaccinationButton}
          onPress={() => navigation.navigate('PetHealth', {petId})}
          testID="historico-saude">
          <LinearGradient colors={['#2563EB', '#7C3AED']} style={styles.addVaccinationButtonGradient}>
            <Ionicons name="pulse" size={24} color="#FFFFFF" />
            <Text style={styles.addVaccinationButtonText}>Histórico de saúde (consultas, exames, peso)</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Carimbo pelo veterinário e compartilhamento */}
        <TouchableOpacity
          style={styles.addVaccinationButton}
          onPress={() => navigation.navigate('PetQr', {petId, petName: pet.name})}
          testID="mostrar-veterinario">
          <LinearGradient colors={['#7C3AED', '#0D9488']} style={styles.addVaccinationButtonGradient}>
            <Ionicons name="qr-code" size={24} color="#FFFFFF" />
            <Text style={styles.addVaccinationButtonText}>Mostrar ao veterinário (carimbar)</Text>
          </LinearGradient>
        </TouchableOpacity>
        <View style={styles.shareRow}>
          <TouchableOpacity style={styles.shareButton} onPress={shareCard} testID="compartilhar-carteira">
            <Ionicons name="share-social" size={20} color="#7C3AED" />
            <Text style={styles.shareText}>Compartilhar carteira</Text>
          </TouchableOpacity>
          {pet.share ? (
            <TouchableOpacity style={styles.shareButton} onPress={stopSharing} testID="desativar-link">
              <Ionicons name="link" size={20} color="#6B7280" />
              <Text style={[styles.shareText, {color: '#6B7280'}]}>Desativar link</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.shareHint}>
          O link abre a carteira atualizada, com os carimbos e o CRMV: serve para hotel, creche, viagem ou outro veterinário.
        </Text>

        {/* Botão Adicionar Vacinação */}
        <TouchableOpacity
          style={styles.addVaccinationButton}
          onPress={() => navigation.navigate('AddVaccination', {petId, onSave: loadPetData})}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.addVaccinationButtonGradient}>
            <Ionicons name="add-circle" size={24} color="#FFFFFF" />
            <Text style={styles.addVaccinationButtonText}>Registrar por conta própria</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={!!photoFor} transparent animationType="fade" onRequestClose={() => setPhotoFor(null)}>
        <TouchableOpacity style={styles.photoBackdrop} activeOpacity={1} onPress={() => setPhotoFor(null)}>
          {photoFor ? (
            <Image
              source={{
                uri: `${API_BASE_PATH}/user/pets/${petId}/vaccinations/${photoFor.id}/photo`,
                headers: {Authorization: `Bearer ${authToken}`},
              }}
              style={styles.photoFull}
              resizeMode="contain"
            />
          ) : null}
          <Text style={styles.photoCaption}>Selo de {photoFor?.vaccineName} · toque para fechar</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F5FB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F5FB',
  },
  loadingText: {
    ...F.regular,
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
    ...F.semibold,
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6D28D9',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    ...F.semibold,
    color: '#FFFFFF',
  },
  header: {
    paddingTop: 14,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
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
    borderColor: '#6D28D9',
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
    borderColor: '#6D28D9',
  },
  petInfoCard: {
    flex: 1,
  },
  petNameCard: {
    fontSize: 24,
    ...F.bold,
    color: '#111827',
    marginBottom: 4,
  },
  petDetailsCard: {
    ...F.regular,
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  petAdditionalInfo: {
    ...F.regular,
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  microchipText: {
    ...F.regular,
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  petNotesText: {
    ...F.regular,
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
    ...F.bold,
    color: '#111827',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardSubtitle: {
    ...F.regular,
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
    ...F.semibold,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyVaccinationsSubtext: {
    ...F.regular,
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
    ...F.bold,
    color: '#111827',
    marginBottom: 2,
  },
  stampVaccineType: {
    ...F.regular,
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
    ...F.regular,
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  vaccinationStamped: {
    borderStyle: 'solid',
    borderColor: '#6EE7B7',
    backgroundColor: '#F0FDF4',
  },
  selfNote: {
    ...F.regular, fontSize: 12, color: '#9CA3AF', marginTop: 4},
  summaryRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, justifyContent: 'center'},
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillLate: {backgroundColor: '#FEE2E2'},
  pillSoon: {backgroundColor: '#FEF3C7'},
  summaryText: {fontSize: 12, ...F.bold, color: '#047857'},
  shareRow: {flexDirection: 'row', gap: 10, marginBottom: 6},
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
  },
  shareText: {fontSize: 14, ...F.bold, color: '#7C3AED'},
  shareHint: {
    ...F.regular, fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 16},
  photoBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 16},
  photoFull: {width: '100%', height: '75%'},
  photoCaption: {color: '#FFFFFF', marginTop: 12},
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
    ...F.heavy,
    color: '#047857',
    flex: 1,
  },
  stampNotes: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  stampNotesText: {
    ...F.regular,
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
    ...F.semibold,
    color: '#FFFFFF',
  },
});

