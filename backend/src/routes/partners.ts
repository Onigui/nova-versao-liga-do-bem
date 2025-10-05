import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { body, query, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// Get all partners with optional location filter
router.get('/', [
  query('lat').optional().isFloat(),
  query('lng').optional().isFloat(),
  query('radius').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isString(),
  query('search').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { lat, lng, radius = 10, category, search } = req.query;
    const where: any = {
      isActive: true
    };

    // Filter by category
    if (category) {
      where.category = category;
    }

    // Search by name or description
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const partners = await prisma.partner.findMany({
      where,
      include: {
        services: true,
        discounts: {
          where: {
            isActive: true,
            validFrom: { lte: new Date() },
            OR: [
              { validUntil: null },
              { validUntil: { gte: new Date() } }
            ]
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // If location is provided, calculate distances and filter by radius
    let partnersWithDistance = partners;
    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const radiusKm = parseInt(radius as string);

      partnersWithDistance = partners
        .filter(partner => partner.latitude && partner.longitude)
        .map(partner => {
          const distance = calculateDistance(
            userLat, userLng,
            partner.latitude!, partner.longitude!
          );
          return { ...partner, distance };
        })
        .filter(partner => partner.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance);
    }

    res.json({
      partners: partnersWithDistance,
      total: partnersWithDistance.length
    });
  } catch (error) {
    console.error('Get partners error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get partner by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await prisma.partner.findUnique({
      where: { id },
      include: {
        services: true,
        discounts: {
          where: {
            isActive: true,
            validFrom: { lte: new Date() },
            OR: [
              { validUntil: null },
              { validUntil: { gte: new Date() } }
            ]
          }
        }
      }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Parceiro não encontrado' });
    }

    res.json(partner);
  } catch (error) {
    console.error('Get partner error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Validate member discount (QR Code scan)
router.post('/:id/validate', [
  authenticate,
  body('memberId').notEmpty(),
  body('discountId').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { memberId, discountId } = req.body;
    const userId = req.user!.id;

    // Find partner
    const partner = await prisma.partner.findUnique({
      where: { id }
    });

    if (!partner) {
      return res.status(404).json({ error: 'Parceiro não encontrado' });
    }

    // Find user's membership
    const membership = await prisma.membership.findFirst({
      where: {
        memberId,
        userId,
        status: 'ACTIVE'
      }
    });

    if (!membership) {
      return res.status(400).json({ error: 'Carteirinha inválida ou inativa' });
    }

    // Check if discount is valid
    let discount = null;
    if (discountId) {
      discount = await prisma.partnerDiscount.findFirst({
        where: {
          id: discountId,
          partnerId: id,
          isActive: true,
          validFrom: { lte: new Date() },
          OR: [
            { validUntil: null },
            { validUntil: { gte: new Date() } }
          ]
        }
      });

      if (!discount) {
        return res.status(400).json({ error: 'Desconto inválido ou expirado' });
      }
    }

    // Create validation record
    const validation = await prisma.partnerValidation.create({
      data: {
        partnerId: id,
        userId,
        discountId: discount?.id,
        amount: discount?.percentage || 0
      }
    });

    res.json({
      message: 'Desconto validado com sucesso',
      validation,
      discount: discount ? {
        name: discount.name,
        percentage: discount.percentage,
        fixedAmount: discount.fixedAmount
      } : null
    });
  } catch (error) {
    console.error('Validate discount error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get partner categories
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await prisma.partner.findMany({
      select: { category: true },
      distinct: ['category'],
      where: { isActive: true }
    });

    res.json({
      categories: categories.map(c => c.category)
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

export default router;
