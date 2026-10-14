/**
 * Avaliações da empresa (App Parceiros). Só clientes atendidos avaliam.
 * O responsável responde em público; se a avaliação for falsa ou ofensiva, denuncie para a Liga analisar.
 */
import React, {useCallback, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {Alert, FlatList, Pressable, Text, TextInput, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, usePartner} from '../PartnerContext';
import {Button, Card, Empty, styles as ui} from '../ui';
import {RatingSummary, ReviewCard} from '../../components/Reviews';

const TAGS = {
  ATENDIMENTO: 'Bom atendimento',
  PRECO: 'Preço justo',
  CUIDADO: 'Cuidado com o pet',
  LIMPEZA: 'Lugar limpo',
  RAPIDEZ: 'Rapidez',
  DESCONTO: 'Respeitou o desconto',
};

export default function ReviewsScreen() {
  const {api, partner} = usePartner();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState(null); // {id, mode: 'reply'|'report', text}
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api('GET', '/partner/reviews'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const send = async () => {
    setBusy(true);
    try {
      const path = `/partner/reviews/${edit.id}/${edit.mode}`;
      const r = await api('POST', path, edit.mode === 'reply' ? {text: edit.text} : {reason: edit.text});
      if (edit.mode === 'report') Alert.alert('Denúncia enviada', r?.message || 'A Liga vai analisar.');
      setEdit(null);
      await load();
    } catch (e) {
      Alert.alert('Não foi possível enviar', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      data={data?.reviews || []}
      keyExtractor={r => r.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View>
          {error ? <Text style={{color: COLORS.bad, marginBottom: 10}}>{error}</Text> : null}
          <Card>
            <RatingSummary summary={data?.summary} />
          </Card>
          <Text style={[ui.muted, {fontSize: 12, marginBottom: 4}]}>
            Só avalia quem usou a carteirinha aqui, concluiu uma reserva ou trouxe o pet para atendimento. Responder com educação melhora a sua nota com os próximos clientes.
          </Text>
        </View>
      }
      ListEmptyComponent={data ? <Empty text="Nenhuma avaliação ainda. Depois de cada visita, o membro recebe um convite para avaliar." /> : null}
      renderItem={({item: r}) => {
        const editing = edit?.id === r.id;
        return (
          <ReviewCard
            review={r}
            tagLabels={TAGS}
            partnerName={partner?.name}
            footer={
              editing ? (
                <View style={{marginTop: 10}}>
                  <TextInput
                    style={{borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, minHeight: 70, textAlignVertical: 'top', color: COLORS.text}}
                    multiline
                    maxLength={edit.mode === 'reply' ? 600 : 300}
                    value={edit.text}
                    onChangeText={t => setEdit(x => ({...x, text: t}))}
                    placeholder={edit.mode === 'reply' ? 'Agradeça ou explique com educação. Fica público.' : 'Por que esta avaliação é falsa ou ofensiva? (mín. 10 letras)'}
                    placeholderTextColor="#94A3B8"
                    testID="texto-avaliacao"
                  />
                  <View style={[ui.row, {gap: 8, marginTop: 8}]}>
                    <Button title="Cancelar" variant="secondary" onPress={() => setEdit(null)} style={{flex: 1}} />
                    <Button
                      title={edit.mode === 'reply' ? 'Publicar resposta' : 'Enviar denúncia'}
                      variant={edit.mode === 'reply' ? 'primary' : 'danger'}
                      onPress={send}
                      loading={busy}
                      style={{flex: 2}}
                      testID="enviar-texto"
                    />
                  </View>
                </View>
              ) : (
                <View style={[ui.row, {gap: 18, marginTop: 10}]}>
                  {data?.canReply ? (
                    <Pressable onPress={() => setEdit({id: r.id, mode: 'reply', text: r.reply?.text || ''})} style={[ui.row, {gap: 4}]} testID={`responder-${r.id}`}>
                      <Icon name="chatbubble-ellipses-outline" size={16} color={COLORS.primary} />
                      <Text style={{color: COLORS.primary, fontWeight: '700'}}>{r.reply ? 'Editar resposta' : 'Responder'}</Text>
                    </Pressable>
                  ) : null}
                  {r.reported ? (
                    <Text style={[ui.muted, {fontSize: 12}]}>Em análise pela Liga</Text>
                  ) : (
                    <Pressable onPress={() => setEdit({id: r.id, mode: 'report', text: ''})} style={[ui.row, {gap: 4}]} testID={`denunciar-${r.id}`}>
                      <Icon name="flag-outline" size={16} color={COLORS.muted} />
                      <Text style={{color: COLORS.muted, fontWeight: '600'}}>Denunciar</Text>
                    </Pressable>
                  )}
                </View>
              )
            }
          />
        );
      }}
    />
  );
}
