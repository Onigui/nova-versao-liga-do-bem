/**
 * Veterinário monta a lista no atendimento (pet lido pelo QR). O pedido vai para o tutor,
 * que recebe as propostas das lojas e escolhe onde comprar. A sua clínica também recebe.
 */
import React, {useState} from 'react';
import {Alert, ScrollView, Text} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import QuoteListBuilder from '../../components/QuoteListBuilder';
import {COLORS, usePartner} from '../PartnerContext';
import {Button, Card, Field, styles as ui} from '../ui';
import {buildItems} from '../../utils/quotes';

const SPECIES_ID = s => (/gat/i.test(s || '') ? 'CAT' : /c[aã]o|cachorr/i.test(s || '') ? 'DOG' : null);

export default function VetQuoteScreen({route, navigation}) {
  const {api} = usePartner();
  const {visitId, pet} = route?.params || {};
  const [list, setList] = useState([]);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const r = await api('POST', `/partner/pets/visits/${visitId}/quote`, {items: buildItems(list), notes: notes.trim() || undefined, expiresInHours: 24});
      Alert.alert('Lista enviada', `O tutor recebeu a lista no app e ${r.targets} ${r.targets === 1 ? 'loja foi avisada' : 'lojas foram avisadas'}. Sua clínica também pode mandar proposta em "Orçamentos".`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Não foi possível enviar', e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <Card style={{backgroundColor: COLORS.primarySoft, borderColor: '#99F6E4'}}>
        <Text style={{fontWeight: '800', color: COLORS.primaryDark}}>Lista para {pet?.name || 'o pet'}</Text>
        <Text style={{color: COLORS.primaryDark, fontSize: 13, marginTop: 4}}>
          Vacinas, remédios, exames ou ração que o tutor vai precisar. Ele recebe no app e as lojas parceiras mandam propostas.
        </Text>
      </Card>
      <QuoteListBuilder value={list} onChange={setList} color={COLORS.primary} species={SPECIES_ID(pet?.species)} />
      <Field
        label="Orientações para o tutor (opcional)"
        value={notes}
        onChangeText={setNotes}
        placeholder="Ex.: dar 1 comprimido a cada 12 h por 7 dias"
        maxLength={500}
        multiline
        style={{marginTop: 16}}
      />
      <Button
        title={`Enviar lista ao tutor (${list.length})`}
        icon={<Icon name="paper-plane" size={20} color="#FFFFFF" />}
        onPress={send}
        disabled={!list.length}
        loading={sending}
        testID="enviar-lista"
      />
    </ScrollView>
  );
}
