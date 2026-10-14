/**
 * Tutor registra (ou corrige) algo no histórico de saúde do pet.
 */
import React, {useMemo, useState} from 'react';
import {Alert, ScrollView, Text, TouchableOpacity} from 'react-native';
import HealthEntryForm from '../components/HealthEntryForm';
import {memberApi} from '../utils/quotes';

export default function HealthEntryFormScreen({navigation, route, fetchImpl = fetch}) {
  const api = useMemo(() => memberApi(fetchImpl), [fetchImpl]);
  const {petId, entry} = route?.params || {};
  const [saving, setSaving] = useState(false);

  const save = async body => {
    setSaving(true);
    try {
      if (entry) await api('PUT', `/user/pets/${petId}/history/${entry.id}`, body);
      else await api('POST', `/user/pets/${petId}/history`, body);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Não foi possível salvar', e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    Alert.alert('Apagar registro?', 'Esta ação não pode ser desfeita.', [
      {text: 'Voltar', style: 'cancel'},
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api('DELETE', `/user/pets/${petId}/history/${entry.id}`);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Erro', e.message);
          }
        },
      },
    ]);

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#F9FAFB'}} contentContainerStyle={{padding: 16, paddingBottom: 40}} keyboardShouldPersistTaps="handled">
      <HealthEntryForm initial={entry} onSubmit={save} saving={saving} submitLabel={entry ? 'Salvar alterações' : 'Registrar'} />
      {entry ? (
        <TouchableOpacity onPress={remove} style={{alignSelf: 'center', marginTop: 18}} testID="apagar-registro">
          <Text style={{color: '#B91C1C', fontWeight: '600'}}>Apagar registro</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}
