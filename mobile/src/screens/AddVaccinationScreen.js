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
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_PATH } from '../config/apiConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logError, logInfo, captureError } from '../services/RemoteLogger';

export default function AddVaccinationScreen({navigation, route}) {
  const {petId, vaccination, onSave} = route.params || {};
  const isEditing = !!vaccination;

  const [vaccineName, setVaccineName] = useState(vaccination?.vaccineName || '');
  const [vaccineType, setVaccineType] = useState(vaccination?.vaccineType || '');
  const [applicationDate, setApplicationDate] = useState(
    vaccination?.applicationDate
      ? new Date(vaccination.applicationDate)
      : new Date(),
  );
  const [showApplicationDatePicker, setShowApplicationDatePicker] = useState(false);
  const [nextDoseDate, setNextDoseDate] = useState(
    vaccination?.nextDoseDate
      ? new Date(vaccination.nextDoseDate)
      : null,
  );
  const [showNextDoseDatePicker, setShowNextDoseDatePicker] = useState(false);
  const [batchNumber, setBatchNumber] = useState(vaccination?.batchNumber || '');
  const [veterinarian, setVeterinarian] = useState(vaccination?.veterinarian || '');
  const [veterinarianCRMV, setVeterinarianCRMV] = useState(vaccination?.veterinarianCRMV || '');
  const [clinicName, setClinicName] = useState(vaccination?.clinicName || '');
  const [notes, setNotes] = useState(vaccination?.notes || '');
  const [saving, setSaving] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  // Cleanup ao desmontar o componente
  useEffect(() => {
    return () => {
      setIsMounted(false);
    };
  }, []);

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
              onPress={() => {
                try {
                  logInfo('📅 Tentando abrir DateTimePicker - Data de Aplicação', {
                    currentDate: applicationDate?.toISOString(),
                    platform: Platform.OS,
                    platformVersion: Platform.Version,
                  });
                  setShowApplicationDatePicker(true);
                  logInfo('📅 DateTimePicker state atualizado para true');
                } catch (error) {
                  logError('❌ Erro ao tentar abrir DateTimePicker - Data de Aplicação', error);
                  captureError(error, { context: 'DateTimePicker - Data de Aplicação' });
                  Alert.alert('Erro', 'Não foi possível abrir o calendário. Tente novamente.');
                }
              }}>
              <Text style={styles.inputText}>
                {applicationDate.toLocaleDateString('pt-BR')}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
            </TouchableOpacity>
            {showApplicationDatePicker && (
              <DateTimePicker
                value={applicationDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  try {
                    logInfo('📅 DateTimePicker onChange - Data de Aplicação', {
                      eventType: event?.type,
                      hasSelectedDate: !!selectedDate,
                      selectedDate: selectedDate?.toISOString(),
                      platform: Platform.OS,
                    });
                    
                    // Fechar picker no Android após seleção
                    if (Platform.OS === 'android') {
                      setShowApplicationDatePicker(false);
                    }
                    // No iOS, manter aberto até cancelar
                    if (event.type === 'dismissed' && Platform.OS === 'ios') {
                      setShowApplicationDatePicker(false);
                    }
                    if (selectedDate) {
                      setApplicationDate(selectedDate);
                      logInfo('📅 Data de aplicação atualizada', { date: selectedDate.toISOString() });
                    }
                  } catch (error) {
                    logError('❌ Erro no onChange do DateTimePicker - Data de Aplicação', error);
                    captureError(error, { context: 'DateTimePicker onChange - Data de Aplicação' });
                    setShowApplicationDatePicker(false);
                  }
                }}
              />
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Próxima Dose</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                try {
                  logInfo('📅 Tentando abrir DateTimePicker - Próxima Dose', {
                    currentDate: nextDoseDate?.toISOString(),
                    applicationDate: applicationDate?.toISOString(),
                    platform: Platform.OS,
                    platformVersion: Platform.Version,
                  });
                  setShowNextDoseDatePicker(true);
                  logInfo('📅 DateTimePicker state atualizado para true (Próxima Dose)');
                } catch (error) {
                  logError('❌ Erro ao tentar abrir DateTimePicker - Próxima Dose', error);
                  captureError(error, { context: 'DateTimePicker - Próxima Dose' });
                  Alert.alert('Erro', 'Não foi possível abrir o calendário. Tente novamente.');
                }
              }}>
              <Text style={nextDoseDate ? styles.inputText : styles.inputPlaceholder}>
                {nextDoseDate
                  ? nextDoseDate.toLocaleDateString('pt-BR')
                  : 'Toque para selecionar a data'}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#8B5CF6" />
            </TouchableOpacity>
            {showNextDoseDatePicker && (
              <DateTimePicker
                value={nextDoseDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  try {
                    logInfo('📅 DateTimePicker onChange - Próxima Dose', {
                      eventType: event?.type,
                      hasSelectedDate: !!selectedDate,
                      selectedDate: selectedDate?.toISOString(),
                      platform: Platform.OS,
                    });
                    
                    // Fechar picker no Android após seleção
                    if (Platform.OS === 'android') {
                      setShowNextDoseDatePicker(false);
                    }
                    // No iOS, manter aberto até cancelar
                    if (event.type === 'dismissed' && Platform.OS === 'ios') {
                      setShowNextDoseDatePicker(false);
                    }
                    if (selectedDate) {
                      setNextDoseDate(selectedDate);
                      logInfo('📅 Data de próxima dose atualizada', { date: selectedDate.toISOString() });
                    }
                  } catch (error) {
                    logError('❌ Erro no onChange do DateTimePicker - Próxima Dose', error);
                    captureError(error, { context: 'DateTimePicker onChange - Próxima Dose' });
                    setShowNextDoseDatePicker(false);
                  }
                }}
              />
            )}
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
  helperText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
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
});

