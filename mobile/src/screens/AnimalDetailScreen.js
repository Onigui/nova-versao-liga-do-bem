import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
  TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_PATH } from '../config/apiConfig';
import {useAuth} from '../services/AuthService';
import DateField from '../components/DateField';
import {F} from '../theme/home';
import {formatBR} from '../utils/dates';
import {formatPhone} from '../utils/lostfound';

const {width} = Dimensions.get('window');

const EMPTY_FORM = {name: '', email: '', phone: '', message: '', visitDate: null, period: ''};
export const VISIT_PERIODS = ['Manhã', 'Tarde', 'Noite'];

function useAuthSafe() {
  try {
    return useAuth() || {};
  } catch {
    return {};
  }
}

/** Monta o pedido de adoção (dados da conta + o que o membro completou). */
export function buildAdoptionRequest(form, animalId) {
  const name = String(form.name || '').trim();
  const email = String(form.email || '').trim().toLowerCase();
  const phone = String(form.phone || '').replace(/\D/g, '');
  if (name.length < 3) return {error: 'Informe seu nome completo.'};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {error: 'Informe um e-mail válido.'};
  if (phone.length < 10) return {error: 'Informe um telefone com DDD para o voluntário falar com você.'};
  return {
    body: {
      animalId,
      name,
      email,
      phone,
      visitDate: form.visitDate ? formatBR(form.visitDate) : null,
      period: form.period || null,
      message: String(form.message || '').trim() || null,
    },
  };
}

