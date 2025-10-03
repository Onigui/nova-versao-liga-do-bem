import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { optionalAuth } from '@/middleware/auth';
import { query, body, validationResult } from 'express-validator';

const router = Router();
const prisma = new PrismaClient();

// Get all events with filters
router.get('/', [
  query('type').optional().isString(),
  query('status').optional().isIn(['upcoming', 'past']),
  query('search').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, status, search } = req.query;
    
    const where: any = {
      isActive: true
    };

    if (type) where.type = type;

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { location: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Filter by status
    if (status === 'upcoming') {
      where.startDate = { gte: new Date() };
    } else if (status === 'past') {
      where.startDate = { lt: new Date() };
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        registrations: {
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { startDate: 'asc' }
    });

    res.json({
      events,
      total: events.length
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get event by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        registrations: {
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

    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Register for event
router.post('/:id/register', [
  optionalAuth,
  body('notes').optional().isString().isLength({ max: 200 })
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

    // Check if event exists and is active
    const event = await prisma.event.findUnique({
      where: { id }
    });

    if (!event) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    if (!event.isActive) {
      return res.status(400).json({ error: 'Evento não está mais ativo' });
    }

    if (event.startDate < new Date()) {
      return res.status(400).json({ error: 'Evento já começou' });
    }

    // Check if event has capacity
    if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
      return res.status(400).json({ error: 'Evento lotado' });
    }

    // Check if user is already registered
    const existingRegistration = await prisma.eventRegistration.findUnique({
      where: {
        eventId_userId: {
          eventId: id,
          userId
        }
      }
    });

    if (existingRegistration) {
      return res.status(400).json({ error: 'Você já está inscrito neste evento' });
    }

    // Create registration
    const registration = await prisma.eventRegistration.create({
      data: {
        eventId: id,
        userId,
        notes,
        status: 'REGISTERED'
      },
      include: {
        event: {
          select: {
            title: true,
            startDate: true,
            location: true
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

    // Update event attendee count
    await prisma.event.update({
      where: { id },
      data: {
        currentAttendees: {
          increment: 1
        }
      }
    });

    res.status(201).json({
      message: 'Inscrição realizada com sucesso',
      registration
    });
  } catch (error) {
    console.error('Event registration error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Get event types for filters
router.get('/meta/types', async (req, res) => {
  try {
    const types = await prisma.event.findMany({
      select: { type: true },
      distinct: ['type'],
      where: { isActive: true }
    });

    res.json({
      types: types.map(t => t.type)
    });
  } catch (error) {
    console.error('Get event types error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;
