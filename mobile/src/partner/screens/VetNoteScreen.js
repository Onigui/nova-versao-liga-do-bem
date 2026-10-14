/**
 * Veterinário registra (ou corrige em até 24 h) um atendimento no histórico de saúde do pet.
 */
import React, {useState} from 'react';
import {Alert, ScrollView, Text} from 'react-native';
import HealthEntryForm from '../../components/HealthEntryForm';
import {COLORS, usePartner} from '../PartnerContext';
import {Card, styles as ui} from '../ui';

export default function VetNoteScreen({route, navigation}) {
  const {api} = usePartner();
  const {visitId, pet, entry} = route?.params || {};
  const [saving, setSaving] = useState(false);

  const save = async body => {
    setSaving(true);
    try {
      if (entry) await api('PUT', `/partner/health/${entry.id}`, body);
      else await api('POST', `/partner/pets/visits/${visitId}/history`, body);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Não foi possível salvar', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Card style={{backgroundColor: COLORS.primarySoft, borderColor: '#99F6E4'}}>
        <Text style={{fontWeight: '800', color: COLORS.primaryDark}}>
          {entry ? 'Corrigir registro' : `Atendimento de ${pet?.name || 'o pet'}`}
        </Text>
        <Text style={{color: COLORS.primaryDark, fontSize: 13, marginTop: 4}}>
          Entra no histórico do pet com o seu nome e CRMV, e o tutor é avisado. Dá para corrigir em até 24 h.
        </Text>
      </Card>
      <HealthEntryForm mode="VET" initial={entry} color={COLORS.primary} onSubmit={save} saving={saving} submitLabel={entry ? 'Salvar correção' : 'Registrar atendimento'} />
    </ScrollView>
  );
}
