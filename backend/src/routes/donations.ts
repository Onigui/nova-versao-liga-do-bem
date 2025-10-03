import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { optionalAuth } from '@/middleware/auth';
import { body, query, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// Create donation
router.post('/', [
  optionalAuth,
  body('amount').isDecimal({ decimal_digits: '0,2' }),
  body('method').isIn(['PIX', 'CREDIT_CARD', 'BANK_TRANSFER', 'CASH', 'OTHER']),
  body('description').optional().isString().isLength({ max: 200 }),
  body('isAnonymous').optional().isBoolean(),
  body('donorName').optional().isString().isLength({ min: 2, max: 100 }),
  body('donorEmail').optional().isEmail()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, method, description, isAnonymous, donorName, donorEmail } = req.body;
    const userId = req.user?.id;

    // Validate anonymous donation
    if (isAnonymous && (!donorName || !donorEmail)) {
      return res.status(400).json({ 
        error: 'Para doações anônimas, nome e email são obrigatórios' 
      });
    }

    // Create donation
    const donation = await prisma.donation.create({
      data: {
        userId: userId || null,
        amount: parseFloat(amount),
        method,
        description,
        isAnonymous: isAnonymous || false,
        donorName: isAnonymous ? donorName : null,
        donorEmail: isAnonymous ? donorEmail : null,
        status: 'PENDING'
      }
    });

    // TODO: Integrate with payment gateway (PIX, PagSeguro, etc.)
    // For now, we'll simulate a successful payment
    setTimeout(async () => {
      await prisma.donation.update({
        where: { id: donation.id },
        data: {
          status: 'COMPLETED',
          transactionId: `TXN_${Date.now()}`
        }
      });
    }, 2000);

    res.status(201).json({
      message: 'Doação criada com sucesso',
      donation: {
        id: donation.id,
        amount: donation.amount,
        method: donation.method,
        status: donation.status,
        createdAt: donation.createdAt
      }
    });
  } catch (error) {
    console.error('Create donation error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get user donations
router.get('/', [
  optionalAuth,
  query('status').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, limit = 20, offset = 0 } = req.query;
    const userId = req.user?.id;

    const where: any = {};
    
    if (userId) {
      where.userId = userId;
    } else {
      // For anonymous users, only show completed donations
      where.status = 'COMPLETED';
      where.isAnonymous = true;
    }

    if (status) {
      where.status = status;
    }

    const donations = await prisma.donation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      select: {
        id: true,
        amount: true,
        method: true,
        status: true,
        description: true,
        isAnonymous: true,
        donorName: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    const total = await prisma.donation.count({ where });

    res.json({
      donations,
      total,
      hasMore: (parseInt(offset as string) + parseInt(limit as string)) < total
    });
  } catch (error) {
    console.error('Get donations error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get donation by ID
router.get('/:id', optionalAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const donation = await prisma.donation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!donation) {
      return res.status(404).json({ error: 'Doação não encontrada' });
    }

    // Check if user can view this donation
    if (donation.userId && donation.userId !== userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    res.json(donation);
  } catch (error) {
    console.error('Get donation error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get donation statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const totalDonations = await prisma.donation.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
      _count: true
    });

    const monthlyDonations = await prisma.donation.groupBy({
      by: ['method'],
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      },
      _sum: { amount: true },
      _count: true
    });

    const recentDonations = await prisma.donation.findMany({
      where: { 
        status: 'COMPLETED',
        isAnonymous: false
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        amount: true,
        createdAt: true,
        user: {
          select: {
            name: true
          }
        }
      }
    });

    res.json({
      total: {
        amount: totalDonations._sum.amount || 0,
        count: totalDonations._count
      },
      monthly: monthlyDonations,
      recent: recentDonations
    });
  } catch (error) {
    console.error('Get donation stats error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
