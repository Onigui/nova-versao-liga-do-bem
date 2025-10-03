import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '@/middleware/auth';
import { query, body, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// Get user adoptions
router.get('/', authenticate, async (req: any, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    const userId = req.user.id;

    const where: any = { userId };

    if (status) {
      where.status = status;
    }

    const adoptions = await prisma.adoption.findMany({
      where,
      include: {
        animal: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            image: true
          }
        }
      },
      orderBy: { applicationDate: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await prisma.adoption.count({ where });

    res.json({
      adoptions,
      total,
      hasMore: (parseInt(offset as string) + parseInt(limit as string)) < total
    });
  } catch (error) {
    console.error('Get adoptions error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Update adoption status (admin only)
router.put('/:id/status', [
  authenticate,
  authorize('ADMIN'),
  body('status').isIn(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED']),
  body('notes').optional().isString().isLength({ max: 500 })
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    const adoption = await prisma.adoption.findUnique({
      where: { id },
      include: {
        animal: true,
        user: true
      }
    });

    if (!adoption) {
      return res.status(404).json({ error: 'Adoção não encontrada' });
    }

    const updateData: any = { status };

    if (status === 'APPROVED') {
      updateData.approvedDate = new Date();
    } else if (status === 'COMPLETED') {
      updateData.completedDate = new Date();
      // Mark animal as adopted
      await prisma.animal.update({
        where: { id: adoption.animalId },
        data: { isAdopted: true }
      });
    }

    if (notes) {
      updateData.notes = notes;
    }

    const updatedAdoption = await prisma.adoption.update({
      where: { id },
      data: updateData,
      include: {
        animal: {
          select: {
            name: true,
            species: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // TODO: Send notification to user about status change

    res.json({
      message: 'Status da adoção atualizado com sucesso',
      adoption: updatedAdoption
    });
  } catch (error) {
    console.error('Update adoption status error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get adoption statistics
router.get('/stats', async (req, res) => {
  try {
    const totalAdoptions = await prisma.adoption.count();

    const adoptionsByStatus = await prisma.adoption.groupBy({
      by: ['status'],
      _count: true
    });

    const monthlyAdoptions = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "applicationDate") as month,
        EXTRACT(YEAR FROM "applicationDate") as year,
        COUNT(*) as total_count
      FROM "adoptions" 
      WHERE "applicationDate" >= NOW() - INTERVAL '12 months'
      GROUP BY EXTRACT(YEAR FROM "applicationDate"), EXTRACT(MONTH FROM "applicationDate")
      ORDER BY year DESC, month DESC
    `;

    const adoptionRate = await prisma.adoption.count({
      where: { status: 'COMPLETED' }
    });

    const totalAnimals = await prisma.animal.count();

    res.json({
      overview: {
        total: totalAdoptions,
        completed: adoptionRate,
        adoptionRate: totalAnimals > 0 ? (adoptionRate / totalAnimals * 100).toFixed(1) : 0
      },
      byStatus: adoptionsByStatus,
      monthly: monthlyAdoptions
    });
  } catch (error) {
    console.error('Get adoption stats error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
