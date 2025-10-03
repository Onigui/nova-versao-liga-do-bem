import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { optionalAuth } from '@/middleware/auth';
import { query, body, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// Get all animals with filters
router.get('/', [
  query('species').optional().isString(),
  query('gender').optional().isIn(['MALE', 'FEMALE']),
  query('size').optional().isIn(['SMALL', 'MEDIUM', 'LARGE']),
  query('isAdopted').optional().isBoolean(),
  query('search').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { species, gender, size, isAdopted, search } = req.query;
    
    const where: any = {
      isActive: true
    };

    if (species) where.species = species;
    if (gender) where.gender = gender;
    if (size) where.size = size;
    if (isAdopted !== undefined) where.isAdopted = isAdopted === 'true';

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { breed: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const animals = await prisma.animal.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      animals,
      total: animals.length
    });
  } catch (error) {
    console.error('Get animals error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get animal by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const animal = await prisma.animal.findUnique({
      where: { id },
      include: {
        adoptions: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!animal) {
      return res.status(404).json({ error: 'Animal não encontrado' });
    }

    res.json(animal);
  } catch (error) {
    console.error('Get animal error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Create adoption application
router.post('/:id/adopt', [
  optionalAuth,
  body('notes').optional().isString().isLength({ max: 500 })
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    // Check if animal exists and is available
    const animal = await prisma.animal.findUnique({
      where: { id }
    });

    if (!animal) {
      return res.status(404).json({ error: 'Animal não encontrado' });
    }

    if (animal.isAdopted) {
      return res.status(400).json({ error: 'Animal já foi adotado' });
    }

    // Check if user already has a pending application for this animal
    const existingApplication = await prisma.adoption.findFirst({
      where: {
        animalId: id,
        userId,
        status: 'PENDING'
      }
    });

    if (existingApplication) {
      return res.status(400).json({ error: 'Você já possui uma solicitação pendente para este animal' });
    }

    // Create adoption application
    const adoption = await prisma.adoption.create({
      data: {
        animalId: id,
        userId,
        notes,
        status: 'PENDING'
      },
      include: {
        animal: {
          select: {
            name: true,
            species: true,
            breed: true
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

    res.status(201).json({
      message: 'Solicitação de adoção enviada com sucesso',
      adoption
    });
  } catch (error) {
    console.error('Create adoption error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get animal species and breeds for filters
router.get('/meta/filters', async (req, res) => {
  try {
    const species = await prisma.animal.findMany({
      select: { species: true },
      distinct: ['species'],
      where: { isActive: true }
    });

    const breeds = await prisma.animal.findMany({
      select: { breed: true },
      distinct: ['breed'],
      where: { 
        isActive: true,
        breed: { not: null }
      }
    });

    res.json({
      species: species.map(s => s.species),
      breeds: breeds.map(b => b.breed).filter(Boolean)
    });
  } catch (error) {
    console.error('Get filters error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
