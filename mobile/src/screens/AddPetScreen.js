import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {launchImageLibrary} from 'react-native-image-picker';
import {Calendar} from 'react-native-calendars';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const formatDateToPT = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const parseDateFromPT = (dateString) => {
  if (!dateString || !dateString.trim()) {
    return null;
  }

  const cleaned = dateString.trim().replace(/[^\d]/g, '');

  if (cleaned.length === 8) {
    const day = parseInt(cleaned.substring(0, 2), 10);
    const month = parseInt(cleaned.substring(2, 4), 10) - 1;
    const year = parseInt(cleaned.substring(4, 8), 10);
    const date = new Date(year, month, day);

    if (
      date.getDate() === day &&
      date.getMonth() === month &&
      date.getFullYear() === year &&
      date.getTime() > 0
    ) {
      return date;
    }
  }

  try {
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime()) && parsed.getTime() > 0) {
      return parsed;
    }
  } catch (e) {
    // ignorar
  }

  return null;
};

const formatDateForCalendar = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateFromCalendar = (dateString) => {
  if (!dateString) return null;
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  } catch (e) {
    // ignorar
  }
  return null;
};

const calendarTheme = {
  calendarBackground: '#FFFFFF',
  textSectionTitleColor: '#8B5CF6',
  selectedDayBackgroundColor: '#8B5CF6',
  selectedDayTextColor: '#FFFFFF',
  todayTextColor: '#8B5CF6',
  dayTextColor: '#111827',
  textDisabledColor: '#D1D5DB',
  dotColor: '#8B5CF6',
  selectedDotColor: '#FFFFFF',
  arrowColor: '#8B5CF6',
  monthTextColor: '#111827',
  textDayFontWeight: '500',
  textMonthFontWeight: 'bold',
  textDayHeaderFontWeight: '600',
  textDayFontSize: 16,
  textMonthFontSize: 18,
  textDayHeaderFontSize: 14,
};