export default function AnimalDetailScreen({route, navigation}) {
  const initialAnimal = route.params?.animal || null;
  const animalId = route.params?.animalId || initialAnimal?.id;
  const [animal, setAnimal] = useState(initialAnimal);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loadingAnimal, setLoadingAnimal] = useState(!initialAnimal && !!animalId);
  const {user} = useAuthSafe();
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [editContact, setEditContact] = useState(false);
  const [sending, setSending] = useState(false);
  const [visitForm, setVisitForm] = useState(EMPTY_FORM);

  useEffect(() => {
    const loadAnimal = async () => {
      if (animal || !animalId) return;
      try {
        const response = await fetch(`${API_BASE_PATH}/animals/${animalId}`);
        const data = await response.json().catch(() => ({}));
        if (response.ok && data.animal) {
          setAnimal(data.animal);
        }
      } catch {
        // silencioso
      } finally {
        setLoadingAnimal(false);
      }
    };
    loadAnimal();
  }, [animal, animalId]);

  useEffect(() => {
    if (!loadingAnimal && !animal) {
      navigation.goBack();
    }
  }, [animal, loadingAnimal, navigation]);

  if (loadingAnimal) {
    return null;
  }

  // Early return if no animal (prevents crash)
  if (!animal) {
    return null;
  }

  const handleAdopt = () => {
    // Já vem com os dados da conta; o membro só confere e completa
    setVisitForm(f => ({
      ...f,
      name: f.name || user?.name || '',
      email: f.email || user?.email || '',
      phone: f.phone || formatPhone(user?.phone || ''),
    }));
    setEditContact(!(user?.name && user?.email && user?.phone));
    setShowVisitModal(true);
  };

  const handleSubmitVisit = async () => {
    const built = buildAdoptionRequest(visitForm, animalData.id);
    if (built.error) {
      setEditContact(true);
      Alert.alert('Confira seus dados', built.error);
      return;
    }
    setSending(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_PATH}/adoptions/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && {Authorization: `Bearer ${token}`}),
        },
        body: JSON.stringify(built.body),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setShowVisitModal(false);
        setVisitForm(f => ({...EMPTY_FORM, name: f.name, email: f.email, phone: f.phone}));
        Alert.alert(
          'Pedido enviado! 🐾',
          data.message || 'Um voluntário da Liga vai entrar em contato para combinar a visita.',
        );
      } else {
        Alert.alert('Erro', data.error || 'Erro ao registrar solicitação');
      }
    } catch (error) {
      Alert.alert('Erro', 'Sem conexão. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  // Merge animal data with defaults, handling missing fields
  const animalData = {
    id: animal?.id || '1',
    name: animal?.name || 'Animal',
    species: animal?.species || 'Cachorro',
    breed: animal?.breed || 'Vira-Lata',
    age: animal?.age || 'N/A',
    gender: animal?.gender || 'Macho',
    size: animal?.size || 'Médio',
    color: animal?.color || 'Não informado',
    vaccinated: animal?.vaccinated || false,
    neutered: animal?.neutered || false,
    description: animal?.description || 'Este animal está procurando um lar cheio de amor!',
    // Handle both 'photo' (singular) and 'photos' (array)
    photos: animal?.photos || (animal?.photo ? [animal.photo] : [
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400',
    ]),
    adoptionDate: animal?.adoptionDate || null,
    rescueDate: animal?.rescueDate || new Date().toISOString().split('T')[0],
    hasSpecialNeeds: animal?.hasSpecialNeeds || false,
    specialNeeds: animal?.specialNeeds || null,
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          <Image
            source={{uri: animalData.photos && animalData.photos.length > 0 ? animalData.photos[0] : 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'}}
            style={styles.mainImage}
            resizeMode="cover"
            onError={(error) => {
              console.log('Erro ao carregar imagem:', error);
            }}
          />
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => setIsFavorite(!isFavorite)}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? '#6D28D9' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Title Section */}
          <View style={styles.titleSection}>
            <View>
              <Text style={styles.name}>{animalData.name}</Text>
              <Text style={styles.breed}>
                {animalData.breed} • {animalData.age}
              </Text>
            </View>
            <View style={styles.genderBadge}>
              <Ionicons
                name={animalData.gender === 'Macho' ? 'male' : 'female'}
                size={20}
                color={animalData.gender === 'Macho' ? '#3B82F6' : '#6D28D9'}
              />
            </View>
          </View>

          {/* Quick Info */}
          <View style={styles.quickInfo}>
            <View style={styles.quickInfoItem}>
              <Ionicons name="resize-outline" size={18} color="#6B7280" />
              <Text style={styles.quickInfoText}>{animalData.size}</Text>
            </View>
            <View style={styles.quickInfoItem}>
              <Ionicons
                name="color-palette-outline"
                size={18}
                color="#6B7280"
              />
              <Text style={styles.quickInfoText}>{animalData.color}</Text>
            </View>
            {animalData.vaccinated && (
              <View style={styles.quickInfoItem}>
                <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                <Text style={[styles.quickInfoText, {color: '#10B981'}]}>
                  Vacinado
                </Text>
              </View>
            )}
            {animalData.neutered && (
              <View style={styles.quickInfoItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={[styles.quickInfoText, {color: '#10B981'}]}>
                  Castrado
                </Text>
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sobre {animalData.name}</Text>
            <Text style={styles.description}>{animalData.description}</Text>
          </View>

          {/* Special Needs */}
          {animalData.hasSpecialNeeds && animalData.specialNeeds && (
            <View style={styles.section}>
              <View style={styles.specialNeedsHeader}>
                <Ionicons name="medical-outline" size={20} color="#EF4444" />
                <Text style={styles.sectionTitle}>Necessidades Especiais</Text>
              </View>
              <View style={styles.specialNeedsBox}>
                <Text style={styles.specialNeedsText}>{animalData.specialNeeds}</Text>
              </View>
            </View>
          )}

          {/* Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informações</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Espécie</Text>
                <Text style={styles.detailValue}>{animalData.species}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Raça</Text>
                <Text style={styles.detailValue}>{animalData.breed}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Idade</Text>
                <Text style={styles.detailValue}>{animalData.age}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Porte</Text>
                <Text style={styles.detailValue}>{animalData.size}</Text>
              </View>
            </View>
          </View>

          {/* Rescue Info */}
          {animalData.rescueDate && (
            <View style={styles.rescueInfo}>
              <Ionicons name="information-circle" size={20} color="#6D28D9" />
              <Text style={styles.rescueInfoText}>
                Resgatado em{' '}
                {formatBR(animalData.rescueDate)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Adopt Button (Fixed) */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.adoptButton} onPress={handleAdopt}>
          <LinearGradient
            colors={['#6D28D9', '#5B21B6']}
            style={styles.adoptButtonGradient}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}>
            <Ionicons
              name="heart"
              size={20}
              color="#FFFFFF"
              style={{marginRight: 8}}
            />
            <Text style={styles.adoptButtonText}>Quero Adotar!</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Visit Modal */}
      <Modal
        visible={showVisitModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowVisitModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Quero adotar {animalData.name}</Text>
              <TouchableOpacity onPress={() => setShowVisitModal(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                Já preenchemos com os dados da sua conta. Confira e complete o que falta para conhecer {animalData.name}!
              </Text>

              <View style={styles.contactCard} testID="adocao-meus-dados">
                <View style={styles.contactHead}>
                  <Text style={styles.contactTitle}>Seus dados</Text>
                  {!editContact ? (
                    <TouchableOpacity onPress={() => setEditContact(true)} testID="adocao-editar-dados">
                      <Text style={styles.contactEdit}>Editar</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                {editContact ? (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Nome completo *</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="Seu nome"
                        value={visitForm.name}
                        onChangeText={text => setVisitForm({...visitForm, name: text})}
                        testID="adocao-nome"
                      />
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>E-mail *</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="seu@email.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={visitForm.email}
                        onChangeText={text => setVisitForm({...visitForm, email: text})}
                        testID="adocao-email"
                      />
                    </View>
                    <View style={[styles.formGroup, {marginBottom: 0}]}>
                      <Text style={styles.formLabel}>Telefone / WhatsApp *</Text>
                      <TextInput
                        style={styles.formInput}
                        placeholder="(14) 99999-9999"
                        keyboardType="phone-pad"
                        value={visitForm.phone}
                        onChangeText={text => setVisitForm({...visitForm, phone: formatPhone(text)})}
                        testID="adocao-telefone"
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.contactLine}>
                      <Ionicons name="person-outline" size={14} color="#6B7280" /> {visitForm.name}
                    </Text>
                    <Text style={styles.contactLine}>
                      <Ionicons name="mail-outline" size={14} color="#6B7280" /> {visitForm.email}
                    </Text>
                    <Text style={styles.contactLine}>
                      <Ionicons name="call-outline" size={14} color="#6B7280" /> {visitForm.phone}
                    </Text>
                  </>
                )}
              </View>

              <Text style={styles.stepTitle}>Falta só isso</Text>
              <DateField
                label="Melhor dia para a visita"
                labelStyle={styles.formLabel}
                style={styles.formGroup}
                value={visitForm.visitDate}
                onChange={d => setVisitForm({...visitForm, visitDate: d})}
                minDate={new Date()}
                maxDate={new Date(Date.now() + 90 * 864e5)}
                optional
                placeholder="Toque para escolher (opcional)"
                testID="adocao-data"
              />
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Melhor período</Text>
                <View style={{flexDirection: 'row', gap: 8}}>
                  {VISIT_PERIODS.map(p => {
                    const on = visitForm.period === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        onPress={() => setVisitForm({...visitForm, period: on ? '' : p})}
                        style={[styles.periodChip, on && styles.periodChipOn]}
                        testID={`adocao-periodo-${p}`}>
                        <Text style={[styles.periodText, on && {color: '#FFFFFF'}]}>{p}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Conte um pouco sobre você (opcional)</Text>
                <TextInput
                  style={[styles.formInput, {height: 100, textAlignVertical: 'top'}]}
                  placeholder="Ex.: moro em casa com quintal, já tenho um gato, trabalho de casa…"
                  multiline
                  value={visitForm.message}
                  onChangeText={text => setVisitForm({...visitForm, message: text})}
                  testID="adocao-mensagem"
                />
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowVisitModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, sending && {opacity: 0.6}]}
                disabled={sending}
                onPress={handleSubmitVisit}
                testID="adocao-enviar">
                <Text style={styles.modalSubmitText}>{sending ? 'Enviando…' : 'Confirmar pedido'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F5FB',
  },
  imageContainer: {
    position: 'relative',
  },
  mainImage: {
    width: width,
    height: 400,
    backgroundColor: '#F3F4F6',
  },
  favoriteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  titleSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  name: {
    fontSize: 28,
    ...F.bold,
    color: '#1F2937',
    marginBottom: 4,
  },
  breed: {
    ...F.regular,
    fontSize: 16,
    color: '#6B7280',
  },
  genderBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  quickInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  quickInfoText: {
    fontSize: 13,
    color: '#6B7280',
    ...F.semibold,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    ...F.semibold,
    color: '#1F2937',
    marginBottom: 12,
  },
  description: {
    ...F.regular,
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 24,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    width: (width - 72) / 2,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  detailLabel: {
    ...F.regular,
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    ...F.semibold,
    color: '#1F2937',
  },
  rescueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 80,
  },
  rescueInfoText: {
    ...F.regular,
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
  specialNeedsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  specialNeedsBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 16,
    borderRadius: 12,
  },
  specialNeedsText: {
    ...F.regular,
    fontSize: 15,
    color: '#1F2937',
    lineHeight: 24,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    padding: 16,
  },
  adoptButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  adoptButtonGradient: {
    flexDirection: 'row',
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adoptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    ...F.semibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    ...F.bold,
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
    maxHeight: 520,
  },
  modalSubtitle: {
    ...F.regular,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  contactCard: {backgroundColor: '#F5F3FF', borderRadius: 14, padding: 14, marginBottom: 18},
  contactHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6},
  contactTitle: {fontSize: 13, ...F.heavy, color: '#5B21B6', textTransform: 'uppercase', letterSpacing: 0.4},
  contactEdit: {fontSize: 14, ...F.bold, color: '#6D28D9'},
  contactLine: {fontSize: 15, ...F.regular, color: '#1F2937', marginTop: 4},
  stepTitle: {fontSize: 16, ...F.bold, color: '#1F2937', marginBottom: 10},
  periodChip: {flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF'},
  periodChipOn: {backgroundColor: '#6D28D9', borderColor: '#6D28D9'},
  periodText: {fontSize: 14, ...F.semibold, color: '#374151'},
  formLabel: {
    fontSize: 14,
    ...F.semibold,
    color: '#1F2937',
    marginBottom: 8,
  },
  formInput: {
    ...F.regular,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    ...F.semibold,
    color: '#6B7280',
  },
  modalSubmitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#6D28D9',
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 16,
    ...F.semibold,
    color: '#FFFFFF',
  },
});
