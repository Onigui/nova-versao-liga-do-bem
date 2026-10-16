/**
 * Sininho no canto superior direito do App Parceiros, com o número de avisos não lidos.
 * Atualiza ao voltar para a tela, quando o app volta do segundo plano e quando chega um aviso.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {AppState, DeviceEventEmitter, Pressable, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import {usePartner} from '../PartnerContext';
import {NOTIFICATION_EVENT} from '../../services/notificationEvents';

export default function PartnerBell() {
  const navigation = useNavigation();
  const {api} = usePartner();
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await api('GET', '/user/notifications?app=partner');
      setUnread(Number(d.unreadCount ?? (d.notifications || []).filter(n => !n.isRead).length) || 0);
    } catch {
      // sem internet: mantém o número que já estava
    }
  }, [api]);

  useEffect(() => {
    load();
    const unsubFocus = navigation.addListener('focus', load);
    const sub = DeviceEventEmitter.addListener(NOTIFICATION_EVENT, load);
    const app = AppState.addEventListener('change', st => st === 'active' && load());
    return () => {
      unsubFocus();
      sub.remove();
      app.remove();
    };
  }, [navigation, load]);

  return (
    <Pressable
      onPress={() => navigation.navigate('PartnerNotifications')}
      hitSlop={10}
      accessibilityLabel={unread ? `Avisos, ${unread} não lidos` : 'Avisos'}
      testID="sininho"
      style={{paddingHorizontal: 14, paddingVertical: 6}}>
      <Icon name={unread ? 'notifications' : 'notifications-outline'} size={24} color="#FFFFFF" />
      {unread > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 8,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: '#EF4444',
            borderWidth: 2,
            borderColor: '#0F766E',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{color: '#FFFFFF', fontSize: 10, fontWeight: '800'}}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
