import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { query, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// Get financial reports
router.get('/reports', [
  query('year').optional().isInt({ min: 2020, max: 2030 }),
  query('type').optional().isIn(['MONTHLY', 'QUARTERLY', 'ANNUAL', 'SPECIAL'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { year, type } = req.query;
    
    const where: any = {
      isPublished: true
    };

    if (year) {
      where.year = parseInt(year as string);
    }

    if (type) {
      where.type = type;
    }

    const reports = await prisma.financialReport.findMany({
      where,
      include: {
        expenseItems: true
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    res.json({
      reports,
      total: reports.length
    });
  } catch (error) {
    console.error('Get financial reports error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get transparency statistics
router.get('/stats', async (req, res) => {
  try {
    // Get total donations
    const totalDonations = await prisma.donation.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
      _count: true
    });

    // Get total animals rescued
    const totalAnimals = await prisma.animal.count();

    // Get total adoptions
    const totalAdoptions = await prisma.adoption.count({
      where: { status: 'COMPLETED' }
    });

    // Get active volunteers
    const activeVolunteers = await prisma.volunteerWork.count({
      where: { isActive: true }
    });

    // Get events this year
    const currentYear = new Date().getFullYear();
    const eventsThisYear = await prisma.event.count({
      where: {
        startDate: {
          gte: new Date(currentYear, 0, 1),
          lt: new Date(currentYear + 1, 0, 1)
        }
      }
    });

    // Get monthly donations for chart
    const monthlyDonations = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "createdAt") as month,
        EXTRACT(YEAR FROM "createdAt") as year,
        SUM(amount) as total_amount,
        COUNT(*) as total_count
      FROM "donations" 
      WHERE status = 'APPROVED'
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY EXTRACT(YEAR FROM "createdAt"), EXTRACT(MONTH FROM "createdAt")
      ORDER BY year DESC, month DESC
    `;

    res.json({
      overview: {
        totalDonations: {
          amount: totalDonations._sum.amount || 0,
          count: totalDonations._count
        },
        totalAnimals,
        totalAdoptions,
        activeVolunteers,
        eventsThisYear
      },
      monthlyDonations
    });
  } catch (error) {
    console.error('Get transparency stats error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get organization info
router.get('/organization', async (req, res) => {
  try {
    const orgInfo = {
      name: 'Liga do Bem Botucatu',
      cnpj: '27.644.955/0001-38',
      address: {
        street: 'Rua Brasílio Panhozzi, 186',
        complement: 'A',
        neighborhood: 'Loteamento Jardim Eldorado',
        zipCode: '18608-785',
        city: 'Botucatu',
        state: 'SP'
      },
      contact: {
        email: 'administrativo@ligadobembotucatu.org.br',
        phone: '(14) 99822-5023'
      },
      founded: '2021',
      mission: 'Proteger e cuidar de animais abandonados e em situação de risco, proporcionando uma segunda chance de vida.',
      vision: 'Ser reconhecida como referência em proteção animal na região de Botucatu.',
      values: [
        'Amor pelos animais',
        'Transparência',
        'Solidariedade',
        'Responsabilidade social',
        'Sustentabilidade'
      ]
    };

    res.json(orgInfo);
  } catch (error) {
    console.error('Get organization info error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get impact metrics
router.get('/impact', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // Animals rescued this year
    const animalsRescuedThisYear = await prisma.animal.count({
      where: {
        createdAt: {
          gte: new Date(currentYear, 0, 1)
        }
      }
    });

    // Adoptions this year
    const adoptionsThisYear = await prisma.adoption.count({
      where: {
        status: 'APPROVED',
        completedDate: {
          gte: new Date(currentYear, 0, 1)
        }
      }
    });

    // Donations this year
    const donationsThisYear = await prisma.donation.aggregate({
      where: {
        status: 'APPROVED',
        createdAt: {
          gte: new Date(currentYear, 0, 1)
        }
      },
      _sum: { amount: true },
      _count: true
    });

    // Events this year
    const eventsThisYear = await prisma.event.count({
      where: {
        startDate: {
          gte: new Date(currentYear, 0, 1)
        }
      }
    });

    res.json({
      currentYear,
      metrics: {
        animalsRescued: animalsRescuedThisYear,
        adoptions: adoptionsThisYear,
        donations: {
          amount: donationsThisYear._sum.amount || 0,
          count: donationsThisYear._count
        },
        events: eventsThisYear
      }
    });
  } catch (error) {
    console.error('Get impact metrics error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