export default function AddPetScreen({navigation, route}) {
  const {pet, onSave} = route.params || {};
  const isEditing = !!pet;

  const parsedInitialBirthDate = (() => {
    if (!pet?.birthDate) return null;
    const d = new Date(pet.birthDate);
    return isNaN(d.getTime()) ? null : d;
  })();

  const [name, setName] = useState(pet?.name || '');
  const [species, setSpecies] = useState(pet?.species || '');
  const [breed, setBreed] = useState(pet?.breed || '');
  const [birthDate, setBirthDate] = useState(parsedInitialBirthDate);
  const [showBirthDateModal, setShowBirthDateModal] = useState(false);
  const [birthDateInput, setBirthDateInput] = useState('');
  const [gender, setGender] = useState(pet?.gender || '');
  const [color, setColor] = useState(pet?.color || '');
  const [weight, setWeight] = useState(pet?.weight ? String(pet.weight) : '');
  const [microchip, setMicrochip] = useState(pet?.microchip || '');
  const [notes, setNotes] = useState(pet?.notes || '');
  const [photo, setPhoto] = useState(pet?.photo || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (showBirthDateModal) {
      setBirthDateInput(birthDate ? formatDateToPT(birthDate) : '');
    }
  }, [showBirthDateModal, birthDate]);

  const handleBirthDateSelect = (day) => {
    if (day?.dateString) {
      const selectedDate = parseDateFromCalendar(day.dateString);
      if (selectedDate) {
        setBirthDate(selectedDate);
        setShowBirthDateModal(false);
      }
    }
  };

  const handleBirthDateConfirm = () => {
    if (!birthDateInput.trim()) {
      setBirthDate(null);
      setShowBirthDateModal(false);
      return;
    }

    const parsed = parseDateFromPT(birthDateInput);
    if (parsed) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (parsed > today) {
        Alert.alert('Data inválida', 'A data de nascimento não pode ser no futuro');
        return;
      }
      setBirthDate(parsed);
      setShowBirthDateModal(false);
    } else {
      Alert.alert('Data inválida', 'Por favor, insira uma data válida no formato DD/MM/AAAA');
    }
  };

  const handleImagePicker = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.8,
      },
      async (response) => {
        if (response.didCancel || response.errorCode) {
          return;
        }

        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          if (asset.base64) {
            // Upload para o backend (similar ao avatar)
            try {
              const token = await AsyncStorage.getItem('auth_token');
              if (!token) return;

              const base64Data = asset.base64.startsWith('data:')
                ? asset.base64.split(',')[1]
                : asset.base64;

              const uploadResponse = await fetch(`${API_BASE_PATH}/user/avatar/upload`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({imageBase64: base64Data}),
              });

              if (uploadResponse.ok) {
                const data = await uploadResponse.json();
                setPhoto(data.avatarUrl);
              } else {
                // Se falhar, usar URI local temporariamente
                setPhoto(asset.uri);
              }
            } catch (error) {
              // Se falhar, usar URI local temporariamente
              setPhoto(asset.uri);
            }
          } else {
            setPhoto(asset.uri);
          }
        }
      },
    );
  };

  const handleSave = async () => {
    if (!name.trim() || !species.trim()) {
      Alert.alert('Erro', 'Nome e espécie são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const petData = {
        name: name.trim(),
        species: species.trim(),
        breed: breed.trim() || null,
        birthDate: birthDate ? formatDateForCalendar(birthDate) : null,
        gender: gender.trim() || null,
        color: color.trim() || null,
        weight: weight ? parseFloat(weight) : null,
        microchip: microchip.trim() || null,
        notes: notes.trim() || null,
        photo: photo || null,
      };

      const url = isEditing
        ? `${API_BASE_PATH}/user/pets/${pet.id}`
        : `${API_BASE_PATH}/user/pets`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(petData),
      });

      if (response.ok) {
        Alert.alert('Sucesso', isEditing ? 'Pet atualizado com sucesso!' : 'Pet adicionado com sucesso!');
        if (onSave) {
          onSave();
        }
        navigation.goBack();
      } else {
        const error = await response.json();
        Alert.alert('Erro', error.error || 'Não foi possível salvar o pet');
      }
    } catch (error) {
      console.error('Erro ao salvar pet:', error);
      Alert.alert('Erro', 'Erro ao salvar pet. Verifique sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Editar Pet' : 'Adicionar Pet'}
        </Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Foto do Pet */}
        <View style={styles.photoSection}>
          <TouchableOpacity style={styles.photoButton} onPress={handleImagePicker}>
            {photo ? (
              <Image source={{uri: photo}} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={40} color="#8B5CF6" />
                <Text style={styles.photoPlaceholderText}>Adicionar foto</Text>
              </View>
            )}
            <View style={styles.photoEditBadge}>
              <Ionicons name="create" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Formulário */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nome do pet"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Espécie *</Text>
            <TextInput
              style={styles.input}
              value={species}
              onChangeText={setSpecies}
              placeholder="Ex: Cão, Gato, etc."
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Raça</Text>
            <TextInput
              style={styles.input}
              value={breed}
              onChangeText={setBreed}
              placeholder="Raça do pet"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Data de Nascimento</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowBirthDateModal(true)}>
              <Text style={birthDate ? styles.inputText : styles.inputPlaceholder}>
                {birthDate
                  ? formatDateToPT(birthDate)
                  : 'Toque para selecionar a data'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Sexo</Text>
            <View style={styles.genderButtons}>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'Macho' && styles.genderButtonActive]}
                onPress={() => setGender('Macho')}>
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === 'Macho' && styles.genderButtonTextActive,
                  ]}>
                  Macho
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'Fêmea' && styles.genderButtonActive]}
                onPress={() => setGender('Fêmea')}>
                <Text
                  style={[
                    styles.genderButtonText,
                    gender === 'Fêmea' && styles.genderButtonTextActive,
                  ]}>
                  Fêmea
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Cor</Text>
            <TextInput
              style={styles.input}
              value={color}
              onChangeText={setColor}
              placeholder="Cor do pelo"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Peso (kg)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="0.0"
              keyboardType="decimal-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Microchip</Text>
            <TextInput
              style={styles.input}
              value={microchip}
              onChangeText={setMicrochip}
              placeholder="Número do microchip"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observações sobre o pet"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Botão Salvar */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}>
          <LinearGradient
            colors={['#8B5CF6', '#7C3AED']}
            style={styles.saveButtonGradient}>
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {isEditing ? 'Atualizar' : 'Salvar'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showBirthDateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBirthDateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Data de Nascimento</Text>
            <Text style={styles.modalSubtitle}>Selecione a data no calendário</Text>

            <Calendar
              onDayPress={handleBirthDateSelect}
              markedDates={
                birthDate
                  ? {
                      [formatDateForCalendar(birthDate)]: {
                        selected: true,
                        selectedColor: '#8B5CF6',
                        selectedTextColor: '#FFFFFF',
                      },
                    }
                  : {}
              }
              current={
                birthDate
                  ? formatDateForCalendar(birthDate)
                  : formatDateForCalendar(new Date())
              }
              minDate={formatDateForCalendar(new Date(1900, 0, 1))}
              maxDate={formatDateForCalendar(new Date())}
              monthFormat="MMMM yyyy"
              hideArrows={false}
              firstDay={1}
              enableSwipeMonths
              theme={calendarTheme}
              style={styles.calendar}
            />

            <View style={styles.modalInputContainer}>
              <Text style={styles.modalInputLabel}>Ou digite manualmente:</Text>
              <TextInput
                style={styles.modalInput}
                value={birthDateInput}
                onChangeText={setBirthDateInput}
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowBirthDateModal(false)}>
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleBirthDateConfirm}>
                <Text style={styles.modalButtonConfirmText}>Usar Data Digitada</Text>
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
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoButton: {
    position: 'relative',
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#8B5CF6',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#8B5CF6',
  },
  photoPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputText: {
    fontSize: 16,
    color: '#111827',
  },
  inputPlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  genderButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  genderButtonActive: {
    borderColor: '#8B5CF6',
    backgroundColor: '#F3F4F6',
  },
  genderButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  genderButtonTextActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  calendar: {
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  modalInputContainer: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  modalButton: {
    flex: 1,
    minWidth: 100,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonConfirm: {
    backgroundColor: '#8B5CF6',
  },
  modalButtonConfirmText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

