import {Platform, PermissionsAndroid} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { API_BASE_PATH } from '../config/apiConfig';

export class NotificationService {
  static async requestPermissions() {
    if (
      Platform.OS === 'android' &&
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    ) {
      const notificationPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );

      if (notificationPermission !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Permissão de notificação do Android negada');
        return false;
      }
    }

    try {
      const authorizationStatus = await messaging().requestPermission();
      const granted =
        authorizationStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authorizationStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!granted) {
        console.log('Permissão do Firebase Messaging negada');
        return false;
      }

      await messaging().registerDeviceForRemoteMessages();
      return true;
    } catch (error) {
      console.error('Erro ao solicitar permissões de notificação:', error);
      return false;
    }
  }

  static async getDeviceToken() {
    try {
      await messaging().registerDeviceForRemoteMessages();
      const token = await messaging().getToken();
      return token;
    } catch (error) {
      console.error('Erro ao obter token do Firebase Messaging:', error);
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

      // Obter token do Firebase Cloud Messaging
      const messagingToken = await this.getDeviceToken();
      if (!messagingToken) {
        return false;
      }

      // Registrar token no backend
      const response = await fetch(`${API_BASE_PATH}/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          token: messagingToken,
          provider: 'fcm',
          platform: Platform.OS,
          deviceInfo: {
            model: Platform.constants?.Model || Platform.OS,
            osVersion: String(Platform.Version),
          },
        }),
      });

      if (response.ok) {
        // Salvar token localmente
        await AsyncStorage.setItem('push_notification_token', messagingToken);
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
    console.warn('Agendamento local de notificações não é suportado sem Expo.');
  }

  static setupNotificationListeners({onMessage, onOpened} = {}) {
    try {
      const foregroundSubscription = messaging().onMessage(
        async remoteMessage => {
          console.log('Notificação recebida em primeiro plano:', remoteMessage);
          if (onMessage) {
            onMessage(remoteMessage);
          }
        },
      );

      const backgroundSubscription = messaging().onNotificationOpenedApp(
        remoteMessage => {
          console.log('Notificação aberta pelo usuário:', remoteMessage);
          if (onOpened) {
            onOpened(remoteMessage);
          }
        },
      );

      messaging()
        .getInitialNotification()
        .then(remoteMessage => {
          if (remoteMessage && onOpened) {
            onOpened(remoteMessage);
          }
        })
        .catch(error =>
          console.error('Erro ao obter notificação inicial:', error),
        );

      return () => {
        try {
          foregroundSubscription();
        } catch (e) {
          /* noop */
        }
        try {
          backgroundSubscription();
        } catch (e) {
          /* noop */
        }
      };
    } catch (error) {
      console.warn('NotificationService.setupNotificationListeners:', error?.message || error);
      return () => {};
    }
  }

  static async sendTestNotification(userToken) {
    try {
      const response = await fetch(`${API_BASE_PATH}/notifications/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
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
      const response = await fetch(`${API_BASE_PATH}/notifications/history`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${userToken}`,
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
