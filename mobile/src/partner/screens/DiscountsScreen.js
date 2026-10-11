import React, {useCallback, useState} from 'react';
import {FlatList, Pressable, RefreshControl, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, formatDateBR, usePartner} from '../PartnerContext';
import {Badge, Button, Card, Empty, styles as ui} from '../ui';

export function discountStatus(d, now = Date.now()) {
  if (!d.isActive) return {text: 'Pausada', tone: 'muted'};
  if (d.validFrom && new Date(d.validFrom).getTime() > now)
    return {text: 'Agendada', tone: 'warn'};
  if (d.validUntil && new Date(d.validUntil).getTime() < now)
    return {text: 'Encerrada', tone: 'muted'};
  return {text: 'No ar', tone: 'ok'};
}

export default function DiscountsScreen({navigation}) {
  const {api, isOwner} = usePartner();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api('GET', '/partner/discounts');
      setItems(r.discounts);
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

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={ui.content}
      data={items || []}
      keyExtractor={d => d.id}
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
          <Text style={[ui.muted, {marginBottom: 12}]}>
            As promoções "no ar" aparecem para os membros no app Liga do Bem, na
            página da sua empresa.
          </Text>
          {isOwner ? (
            <Button
              title="Nova promoção"
              icon={<Icon name="add-circle" size={22} color="#FFFFFF" />}
              onPress={() => navigation.navigate('DiscountForm')}
              style={{marginBottom: 14}}
              testID="nova-promocao"
            />
          ) : null}
          {error ? (
            <Text style={[ui.error, {marginBottom: 10}]}>{error}</Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        items ? <Empty text="Nenhuma promoção cadastrada ainda." /> : null
      }
      renderItem={({item: d}) => {
        const st = discountStatus(d);
        return (
          <Pressable
            disabled={!isOwner}
            onPress={() => navigation.navigate('DiscountForm', {discount: d})}>
            <Card>
              <View
                style={[
                  ui.row,
                  {justifyContent: 'space-between', marginBottom: 6},
                ]}>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '900',
                    color: COLORS.primary,
                  }}>
                  {d.label}
                </Text>
                <Badge text={st.text} tone={st.tone} />
              </View>
              <Text
                style={{fontSize: 16, fontWeight: '700', color: COLORS.text}}>
                {d.name}
              </Text>
              {d.description ? (
                <Text style={[ui.muted, {marginTop: 2}]}>{d.description}</Text>
              ) : null}
              <Text style={[ui.muted, {marginTop: 8, fontSize: 13}]}>
                {d.validUntil
                  ? `De ${formatDateBR(d.validFrom)} até ${formatDateBR(
                      d.validUntil,
                    )}`
                  : `Desde ${formatDateBR(d.validFrom)} · sem data de fim`}
                {` · usada ${d.uses || 0}x`}
              </Text>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}
