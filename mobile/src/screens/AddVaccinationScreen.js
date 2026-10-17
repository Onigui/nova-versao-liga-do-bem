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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import DateField from '../components/DateField';
import {calendarDate, toISODay} from '../utils/dates';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {F} from '../theme/home';

export default function AddVaccinationScreen({navigation, route}) {
  const {petId, vaccination, onSave} = route.params || {};
  const isEditing = !!vaccination;

  const [vaccineName, setVaccineName] = useState(vaccination?.vaccineName || '');
  const [vaccineType, setVaccineType] = useState(vaccination?.vaccineType || '');
  const [applicationDate, setApplicationDate] = useState(() => {
    try {
      if (vaccination?.applicationDate) {
        const date = calendarDate(vaccination.applicationDate);
        if (date) {
          return date;
        }
      }
      return new Date();
    } catch (e) {
      return new Date();
    }
  });
  
  const [nextDoseDate, setNextDoseDate] = useState(() => {
    try {
      if (vaccination?.nextDoseDate) {
        const date = calendarDate(vaccination.nextDoseDate);
        if (date) {
          return date;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  });
  
  const [batchNumber, setBatchNumber] = useState(vaccination?.batchNumber || '');
  const [veterinarian, setVeterinarian] = useState(vaccination?.veterinarian || '');
  const [veterinarianCRMV, setVeterinarianCRMV] = useState(vaccination?.veterinarianCRMV || '');
  const [clinicName, setClinicName] = useState(vaccination?.clinicName || '');
  const [notes, setNotes] = useState(vaccination?.notes || '');
  const [saving, setSaving] = useState(false);

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
        applicationDate: toISODay(applicationDate),
        nextDoseDate: nextDoseDate ? toISODay(nextDoseDate) : null,
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
      <LinearGradient colors={['#3B1A78', '#5B21B6']} style={styles.header}>
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
            <DateField
              label="Data de Aplicação *"
              labelStyle={styles.label}
              value={applicationDate}
              onChange={d => d && setApplicationDate(d)}
              minDate={new Date(2000, 0, 1)}
              maxDate={new Date()}
              testID="aplicacao"
            />
          </View>

          <View style={styles.inputGroup}>
            <DateField
              label="Próxima Dose"
              labelStyle={styles.label}
              value={nextDoseDate}
              onChange={setNextDoseDate}
              minDate={applicationDate}
              maxDate={new Date(new Date().getFullYear() + 5, 11, 31)}
              optional
              placeholder="Toque para escolher (opcional)"
              testID="proxima-dose"
            />
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F5FB',
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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    ...F.bold,
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
    ...F.semibold,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    ...F.regular,
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
    ...F.regular,
    fontSize: 16,
    color: '#111827',
  },
  inputPlaceholder: {
    ...F.regular,
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
    ...F.semibold,
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
    ...F.bold,
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    ...F.regular,
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
    ...F.regular,
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  modalInput: {
    ...F.regular,
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
    ...F.semibold,
    color: '#374151',
  },
  modalButtonConfirm: {
    backgroundColor: '#6D28D9',
  },
  modalButtonConfirmText: {
    fontSize: 14,
    ...F.semibold,
    color: '#FFFFFF',
  },
  modalButtonSecondary: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonSecondaryText: {
    fontSize: 14,
    ...F.semibold,
    color: '#6B7280',
  },
});
