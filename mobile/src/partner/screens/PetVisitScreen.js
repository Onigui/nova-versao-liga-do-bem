/**
 * Atendimento: o veterinário leu o QR do pet. Mostra o pet, se o tutor é membro ativo
 * (desconto) e a carteira; daqui ele carimba ou corrige carimbos recentes da clínica.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Image, Pressable, ScrollView, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, formatDateBR, usePartner} from '../PartnerContext';
import {Badge, Button, Card, styles as ui} from '../ui';
import {categoryLabel} from '../../utils/vaccineCatalog';

export function petAge(birthDate, now = Date.now()) {
  if (!birthDate) return null;
  const m = Math.floor((now - new Date(birthDate).getTime()) / (30.44 * 864e5));
  if (m < 0) return null;
  if (m < 12) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  const y = Math.floor(m / 12);
  return `${y} ${y === 1 ? 'ano' : 'anos'}`;
}

function RecordRow({r, onCorrect}) {
  return (
    <View style={{paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9'}} testID="registro">
      <View style={[ui.row, {justifyContent: 'space-between', gap: 8}]}>
        <Text style={{fontWeight: '700', color: COLORS.text, flex: 1}}>
          {r.vaccineName} <Text style={ui.muted}>· {categoryLabel(r.category)}</Text>
        </Text>
        {r.isVerified ? <Badge text="Carimbada" tone="ok" /> : <Badge text="Do tutor" tone="muted" />}
      </View>
      <Text style={[ui.muted, {fontSize: 13, marginTop: 2}]}>
        {formatDateBR(r.applicationDate)}
        {r.nextDoseDate ? ` · próxima ${formatDateBR(r.nextDoseDate)}` : ''}
        {r.isVerified && r.clinicName ? ` · ${r.clinicName}` : ''}
      </Text>
      {r.canCorrect ? (
        <Pressable onPress={() => onCorrect(r)} hitSlop={8} testID={`corrigir-${r.id}`}>
          <Text style={{color: COLORS.primary, fontWeight: '700', marginTop: 4}}>Corrigir (até 24 h)</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function PetVisitScreen({route, navigation}) {
  const {api} = usePartner();
  const code = route?.params?.code;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const lookup = useCallback(async () => {
    try {
      setData(await api('POST', '/partner/pets/lookup', {code}));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [api, code]);

  useEffect(() => {
    lookup();
  }, [lookup]);

  // Volta do formulário com o registro novo ou corrigido (ou anulado)
  const saved = route?.params?.saved;
  const removed = route?.params?.removed;
  useEffect(() => {
    if (!saved && !removed) return;
    setData(d => {
      if (!d) return d;
      let records = d.records.filter(r => r.id !== (saved?.id || removed));
      if (saved) records = [saved, ...records];
      return {...d, records};
    });
  }, [saved, removed]);

  if (error) {
    return (
      <View style={[ui.screen, {padding: 16}]}>
        <Card style={{alignItems: 'center', paddingVertical: 28}}>
          <Icon name="alert-circle" size={56} color={COLORS.bad} />
          <Text style={{fontSize: 16, color: COLORS.text, textAlign: 'center', marginTop: 10}} testID="erro-pet">
            {error}
          </Text>
          <Button
            title="Ler outro QR"
            onPress={() => navigation.replace('Scanner', {mode: 'pet'})}
            style={{alignSelf: 'stretch', marginTop: 16}}
          />
        </Card>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[ui.screen, {alignItems: 'center', justifyContent: 'center'}]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const {pet, owner, member, visitId, records} = data;
  const details = [pet.species, pet.breed, pet.gender, petAge(pet.birthDate), pet.weight ? `${pet.weight} kg` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}>
      <Card>
        <View style={[ui.row, {gap: 14}]}>
          {pet.photo ? (
            <Image source={{uri: pet.photo}} style={{width: 72, height: 72, borderRadius: 36}} />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: COLORS.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="paw" size={32} color={COLORS.primary} />
            </View>
          )}
          <View style={{flex: 1}}>
            <Text style={[ui.title, {fontSize: 22}]}>{pet.name}</Text>
            <Text style={ui.muted}>{details}</Text>
            <Text style={[ui.muted, {marginTop: 2}]}>Tutor(a): {owner.firstName}</Text>
            {pet.microchip ? <Text style={[ui.muted, {fontSize: 12}]}>Microchip {pet.microchip}</Text> : null}
          </View>
        </View>
        <View
          style={{
            marginTop: 12,
            borderRadius: 10,
            padding: 10,
            backgroundColor: member.active ? COLORS.okSoft : '#F1F5F9',
          }}
          testID="situacao-membro">
          <Text style={{fontWeight: '700', color: member.active ? COLORS.ok : COLORS.muted}}>
            {member.active ? `✓ Membro ativo (${member.memberId}) · aplique o desconto` : 'Não é membro pagante · sem desconto da Liga'}
          </Text>
        </View>
      </Card>

      <Button
        title="Carimbar vacina ou medicamento"
        icon={<Icon name="ribbon" size={22} color="#FFFFFF" />}
        onPress={() => navigation.navigate('StampForm', {visitId, pet})}
        style={{marginBottom: 12}}
        testID="carimbar"
      />

      <Card>
        <Text style={ui.sectionTitle}>Carteira de {pet.name}</Text>
        {records.length ? (
          records.map(r => (
            <RecordRow key={r.id} r={r} onCorrect={rec => navigation.navigate('StampForm', {visitId, pet, record: rec})} />
          ))
        ) : (
          <Text style={[ui.muted, {marginTop: 6}]}>Nenhum registro ainda. O seu será o primeiro!</Text>
        )}
      </Card>
    </ScrollView>
  );
}
