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

const {width} = Dimensions.get('window');

export default function AnimalDetailScreen({route, navigation}) {
  const {animal} = route.params || {};
  const [isFavorite, setIsFavorite] = useState(false);

  // Safety check: if no animal data, go back
  useEffect(() => {
    if (!animal) {
      navigation.goBack();
    }
  }, [animal, navigation]);

  // Early return if no animal (prevents crash)
  if (!animal) {
    return null;
  }

  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitForm, setVisitForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    visitDate: '',
  });

  const handleAdopt = () => {
    setShowVisitModal(true);
  };

  const handleSubmitVisit = async () => {
    try {
      if (!visitForm.name || !visitForm.email) {
        Alert.alert('Erro', 'Nome e email são obrigatórios');
        return;
      }

      // Buscar token e dados do usuário logado (se houver)
      const token = await AsyncStorage.getItem('auth_token');
      const userData = await AsyncStorage.getItem('user_data');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || null;

      const response = await fetch(`${API_BASE_PATH}/adoptions/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          animalId: animalData.id,
          userId: userId,
          name: visitForm.name,
          email: visitForm.email,
          phone: visitForm.phone || null,
          message: visitForm.message || null,
          visitDate: visitForm.visitDate || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Sucesso!',
          data.message || 'Solicitação de visita registrada com sucesso! Um voluntário entrará em contato em breve.',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowVisitModal(false);
                setVisitForm({ name: '', email: '', phone: '', message: '', visitDate: '' });
              },
            },
          ],
        );
      } else {
        Alert.alert('Erro', data.error || 'Erro ao registrar solicitação');
      }
    } catch (error) {
      console.error('Erro ao registrar visita:', error);
      Alert.alert('Erro', 'Erro ao registrar solicitação. Tente novamente.');
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
              color={isFavorite ? '#EC4899' : '#FFFFFF'}
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
                color={animalData.gender === 'Macho' ? '#3B82F6' : '#EC4899'}
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
              <Ionicons name="information-circle" size={20} color="#8B5CF6" />
              <Text style={styles.rescueInfoText}>
                Resgatado em{' '}
                {new Date(animalData.rescueDate).toLocaleDateString('pt-BR')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Adopt Button (Fixed) */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.adoptButton} onPress={handleAdopt}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
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
              <Text style={styles.modalTitle}>Agendar Visita</Text>
              <TouchableOpacity onPress={() => setShowVisitModal(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalSubtitle}>
                Preencha os dados abaixo para agendar uma visita e conhecer {animalData.name}!
              </Text>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nome Completo *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="Seu nome"
                  value={visitForm.name}
                  onChangeText={(text) => setVisitForm({...visitForm, name: text})}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="seu@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={visitForm.email}
                  onChangeText={(text) => setVisitForm({...visitForm, email: text})}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Telefone</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="(14) 99999-9999"
                  keyboardType="phone-pad"
                  value={visitForm.phone}
                  onChangeText={(text) => setVisitForm({...visitForm, phone: text})}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Data Sugerida para Visita</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="DD/MM/AAAA"
                  value={visitForm.visitDate}
                  onChangeText={(text) => setVisitForm({...visitForm, visitDate: text})}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mensagem (opcional)</Text>
                <TextInput
                  style={[styles.formInput, {height: 100, textAlignVertical: 'top'}]}
                  placeholder="Conte-nos um pouco sobre você e sua família..."
                  multiline
                  value={visitForm.message}
                  onChangeText={(text) => setVisitForm({...visitForm, message: text})}
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
                style={styles.modalSubmitButton}
                onPress={handleSubmitVisit}>
                <Text style={styles.modalSubmitText}>Enviar Solicitação</Text>
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
    backgroundColor: '#FFFFFF',
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
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  breed: {
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
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  description: {
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
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
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
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
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
    fontWeight: '600',
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
    fontWeight: '700',
    color: '#1F2937',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  formInput: {
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
    fontWeight: '600',
    color: '#6B7280',
  },
  modalSubmitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
