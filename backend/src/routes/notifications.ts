import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, optionalAuth } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// Get user notifications
router.get('/', authenticate, async (req: any, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { sentAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await prisma.notification.count({
      where: { userId }
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false
      }
    });

    res.json({
      notifications,
      total,
      unreadCount,
      hasMore: (parseInt(offset as string) + parseInt(limit as string)) < total
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      message: 'Notificação marcada como lida',
      notification: updatedNotification
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Register device token for push notifications
router.post('/device-token', [
  optionalAuth,
  body('token').notEmpty().isString(),
  body('platform').isIn(['ios', 'android'])
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, platform } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Check if token already exists
    const existingToken = await prisma.deviceToken.findUnique({
      where: { token }
    });

    if (existingToken) {
      // Update existing token
      const updatedToken = await prisma.deviceToken.update({
        where: { token },
        data: {
          userId,
          platform,
          isActive: true,
          updatedAt: new Date()
        }
      });

      return res.json({
        message: 'Token atualizado com sucesso',
        deviceToken: updatedToken
      });
    }

    // Create new token
    const deviceToken = await prisma.deviceToken.create({
      data: {
        token,
        platform,
        userId,
        isActive: true
      }
    });

    res.status(201).json({
      message: 'Token registrado com sucesso',
      deviceToken
    });
  } catch (error) {
    console.error('Register device token error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Send test notification
router.post('/test', authenticate, async (req: any, res) => {
  try {
    const { title, message } = req.body;
    const userId = req.user.id;

    const notification = await prisma.notification.create({
      data: {
        userId,
        title: title || 'Teste de Notificação',
        message: message || 'Esta é uma notificação de teste',
        type: 'GENERAL'
      }
    });

    // TODO: Send push notification via Firebase FCM
    // await sendPushNotification(userId, title, message);

    res.json({
      message: 'Notificação de teste enviada',
      notification
    });
  } catch (error) {
    console.error('Send test notification error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
