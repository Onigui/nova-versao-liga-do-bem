import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

// Configurar como as notificações são tratadas quando o app está em primeiro plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  // Dados simulados de notificações
  const sampleNotifications = [
    {
      id: '1',
      title: 'Nova Promoção no Pet Shop Central!',
      body: '15% de desconto em todos os produtos para membros da Liga do Bem. Válido até domingo!',
      type: 'PROMOTION',
      data: {
        partnerId: '1',
        discount: '15%',
        partnerName: 'Pet Shop Central'
      },
      isRead: false,
      sentAt: '2024-01-05T14:30:00Z',
      imageUrl: 'https://via.placeholder.com/300x200/4CAF50/ffffff?text=Promoção'
    },
    {
      id: '2',
      title: 'Evento de Adoção - Sábado',
      body: 'Não perca nosso evento de adoção neste sábado das 9h às 17h na Praça da Matriz!',
      type: 'EVENT',
      data: {
        eventId: '1',
        location: 'Praça da Matriz',
        date: '2024-01-06'
      },
      isRead: true,
      sentAt: '2024-01-04T10:15:00Z',
      imageUrl: 'https://via.placeholder.com/300x200/2196F3/ffffff?text=Evento'
    },
    {
      id: '3',
      title: 'Lembrete de Pagamento',
      body: 'Sua mensalidade da Liga do Bem vence em 5 dias. Mantenha-se em dia!',
      type: 'PAYMENT_REMINDER',
      data: {
        dueDate: '2024-01-10',
        amount: 'R$ 25,00'
      },
      isRead: false,
      sentAt: '2024-01-03T09:00:00Z'
    },
    {
      id: '4',
      title: 'Bem-vindo à Liga do Bem!',
      body: 'Obrigado por se tornar um membro da nossa comunidade. Aproveite todos os benefícios!',
      type: 'WELCOME',
      data: {},
      isRead: true,
      sentAt: '2024-01-01T08:00:00Z',
      imageUrl: 'https://via.placeholder.com/300x200/8B5CF6/ffffff?text=Bem-vindo'
    },
    {
      id: '5',
      title: 'Nova Parceira: Clínica Veterinária Amigo',
      body: 'Conheça nossa nova parceira que oferece 10% de desconto para membros!',
      type: 'NEW_PARTNER',
      data: {
        partnerId: '2',
        partnerName: 'Clínica Veterinária Amigo',
        discount: '10%'
      },
      isRead: false,
      sentAt: '2024-01-02T16:45:00Z',
      imageUrl: 'https://via.placeholder.com/300x200/FF9800/ffffff?text=Nova+Parceira'
    }
  ];

  useEffect(() => {
    loadNotifications();
    registerForPushNotifications();
  }, []);

  const registerForPushNotifications = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert('Permissão Negada', 'Notificações push não foram permitidas.');
        return;
      }
      
      const token = await Notifications.getExpoPushTokenAsync();
      setExpoPushToken(token.data);
      
      // Registrar token no backend (simulado)
      console.log('Token de notificação:', token.data);
      
    } catch (error) {
      console.error('Erro ao registrar notificações:', error);
    }
  };

  const loadNotifications = async () => {
    setRefreshing(true);
    
    // Simular carregamento de notificações
    setTimeout(() => {
      setNotifications(sampleNotifications);
      const unread = sampleNotifications.filter(n => !n.isRead).length;
      setUnreadCount(unread);
      setRefreshing(false);
    }, 1000);
  };

  const markAsRead = async (notificationId) => {
    const updatedNotifications = notifications.map(notification =>
      notification.id === notificationId
        ? { ...notification, isRead: true }
        : notification
    );
    
    setNotifications(updatedNotifications);
    
    // Atualizar contador
    const unread = updatedNotifications.filter(n => !n.isRead).length;
    setUnreadCount(unread);
    
    // Em produção, fazer chamada para API
    console.log(`Notificação ${notificationId} marcada como lida`);
  };

  const markAllAsRead = async () => {
    const updatedNotifications = notifications.map(notification => ({
      ...notification,
      isRead: true
    }));
    
    setNotifications(updatedNotifications);
    setUnreadCount(0);
    
    // Em produção, fazer chamada para API
    console.log('Todas as notificações marcadas como lidas');
  };

  const handleNotificationPress = (notification) => {
    // Marcar como lida
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // Navegar baseado no tipo
    switch (notification.type) {
      case 'PROMOTION':
      case 'NEW_PARTNER':
        if (notification.data.partnerId) {
          // Navegar para detalhes do parceiro
          navigation.navigate('PartnerDetail', { partnerId: notification.data.partnerId });
        }
        break;
      case 'EVENT':
        if (notification.data.eventId) {
          // Navegar para detalhes do evento
          navigation.navigate('Eventos');
        }
        break;
      case 'PAYMENT_REMINDER':
        // Navegar para área de pagamentos
        Alert.alert('Pagamento', 'Redirecionando para área de pagamentos...');
        break;
      default:
        // Não fazer nada para outros tipos
        break;
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'PROMOTION':
        return 'pricetag';
      case 'EVENT':
        return 'calendar';
      case 'PAYMENT_REMINDER':
        return 'card';
      case 'NEW_PARTNER':
        return 'business';
      case 'WELCOME':
        return 'heart';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'PROMOTION':
        return '#10B981';
      case 'EVENT':
        return '#3B82F6';
      case 'PAYMENT_REMINDER':
        return '#F59E0B';
      case 'NEW_PARTNER':
        return '#8B5CF6';
      case 'WELCOME':
        return '#EC4899';
      default:
        return '#6B7280';
    }
  };

  const formatDate = (dateString) => {
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
        year: '2-digit'
      });
    }
  };

  const renderNotificationItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        !item.isRead && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationHeader}>
        <View style={[
          styles.notificationIcon,
          { backgroundColor: getNotificationColor(item.type) }
        ]}>
          <Ionicons 
            name={getNotificationIcon(item.type)} 
            size={20} 
            color="white" 
          />
        </View>
        
        <View style={styles.notificationContent}>
          <View style={styles.notificationTitleRow}>
            <Text style={[
              styles.notificationTitle,
              !item.isRead && styles.unreadTitle
            ]}>
              {item.title}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          
          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body}
          </Text>
          
          <Text style={styles.notificationTime}>
            {formatDate(item.sentAt)}
          </Text>
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
            onPress={markAllAsRead}
          >
            <Text style={styles.markAllText}>Marcar todas como lidas</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadNotifications}
            colors={['#8B5CF6']}
            tintColor="#8B5CF6"
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  markAllButton: {
    alignSelf: 'flex-end',
  },
  markAllText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  notificationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
    backgroundColor: '#FAFAFA',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
