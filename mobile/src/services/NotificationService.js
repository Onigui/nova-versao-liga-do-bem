import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://liga-do-bem-backend.onrender.com/api';

// Configurar como as notificações são tratadas quando recebidas
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class NotificationService {
  static async requestPermissions() {
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Permissão para notificações negada');
        return false;
      }
      
      return true;
    } else {
      console.log('Deve usar um dispositivo físico para notificações');
      return false;
    }
  }

  static async getExpoPushToken() {
    if (Device.isDevice) {
      try {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: 'liga-do-bem-botucatu', // Seu project ID do Expo
        });
        return token.data;
      } catch (error) {
        console.error('Erro ao obter token push:', error);
        return null;
      }
    } else {
      console.log('Deve usar um dispositivo físico para obter token push');
      return null;
    }
  }

  static async registerForPushNotifications(userToken) {
    try {
      // Solicitar permissões
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return false;
      }

      // Obter token do Expo
      const expoPushToken = await this.getExpoPushToken();
      if (!expoPushToken) {
        return false;
      }

      // Registrar token no backend
      const response = await fetch(`${API_BASE_URL}/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          token: expoPushToken,
          platform: Platform.OS,
          deviceInfo: {
            model: Device.modelName,
            osVersion: Device.osVersion,
          },
        }),
      });

      if (response.ok) {
        // Salvar token localmente
        await AsyncStorage.setItem('expo_push_token', expoPushToken);
        console.log('Token push registrado com sucesso');
        return true;
      } else {
        console.error('Erro ao registrar token push no backend');
        return false;
      }
    } catch (error) {
      console.error('Erro ao registrar notificações push:', error);
      return false;
    }
  }

  static async scheduleLocalNotification(title, body, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
        },
        trigger: null, // Enviar imediatamente
      });
    } catch (error) {
      console.error('Erro ao agendar notificação local:', error);
    }
  }

  static setupNotificationListeners() {
    // Listener para notificações recebidas quando o app está em primeiro plano
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notificação recebida:', notification);
    });

    // Listener para quando o usuário toca na notificação
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Usuário tocou na notificação:', response);
      
      // Navegar para a tela apropriada baseada no tipo de notificação
      const { type, data } = response.notification.request.content.data;
      
      if (type === 'adoption') {
        // Navegar para adoções
        console.log('Navegar para adoções');
      } else if (type === 'donation') {
        // Navegar para doações
        console.log('Navegar para doações');
      } else if (type === 'partner') {
        // Navegar para parceiros
        console.log('Navegar para parceiros');
      }
    });

    return () => {
      foregroundSubscription.remove();
      responseSubscription.remove();
    };
  }

  static async sendTestNotification(userToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          title: 'Teste Liga do Bem',
          body: 'Esta é uma notificação de teste!',
        }),
      });

      if (response.ok) {
        console.log('Notificação de teste enviada');
        return true;
      } else {
        console.error('Erro ao enviar notificação de teste');
        return false;
      }
    } catch (error) {
      console.error('Erro ao enviar notificação de teste:', error);
      return false;
    }
  }

  static async getNotificationHistory(userToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/history`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.notifications || [];
      } else {
        console.error('Erro ao obter histórico de notificações');
        return [];
      }
    } catch (error) {
      console.error('Erro ao obter histórico de notificações:', error);
      return [];
    }
  }
}

export default NotificationService;
