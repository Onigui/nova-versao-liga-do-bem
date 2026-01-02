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
  Platform,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Função para formatar data para DD/MM/YYYY
const formatDateToPT = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Função para parsear data de DD/MM/YYYY
const parseDateFromPT = (dateString) => {
  if (!dateString || !dateString.trim()) {
    return null;
  }
  
  // Remove espaços e caracteres extras
  const cleaned = dateString.trim().replace(/[^\d]/g, '');
  
  // Se tiver 8 dígitos (DDMMYYYY), parsear
  if (cleaned.length === 8) {
    const day = parseInt(cleaned.substring(0, 2), 10);
    const month = parseInt(cleaned.substring(2, 4), 10) - 1; // Month é 0-indexed
    const year = parseInt(cleaned.substring(4, 8), 10);
    
    const date = new Date(year, month, day);
    
    // Validar se a data é válida
    if (
      date.getDate() === day &&
      date.getMonth() === month &&
      date.getFullYear() === year &&
      date.getTime() > 0
    ) {
      return date;
    }
  }
  
  // Tentar parsear formato ISO ou outro formato
  try {
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime()) && parsed.getTime() > 0) {
      return parsed;
    }
  } catch (e) {
    // Ignorar
  }
  
  return null;
};

export default function AddVaccinationScreen({navigation, route}) {
  const {petId, vaccination, onSave} = route.params || {};
  const isEditing = !!vaccination;

  const [vaccineName, setVaccineName] = useState(vaccination?.vaccineName || '');
  const [vaccineType, setVaccineType] = useState(vaccination?.vaccineType || '');
  const [applicationDate, setApplicationDate] = useState(() => {
    try {
      if (vaccination?.applicationDate) {
        const date = new Date(vaccination.applicationDate);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      return new Date();
    } catch (e) {
      return new Date();
    }
  });
  const [showApplicationDateModal, setShowApplicationDateModal] = useState(false);
  const [applicationDateInput, setApplicationDateInput] = useState('');
  
  const [nextDoseDate, setNextDoseDate] = useState(() => {
    try {
      if (vaccination?.nextDoseDate) {
        const date = new Date(vaccination.nextDoseDate);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });
  const [showNextDoseDateModal, setShowNextDoseDateModal] = useState(false);
  const [nextDoseDateInput, setNextDoseDateInput] = useState('');
  
  const [batchNumber, setBatchNumber] = useState(vaccination?.batchNumber || '');
  const [veterinarian, setVeterinarian] = useState(vaccination?.veterinarian || '');
  const [veterinarianCRMV, setVeterinarianCRMV] = useState(vaccination?.veterinarianCRMV || '');
  const [clinicName, setClinicName] = useState(vaccination?.clinicName || '');
  const [notes, setNotes] = useState(vaccination?.notes || '');
  const [saving, setSaving] = useState(false);

  // Inicializar inputs de data quando modal abrir
  useEffect(() => {
    if (showApplicationDateModal) {
      setApplicationDateInput(formatDateToPT(applicationDate));
    }
  }, [showApplicationDateModal]);

  useEffect(() => {
    if (showNextDoseDateModal) {
      setNextDoseDateInput(nextDoseDate ? formatDateToPT(nextDoseDate) : '');
    }
  }, [showNextDoseDateModal]);

  const handleApplicationDateConfirm = () => {
    const parsed = parseDateFromPT(applicationDateInput);
    if (parsed) {
      setApplicationDate(parsed);
      setShowApplicationDateModal(false);
    } else {
      Alert.alert('Data inválida', 'Por favor, insira uma data válida no formato DD/MM/AAAA');
    }
  };

  const handleNextDoseDateConfirm = () => {
    if (!nextDoseDateInput.trim()) {
      setNextDoseDate(null);
      setShowNextDoseDateModal(false);
      return;
    }
    
    const parsed = parseDateFromPT(nextDoseDateInput);
    if (parsed) {
      setNextDoseDate(parsed);
      setShowNextDoseDateModal(false);
    } else {
      Alert.alert('Data inválida', 'Por favor, insira uma data válida no formato DD/MM/AAAA');
    }
  };

  const handleSave = async () => {
    if (!vaccineName.trim() || !applicationDate) {
      Alert.alert('Erro', 'Nome da vacina e data de aplicação são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const vaccinationData = {
        vaccineName: vaccineName.trim(),
        vaccineType: vaccineType.trim() || null,
        applicationDate: applicationDate.toISOString().split('T')[0],
        nextDoseDate: nextDoseDate ? nextDoseDate.toISOString().split('T')[0] : null,
        batchNumber: batchNumber.trim() || null,
        veterinarian: veterinarian.trim() || null,
        veterinarianCRMV: veterinarianCRMV.trim() || null,
        clinicName: clinicName.trim() || null,
        notes: notes.trim() || null,
      };

      let url, method;
      if (isEditing) {
        url = `${API_BASE_PATH}/user/pets/${petId}/vaccinations/${vaccination.id}`;
        method = 'PUT';
      } else {
        url = `${API_BASE_PATH}/user/pets/${petId}/vaccinations`;
        method = 'POST';
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(vaccinationData),
      });

      if (response.ok) {
        Alert.alert(
          'Sucesso',
          isEditing ? 'Vacinação atualizada com sucesso!' : 'Vacinação adicionada com sucesso!',
        );
        if (onSave) {
          onSave();
        }
        navigation.goBack();
      } else {
        const error = await response.json();
        Alert.alert('Erro', error.error || 'Não foi possível salvar a vacinação');
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao salvar vacinação');
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
          {isEditing ? 'Editar Vacinação' : 'Adicionar Vacinação'}
        </Text>
        <View style={styles.placeholder} />
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nome da Vacina *</Text>
            <TextInput
              style={styles.input}
              value={vaccineName}
              onChangeText={setVaccineName}
              placeholder="Ex: V10, Antirrábica, etc."
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Tipo de Vacina</Text>
            <TextInput
              style={styles.input}
              value={vaccineType}
              onChangeText={setVaccineType}
              placeholder="Ex: Polivalente, Antirrábica, etc."
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Data de Aplicação *</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowApplicationDateModal(true)}>
              <Text style={styles.inputText}>
                {formatDateToPT(applicationDate)}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Próxima Dose</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowNextDoseDateModal(true)}>
              <Text style={nextDoseDate ? styles.inputText : styles.inputPlaceholder}>
                {nextDoseDate ? formatDateToPT(nextDoseDate) : 'Toque para selecionar a data'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Número do Lote</Text>
            <TextInput
              style={styles.input}
              value={batchNumber}
              onChangeText={setBatchNumber}
              placeholder="Número do lote da vacina"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Veterinário</Text>
            <TextInput
              style={styles.input}
              value={veterinarian}
              onChangeText={setVeterinarian}
              placeholder="Nome do veterinário"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>CRMV do Veterinário</Text>
            <TextInput
              style={styles.input}
              value={veterinarianCRMV}
              onChangeText={setVeterinarianCRMV}
              placeholder="CRMV (ex: SP-12345)"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Clínica</Text>
            <TextInput
              style={styles.input}
              value={clinicName}
              onChangeText={setClinicName}
              placeholder="Nome da clínica veterinária"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observações sobre a vacinação"
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
            colors={['#10B981', '#059669']}
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

      {/* Modal para Data de Aplicação */}
      <Modal
        visible={showApplicationDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowApplicationDateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Data de Aplicação</Text>
            <Text style={styles.modalSubtitle}>Digite a data no formato DD/MM/AAAA</Text>
            
            <TextInput
              style={styles.modalInput}
              value={applicationDateInput}
              onChangeText={setApplicationDateInput}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={10}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowApplicationDateModal(false)}>
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleApplicationDateConfirm}>
                <Text style={styles.modalButtonConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Próxima Dose */}
      <Modal
        visible={showNextDoseDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowNextDoseDateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Próxima Dose</Text>
            <Text style={styles.modalSubtitle}>Digite a data no formato DD/MM/AAAA (ou deixe vazio)</Text>
            
            <TextInput
              style={styles.modalInput}
              value={nextDoseDateInput}
              onChangeText={setNextDoseDateInput}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              maxLength={10}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setShowNextDoseDateModal(false)}>
                <Text style={styles.modalButtonCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleNextDoseDateConfirm}>
                <Text style={styles.modalButtonConfirmText}>Confirmar</Text>
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
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
