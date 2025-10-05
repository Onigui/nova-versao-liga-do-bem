import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { optionalAuth } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// Get all volunteers
router.get('/', async (req, res) => {
  try {
    const volunteers = await prisma.volunteerWork.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      volunteers,
      total: volunteers.length
    });
  } catch (error) {
    console.error('Get volunteers error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Register as volunteer
router.post('/register', [
  optionalAuth,
  body('role').notEmpty().isString().isLength({ min: 2, max: 100 }),
  body('description').optional().isString().isLength({ max: 500 }),
  body('startDate').isISO8601(),
  body('endDate').optional().isISO8601()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { role, description, startDate, endDate } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Check if user already has an active volunteer work
    const existingVolunteerWork = await prisma.volunteerWork.findFirst({
      where: {
        userId,
        isActive: true
      }
    });

    if (existingVolunteerWork) {
      return res.status(400).json({ 
        error: 'Você já possui um trabalho voluntário ativo' 
      });
    }

    // Create volunteer work
    const volunteerWork = await prisma.volunteerWork.create({
      data: {
        userId,
        role,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Registro de voluntário criado com sucesso',
      volunteerWork
    });
  } catch (error) {
    console.error('Register volunteer error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get volunteer statistics
router.get('/stats', async (req, res) => {
  try {
    const totalVolunteers = await prisma.volunteerWork.count({
      where: { isActive: true }
    });

    const volunteersByRole = await prisma.volunteerWork.groupBy({
      by: ['role'],
      where: { isActive: true },
      _count: true
    });

    const recentVolunteers = await prisma.volunteerWork.findMany({
      where: { isActive: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            avatar: true
          }
        }
      }
    });

    res.json({
      total: totalVolunteers,
      byRole: volunteersByRole,
      recent: recentVolunteers
    });
  } catch (error) {
    console.error('Get volunteer stats error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
