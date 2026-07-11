import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_PATH} from '../config/apiConfig';
import NotificationService from '../services/NotificationService';

export default function NotificationsScreen({navigation}) {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const registerForPushNotifications = useCallback(async () => {
    try {
      const granted = await NotificationService.requestPermissions();
      if (!granted) return;
      await NotificationService.getDeviceToken();
    } catch (error) {
      console.log('Push notifications indisponíveis neste build:', error?.message);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const response = await fetch(`${API_BASE_PATH}/user/notifications`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        Alert.alert(
          'Erro',
          data.error || 'Não foi possível carregar as notificações',
        );
        return;
      }

      const list = (data.notifications || []).map(n => ({
        ...n,
        body: n.body || n.message,
      }));
      setNotifications(list);
      setUnreadCount(
        typeof data.unreadCount === 'number'
          ? data.unreadCount
          : list.filter(n => !n.isRead).length,
      );
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      Alert.alert('Erro', 'Falha de conexão ao carregar notificações');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    registerForPushNotifications();
  }, [loadNotifications, registerForPushNotifications]);

  const markAsRead = async notificationId => {
    setNotifications(prev => {
      const updated = prev.map(notification =>
        notification.id === notificationId
          ? {...notification, isRead: true}
          : notification,
      );
      setUnreadCount(updated.filter(n => !n.isRead).length);
      return updated;
    });

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;
      await fetch(`${API_BASE_PATH}/user/notifications/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({notificationId}),
      });
    } catch (error) {
      console.error('Erro ao marcar notificação:', error);
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({...n, isRead: true})));
    setUnreadCount(0);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;
      await fetch(`${API_BASE_PATH}/user/notifications/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({markAll: true}),
      });
    } catch (error) {
      console.error('Erro ao marcar todas:', error);
    }
  };

  const handleNotificationPress = notification => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    const screen = notification.data?.screen;
    switch (notification.type) {
      case 'EVENT_REMINDER':
        navigation.navigate(screen || 'EventsCalendar');
        break;
      case 'PAYMENT_REMINDER':
        navigation.navigate(screen || 'Cartão');
        break;
      case 'DONATION_CONFIRMATION':
        navigation.navigate(screen || 'Donation');
        break;
      case 'ADOPTION_UPDATE':
        navigation.navigate(screen || 'MyAdoptions');
        break;
      case 'VOLUNTEER_OPPORTUNITY':
        navigation.navigate(screen || 'Volunteer');
        break;
      case 'GENERAL':
        if (screen === 'MembershipCard') {
          navigation.navigate('Cartão');
        } else if (screen) {
          navigation.navigate(screen);
        }
        break;
      default:
        break;
    }
  };

  const getNotificationIcon = type => {
    switch (type) {
      case 'EVENT_REMINDER':
        return 'calendar';
      case 'PAYMENT_REMINDER':
        return 'card';
      case 'DONATION_CONFIRMATION':
        return 'heart';
      case 'ADOPTION_UPDATE':
        return 'paw';
      case 'VOLUNTEER_OPPORTUNITY':
        return 'people';
      case 'GENERAL':
        return 'notifications';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = type => {
    switch (type) {
      case 'EVENT_REMINDER':
        return '#3B82F6';
      case 'PAYMENT_REMINDER':
        return '#F59E0B';
      case 'DONATION_CONFIRMATION':
        return '#EC4899';
      case 'ADOPTION_UPDATE':
        return '#10B981';
      case 'VOLUNTEER_OPPORTUNITY':
        return '#8B5CF6';
      case 'GENERAL':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const formatDate = dateString => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Agora';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h atrás`;
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
    }
  };

  const renderNotificationItem = ({item}) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        !item.isRead && styles.unreadNotification,
      ]}
      onPress={() => handleNotificationPress(item)}>
      <View style={styles.notificationHeader}>
        <View
          style={[
            styles.notificationIcon,
            {backgroundColor: getNotificationColor(item.type)},
          ]}>
          <Ionicons
            name={getNotificationIcon(item.type)}
            size={20}
            color="white"
          />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationTitleRow}>
            <Text
              style={[
                styles.notificationTitle,
                !item.isRead && styles.unreadTitle,
              ]}>
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>

          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body}
          </Text>

          <Text style={styles.notificationTime}>{formatDate(item.sentAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-outline" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
      <Text style={styles.emptySubtitle}>
        Você não tem notificações no momento
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingBox]}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Carregando notificações...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Notificações</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={markAllAsRead}>
            <Text style={styles.markAllText}>Marcar todas como lidas</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={item => item.id}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadNotifications();
            }}
            colors={['#8B5CF6']}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingBox: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  unreadBadge: {
    marginLeft: 10,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  markAllButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  markAllText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flexGrow: 1,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unreadNotification: {
    borderColor: '#C4B5FD',
    backgroundColor: '#F5F3FF',
  },
  notificationHeader: {
    flexDirection: 'row',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  unreadTitle: {
    color: '#1F2937',
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
    marginLeft: 8,
  },
  notificationBody: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
