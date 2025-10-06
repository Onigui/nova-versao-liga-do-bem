import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Firebase Admin SDK (opcional - só carrega se configurado)
let admin: any = null;
let firebaseInitialized = false;

try {
  // Só importa Firebase se as variáveis de ambiente estiverem configuradas
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    // Importação dinâmica para evitar erro se o pacote não estiver instalado
    let firebaseAdmin;
    try {
      firebaseAdmin = require('firebase-admin');
    } catch (requireError) {
      console.log('⚠️ firebase-admin não instalado - usando modo simulado');
      throw new Error('firebase-admin not available');
    }
    
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };

    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID
      });
    }
    
    admin = firebaseAdmin;
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK inicializado com sucesso');
  } else {
    console.log('⚠️ Firebase Admin SDK não configurado - usando modo simulado');
  }
} catch (error) {
  console.log('⚠️ Firebase Admin SDK não disponível - usando modo simulado:', error instanceof Error ? error.message : String(error));
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: { [key: string]: string };
  imageUrl?: string;
}

export interface NotificationTarget {
  userId?: string;
  userRole?: string;
  allUsers?: boolean;
  specificTokens?: string[];
}

export class NotificationService {
  /**
   * Enviar notificação para um usuário específico
   */
  static async sendToUser(userId: string, payload: NotificationPayload): Promise<boolean> {
    try {
      // Buscar tokens do usuário
      const deviceTokens = await prisma.deviceToken.findMany({
        where: {
          userId: userId,
          isActive: true
        },
        select: {
          token: true,
          platform: true
        }
      });

      if (deviceTokens.length === 0) {
        console.log(`Usuário ${userId} não possui tokens ativos`);
        return false;
      }

      let response: any = { successCount: 0 };
      
      if (firebaseInitialized && admin) {
        // Preparar mensagem para Firebase
        const message = {
          notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.imageUrl
          },
          data: payload.data || {},
          tokens: deviceTokens.map(dt => dt.token)
        };

        // Enviar notificação via Firebase
        response = await admin.messaging().sendMulticast(message);
      } else {
        // Modo simulado - simular envio bem-sucedido
        console.log(`📱 [SIMULADO] Enviando notificação para usuário ${userId}:`);
        console.log(`   Título: ${payload.title}`);
        console.log(`   Corpo: ${payload.body}`);
        console.log(`   Dispositivos: ${deviceTokens.length}`);
        
        response.successCount = deviceTokens.length;
      }
      
      // Salvar notificação no banco
      await prisma.notification.create({
        data: {
          userId: userId,
          title: payload.title,
          message: payload.body,
          type: 'GENERAL',
          data: payload.data || {},
          sentAt: new Date()
        }
      });

      console.log(`Notificação enviada para ${response.successCount} dispositivos do usuário ${userId}`);
      return response.successCount > 0;

    } catch (error) {
      console.error('Erro ao enviar notificação para usuário:', error);
      return false;
    }
  }

  /**
   * Enviar notificação para todos os usuários de uma role
   */
  static async sendToRole(role: string, payload: NotificationPayload): Promise<number> {
    try {
      // Buscar todos os usuários da role
      const users = await prisma.user.findMany({
        where: {
          role: role as any,
          isActive: true
        },
        select: {
          id: true
        }
      });

      let successCount = 0;
      
      // Enviar para cada usuário
      for (const user of users) {
        const success = await this.sendToUser(user.id, payload);
        if (success) successCount++;
      }

      return successCount;

    } catch (error) {
      console.error('Erro ao enviar notificação para role:', error);
      return 0;
    }
  }

  /**
   * Enviar notificação para todos os usuários
   */
  static async sendToAllUsers(payload: NotificationPayload): Promise<number> {
    try {
      // Buscar todos os tokens ativos
      const deviceTokens = await prisma.deviceToken.findMany({
        where: {
          isActive: true
        },
        select: {
          token: true,
          userId: true
        }
      });

      if (deviceTokens.length === 0) {
        console.log('Nenhum token ativo encontrado');
        return 0;
      }

      let response: any = { successCount: 0 };
      
      if (firebaseInitialized && admin) {
        // Preparar mensagem
        const message = {
          notification: {
            title: payload.title,
            body: payload.body,
            imageUrl: payload.imageUrl
          },
          data: payload.data || {},
          tokens: deviceTokens.map(dt => dt.token)
        };

        // Enviar notificação via Firebase
        response = await admin.messaging().sendMulticast(message);
      } else {
        // Modo simulado - simular envio bem-sucedido
        console.log(`📱 [SIMULADO] Enviando notificação para todos os usuários:`);
        console.log(`   Título: ${payload.title}`);
        console.log(`   Corpo: ${payload.body}`);
        console.log(`   Total de dispositivos: ${deviceTokens.length}`);
        
        response.successCount = deviceTokens.length;
      }
      
      // Salvar notificação para cada usuário
      const userIds = [...new Set(deviceTokens.map(dt => dt.userId))];
      const notifications = userIds.map(userId => ({
        userId: userId,
        title: payload.title,
        message: payload.body,
        type: 'GENERAL' as any,
        data: payload.data || {},
        sentAt: new Date()
      }));

      await prisma.notification.createMany({
        data: notifications
      });

      console.log(`Notificação enviada para ${response.successCount} dispositivos`);
      return response.successCount;

    } catch (error) {
      console.error('Erro ao enviar notificação para todos:', error);
      return 0;
    }
  }

  /**
   * Enviar notificação de evento
   */
  static async sendEventNotification(eventId: string, payload: NotificationPayload): Promise<number> {
    try {
      // Buscar usuários inscritos no evento
      const registrations = await prisma.eventRegistration.findMany({
        where: {
          eventId: eventId,
          status: 'REGISTERED'
        },
        select: {
          userId: true
        }
      });

      let successCount = 0;
      
      // Enviar para cada usuário inscrito
      for (const registration of registrations) {
        const success = await this.sendToUser(registration.userId, payload);
        if (success) successCount++;
      }

      return successCount;

    } catch (error) {
      console.error('Erro ao enviar notificação de evento:', error);
      return 0;
    }
  }

  /**
   * Enviar notificação de promoção de parceiro
   */
  static async sendPartnerPromotion(partnerId: string, payload: NotificationPayload): Promise<number> {
    try {
      // Buscar todos os membros ativos
      const members = await prisma.user.findMany({
        where: {
          role: 'MEMBER',
          isActive: true
        },
        select: {
          id: true
        }
      });

      let successCount = 0;
      
      // Enviar para cada membro
      for (const member of members) {
        const success = await this.sendToUser(member.id, payload);
        if (success) successCount++;
      }

      return successCount;

    } catch (error) {
      console.error('Erro ao enviar promoção de parceiro:', error);
      return 0;
    }
  }

  /**
   * Enviar lembrete de pagamento
   */
  static async sendPaymentReminder(userId: string, payload: NotificationPayload): Promise<boolean> {
    try {
      const success = await this.sendToUser(userId, payload);
      
      if (success) {
        // Salvar como notificação de pagamento
        await prisma.notification.create({
          data: {
            userId: userId,
            title: payload.title,
            message: payload.body,
            type: 'PAYMENT_REMINDER',
            data: payload.data || {},
            sentAt: new Date()
          }
        });
      }

      return success;

    } catch (error) {
      console.error('Erro ao enviar lembrete de pagamento:', error);
      return false;
    }
  }

  /**
   * Registrar token de dispositivo
   */
  static async registerDeviceToken(userId: string, token: string, platform: string): Promise<boolean> {
    try {
      await prisma.deviceToken.upsert({
        where: {
          token: token
        },
        update: {
          userId: userId,
          platform: platform,
          isActive: true,
          updatedAt: new Date()
        },
        create: {
          userId: userId,
          token: token,
          platform: platform,
          isActive: true
        }
      });

      console.log(`Token registrado para usuário ${userId}`);
      return true;

    } catch (error) {
      console.error('Erro ao registrar token:', error);
      return false;
    }
  }

  /**
   * Desativar token de dispositivo
   */
  static async deactivateDeviceToken(token: string): Promise<boolean> {
    try {
      await prisma.deviceToken.update({
        where: {
          token: token
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });

      console.log(`Token desativado: ${token}`);
      return true;

    } catch (error) {
      console.error('Erro ao desativar token:', error);
      return false;
    }
  }

  /**
   * Buscar notificações do usuário
   */
  static async getUserNotifications(userId: string, limit: number = 20, offset: number = 0) {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          userId: userId
        },
        orderBy: {
          sentAt: 'desc'
        },
        take: limit,
        skip: offset
      });

      return notifications;

    } catch (error) {
      console.error('Erro ao buscar notificações:', error);
      return [];
    }
  }

  /**
   * Marcar notificação como lida
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      await prisma.notification.update({
        where: {
          id: notificationId
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      return true;

    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return false;
    }
  }
}

export default NotificationService;
