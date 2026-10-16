/**
 * Sininho do App Parceiros: pedidos de orçamento, reservas, campanhas aprovadas/enviadas,
 * avaliações… (os mesmos avisos que chegam em pop-up com o app fechado).
 */
import React, {useCallback, useEffect, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import {COLORS, formatDateTimeBR, usePartner} from '../PartnerContext';
import {Empty, styles as ui} from '../ui';
import {NOTIFICATION_EVENT} from '../../services/notificationEvents';

const ICONS = {
  QuoteRespond: 'document-text',
  Reservations: 'bookmark',
  PushCampaigns: 'megaphone',
  Reviews: 'star',
  VetProfile: 'medkit',
};

/** Rota do App Parceiros para o data.screen do aviso (ou null se não abre nada). */
export function partnerTarget(data) {
  const d = data || {};
  if (!d.screen || !ICONS[d.screen]) return null;
  const {screen, audience, ...params} = d;
  return {name: screen, params};
}

export default function PartnerNotificationsScreen({navigation}) {
  const {api} = usePartner();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api('GET', '/user/notifications?app=partner');
      setList(d.notifications || []);
      setError('');
    } catch (e) {
      setList(prev => prev || []);
      setError(e.message);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(NOTIFICATION_EVENT, load);
    return () => sub.remove();
  }, [load]);

  const markAll = useCallback(async () => {
    setList(prev => (prev || []).map(n => ({...n, isRead: true})));
    try {
      await api('POST', '/user/notifications/read', {markAll: true, app: 'partner'});
    } catch {
      load();
    }
  }, [api, load]);

  const unread = (list || []).filter(n => !n.isRead).length;

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        unread > 0 ? (
          <Pressable onPress={markAll} style={{paddingHorizontal: 14}} testID="ler-todas">
            <Text style={{color: '#FFFFFF', fontWeight: '700'}}>Ler todas</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, unread, markAll]);

  const open = async n => {
    if (!n.isRead) {
      setList(prev => (prev || []).map(x => (x.id === n.id ? {...x, isRead: true} : x)));
      api('POST', '/user/notifications/read', {notificationId: n.id}).catch(() => {});
    }
    const t = partnerTarget(n.data);
    if (t) navigation.navigate(t.name, t.params);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (list === null) {
    return (
      <View style={[ui.screen, {alignItems: 'center', justifyContent: 'center'}]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={ui.screen}
      contentContainerStyle={{padding: 16, paddingBottom: 32}}
      data={list}
      keyExtractor={n => String(n.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      ListHeaderComponent={error ? <Text style={[ui.muted, {color: COLORS.bad, marginBottom: 10}]}>{error}</Text> : null}
      ListEmptyComponent={<Empty text="Nenhum aviso por aqui. Quando chegar pedido de orçamento, reserva ou novidade da sua campanha, aparece aqui." />}
      renderItem={({item: n}) => (
        <Pressable
          onPress={() => open(n)}
          testID={`aviso-${n.id}`}
          style={[s.item, !n.isRead && s.unread]}>
          <View style={[s.icon, !n.isRead && {backgroundColor: COLORS.primary}]}>
            <Icon
              name={ICONS[n.data?.screen] || 'notifications'}
              size={18}
              color={n.isRead ? COLORS.primary : '#FFFFFF'}
            />
          </View>
          <View style={{flex: 1}}>
            <Text style={[s.title, !n.isRead && {fontWeight: '800'}]} numberOfLines={2}>
              {n.title}
            </Text>
            <Text style={s.msg} numberOfLines={3}>
              {n.message}
            </Text>
            <Text style={s.date}>{formatDateTimeBR(n.sentAt)}</Text>
          </View>
          {!n.isRead ? <View style={s.dot} /> : null}
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  unread: {borderColor: COLORS.primary, backgroundColor: '#F0FDFA'},
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {fontSize: 15, fontWeight: '600', color: COLORS.text},
  msg: {fontSize: 14, color: COLORS.muted, marginTop: 2},
  date: {fontSize: 12, color: '#94A3B8', marginTop: 6},
  dot: {width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, marginLeft: 8, marginTop: 4},
});
