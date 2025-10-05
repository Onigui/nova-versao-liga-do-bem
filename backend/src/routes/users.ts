import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Get user profile
router.get('/profile', authenticate, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        membership: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Update user profile
router.put('/profile', authenticate, async (req: any, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const userId = req.user.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phone,
        avatar
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true
      }
    });

    res.json({
      message: 'Perfil atualizado com sucesso',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get user membership
router.get('/membership', authenticate, async (req: any, res) => {
  try {
    const membership = await prisma.membership.findUnique({
      where: { userId: req.user.id }
    });

    if (!membership) {
      return res.status(404).json({ error: 'Carteirinha não encontrada' });
    }

    res.json(membership);
  } catch (error) {
    console.error('Get membership error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
