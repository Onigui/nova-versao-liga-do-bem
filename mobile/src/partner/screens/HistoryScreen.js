import React, {useCallback, useState} from 'react';
import {FlatList, RefreshControl, Text, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  COLORS,
  formatDateTimeBR,
  formatMoney,
  usePartner,
} from '../PartnerContext';
import {Badge, Card, Empty, styles as ui} from '../ui';

const METHOD = {SIGNED: 'QR', LEGACY: 'QR antigo', MANUAL: 'Digitado'};

export default function HistoryScreen() {
  const {api, stats} = usePartner();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api('GET', '/partner/validations?limit=100');
      setItems(r.validations);
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
      keyExtractor={v => v.id}
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
          {stats ? (
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 12}}>
              {[
                ['Hoje', stats.today],
                ['30 dias', stats.last30],
                ['Com promoção', stats.discountsUsed30],
              ].map(([label, n]) => (
                <Card
                  key={label}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: 12,
                    marginBottom: 0,
                  }}>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: '900',
                      color: COLORS.primary,
                    }}>
                    {n}
                  </Text>
                  <Text style={[ui.muted, {fontSize: 12}]}>{label}</Text>
                </Card>
              ))}
            </View>
          ) : null}
          {error ? (
            <Text style={[ui.error, {marginBottom: 10}]}>{error}</Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        items ? <Empty text="Nenhuma carteirinha validada ainda." /> : null
      }
      renderItem={({item: v}) => (
        <Card style={{paddingVertical: 12}}>
          <View style={[ui.row, {justifyContent: 'space-between'}]}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: COLORS.text,
                flex: 1,
              }}
              numberOfLines={1}>
              {v.memberName}
            </Text>
            <Badge
              text={v.membershipActive ? 'Ativa' : 'Vencida'}
              tone={v.membershipActive ? 'ok' : 'bad'}
            />
          </View>
          <Text style={[ui.muted, {fontSize: 13, marginTop: 2}]}>
            {formatDateTimeBR(v.validatedAt)} · {METHOD[v.method] || 'QR'} ·{' '}
            {v.memberId}
            {v.validatedByName ? ` · por ${v.validatedByName}` : ''}
          </Text>
          {v.discountName || v.amount ? (
            <Text
              style={{
                color: COLORS.primaryDark,
                fontSize: 13,
                marginTop: 4,
                fontWeight: '600',
              }}>
              {v.discountName || 'Sem promoção'}
              {v.amount ? ` · compra de ${formatMoney(v.amount)}` : ''}
            </Text>
          ) : null}
        </Card>
      )}
    />
  );
}
