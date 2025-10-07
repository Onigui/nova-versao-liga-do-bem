import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Interface para dados de pagamento
interface PaymentRequest {
  amount: number;
  description: string;
  type: 'DONATION' | 'MEMBERSHIP' | 'EVENT';
  userId?: string;
  email?: string;
  name?: string;
  phone?: string;
}

// Interface para resposta do gateway
interface GatewayResponse {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  paymentUrl?: string;
  qrCode?: string;
  expiresAt?: Date;
}

// Simulação de gateway de pagamento (Mercado Pago / PagSeguro)
const simulatePaymentGateway = async (paymentData: PaymentRequest): Promise<GatewayResponse> => {
  // Em produção, integrar com gateway real
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id: paymentId,
    status: 'PENDING',
    paymentUrl: `https://sandbox.pagamento.com/pay/${paymentId}`,
    qrCode: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutos
  };
};

// Criar pagamento
router.post('/', async (req: Request, res: Response) => {
  try {
    const { amount, description, type, email, name, phone } = req.body;

    if (!amount || !description || !type) {
      return res.status(400).json({
        message: 'Campos obrigatórios: amount, description, type'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        message: 'Valor deve ser maior que zero'
      });
    }

    // Criar pagamento no banco
    const payment = await prisma.payment.create({
      data: {
        amount,
        description,
        type,
        status: 'PENDING',
        userEmail: email,
        userName: name,
        userPhone: phone,
        gateway: 'SIMULATED',
        gatewayId: `temp_${Date.now()}`
      }
    });

    // Simular gateway de pagamento
    const gatewayResponse = await simulatePaymentGateway({
      amount,
      description,
      type,
      email,
      name,
      phone
    });

    // Atualizar pagamento com dados do gateway
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayId: gatewayResponse.id,
        paymentUrl: gatewayResponse.paymentUrl,
        qrCode: gatewayResponse.qrCode,
        expiresAt: gatewayResponse.expiresAt
      }
    });

    res.status(201).json({
      message: 'Pagamento criado com sucesso',
      payment: {
        id: updatedPayment.id,
        amount: updatedPayment.amount,
        description: updatedPayment.description,
        status: updatedPayment.status,
        paymentUrl: updatedPayment.paymentUrl,
        qrCode: updatedPayment.qrCode,
        expiresAt: updatedPayment.expiresAt
      }
    });

  } catch (error) {
    console.error('Erro ao criar pagamento:', error);
    res.status(500).json({
      message: 'Erro interno do servidor'
    });
  }
});

// Webhook para confirmação de pagamento
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { paymentId, status, gatewayData } = req.body;

    if (!paymentId || !status) {
      return res.status(400).json({
        message: 'paymentId e status são obrigatórios'
      });
    }

    // Buscar pagamento
    const payment = await prisma.payment.findUnique({
      where: { gatewayId: paymentId }
    });

    if (!payment) {
      return res.status(404).json({
        message: 'Pagamento não encontrado'
      });
    }

    // Atualizar status do pagamento
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: status.toUpperCase(),
        gatewayData: JSON.stringify(gatewayData),
        paidAt: status === 'APPROVED' ? new Date() : null
      }
    });

    // Se pagamento aprovado, processar
    if (status === 'APPROVED') {
      await processPaymentSuccess(updatedPayment);
    }

    res.status(200).json({
      message: 'Webhook processado com sucesso',
      paymentId: updatedPayment.id
    });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({
      message: 'Erro interno do servidor'
    });
  }
});

// Processar pagamento aprovado
async function processPaymentSuccess(payment: any) {
  try {
    // Se for mensalidade, ativar/renovar usuário
    if (payment.type === 'MEMBERSHIP' && payment.userEmail) {
      await prisma.user.upsert({
        where: { email: payment.userEmail },
        update: {
          isActive: true,
          membershipExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
          updatedAt: new Date()
        },
        create: {
          email: payment.userEmail,
          name: payment.userName || 'Membro',
          phone: payment.userPhone,
          password: 'temp_password', // Em produção, gerar senha temporária
          role: 'MEMBER',
          isActive: true,
          membershipExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });
    }

    // Registrar transação
    await prisma.transaction.create({
      data: {
        userId: payment.userId,
        amount: payment.amount,
        type: payment.type,
        description: payment.description,
        status: 'APPROVED',
        paymentId: payment.id
      }
    });

    console.log(`Pagamento processado com sucesso: ${payment.id}`);
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
  }
}

// Listar pagamentos (admin)
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, type } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
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

    const total = await prisma.payment.count({ where });

    res.json({
      payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('Erro ao listar pagamentos:', error);
    res.status(500).json({
      message: 'Erro interno do servidor'
    });
  }
});

// Obter estatísticas de pagamentos (admin)
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const [
      totalRevenue,
      monthlyRevenue,
      yearlyRevenue,
      totalTransactions,
      pendingPayments,
      approvedPayments
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: 'APPROVED' },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { 
          status: 'APPROVED',
          paidAt: { gte: startOfMonth }
        },
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { 
          status: 'APPROVED',
          paidAt: { gte: startOfYear }
        },
        _sum: { amount: true }
      }),
      prisma.payment.count({
        where: { status: 'APPROVED' }
      }),
      prisma.payment.count({
        where: { status: 'PENDING' }
      }),
      prisma.payment.count({
        where: { status: 'APPROVED' }
      })
    ]);

    res.json({
      stats: {
        totalRevenue: totalRevenue._sum.amount || 0,
        monthlyRevenue: monthlyRevenue._sum.amount || 0,
        yearlyRevenue: yearlyRevenue._sum.amount || 0,
        totalTransactions,
        pendingPayments,
        approvedPayments,
        conversionRate: totalTransactions > 0 ? (approvedPayments / (approvedPayments + pendingPayments)) * 100 : 0
      }
    });

  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      message: 'Erro interno do servidor'
    });
  }
});

// Obter pagamento por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
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

    if (!payment) {
      return res.status(404).json({
        message: 'Pagamento não encontrado'
      });
    }

    res.json({ payment });

  } catch (error) {
    console.error('Erro ao obter pagamento:', error);
    res.status(500).json({
      message: 'Erro interno do servidor'
    });
  }
});

// Simular confirmação de pagamento (para testes)
router.post('/:id/simulate-approval', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payment.findUnique({
      where: { id }
    });

    if (!payment) {
      return res.status(404).json({
        message: 'Pagamento não encontrado'
      });
    }

    if (payment.status !== 'PENDING') {
      return res.status(400).json({
        message: 'Pagamento já foi processado'
      });
    }

    // Simular aprovação
    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        status: 'APPROVED',
        paidAt: new Date(),
        gatewayData: JSON.stringify({ simulated: true, approvedAt: new Date() })
      }
    });

    // Processar pagamento
    await processPaymentSuccess(updatedPayment);

    res.json({
      message: 'Pagamento simulado com sucesso',
      payment: updatedPayment
    });

  } catch (error) {
    console.error('Erro ao simular pagamento:', error);
    res.status(500).json({
      message: 'Erro interno do servidor'
    });
  }
});

export default router;
