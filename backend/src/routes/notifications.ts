import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import NotificationService from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

// Registrar token de dispositivo para notificações push
router.post('/register', authenticate, async (req: Request, res: Response) => {
  try {
    const { token, platform } = req.body;
    const userId = (req as any).user.id;

    if (!token || !platform) {
      return res.status(400).json({ 
        message: 'Token e plataforma são obrigatórios' 
      });
    }

    const success = await NotificationService.registerDeviceToken(userId, token, platform);

    if (success) {
      res.json({ 
        message: 'Token registrado com sucesso' 
      });
    } else {
      res.status(500).json({ 
        message: 'Erro ao registrar token' 
      });
    }

  } catch (error) {
    console.error('Erro ao registrar token:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Desativar token de dispositivo
router.post('/unregister-token', authenticate, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ 
        message: 'Token é obrigatório' 
      });
    }

    const success = await NotificationService.deactivateDeviceToken(token);

    if (success) {
      res.json({ 
        message: 'Token desativado com sucesso' 
      });
    } else {
      res.status(500).json({ 
        message: 'Erro ao desativar token' 
      });
    }

  } catch (error) {
    console.error('Erro ao desativar token:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Buscar notificações do usuário
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await NotificationService.getUserNotifications(userId, limit, offset);

    res.json({
      notifications,
      pagination: {
        limit,
        offset,
        total: notifications.length
      }
    });

  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Marcar notificação como lida
router.patch('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    // Verificar se a notificação pertence ao usuário
    const notification = await prisma.notification.findFirst({
      where: {
        id: id,
        userId: userId
      }
    });

    if (!notification) {
      return res.status(404).json({ 
        message: 'Notificação não encontrada' 
      });
    }

    const success = await NotificationService.markAsRead(id);

    if (success) {
      res.json({ 
        message: 'Notificação marcada como lida' 
      });
    } else {
      res.status(500).json({ 
        message: 'Erro ao marcar notificação como lida' 
      });
    }

  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Marcar todas as notificações como lidas
router.patch('/mark-all-read', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    await prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({ 
      message: 'Todas as notificações foram marcadas como lidas' 
    });

  } catch (error) {
    console.error('Erro ao marcar todas as notificações como lidas:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Contar notificações não lidas
router.get('/unread-count', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const count = await prisma.notification.count({
      where: {
        userId: userId,
        isRead: false
      }
    });

    res.json({ 
      unreadCount: count 
    });

  } catch (error) {
    console.error('Erro ao contar notificações não lidas:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// ===== ROTAS ADMINISTRATIVAS =====

// Enviar notificação para todos os usuários (ADMIN)
router.post('/admin/send-to-all', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return res.status(403).json({ 
        message: 'Acesso negado. Apenas administradores podem enviar notificações.' 
      });
    }

    const { title, body, data, imageUrl } = req.body;

    if (!title || !body) {
      return res.status(400).json({ 
        message: 'Título e corpo da mensagem são obrigatórios' 
      });
    }

    const payload = {
      title,
      body,
      data: data || {},
      imageUrl
    };

    const successCount = await NotificationService.sendToAllUsers(payload);

    res.json({
      message: `Notificação enviada para ${successCount} dispositivos`,
      successCount
    });

  } catch (error) {
    console.error('Erro ao enviar notificação para todos:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Enviar notificação para uma role específica (ADMIN)
router.post('/admin/send-to-role', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return res.status(403).json({ 
        message: 'Acesso negado. Apenas administradores podem enviar notificações.' 
      });
    }

    const { title, body, role, data, imageUrl } = req.body;

    if (!title || !body || !role) {
      return res.status(400).json({ 
        message: 'Título, corpo da mensagem e role são obrigatórios' 
      });
    }

    const payload = {
      title,
      body,
      data: data || {},
      imageUrl
    };

    const successCount = await NotificationService.sendToRole(role, payload);

    res.json({
      message: `Notificação enviada para ${successCount} usuários da role ${role}`,
      successCount
    });

  } catch (error) {
    console.error('Erro ao enviar notificação para role:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Enviar notificação de evento (ADMIN)
router.post('/admin/send-event', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return res.status(403).json({ 
        message: 'Acesso negado. Apenas administradores podem enviar notificações.' 
      });
    }

    const { eventId, title, body, data, imageUrl } = req.body;

    if (!eventId || !title || !body) {
      return res.status(400).json({ 
        message: 'ID do evento, título e corpo da mensagem são obrigatórios' 
      });
    }

    const payload = {
      title,
      body,
      data: data || {},
      imageUrl
    };

    const successCount = await NotificationService.sendEventNotification(eventId, payload);

    res.json({
      message: `Notificação de evento enviada para ${successCount} usuários`,
      successCount
    });

  } catch (error) {
    console.error('Erro ao enviar notificação de evento:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Enviar promoção de parceiro (ADMIN)
router.post('/admin/send-partner-promotion', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return res.status(403).json({ 
        message: 'Acesso negado. Apenas administradores podem enviar notificações.' 
      });
    }

    const { partnerId, title, body, data, imageUrl } = req.body;

    if (!partnerId || !title || !body) {
      return res.status(400).json({ 
        message: 'ID do parceiro, título e corpo da mensagem são obrigatórios' 
      });
    }

    const payload = {
      title,
      body,
      data: data || {},
      imageUrl
    };

    const successCount = await NotificationService.sendPartnerPromotion(partnerId, payload);

    res.json({
      message: `Promoção de parceiro enviada para ${successCount} membros`,
      successCount
    });

  } catch (error) {
    console.error('Erro ao enviar promoção de parceiro:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Enviar lembrete de pagamento (ADMIN)
router.post('/admin/send-payment-reminder', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return res.status(403).json({ 
        message: 'Acesso negado. Apenas administradores podem enviar notificações.' 
      });
    }

    const { targetUserId, title, body, data } = req.body;

    if (!targetUserId || !title || !body) {
      return res.status(400).json({ 
        message: 'ID do usuário, título e corpo da mensagem são obrigatórios' 
      });
    }

    const payload = {
      title,
      body,
      data: data || {}
    };

    const success = await NotificationService.sendPaymentReminder(targetUserId, payload);

    if (success) {
      res.json({
        message: 'Lembrete de pagamento enviado com sucesso'
      });
    } else {
      res.status(500).json({ 
        message: 'Erro ao enviar lembrete de pagamento' 
      });
    }

  } catch (error) {
    console.error('Erro ao enviar lembrete de pagamento:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

// Buscar estatísticas de notificações (ADMIN)
router.get('/admin/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Verificar se é admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user?.role !== 'ADMIN') {
      return res.status(403).json({ 
        message: 'Acesso negado. Apenas administradores podem ver estatísticas.' 
      });
    }

    const [
      totalNotifications,
      unreadNotifications,
      totalDeviceTokens,
      activeDeviceTokens,
      notificationsByType
    ] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: false } }),
      prisma.deviceToken.count(),
      prisma.deviceToken.count({ where: { isActive: true } }),
      prisma.notification.groupBy({
        by: ['type'],
        _count: { type: true }
      })
    ]);

    res.json({
      totalNotifications,
      unreadNotifications,
      totalDeviceTokens,
      activeDeviceTokens,
      notificationsByType: notificationsByType.map(item => ({
        type: item.type,
        count: item._count.type
      }))
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas de notificações:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor' 
    });
  }
});

export default router;