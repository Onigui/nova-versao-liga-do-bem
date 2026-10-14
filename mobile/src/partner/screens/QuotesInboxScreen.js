/**
 * Pedidos de orçamento que chegaram para a empresa. O pedido é anônimo e ninguém vê a
 * proposta dos outros parceiros: mande o melhor preço que puder, uma vez só.
 */
import React, {useCallback, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, usePartner} from '../PartnerContext';
import {Badge, Button, Card, Empty, styles as ui} from '../ui';
import {timeLeft} from '../../utils/quotes';

function statusOf(q) {
  if (q.reservationStatus === 'RESERVED') return ['Reservado com você', 'ok'];
  if (q.reservationStatus === 'DONE') return ['Venda concluída', 'ok'];
  if (q.answered) return ['Proposta enviada', 'muted'];
  if (q.open) return ['Responder', 'warn'];
  return ['Encerrado', 'muted'];
}

export default function QuotesInboxScreen({navigation}) {
  const {api} = usePartner();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api('GET', '/partner/quotes'));
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

  if (!data && !error) {
    return (
      <View style={[ui.screen, {alignItems: 'center', justifyContent: 'center'}]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      data={data?.quotes || []}
      keyExtractor={q => q.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        <View>
          <Card style={{backgroundColor: COLORS.primarySoft, borderColor: '#99F6E4'}}>
            <Text style={{fontWeight: '800', color: COLORS.primaryDark, marginBottom: 4}}>Como funciona</Text>
            <Text style={{color: COLORS.primaryDark, fontSize: 13, lineHeight: 19}}>
              O membro monta a lista e as lojas mandam propostas às cegas: ninguém vê o preço do outro. A proposta não pode
              ser alterada depois de enviada. Se o membro reservar com você, ele mostra um código no caixa.
            </Text>
          </Card>
          <Button
            title="Reservas dos membros"
            variant="secondary"
            icon={<Icon name="bag-check" size={20} color={COLORS.primary} />}
            onPress={() => navigation.navigate('Reservations')}
            style={{marginBottom: 12}}
            testID="ver-reservas"
          />
          {error ? <Text style={{color: COLORS.bad, marginBottom: 10}}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={<Empty text="Nenhum pedido de orçamento nos últimos 30 dias. Quanto mais itens na sua tabela de preços, mais pedidos você recebe." />}
      renderItem={({item: q}) => {
        const [label, tone] = statusOf(q);
        return (
          <Pressable onPress={() => navigation.navigate('QuoteRespond', {requestId: q.id})} testID={`pedido-${q.id}`}>
            <Card style={q.open && !q.answered ? {borderColor: '#FCD34D'} : null}>
              <View style={[ui.row, {justifyContent: 'space-between', marginBottom: 6}]}>
                <Badge text={label} tone={tone} />
                <Text style={ui.muted}>{q.open ? timeLeft(q.expiresAt) : ''}</Text>
              </View>
              <Text style={{fontSize: 15, fontWeight: '700', color: COLORS.text}} numberOfLines={2}>
                {q.preview}
                {q.items > 3 ? ` +${q.items - 3}` : ''}
              </Text>
              <Text style={[ui.muted, {marginTop: 4}]}>
                {[
                  `${q.items} ${q.items === 1 ? 'item' : 'itens'}`,
                  q.species,
                  q.petWeight ? `${q.petWeight} kg` : null,
                  q.district,
                  q.hasPrescription ? 'com receita' : null,
                  q.fromUs ? 'lista feita aqui' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {q.open && !q.answered ? (
                <View style={[ui.row, {marginTop: 8, gap: 6}]}>
                  <Icon name="create-outline" size={16} color={COLORS.primary} />
                  <Text style={{color: COLORS.primary, fontWeight: '700'}}>Mandar proposta</Text>
                </View>
              ) : null}
            </Card>
          </Pressable>
        );
      }}
    />
  );
}
