import messaging from '@react-native-firebase/messaging';
import {Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://nova-versao-liga-do-bem-api.onrender.com/api';

export class NotificationService {
  static async requestPermissions() {
    try {
      const authorizationStatus = await messaging().requestPermission({
        sound: true,
        announcement: true,
        alert: true,
        badge: true,
        provisional: true,
      });

      const enabled =
        authorizationStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authorizationStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('Permissão para notificações negada');
        return false;
      }

      if (Platform.OS === 'android') {
        await messaging().registerDeviceForRemoteMessages();
        await messaging().setAutoInitEnabled(true);
      }

      return true;
    } catch (error) {
      console.error('Erro ao solicitar permissões de notificação:', error);
      return false;
    }
  }

  static async getFcmToken() {
    try {
      await messaging().registerDeviceForRemoteMessages();
      const token = await messaging().getToken();
      return token;
    } catch (error) {
      console.error('Erro ao obter token FCM:', error);
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

      // Obter token FCM
      const fcmToken = await this.getFcmToken();
      if (!fcmToken) {
        return false;
      }

      // Registrar token no backend
      const response = await fetch(`${API_BASE_URL}/notifications/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify({
          token: fcmToken,
          platform: Platform.OS,
          deviceInfo: {
            model:
              Platform.constants?.Model ||
              Platform.constants?.model ||
              'unknown',
            osVersion:
              typeof Platform.Version === 'string'
                ? Platform.Version
                : String(Platform.Version ?? ''),
            provider: 'fcm',
          },
        }),
      });

      if (response.ok) {
        // Salvar token localmente
        await AsyncStorage.setItem('fcm_push_token', fcmToken);
        console.log('Token push FCM registrado com sucesso');
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
    console.warn(
      'Notificações locais não estão configuradas para Firebase Messaging. Dados recebidos:',
      {
        title,
        body,
        data,
      },
    );
  }

  static setupNotificationListeners() {
    // Listener para notificações recebidas quando o app está em primeiro plano
    const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
      console.log('Notificação recebida em primeiro plano:', remoteMessage);
    });

    // Listener para quando o usuário toca na notificação abrindo o app a partir do background
    const unsubscribeOnNotificationOpened = messaging().onNotificationOpenedApp(
      remoteMessage => {
        if (!remoteMessage) {
          return;
        }

        console.log(
          'Usuário abriu a notificação a partir do background:',
          remoteMessage,
        );

        const {type, ...rest} = remoteMessage.data || {};

        if (type === 'adoption') {
          console.log('Navegar para adoções', rest);
        } else if (type === 'donation') {
          console.log('Navegar para doações', rest);
        } else if (type === 'partner') {
          console.log('Navegar para parceiros', rest);
        }
      },
    );

    // Verificar se o app foi aberto a partir de uma notificação quando estava fechado
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log(
            'App aberto por notificação (estado terminado):',
            remoteMessage,
          );
        }
      })
      .catch(error => {
        console.error('Erro ao obter notificação inicial:', error);
      });

    return () => {
      unsubscribeOnMessage();
      unsubscribeOnNotificationOpened();
    };
  }

  static async sendTestNotification(userToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/test`, {
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
      const response = await fetch(`${API_BASE_URL}/notifications/history`, {
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
