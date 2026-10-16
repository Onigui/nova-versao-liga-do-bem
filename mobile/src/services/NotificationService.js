import {DeviceEventEmitter, Platform, PermissionsAndroid} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging from '@react-native-firebase/messaging';
import { API_BASE_PATH } from '../config/apiConfig';
import { APP_VARIANT } from '../config/appVariant';

import {NOTIFICATION_EVENT} from './notificationEvents';

export {NOTIFICATION_EVENT};
const REG_KEY = 'push_registration_v2';
const REG_EVERY_MS = 24 * 60 * 60 * 1000;

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

  /** Envia o token deste aparelho ao servidor (com ou sem permissão: se o usuário liberar depois, já chega). */
  static async sendTokenToServer(userToken, messagingToken) {
    const response = await fetch(`${API_BASE_PATH}/notifications/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        token: messagingToken,
        provider: 'fcm',
        app: APP_VARIANT,
        platform: Platform.OS,
        deviceInfo: {
          model: Platform.constants?.Model || Platform.OS,
          osVersion: String(Platform.Version),
        },
      }),
    });
    if (!response.ok) {
      console.error('Erro ao registrar token push no backend');
      return false;
    }
    await AsyncStorage.setItem('push_notification_token', messagingToken);
    await AsyncStorage.setItem(
      REG_KEY,
      JSON.stringify({token: messagingToken, auth: String(userToken).slice(-16), at: Date.now()}),
    );
    return true;
  }

  static async registerForPushNotifications(userToken) {
    try {
      // Pede a permissão (Android 13+), mas registra o aparelho mesmo se negada
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('Avisos sem permissão: o token é registrado mesmo assim');
      }
      const messagingToken = await this.getDeviceToken();
      if (!messagingToken) {
        return false;
      }
      const ok = await this.sendTokenToServer(userToken, messagingToken);
      if (ok) console.log('Token push registrado com sucesso');
      return ok;
    } catch (error) {
      console.error('Erro ao registrar notificações push:', error);
      return false;
    }
  }

  /**
   * Chamado sempre que o app abre com alguém logado (inclusive sessão já salva).
   * Registra de novo se o token mudou, se trocou de conta ou uma vez por dia.
   */
  static async ensureRegistered(userToken) {
    if (!userToken) return false;
    try {
      const messagingToken = await this.getDeviceToken();
      if (!messagingToken) return false;
      let last = null;
      try {
        last = JSON.parse((await AsyncStorage.getItem(REG_KEY)) || 'null');
      } catch {
        last = null;
      }
      const fresh =
        last &&
        last.token === messagingToken &&
        last.auth === String(userToken).slice(-16) &&
        Date.now() - Number(last.at || 0) < REG_EVERY_MS;
      if (fresh) return true;
      return await this.registerForPushNotifications(userToken);
    } catch (error) {
      console.log('Registro de avisos adiado:', error?.message);
      return false;
    }
  }

  /** Token do Firebase trocou (reinstalação, limpeza de dados…): avisa o servidor. */
  static listenTokenRefresh(userToken) {
    if (!userToken) return () => {};
    try {
      return messaging().onTokenRefresh(newToken => {
        this.sendTokenToServer(userToken, newToken).catch(() => {});
      });
    } catch {
      return () => {};
    }
  }

  static async scheduleLocalNotification(title, body, data = {}) {
    console.warn('Agendamento local de notificações não é suportado sem Expo.');
  }

  static setupNotificationListeners({onMessage, onOpened} = {}) {
    const foregroundSubscription = messaging().onMessage(
      async remoteMessage => {
        console.log('Notificação recebida em primeiro plano:', remoteMessage);
        DeviceEventEmitter.emit(NOTIFICATION_EVENT, remoteMessage);
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
      foregroundSubscription();
      backgroundSubscription();
    };
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
