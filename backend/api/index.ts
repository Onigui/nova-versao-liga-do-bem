// Vercel Serverless Function - Com Prisma

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Busboy from 'busboy';
import fs from 'fs';
import path from 'path';

// Cloudinary para upload de imagens
let cloudinary: any = null;
function getCloudinary() {
  if (!cloudinary && process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      cloudinary = require('cloudinary').v2;
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    } catch (error) {
      console.warn('⚠️ Cloudinary não configurado:', error);
    }
  }
  return cloudinary;
}

let prisma: PrismaClient | null = null;

const JWT_SECRET = process.env.JWT_SECRET || 'liga-do-bem-secret-key';

/** Envia e-mail de recuperação de senha. Nunca loga o código. */
async function sendPasswordResetEmail(to: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const from =
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    '';

  // Preferência: Resend API
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from || 'Liga do Bem <onboarding@resend.dev>',
          to: [to],
          subject: 'Código para redefinir sua senha — Liga do Bem',
          text: `Seu código de recuperação é: ${code}\n\nEle vale por 15 minutos.\nSe você não pediu isso, ignore este e-mail.`,
          html: `<p>Seu código de recuperação é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;">${code}</p><p>Ele vale por <strong>15 minutos</strong>.</p><p>Se você não pediu isso, ignore este e-mail.</p>`,
        }),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => '');
        return { ok: false, error: `Resend: ${resp.status} ${detail}` };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Falha Resend' };
    }
  }

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { ok: false, error: 'SMTP/Resend não configurado' };
  }

  try {
    const nodemailer = require('nodemailer');
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: from || user,
      to,
      subject: 'Código para redefinir sua senha — Liga do Bem',
      text: `Seu código de recuperação é: ${code}\n\nEle vale por 15 minutos.\nSe você não pediu isso, ignore este e-mail.`,
      html: `<p>Seu código de recuperação é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px;">${code}</p><p>Ele vale por <strong>15 minutos</strong>.</p><p>Se você não pediu isso, ignore este e-mail.</p>`,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Falha SMTP' };
  }
}

function isEmailDeliveryConfigured(): boolean {
  if (process.env.RESEND_API_KEY) return true;
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Estima birthDate a partir da idade atual informada (em meses). */
function birthDateFromAgeMonths(months: number, fromDate: Date = new Date()): Date {
  const d = new Date(fromDate.getTime());
  const m = Math.max(0, Math.floor(Number(months) || 0));
  d.setMonth(d.getMonth() - m);
  return d;
}

/** Calcula idade em meses completos a partir de birthDate. */
function ageMonthsFromBirthDate(birthDate: Date | string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

/** Formata idade para exibição (PT-BR). */
function formatAnimalAgeLabel(months: number | null | undefined): string {
  if (months == null || Number.isNaN(months) || months < 0) return 'N/A';
  if (months < 1) return 'Menos de 1 mês';
  if (months < 12) return months === 1 ? '1 mês' : `${months} meses`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const yearsLabel = years === 1 ? '1 ano' : `${years} anos`;
  if (rem === 0) return yearsLabel;
  const monthsLabel = rem === 1 ? '1 mês' : `${rem} meses`;
  return `${yearsLabel} e ${monthsLabel}`;
}

/** Resolve idade atual do animal (prioriza birthDate; fallback no campo age estático). */
function resolveAnimalAge(animal: { birthDate?: Date | string | null; age?: number | null }) {
  const fromBirth = ageMonthsFromBirthDate(animal?.birthDate);
  const months = fromBirth != null ? fromBirth : (animal?.age != null ? Number(animal.age) : null);
  return {
    ageMonths: months,
    ageLabel: formatAnimalAgeLabel(months),
    age: months, // compatível com admin/forms que usam age em meses
  };
}

function getPrisma() {
  if (!prisma && process.env.DATABASE_URL) {
    prisma = new PrismaClient();
  }
  return prisma;
}

function generateToken(payload: any) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export default async function handler(req: any, res: any) {
  // CORS - Permitir todos os subdomínios Vercel
  // IMPORTANTE: Headers CORS devem ser definidos ANTES de qualquer processamento
  const origin = req.headers?.origin;
  
  // Log para debug - SEMPRE executar primeiro
  try {
    console.log('🔍 Request:', {
      method: req.method,
      path: req.url,
      origin: origin,
      'content-length': req.headers['content-length'],
      headers: {
        'content-type': req.headers['content-type'],
        'x-admin-token': req.headers['x-admin-token'] ? 'present' : 'missing',
        'authorization': req.headers['authorization'] ? 'present' : 'missing'
      }
    });
  } catch (logError) {
    console.error('❌ Erro ao fazer log:', logError);
  }
  
  // Sempre permitir subdomínios Vercel e localhost
  const allowedOrigins = [
    'https://nova-versao-liga-do-bem-admin.vercel.app',
    'https://nova-versao-liga-do-bem-web.vercel.app',
    'https://nova-versao-liga-do-bem-pufx.vercel.app',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8081'
  ];
  
  let allowOrigin = '*';
  if (origin) {
    // Se for subdomínio Vercel, permitir
    if (origin.includes('.vercel.app') || origin.includes('vercel.app') || origin.includes('localhost')) {
      allowOrigin = origin;
    } else if (allowedOrigins.includes(origin)) {
      allowOrigin = origin;
    }
  }
  
  // SEMPRE definir headers CORS primeiro, antes de qualquer processamento
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token, x-admin-token, Accept, Content-Length');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length');

  // Tratar OPTIONS (preflight) imediatamente
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS preflight request - retornando 200');
    return res.status(200).end();
  }

  // Get path - Vercel may pass different path formats
  // Try multiple sources: req.url, req.path, or query parameter
  let path = req.url?.replace(/\?.*$/, '') || req.path || req.query?.path || '/';
  const method = req.method || 'GET';

  // Log all available path information
  console.log(`🔍 Path debug:`, {
    'req.url': req.url,
    'req.path': req.path,
    'req.query': req.query,
    'raw path': path
  });

  // Normalize path - Vercel routes /api/(.*) to /api/index.ts
  // The path might come as /api/admin/companies/... or /admin/companies/...
  // Always normalize to include /api/ prefix for consistency
  if (!path.startsWith('/api/') && !path.startsWith('/ping')) {
    // If path starts with /admin/, add /api/ prefix
    if (path.startsWith('/admin/')) {
      path = '/api' + path;
    }
    // If path is just /, keep it
    else if (path !== '/') {
      // For other paths, try to add /api/ if it looks like an API route
      path = '/api' + (path.startsWith('/') ? '' : '/') + path;
    }
  }
  
  // DEBUG: Log após normalização
  if (path.includes('update/check') || req.url?.includes('update/check')) {
    console.log('🔍🔍🔍 DEBUG update/check APÓS normalização:', {
      path,
      method,
      'path === /api/app/update/check': path === '/api/app/update/check',
      'method === GET': method === 'GET',
      'matches condition': path === '/api/app/update/check' && method === 'GET'
    });
  }

  console.log(`📥 ${method} ${path}`);
  
  // DEBUG: Log específico para o endpoint de update/check
  if (path.includes('update/check') || req.url?.includes('update/check')) {
    console.log('🔍🔍🔍 DEBUG update/check ANTES dos endpoints:', {
      path,
      method,
      'req.url': req.url,
      'req.path': req.path,
      'path === /api/app/update/check': path === '/api/app/update/check',
      'method === GET': method === 'GET',
      'matches condition': path === '/api/app/update/check' && method === 'GET'
    });
  }
  
  // Parse body if present (skip for multipart/form-data - will be handled by busboy)
  const contentType = req.headers['content-type'] || '';
  const isMultipart = contentType.includes('multipart/form-data');
  
  let body = req.body;
  if (!isMultipart && req.method !== 'GET' && req.method !== 'HEAD' && typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // Body might already be parsed
    }
  }
  if (!body && !isMultipart) body = {};
  
  // Store parsed body (for non-multipart requests)
  if (!isMultipart) {
    req.body = body;
  }

  try {
    // GET transparency summary (public)
    if (path === '/api/transparency/summary' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const period = (req.query?.period || 'month').toString();
        const now = new Date();
        let start = new Date(now.getFullYear(), now.getMonth(), 1);
        if (period === 'quarter') {
          const q = Math.floor(now.getMonth() / 3) * 3;
          start = new Date(now.getFullYear(), q, 1);
        } else if (period === 'year') {
          start = new Date(now.getFullYear(), 0, 1);
        }

        const donationsAgg: any[] = await db.$queryRawUnsafe(
          `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*)::int AS count
           FROM donations
           WHERE status = 'APPROVED' AND "createdAt" >= $1`,
          start
        );

        const membershipsAgg: any[] = await db.$queryRawUnsafe(
          `SELECT COALESCE(SUM("monthlyFee"), 0) AS total, COUNT(*)::int AS count
           FROM memberships
           WHERE status = 'ACTIVE'`
        );

        const expenseRows: any[] = await db.$queryRawUnsafe(
          `SELECT e.category, COALESCE(SUM(e.amount), 0) AS total
           FROM financial_expenses e
           INNER JOIN financial_reports r ON r.id = e."reportId"
           WHERE r."isPublished" = true
             AND r.year = $1
             AND (r.month IS NULL OR r.month >= $2)
           GROUP BY e.category
           ORDER BY total DESC`,
          now.getFullYear(),
          period === 'year' ? 1 : period === 'quarter' ? Math.floor(now.getMonth() / 3) * 3 + 1 : now.getMonth() + 1
        );

        const categoryLabels: Record<string, { name: string; color: string }> = {
          FOOD: { name: 'Alimentação', color: '#10B981' },
          VETERINARY: { name: 'Veterinário', color: '#3B82F6' },
          INFRASTRUCTURE: { name: 'Abrigo', color: '#F59E0B' },
          MEDICATIONS: { name: 'Medicamentos', color: '#8B5CF6' },
          EVENTS: { name: 'Eventos', color: '#EC4899' },
          ADMINISTRATIVE: { name: 'Administrativo', color: '#6B7280' },
          TRANSPORT: { name: 'Transporte', color: '#14B8A6' },
          OTHER: { name: 'Outros', color: '#EC4899' },
        };

        const expensesTotal = (expenseRows || []).reduce(
          (sum, row) => sum + parseFloat(row.total?.toString?.() || '0'),
          0
        );

        const categories = (expenseRows || []).map((row) => {
          const value = parseFloat(row.total?.toString?.() || '0');
          const meta = categoryLabels[row.category] || {
            name: row.category,
            color: '#6B7280',
          };
          return {
            name: meta.name,
            value,
            percentage: expensesTotal > 0 ? (value / expensesTotal) * 100 : 0,
            color: meta.color,
          };
        });

        const donationsTotal = parseFloat(donationsAgg?.[0]?.total?.toString?.() || '0');
        const membershipsTotal = parseFloat(membershipsAgg?.[0]?.total?.toString?.() || '0');
        // Receita do período: doações no período + mensalidades ativas (referência)
        const income = donationsTotal + (period === 'month' ? membershipsTotal : membershipsTotal);
        const expenses = expensesTotal;
        const balance = income - expenses;

        const recentDonations: any[] = await db.$queryRawUnsafe(
          `SELECT d.amount, d."createdAt", d."isAnonymous", d."donorName", u.name AS user_name
           FROM donations d
           LEFT JOIN users u ON u.id = d."userId"
           WHERE d.status = 'APPROVED'
           ORDER BY d."createdAt" DESC
           LIMIT 8`
        );

        const recentExpenses: any[] = await db.$queryRawUnsafe(
          `SELECT e.description, e.amount, e."createdAt", e.category
           FROM financial_expenses e
           INNER JOIN financial_reports r ON r.id = e."reportId"
           WHERE r."isPublished" = true
           ORDER BY e."createdAt" DESC
           LIMIT 8`
        );

        const transactions = [
          ...(recentDonations || []).map((d) => ({
            type: 'income',
            title: d.isAnonymous
              ? 'Doação anônima'
              : `Doação - ${d.donorName || d.user_name || 'Membro'}`,
            amount: parseFloat(d.amount?.toString?.() || '0'),
            date: d.createdAt,
          })),
          ...(recentExpenses || []).map((e) => ({
            type: 'expense',
            title: e.description || e.category,
            amount: parseFloat(e.amount?.toString?.() || '0'),
            date: e.createdAt,
          })),
        ]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10);

        return res.status(200).json({
          period,
          income,
          expenses,
          balance,
          donations: donationsTotal,
          memberships: membershipsTotal,
          categories,
          transactions,
        });
      } catch (error: any) {
        console.error('❌ Erro transparency summary:', error);
        return res.status(500).json({
          error: 'Erro ao carregar transparência',
          detail: error?.message || String(error),
        });
      }
    }

    // Ping
    if (path === '/api/ping' || path === '/ping') {
      return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), hasDb: !!process.env.DATABASE_URL });
    }

    // GET /api/app/update/check - Verificar atualizações (public - for mobile app)
    // MOVENDO PARA O TOPO PARA GARANTIR QUE SEJA EXECUTADO
    console.log('🔍🔍🔍 ANTES DO IF update/check:', {
      path: JSON.stringify(path),
      method: JSON.stringify(method),
      pathLength: path?.length,
      methodLength: method?.length,
      'path === /api/app/update/check': path === '/api/app/update/check',
      'method === GET': method === 'GET',
      'path.includes(update/check)': path?.includes('update/check'),
      'method.includes(GET)': method?.includes('GET')
    });
    if (path === '/api/app/update/check' && method === 'GET') {
      console.log('✅✅✅ [update/check] Rota detectada NO TOPO! Path:', path, 'Method:', method);
      const db = getPrisma();
      if (!db) {
        console.error('❌ [update/check] Database not available');
        return res.status(503).json({
          error: 'Database not available'
        });
      }
      
      try {
        const { version, versionCode } = req.query;
        
        console.log('🔍 [update/check] Verificando atualizações...', {
          version,
          versionCode,
          query: req.query
        });

        // Buscar a versão mais recente ativa
        const latestVersion = await db.appVersion.findFirst({
          where: {
            isActive: true,
            platform: 'android'
          },
          orderBy: {
            versionCode: 'desc'
          }
        });

        console.log('📦 [update/check] Versão mais recente no banco:', latestVersion ? {
          id: latestVersion.id,
          version: latestVersion.version,
          versionCode: latestVersion.versionCode,
          isActive: latestVersion.isActive,
          apkUrl: latestVersion.apkUrl
        } : 'Nenhuma versão encontrada');

        if (!latestVersion) {
          console.log('ℹ️ [update/check] Nenhuma versão ativa encontrada');
          return res.json({
            hasUpdate: false,
            message: 'Nenhuma versão disponível'
          });
        }

        // Garantir que versionCode seja número
        const currentVersionCode = versionCode ? parseInt(String(versionCode), 10) : 0;
        const latestVersionCode = typeof latestVersion.versionCode === 'number' 
          ? latestVersion.versionCode 
          : parseInt(String(latestVersion.versionCode), 10);
        
        const hasUpdate = latestVersionCode > currentVersionCode;
        
        console.log('🔍 [update/check] Comparação:', {
          currentVersionCode,
          currentVersionCodeType: typeof currentVersionCode,
          latestVersionCode,
          latestVersionCodeType: typeof latestVersionCode,
          hasUpdate,
          currentVersion: version,
          latestVersion: latestVersion.version,
          comparison: `${latestVersionCode} > ${currentVersionCode} = ${hasUpdate}`
        });

        // Se apkUrl for uma URL do GitHub Release, usar diretamente
        // Caso contrário, usar o endpoint de download
        let apkUrl = null;
        if (hasUpdate && latestVersion.apkUrl) {
          if (latestVersion.apkUrl.startsWith('https://github.com/') || 
              latestVersion.apkUrl.startsWith('https://github-releases')) {
            // URL direta do GitHub Release
            apkUrl = latestVersion.apkUrl;
          } else {
            // URL relativa - construir URL do endpoint
            apkUrl = `/api/app/update/apk/${latestVersion.id}`;
          }
        }

        const responseData = {
          hasUpdate,
          currentVersionCode, // Adicionar para debug
          latestVersionCode, // Adicionar para debug
          latestVersion: hasUpdate ? {
            version: latestVersion.version,
            versionCode: latestVersionCode, // Usar o versionCode já convertido
            releaseNotes: latestVersion.releaseNotes,
            isMandatory: latestVersion.isMandatory,
            apkSize: latestVersion.apkSize,
            apkUrl: apkUrl, // URL direta para download
            versionId: latestVersion.id
          } : null
        };
        
        console.log('📤 [update/check] Enviando resposta:', JSON.stringify(responseData, null, 2));
        return res.json(responseData);
      } catch (error: any) {
        console.error('❌ [update/check] Erro ao verificar atualizações:', error);
        return res.status(500).json({
          error: 'Erro ao verificar atualizações',
          message: error.message
        });
      }
    }

    // Admin login
    if (path === '/api/admin/login' && method === 'POST') {
      const { email, password } = body;
      if (email === 'admin@ligadobem.com' && (password === 'admin123' || password === 'demo123')) {
        return res.status(200).json({
          success: true,
          token: 'demo-token-' + Date.now(),
          user: { id: 'demo-1', name: 'Admin Demo', email, role: 'admin' }
        });
      }
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Public stats endpoint (for mobile app)
    if (path === '/api/stats' && method === 'GET') {
      console.log('📊 Public stats request');
      const db = getPrisma();
      if (db) {
        try {
          const [totalAdoptions, totalAnimals, totalDonations, activePartners] = await Promise.all([
            db.adoption.count({ where: { status: 'COMPLETED' } }).catch((e) => { console.error('Error counting adoptions:', e); return 0; }),
            db.animal.count({ where: { isActive: true, isAdopted: false } }).catch((e) => { console.error('Error counting animals:', e); return 0; }),
            db.donation.aggregate({ 
              where: { status: 'APPROVED' },
              _sum: { amount: true } 
            }).catch((e) => { console.error('Error summing donations:', e); return { _sum: { amount: 0 } }; }),
            db.partner.count({ where: { isActive: true } }).catch((e) => { console.error('Error counting partners:', e); return 0; })
          ]);
          const donationTotal = totalDonations?._sum?.amount ? parseFloat(totalDonations._sum.amount.toString()) : 0;
          const response = {
            stats: {
              totalAdoptions: totalAdoptions || 0,
              totalAnimals: totalAnimals || 0,
              totalDonations: donationTotal || 0,
              totalPartners: activePartners || 0,
            }
          };
          console.log('✅ Public stats response:', response);
          return res.status(200).json(response);
        } catch (error: any) {
          console.error('❌ Public stats error:', error);
          return res.status(200).json({
            stats: {
              totalAdoptions: 0,
              totalAnimals: 0,
              totalDonations: 0,
              totalPartners: 0,
            }
          });
        }
      }
      console.log('⚠️ Public stats: No database');
      return res.status(200).json({
        stats: {
          totalAdoptions: 0,
          totalAnimals: 0,
          totalDonations: 0,
          totalPartners: 0,
        }
      });
    }

    // Admin dashboard
    if (path === '/api/admin/dashboard' && method === 'GET') {
      console.log('📊 Dashboard request');
      const db = getPrisma();
      if (db) {
        try {
          const [totalMembers, activePartners, totalAdoptions, totalAnimals, totalDonations] = await Promise.all([
            db.user.count().catch((e) => { console.error('Error counting users:', e); return 0; }),
            db.partner.count({ where: { isActive: true } }).catch((e) => { console.error('Error counting partners:', e); return 0; }),
            db.adoption.count({ where: { status: 'COMPLETED' } }).catch((e) => { console.error('Error counting adoptions:', e); return 0; }),
            db.animal.count({ where: { isActive: true, isAdopted: false } }).catch((e) => { console.error('Error counting animals:', e); return 0; }),
            db.donation.aggregate({ _sum: { amount: true } }).catch((e) => { console.error('Error summing donations:', e); return { _sum: { amount: 0 } }; })
          ]);
          const donationTotal = totalDonations?._sum?.amount ? parseFloat(totalDonations._sum.amount.toString()) : 0;
          const response = {
            stats: {
              totalMembers,
              activePartners,
              totalAdoptions,
              totalAnimals: totalAnimals || 0,
              totalPartners: activePartners || 0,
              totalDonations: donationTotal || 0,
              monthlyRevenue: 0
            }
          };
          console.log('✅ Dashboard response:', response);
          return res.status(200).json(response);
        } catch (error: any) {
          console.error('❌ Dashboard error:', error);
          return res.status(200).json({
            stats: {
              totalMembers: 0,
              activePartners: 0,
              totalAdoptions: 0,
              monthlyRevenue: 0
            }
          });
        }
      }
      console.log('⚠️ Dashboard: No database');
      return res.status(200).json({
        stats: {
          totalMembers: 0,
          activePartners: 0,
          totalAdoptions: 0,
          monthlyRevenue: 0
        }
      });
    }

    // Admin companies (partners) - GET all
    if (path === '/api/admin/companies' && method === 'GET') {
      const db = getPrisma();
      if (db) {
        const partners = await db.partner.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: {
            discounts: true
          }
        });
        // Map to expected format
        const companies = partners.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          status: p.isActive ? 'active' : 'inactive',
          discount: p.discounts?.[0]?.percentage ? `${p.discounts[0].percentage}%` : 'N/A',
          location: p.city || p.address,
          email: p.email,
          phone: p.phone,
          description: p.description
        }));
        return res.status(200).json({ companies, total: companies.length });
      }
      return res.status(200).json({ companies: [], total: 0, error: 'Database not configured' });
    }

    // Admin companies - POST (create)
    if (path === '/api/admin/companies' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { name, category, address, latitude, longitude, phone, email, description, status } = body;
        if (!name || !category) {
          return res.status(400).json({ error: 'Nome e categoria são obrigatórios' });
        }
        // Parse address to get city and state if needed
        const city = 'Botucatu'; // Default
        const state = 'SP'; // Default
        const zipCode = '18608-000'; // Default
        
        const partner = await db.partner.create({
          data: {
            name,
            category,
            address: address || 'Não informado',
            city,
            state,
            zipCode,
            latitude: latitude || null,
            longitude: longitude || null,
            phone: phone || null,
            email: email || null,
            description: description || null,
            isActive: status === 'active' || status === undefined
          }
        });
        return res.status(201).json({ message: 'Empresa cadastrada com sucesso', company: partner });
      } catch (error: any) {
        console.error('❌ Erro ao criar empresa:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao criar empresa' });
      }
    }

    // Admin companies - PATCH approve (check BEFORE generic routes)
    if ((path.includes('/api/admin/companies/') || path.includes('/admin/companies/')) && path.endsWith('/approve') && method === 'PATCH') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/companies\/([^\/]+)\/approve$/);
        if (!match) match = path.match(/\/admin\/companies\/([^\/]+)\/approve$/);
        const companyId = match?.[1];
        if (!companyId) {
          return res.status(400).json({ error: 'ID da empresa é obrigatório' });
        }
        const partner = await db.partner.update({
          where: { id: companyId },
          data: { isActive: true }
        });
        return res.status(200).json({ message: 'Empresa aprovada com sucesso', company: partner });
      } catch (error: any) {
        console.error('❌ Erro ao aprovar empresa:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao aprovar empresa' });
      }
    }

    // Admin companies - PATCH reject (check BEFORE generic routes)
    if ((path.includes('/api/admin/companies/') || path.includes('/admin/companies/')) && path.endsWith('/reject') && method === 'PATCH') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/companies\/([^\/]+)\/reject$/);
        if (!match) match = path.match(/\/admin\/companies\/([^\/]+)\/reject$/);
        const companyId = match?.[1];
        if (!companyId) {
          return res.status(400).json({ error: 'ID da empresa é obrigatório' });
        }
        const partner = await db.partner.update({
          where: { id: companyId },
          data: { isActive: false }
        });
        return res.status(200).json({ message: 'Empresa rejeitada com sucesso', company: partner });
      } catch (error: any) {
        console.error('❌ Erro ao rejeitar empresa:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao rejeitar empresa' });
      }
    }

    // Admin companies - PUT (update by ID)
    if ((path.startsWith('/api/admin/companies/') || path.match(/^\/api\/admin\/companies\/[^\/]+$/)) && method === 'PUT') {
      console.log('🔧 PUT /api/admin/companies/:id detected');
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Try multiple regex patterns to extract ID
        let match = path.match(/\/api\/admin\/companies\/([^\/]+)$/);
        if (!match) {
          match = path.match(/\/admin\/companies\/([^\/]+)$/);
        }
        if (!match) {
          match = path.match(/\/companies\/([^\/]+)$/);
        }
        
        const companyId = match?.[1];
        console.log(`🔍 Extracted company ID: ${companyId} from path: ${path}`);
        
        if (!companyId) {
          return res.status(400).json({ error: 'ID da empresa é obrigatório', path, match });
        }
        const { name, category, city, state, zipCode, address, email, phone, description } = body;
        
        console.log(`💾 Updating company ${companyId} with data:`, { name, category, city, state });
        
        const updateData: any = {};
        if (name) updateData.name = name;
        if (category) updateData.category = category;
        if (city) updateData.city = city;
        if (state) updateData.state = state;
        if (zipCode) updateData.zipCode = zipCode;
        if (address) updateData.address = address;
        if (email !== undefined) updateData.email = email || null;
        if (phone !== undefined) updateData.phone = phone || null;
        if (description !== undefined) updateData.description = description || null;
        
        const partner = await db.partner.update({
          where: { id: companyId },
          data: updateData
        });
        console.log('✅ Company updated successfully:', partner.id);
        return res.status(200).json({ message: 'Empresa atualizada com sucesso', company: partner });
      } catch (error: any) {
        console.error('❌ Erro ao atualizar empresa:', error);
        console.error('❌ Error details:', { message: error?.message, code: error?.code, path });
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao atualizar empresa' });
      }
    }

    // Admin companies - DELETE
    if ((path.startsWith('/api/admin/companies/') || path.match(/^\/api\/admin\/companies\/[^\/]+$/)) && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/companies\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/companies\/([^\/]+)$/);
        const companyId = match?.[1];
        if (!companyId) {
          return res.status(400).json({ error: 'ID da empresa é obrigatório' });
        }
        await db.partner.delete({
          where: { id: companyId }
        });
        return res.status(200).json({ message: 'Empresa deletada com sucesso' });
      } catch (error: any) {
        console.error('❌ Erro ao deletar empresa:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Empresa não encontrada' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao deletar empresa' });
      }
    }

    // Admin members - GET all
    if (path === '/api/admin/members' && method === 'GET') {
      const db = getPrisma();
      if (db) {
        const members = await db.user.findMany({
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            avatar: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
          }
        });
        return res.status(200).json({ members, total: members.length });
      }
      return res.status(200).json({ members: [], total: 0 });
    }

    // Admin members - PUT (update by ID)
    if ((path.startsWith('/api/admin/members/') || path.match(/^\/api\/admin\/members\/[^\/]+$/)) && method === 'PUT') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/members\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/members\/([^\/]+)$/);
        const memberId = match?.[1];
        if (!memberId) {
          return res.status(400).json({ error: 'ID do membro é obrigatório' });
        }
        const { name, email, phone, role, status, points } = body;
        
        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone || null;
        if (role) updateData.role = role;
        // Map status to isActive
        if (status !== undefined) {
          updateData.isActive = status === 'active' || status === true;
        }
        // Note: points field doesn't exist in User model, so we ignore it
        
        const member = await db.user.update({
          where: { id: memberId },
          data: updateData
        });
        return res.status(200).json({ message: 'Membro atualizado com sucesso', member });
      } catch (error: any) {
        console.error('❌ Erro ao atualizar membro:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Membro não encontrado' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao atualizar membro' });
      }
    }

    // Admin members - DELETE
    if ((path.startsWith('/api/admin/members/') || path.match(/^\/api\/admin\/members\/[^\/]+$/)) && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/members\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/members\/([^\/]+)$/);
        const memberId = match?.[1];
        if (!memberId) {
          return res.status(400).json({ error: 'ID do membro é obrigatório' });
        }
        await db.user.delete({
          where: { id: memberId }
        });
        return res.status(200).json({ message: 'Membro deletado com sucesso' });
      } catch (error: any) {
        console.error('❌ Erro ao deletar membro:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Membro não encontrado' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao deletar membro' });
      }
    }

    // Auth - Login
    if (path === '/api/auth/login' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { email, password } = body;
        
        if (!email || !password) {
          return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        console.log('🔐 Login attempt:', email);

        // Find user (tentar buscar cpf se coluna existir)
        let user: any;
        try {
          user = await db.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              password: true,
              name: true,
              phone: true,
              avatar: true,
              notificationsEnabled: true,
              locationEnabled: true,
              role: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
              cpf: true, // Tentar buscar CPF
            }
          });
        } catch (error: any) {
          // Se colunas não existirem, buscar sem elas
          if (error.message?.includes('cpf') || error.message?.includes('notificationsEnabled') || error.message?.includes('locationEnabled') || error.code === 'P2021') {
            console.warn('⚠️ Algumas colunas não existem ainda, buscando usuário sem elas');
            user = await db.user.findUnique({
              where: { email },
              select: {
                id: true,
                email: true,
                password: true,
                name: true,
                phone: true,
                avatar: true,
                role: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
              }
            });
            if (user) {
              (user as any).cpf = null;
              (user as any).notificationsEnabled = true; // Default
              (user as any).locationEnabled = true; // Default
            }
          } else {
            throw error;
          }
        }

        if (!user) {
          console.log('❌ User not found:', email);
          return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        console.log('👤 User found:', { id: user.id, email: user.email, isActive: user.isActive });
        console.log('🔑 Password hash starts with:', user.password.substring(0, 10));

        // Check if password is hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
        const isPasswordHashed = user.password.startsWith('$2a$') || 
                                 user.password.startsWith('$2b$') || 
                                 user.password.startsWith('$2y$');

        let isPasswordValid = false;

        if (isPasswordHashed) {
          // Password is hashed, use bcrypt.compare
          console.log('🔐 Comparing with bcrypt (hashed password)');
          isPasswordValid = await bcrypt.compare(password, user.password);
        } else {
          // Password is not hashed (legacy user), compare directly
          console.log('⚠️ Password is not hashed (legacy user), comparing directly');
          isPasswordValid = password === user.password;
          
          // If direct comparison works, hash the password for future use
          if (isPasswordValid) {
            console.log('✅ Legacy password match, updating to hashed password...');
            const hashedPassword = await bcrypt.hash(password, 12);
            await db.user.update({
              where: { id: user.id },
              data: { password: hashedPassword }
            });
            console.log('✅ Password updated to hashed format');
          }
        }

        if (!isPasswordValid) {
          console.log('❌ Invalid password for:', email);
          return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Check if user is active
        if (!user.isActive) {
          return res.status(401).json({ error: 'Usuário inativo' });
        }

        // Generate JWT
        const token = generateToken({
          userId: user.id,
          email: user.email,
          role: user.role
        });

        console.log('✅ Login successful:', user.id);

        // Preparar dados do usuário para retorno
        const userData: any = {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role
        };
        
        // Adicionar CPF se existir e for válido (não pode ser zeros ou vazio)
        if ('cpf' in user && user.cpf && user.cpf.trim() !== '' && user.cpf !== '00000000000') {
          userData.cpf = user.cpf;
        } else {
          userData.cpf = null;
        }

        return res.status(200).json({
          message: 'Login realizado com sucesso',
          user: userData,
          token
        });
      } catch (error: any) {
        console.error('❌ Login error:', error);
        return res.status(500).json({ error: error?.message || 'Erro interno do servidor' });
      }
    }

    // Auth - Register
    if (path === '/api/auth/register' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { email, name, phone, password, cpf } = body;
        
        // Validações obrigatórias
        if (!email || !name || !password) {
          return res.status(400).json({ error: 'Email, nome e senha são obrigatórios' });
        }

        // CPF é obrigatório no cadastro
        if (!cpf || !cpf.trim()) {
          return res.status(400).json({ error: 'CPF é obrigatório para cadastro' });
        }

        // Validar formato do CPF (11 dígitos)
        const cpfClean = cpf.replace(/\D/g, '');
        if (cpfClean.length !== 11) {
          return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos' });
        }

        console.log('📝 Register attempt:', email, 'CPF:', cpfClean);

        // Verificar se email já existe
        const existingUserByEmail = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
          }
        });

        if (existingUserByEmail) {
          return res.status(400).json({ error: 'Usuário já existe com este email' });
        }

        // Verificar se CPF já está em uso (só se coluna existir)
        try {
          const existingUserByCpf = await db.user.findFirst({
            where: { cpf: cpfClean },
            select: {
              id: true,
              email: true,
            }
          });

          if (existingUserByCpf) {
            return res.status(400).json({ error: 'CPF já cadastrado. Este CPF já está em uso por outra conta' });
          }
        } catch (error: any) {
          // Se coluna cpf não existir ainda, apenas logar aviso
          if (error.message?.includes('cpf') || error.code === 'P2021') {
            console.warn('⚠️ Coluna cpf não existe ainda, pulando verificação de duplicidade de CPF');
          } else {
            throw error;
          }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        console.log('🔄 Criando usuário com dados:', { email, name, hasCpf: !!cpfClean });

        // Gerar ID único (usando cuid ou uuid)
        const userId = require('crypto').randomUUID();

        // Criar usuário usando SQL direto para ter controle total sobre as colunas
        // Isso evita que o Prisma tente usar colunas que não existem no banco
        try {
          // Verificar se coluna CPF existe antes de tentar inserir
          let cpfExists = false;
          
          if (cpfClean) {
            try {
              // Tentar verificar se a coluna CPF existe
              await db.$queryRaw`SELECT "cpf" FROM "users" LIMIT 1`;
              cpfExists = true;
              console.log('✅ Coluna CPF existe, será incluída na criação');
            } catch (cpfCheckError: any) {
              if (cpfCheckError.message?.includes('column') && cpfCheckError.message?.includes('does not exist')) {
                console.warn('⚠️ Coluna CPF não existe, criando usuário sem CPF');
                cpfExists = false;
              } else {
                throw cpfCheckError;
              }
            }
          }

          // Criar usuário usando SQL direto - apenas com colunas que existem
          // IMPORTANTE: role é um enum, precisa fazer cast
          if (cpfExists && cpfClean) {
            await db.$executeRaw`
              INSERT INTO "users" (
                "id", 
                "email", 
                "name", 
                "phone", 
                "password", 
                "role", 
                "isActive", 
                "createdAt", 
                "updatedAt",
                "cpf"
              ) VALUES (
                ${userId}, 
                ${email}, 
                ${name}, 
                ${phone || null}, 
                ${hashedPassword}, 
                ${'MEMBER'}::"UserRole", 
                ${true}, 
                NOW(), 
                NOW(),
                ${cpfClean}
              )
            `;
          } else {
            await db.$executeRaw`
              INSERT INTO "users" (
                "id", 
                "email", 
                "name", 
                "phone", 
                "password", 
                "role", 
                "isActive", 
                "createdAt", 
                "updatedAt"
              ) VALUES (
                ${userId}, 
                ${email}, 
                ${name}, 
                ${phone || null}, 
                ${hashedPassword}, 
                ${'MEMBER'}::"UserRole", 
                ${true}, 
                NOW(), 
                NOW()
              )
            `;
          }

          console.log('✅ Usuário criado com SQL direto:', userId);

          // Buscar o usuário criado usando Prisma (apenas campos que existem)
          const user = await db.user.findUnique({
            where: { id: userId },
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              role: true,
              createdAt: true
            }
          });

          if (!user) {
            throw new Error('Usuário criado mas não foi possível recuperá-lo');
          }

          // Adicionar CPF na resposta se foi salvo
          (user as any).cpf = (cpfExists && cpfClean) ? cpfClean : null;
          
          return res.status(201).json({
            message: 'Usuário criado com sucesso',
            user,
            token: generateToken({
              userId: user.id,
              email: user.email,
              role: user.role
            })
          });

        } catch (error: any) {
          console.error('❌ Erro ao criar usuário com SQL direto:', error);
          console.error('❌ Detalhes do erro:', {
            code: error.code,
            message: error.message,
            meta: error.meta,
          });
          throw error;
        }
      } catch (error: any) {
        console.error('❌ Register error:', error);
        return res.status(500).json({ error: error?.message || 'Erro interno do servidor' });
      }
    }

    // Auth - Forgot password (código SOMENTE por e-mail — nunca na resposta)
    if (path === '/api/auth/forgot-password' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const email = (body?.email || '').toString().trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: 'Informe um e-mail válido' });
        }

        // Sem e-mail configurado: bloqueia o fluxo (nunca devolver código no app)
        if (!isEmailDeliveryConfigured()) {
          console.error('❌ Recuperação de senha: SMTP/Resend não configurado');
          return res.status(503).json({
            error:
              'Recuperação de senha temporariamente indisponível. Entre em contato com a Liga do Bem para redefinir sua senha.',
            emailRequired: true,
          });
        }

        const genericMessage =
          'Se o e-mail estiver cadastrado, enviamos um código para redefinir a senha. Verifique sua caixa de entrada e o spam.';

        // Rate limit simples: no máximo 3 pedidos em 15 min por e-mail
        const recent: any[] = await db.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS c FROM password_reset_tokens
           WHERE lower(email) = lower($1) AND "createdAt" > NOW() - INTERVAL '15 minutes'`,
          email
        );
        if ((recent?.[0]?.c || 0) >= 3) {
          return res.status(429).json({
            error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
          });
        }

        const user = await db.user.findUnique({
          where: { email },
          select: { id: true, email: true, isActive: true },
        });

        // Sempre a mesma resposta se o e-mail não existir (anti-enumeração)
        if (!user || !user.isActive) {
          return res.status(200).json({
            message: genericMessage,
            sent: true,
            expiresInMinutes: 15,
          });
        }

        const crypto = require('crypto');
        const code = String(crypto.randomInt(100000, 1000000));
        const codeHash = await bcrypt.hash(code, 10);
        const tokenId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

        await db.$executeRawUnsafe(
          `UPDATE password_reset_tokens SET "usedAt" = NOW() WHERE email = $1 AND "usedAt" IS NULL`,
          email
        );

        await db.$executeRawUnsafe(
          `INSERT INTO password_reset_tokens (id, email, code, "expiresAt", "createdAt")
           VALUES ($1, $2, $3, $4, NOW())`,
          tokenId,
          email,
          codeHash,
          expiresAt
        );

        const mail = await sendPasswordResetEmail(email, code);
        if (!mail.ok) {
          await db.$executeRawUnsafe(
            `UPDATE password_reset_tokens SET "usedAt" = NOW() WHERE id = $1`,
            tokenId
          );
          console.error('❌ Falha ao enviar e-mail de recuperação:', mail.error);
          return res.status(503).json({
            error:
              'Não foi possível enviar o e-mail de recuperação. Tente novamente mais tarde ou contate a Liga do Bem.',
          });
        }

        console.log(`📧 Código de recuperação enviado por e-mail para ${email}`);

        return res.status(200).json({
          message: genericMessage,
          sent: true,
          expiresInMinutes: 15,
          delivery: 'email',
        });
      } catch (error: any) {
        console.error('❌ Forgot password error:', error);
        return res.status(500).json({ error: 'Erro ao processar recuperação de senha' });
      }
    }

    // Auth - Reset password with code
    if (path === '/api/auth/reset-password' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const email = (body?.email || '').toString().trim().toLowerCase();
        const code = (body?.code || '').toString().trim();
        const newPassword = (body?.newPassword || body?.password || '').toString();

        if (!email || !code || !newPassword) {
          return res.status(400).json({
            error: 'E-mail, código e nova senha são obrigatórios',
          });
        }
        if (!/^\d{6}$/.test(code)) {
          return res.status(400).json({ error: 'Código inválido' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
        }

        const rows: Array<{
          id: string;
          email: string;
          code: string;
          expiresAt: Date;
          usedAt: Date | null;
        }> = await db.$queryRawUnsafe(
          `SELECT id, email, code, "expiresAt", "usedAt"
           FROM password_reset_tokens
           WHERE lower(email) = lower($1) AND "usedAt" IS NULL AND "expiresAt" > NOW()
           ORDER BY "createdAt" DESC
           LIMIT 5`,
          email
        );

        let matched: (typeof rows)[0] | null = null;
        for (const row of rows || []) {
          const stored = (row.code || '').toString();
          // Aceita hash bcrypt (novo) — nunca plaintext em produção
          if (stored.startsWith('$2')) {
            const ok = await bcrypt.compare(code, stored);
            if (ok) {
              matched = row;
              break;
            }
          }
        }

        if (!matched) {
          return res.status(400).json({ error: 'Código inválido ou expirado' });
        }

        const users: Array<{ id: string }> = await db.$queryRawUnsafe(
          `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
          email
        );
        const user = users?.[0];
        if (!user) {
          return res.status(400).json({ error: 'Código inválido ou expirado' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await db.$executeRawUnsafe(
          `UPDATE users SET password = $1, "updatedAt" = NOW() WHERE id = $2`,
          hashedPassword,
          user.id
        );

        // Invalida este e quaisquer outros códigos pendentes do e-mail
        await db.$executeRawUnsafe(
          `UPDATE password_reset_tokens SET "usedAt" = NOW() WHERE lower(email) = lower($1) AND "usedAt" IS NULL`,
          email
        );

        return res.status(200).json({
          message: 'Senha redefinida com sucesso. Faça login com a nova senha.',
        });
      } catch (error: any) {
        console.error('❌ Reset password error:', error);
        return res.status(500).json({
          error: 'Erro ao redefinir senha',
        });
      }
    }

    // Partners - GET all (public, only active)
    if (path === '/api/partners' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(200).json({ partners: [] });
      }
      try {
        const partners = await db.partner.findMany({
          where: { isActive: true },
          orderBy: { name: 'asc' },
          include: {
            discounts: {
              where: {
                validFrom: { lte: new Date() },
                validUntil: { gte: new Date() }
              },
              take: 1
            }
          }
        });

        // Map to expected format
        const formattedPartners = partners.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          description: p.description || 'Parceiro da Liga do Bem',
          address: p.address || `${p.city || ''}${p.state ? ` - ${p.state}` : ''}`.trim(),
          phone: p.phone,
          email: p.email,
          latitude: p.latitude ? parseFloat(p.latitude.toString()) : null,
          longitude: p.longitude ? parseFloat(p.longitude.toString()) : null,
          city: p.city,
          state: p.state,
          discount: p.discounts?.[0]?.percentage ? `${p.discounts[0].percentage}%` : null
        }));

        console.log(`✅ Partners loaded: ${formattedPartners.length}`);
        return res.status(200).json({ partners: formattedPartners });
      } catch (error: any) {
        console.error('❌ Error loading partners:', error);
        return res.status(200).json({ partners: [] });
      }
    }

    // --- Admin Animals Endpoints ---
    // GET all animals (admin)
    if (path === '/api/admin/animals' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const animals = await db.animal.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            adoptions: {
              where: { status: 'PENDING' },
              take: 1
            }
          }
        });
        const enriched = animals.map((a: any) => {
          const resolved = resolveAnimalAge(a);
          return {
            ...a,
            age: resolved.ageMonths,
            ageMonths: resolved.ageMonths,
            ageLabel: resolved.ageLabel,
            birthDate: a.birthDate || null,
          };
        });
        return res.status(200).json({ animals: enriched, total: enriched.length });
      } catch (error: any) {
        console.error('❌ Erro ao listar animais:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar animais' });
      }
    }

    // POST create animal (admin)
    if (path === '/api/admin/animals' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { name, species, breed, age, birthDate, gender, size, description, image, isVaccinated, isCastrated, hasSpecialNeeds, specialNeeds, isActive } = body;
        if (!name || !species || !gender || !size) {
          return res.status(400).json({ error: 'Nome, espécie, gênero e porte são obrigatórios' });
        }

        let resolvedBirthDate: Date | null = null;
        let ageMonths: number | null = null;
        if (birthDate) {
          resolvedBirthDate = new Date(birthDate);
          ageMonths = ageMonthsFromBirthDate(resolvedBirthDate);
        } else if (age !== undefined && age !== null && age !== '') {
          ageMonths = parseInt(String(age), 10);
          if (!Number.isNaN(ageMonths)) {
            resolvedBirthDate = birthDateFromAgeMonths(ageMonths);
          } else {
            ageMonths = null;
          }
        }

        const animal = await db.animal.create({
          data: {
            name,
            species,
            breed: breed || null,
            age: ageMonths,
            birthDate: resolvedBirthDate,
            gender,
            size,
            description: description || null,
            image: image || null,
            isVaccinated: isVaccinated || false,
            isCastrated: isCastrated || false,
            hasSpecialNeeds: hasSpecialNeeds || false,
            specialNeeds: specialNeeds || null,
            isActive: isActive !== undefined ? isActive : true,
            isAdopted: false
          } as any
        });
        const resolved = resolveAnimalAge(animal as any);
        return res.status(201).json({
          message: 'Animal cadastrado com sucesso',
          animal: { ...animal, age: resolved.ageMonths, ageMonths: resolved.ageMonths, ageLabel: resolved.ageLabel },
        });
      } catch (error: any) {
        console.error('❌ Erro ao criar animal:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao criar animal' });
      }
    }

    // PUT update animal (admin)
    if ((path.startsWith('/api/admin/animals/') || path.match(/^\/api\/admin\/animals\/[^\/]+$/)) && method === 'PUT') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/animals\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/animals\/([^\/]+)$/);
        const animalId = match?.[1];
        if (!animalId) {
          return res.status(400).json({ error: 'ID do animal é obrigatório' });
        }
        const { name, species, breed, age, birthDate, gender, size, description, image, isVaccinated, isCastrated, hasSpecialNeeds, specialNeeds, isActive, isAdopted } = body;
        const existing: any = await db.animal.findUnique({ where: { id: animalId } });
        if (!existing) {
          return res.status(404).json({ error: 'Animal não encontrado' });
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (species) updateData.species = species;
        if (breed !== undefined) updateData.breed = breed || null;
        if (gender) updateData.gender = gender;
        if (size) updateData.size = size;
        if (description !== undefined) updateData.description = description || null;
        if (image !== undefined) updateData.image = image || null;
        if (isVaccinated !== undefined) updateData.isVaccinated = isVaccinated;
        if (isCastrated !== undefined) updateData.isCastrated = isCastrated;
        if (hasSpecialNeeds !== undefined) updateData.hasSpecialNeeds = hasSpecialNeeds;
        if (specialNeeds !== undefined) updateData.specialNeeds = specialNeeds || null;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isAdopted !== undefined) updateData.isAdopted = isAdopted;

        // Idade: birthDate explícito OU correção da idade atual em meses
        if (birthDate !== undefined) {
          if (birthDate) {
            const bd = new Date(birthDate);
            updateData.birthDate = bd;
            updateData.age = ageMonthsFromBirthDate(bd);
          } else {
            updateData.birthDate = null;
            if (age !== undefined) updateData.age = age ? parseInt(String(age), 10) : null;
          }
        } else if (age !== undefined) {
          if (age === null || age === '') {
            updateData.age = null;
            updateData.birthDate = null;
          } else {
            const ageMonths = parseInt(String(age), 10);
            if (!Number.isNaN(ageMonths)) {
              const currentMonths = resolveAnimalAge(existing).ageMonths;
              if (!existing.birthDate) {
                // Primeira definição: ancora na data de cadastro
                updateData.age = ageMonths;
                updateData.birthDate = birthDateFromAgeMonths(ageMonths, existing.createdAt || new Date());
              } else if (currentMonths !== ageMonths) {
                // Correção explícita da idade atual
                updateData.age = ageMonths;
                updateData.birthDate = birthDateFromAgeMonths(ageMonths);
              }
              // Se a idade informada = idade atual calculada, não mexe no birthDate
            }
          }
        }

        const animal = await db.animal.update({
          where: { id: animalId },
          data: updateData
        });
        const resolved = resolveAnimalAge(animal as any);
        return res.status(200).json({
          message: 'Animal atualizado com sucesso',
          animal: { ...animal, age: resolved.ageMonths, ageMonths: resolved.ageMonths, ageLabel: resolved.ageLabel },
        });
      } catch (error: any) {
        console.error('❌ Erro ao atualizar animal:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Animal não encontrado' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao atualizar animal' });
      }
    }

    // DELETE animal (admin)
    if ((path.startsWith('/api/admin/animals/') || path.match(/^\/api\/admin\/animals\/[^\/]+$/)) && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/animals\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/animals\/([^\/]+)$/);
        const animalId = match?.[1];
        if (!animalId) {
          return res.status(400).json({ error: 'ID do animal é obrigatório' });
        }
        await db.animal.delete({ where: { id: animalId } });
        return res.status(200).json({ message: 'Animal deletado com sucesso' });
      } catch (error: any) {
        console.error('❌ Erro ao deletar animal:', error);
        if (error?.code === 'P2025') {
          return res.status(404).json({ error: 'Animal não encontrado' });
        }
        return res.status(500).json({ error: error?.message || 'Erro ao deletar animal' });
      }
    }

    // --- Public Animals Endpoint (for mobile app) ---
    if (path === '/api/animals' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(200).json({ animals: [] });
      }
      try {
        const animals = await db.animal.findMany({
          where: { 
            isActive: true,
            isAdopted: false
          },
          orderBy: { createdAt: 'desc' }
        });
        // Format for mobile app — idade sempre calculada a partir de birthDate
        const formattedAnimals = animals.map((a: any) => {
          const resolved = resolveAnimalAge(a);
          return {
          id: a.id,
          name: a.name,
          species: a.species === 'DOG' ? 'Cachorro' : a.species === 'CAT' ? 'Gato' : a.species === 'BIRD' ? 'Ave' : a.species === 'RABBIT' ? 'Coelho' : 'Outro',
          breed: a.breed || 'Vira-Lata',
          age: resolved.ageLabel,
          ageMonths: resolved.ageMonths,
          birthDate: a.birthDate || null,
          gender: a.gender === 'MALE' ? 'Macho' : 'Fêmea',
          size: a.size === 'SMALL' ? 'Pequeno' : a.size === 'MEDIUM' ? 'Médio' : 'Grande',
          photo: a.image || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400',
          photos: a.image ? [a.image] : ['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400'],
          vaccinated: a.isVaccinated,
          neutered: a.isCastrated,
          description: a.description || 'Este animal está procurando um lar cheio de amor!',
          color: 'Não informado', // Campo não existe no schema, mas pode ser adicionado depois
          rescueDate: a.createdAt.toISOString().split('T')[0],
          hasSpecialNeeds: a.hasSpecialNeeds || false,
          specialNeeds: a.specialNeeds || null
        };
        });
        return res.status(200).json({ animals: formattedAnimals, total: formattedAnimals.length });
      } catch (error: any) {
        console.error('❌ Erro ao listar animais públicos:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar animais' });
      }
    }

    // --- Admin Events Endpoints ---
    // GET all events (admin)
    if (path === '/api/admin/events' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const events = await db.event.findMany({
          orderBy: { startDate: 'desc' },
          include: {
            registrations: {
              where: { status: 'REGISTERED' },
            }
          }
        });
        return res.status(200).json({ events, total: events.length });
      } catch (error: any) {
        console.error('❌ Erro ao listar eventos:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar eventos' });
      }
    }

    // POST create event (admin)
    if (path === '/api/admin/events' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { title, description, type, startDate, endDate, location, address, latitude, longitude, maxAttendees, image, isActive } = body;
        if (!title || !type || !startDate) {
          return res.status(400).json({ error: 'Título, tipo e data de início são obrigatórios' });
        }
        const event = await db.event.create({
          data: {
            title,
            description: description || null,
            type,
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : null,
            location: location || null,
            address: address || null,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
            image: image || null,
            isActive: isActive !== undefined ? isActive : true,
            currentAttendees: 0
          }
        });
        return res.status(201).json({ message: 'Evento cadastrado com sucesso', event });
      } catch (error: any) {
        console.error('❌ Erro ao criar evento:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao criar evento' });
      }
    }

    // PUT update event (admin)
    if ((path.startsWith('/api/admin/events/') || path.match(/^\/api\/admin\/events\/[^\/]+$/)) && method === 'PUT') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/events\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/events\/([^\/]+)$/);
        const eventId = match?.[1];
        if (!eventId) {
          return res.status(400).json({ error: 'ID do evento é obrigatório' });
        }
        const { title, description, type, startDate, endDate, location, address, latitude, longitude, maxAttendees, image, isActive } = body;
        const updateData: any = {};
        if (title) updateData.title = title;
        if (description !== undefined) updateData.description = description || null;
        if (type) updateData.type = type;
        if (startDate) updateData.startDate = new Date(startDate);
        if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
        if (location !== undefined) updateData.location = location || null;
        if (address !== undefined) updateData.address = address || null;
        if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null;
        if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null;
        if (maxAttendees !== undefined) updateData.maxAttendees = maxAttendees ? parseInt(maxAttendees) : null;
        if (image !== undefined) updateData.image = image || null;
        if (isActive !== undefined) updateData.isActive = isActive;
        const event = await db.event.update({
          where: { id: eventId },
          data: updateData
        });
        return res.status(200).json({ message: 'Evento atualizado com sucesso', event });
      } catch (error: any) {
        console.error('❌ Erro ao atualizar evento:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao atualizar evento' });
      }
    }

    // DELETE event (admin)
    if ((path.startsWith('/api/admin/events/') || path.match(/^\/api\/admin\/events\/[^\/]+$/)) && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        let match = path.match(/\/api\/admin\/events\/([^\/]+)$/);
        if (!match) match = path.match(/\/admin\/events\/([^\/]+)$/);
        const eventId = match?.[1];
        if (!eventId) {
          return res.status(400).json({ error: 'ID do evento é obrigatório' });
        }
        await db.event.delete({
          where: { id: eventId }
        });
        return res.status(200).json({ message: 'Evento excluído com sucesso' });
      } catch (error: any) {
        console.error('❌ Erro ao excluir evento:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao excluir evento' });
      }
    }

    // --- Public Events Endpoint (for mobile app) ---
    if (path === '/api/events' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(200).json({ events: [] });
      }
      try {
        const events = await db.event.findMany({
          where: { 
            isActive: true,
            startDate: { gte: new Date() } // Apenas eventos futuros
          },
          orderBy: { startDate: 'asc' },
          include: {
            registrations: {
              where: { status: 'REGISTERED' },
            }
          }
        });
        // Format for mobile app
        const formattedEvents = events.map(e => {
          const startDate = new Date(e.startDate);
          const endDate = e.endDate ? new Date(e.endDate) : null;
          const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
          const monthAbbr = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
          
          const categoryMap: any = {
            'ADOPTION_FAIR': 'Adoção',
            'FUNDRAISING': 'Arrecadação',
            'VOLUNTEER_MEETING': 'Voluntariado',
            'MEDICAL_CAMPAIGN': 'Saúde',
            'EDUCATION': 'Educação',
            'OTHER': 'Outro'
          };

          // Formatar horários usando timezone do Brasil
          // O JavaScript converte automaticamente de UTC para o timezone especificado
          let timeStr = '';
          if (endDate) {
            const startTime = startDate.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
            const endTime = endDate.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
            timeStr = `${startTime} - ${endTime}`;
          } else {
            timeStr = startDate.toLocaleTimeString('pt-BR', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo'
            });
          }

          // Formatar data também usando timezone do Brasil
          const dateStr = startDate.toLocaleDateString('en-CA', { 
            timeZone: 'America/Sao_Paulo',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });

          // Obter mês e dia usando timezone do Brasil
          const startDateBrazil = new Date(startDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));

          return {
            id: e.id,
            title: e.title,
            description: e.description || 'Participe e faça a diferença!',
            date: dateStr,
            time: timeStr,
            location: e.location || 'Local a definir',
            address: e.address || null,
            category: categoryMap[e.type] || 'Outro',
            type: e.type,
            vacancies: e.maxAttendees || 0,
            registered: e.registrations.length,
            image: e.image || 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400',
            month: monthNames[startDateBrazil.getMonth()],
            monthAbbr: monthAbbr[startDateBrazil.getMonth()],
            day: startDateBrazil.getDate(),
          };
        });
        return res.status(200).json({ events: formattedEvents, total: formattedEvents.length });
      } catch (error: any) {
        console.error('❌ Erro ao listar eventos públicos:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar eventos' });
      }
    }

    // --- Event Registration Endpoints (for mobile app) ---
    // GET check if user is registered in event
    if (path.startsWith('/api/events/') && path.endsWith('/registration') && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Extract event ID from path
        const eventId = path.replace('/api/events/', '').replace('/registration', '');
        
        // Get user from token
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        let userId = null;
        if (token) {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            userId = decoded.userId || decoded.id;
          } catch (e) {
            // Token inválido, continuar sem userId
          }
        }
        
        if (!userId) {
          return res.status(200).json({ isRegistered: false });
        }
        
        const registration = await db.eventRegistration.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId
            }
          }
        });
        
        return res.status(200).json({ 
          isRegistered: !!registration && registration.status === 'REGISTERED',
          registration: registration ? {
            id: registration.id,
            status: registration.status,
            createdAt: registration.createdAt
          } : null
        });
      } catch (error: any) {
        console.error('❌ Erro ao verificar registro:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao verificar registro' });
      }
    }

    // POST register for event
    if (path.startsWith('/api/events/') && path.endsWith('/register') && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Extract event ID from path
        const eventId = path.replace('/api/events/', '').replace('/register', '');
        
        // Get user from token
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        // Check if event exists
        const event = await db.event.findUnique({
          where: { id: eventId }
        });
        
        if (!event) {
          return res.status(404).json({ error: 'Evento não encontrado' });
        }
        
        if (!event.isActive) {
          return res.status(400).json({ error: 'Evento não está mais ativo' });
        }
        
        if (new Date(event.startDate) < new Date()) {
          return res.status(400).json({ error: 'Evento já começou' });
        }
        
        // Check if event has capacity
        if (event.maxAttendees && event.currentAttendees >= event.maxAttendees) {
          return res.status(400).json({ error: 'Evento lotado' });
        }
        
        // Check if user is already registered
        const existingRegistration = await db.eventRegistration.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId
            }
          }
        });
        
        if (existingRegistration) {
          if (existingRegistration.status === 'REGISTERED') {
            return res.status(400).json({ error: 'Você já está inscrito neste evento' });
          } else {
            // Re-register if previously cancelled
            await db.eventRegistration.update({
              where: { id: existingRegistration.id },
              data: { status: 'REGISTERED' }
            });
            await db.event.update({
              where: { id: eventId },
              data: { currentAttendees: { increment: 1 } }
            });
            return res.status(200).json({ 
              message: 'Inscrição realizada com sucesso',
              registration: existingRegistration
            });
          }
        }
        
        // Create registration
        const registration = await db.eventRegistration.create({
          data: {
            eventId,
            userId,
            status: 'REGISTERED',
            notes: body.notes || null
          }
        });
        
        // Update event attendee count
        await db.event.update({
          where: { id: eventId },
          data: {
            currentAttendees: { increment: 1 }
          }
        });
        
        return res.status(201).json({ 
          message: 'Inscrição realizada com sucesso! Nos vemos lá! 🎉',
          registration 
        });
      } catch (error: any) {
        console.error('❌ Erro ao registrar em evento:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao registrar em evento' });
      }
    }

    // DELETE cancel event registration
    if (path.startsWith('/api/events/') && path.endsWith('/register') && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Extract event ID from path
        const eventId = path.replace('/api/events/', '').replace('/register', '');
        
        // Get user from token
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        // Find registration
        const registration = await db.eventRegistration.findUnique({
          where: {
            eventId_userId: {
              eventId,
              userId
            }
          }
        });
        
        if (!registration || registration.status !== 'REGISTERED') {
          return res.status(404).json({ error: 'Inscrição não encontrada' });
        }
        
        // Update registration status to CANCELLED
        await db.eventRegistration.update({
          where: { id: registration.id },
          data: { status: 'CANCELLED' }
        });
        
        // Decrease event attendee count
        await db.event.update({
          where: { id: eventId },
          data: {
            currentAttendees: { decrement: 1 }
          }
        });
        
        return res.status(200).json({ 
          message: 'Inscrição cancelada com sucesso',
          registration 
        });
      } catch (error: any) {
        console.error('❌ Erro ao cancelar inscrição:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao cancelar inscrição' });
      }
    }

    // --- Event Registrations List (admin) ---
    if (path.startsWith('/api/admin/events/') && path.endsWith('/registrations') && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Extract event ID from path
        const eventId = path.replace('/api/admin/events/', '').replace('/registrations', '');
        
        const registrations = await db.eventRegistration.findMany({
          where: {
            eventId,
            status: 'REGISTERED'
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            event: {
              select: {
                title: true,
                startDate: true,
                location: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        return res.status(200).json({ 
          registrations: registrations.map(r => ({
            id: r.id,
            userId: r.userId,
            userName: r.user.name,
            userEmail: r.user.email,
            userPhone: r.user.phone,
            status: r.status,
            notes: r.notes,
            createdAt: r.createdAt,
            eventTitle: r.event.title,
            eventDate: r.event.startDate,
            eventLocation: r.event.location
          })),
          total: registrations.length
        });
      } catch (error: any) {
        console.error('❌ Erro ao listar inscrições:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao listar inscrições' });
      }
    }

    // --- Adoption Request Endpoint (for mobile app) ---
    if (path === '/api/adoptions/request' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { animalId, userId, name, email, phone, message, visitDate } = body;
        if (!animalId || (!userId && (!name || !email))) {
          return res.status(400).json({ error: 'ID do animal e dados de contato são obrigatórios' });
        }
        // Se userId não foi fornecido, criar ou buscar usuário pelo email
        let finalUserId = userId;
        if (!userId && email) {
          let user = await db.user.findUnique({ 
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              role: true,
            }
          });
          if (!user) {
            // Criar usuário temporário (sem senha, apenas para registro de interesse)
            user = await db.user.create({
              data: {
                email,
                name: name || 'Visitante',
                phone: phone || null,
                password: 'temp-' + Date.now(), // Senha temporária
                role: 'MEMBER',
                isActive: true
              }
            });
          }
          finalUserId = user.id;
        }
        if (!finalUserId) {
          return res.status(400).json({ error: 'Não foi possível identificar o usuário' });
        }
        // Criar registro de adoção
        const adoption = await db.adoption.create({
          data: {
            animalId,
            userId: finalUserId,
            status: 'PENDING',
            notes: message || `Interesse em visitar. ${visitDate ? `Data sugerida: ${visitDate}` : ''}`
          }
        });
        return res.status(201).json({ 
          message: 'Solicitação de visita registrada com sucesso! Um voluntário entrará em contato em breve.',
          adoption 
        });
      } catch (error: any) {
        console.error('❌ Erro ao registrar interesse em adoção:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao registrar interesse' });
      }
    }

    // ==========================================
    // APP CONFIGURATION ENDPOINTS
    // ==========================================

    // GET help info (public - for mobile app)
    if (path === '/api/app/help-info' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const helpInfos = await db.helpInfo.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          select: {
            id: true,
            category: true,
            title: true,
            description: true,
            items: true,
            order: true,
          }
        });
        return res.status(200).json({ helpInfos });
      } catch (error: any) {
        console.error('❌ Error loading help info:', error);
        // Se a tabela não existir ainda, retornar array vazio
        if (error.message?.includes('does not exist') || error.code === 'P2021') {
          return res.status(200).json({ helpInfos: [] });
        }
        return res.status(500).json({ error: 'Error loading help information' });
      }
    }

    // GET app configuration (public endpoint for mobile app)
    if (path === '/api/app/config' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const configs = await db.systemConfig.findMany({
          where: { isPublic: true },
        });
        console.log('📊 Configurações públicas encontradas:', configs.length);
        const configObject: any = {};
        configs.forEach((config) => {
          if (config.type === 'JSON') {
            try {
              configObject[config.key] = JSON.parse(config.value);
            } catch {
              configObject[config.key] = config.value;
            }
          } else if (config.type === 'BOOLEAN') {
            configObject[config.key] = config.value === 'true';
          } else if (config.type === 'NUMBER') {
            configObject[config.key] = parseFloat(config.value);
          } else {
            configObject[config.key] = config.value;
          }
        });
        console.log('✅ Configurações retornadas:', Object.keys(configObject));
        return res.status(200).json(configObject);
      } catch (error: any) {
        console.error('❌ Error loading app config:', error);
        return res.status(500).json({ error: 'Error loading configuration' });
      }
    }

    // GET app configuration (admin - all configs)
    if (path === '/api/admin/app/config' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        // Aceitar token demo ou JWT válido
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            // Token inválido
          }
        }
        if (!isAuthorized) {
          return res.status(401).json({ error: 'Invalid token' });
        }

        const configs = await db.systemConfig.findMany({
          orderBy: { key: 'asc' },
        });
        const configObject: any = {};
        configs.forEach((config) => {
          if (config.type === 'JSON') {
            try {
              configObject[config.key] = JSON.parse(config.value);
            } catch {
              configObject[config.key] = config.value;
            }
          } else if (config.type === 'BOOLEAN') {
            configObject[config.key] = config.value === 'true';
          } else if (config.type === 'NUMBER') {
            configObject[config.key] = parseFloat(config.value);
          } else {
            configObject[config.key] = config.value;
          }
        });
        return res.status(200).json(configObject);
      } catch (error: any) {
        console.error('❌ Error loading admin app config:', error);
        return res.status(500).json({ error: 'Error loading configuration' });
      }
    }

    // PUT app configuration (admin only)
    if (path === '/api/admin/app/config' && method === 'PUT') {
      console.log('📝 PUT /api/admin/app/config - Request received');
      const db = getPrisma();
      if (!db) {
        console.error('❌ Database not configured');
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          console.error('❌ No token provided');
          return res.status(401).json({ error: 'Unauthorized' });
        }
        // Aceitar token demo ou JWT válido
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
          console.log('✅ Demo token accepted');
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
              console.log('✅ Token verified, role:', decoded.role);
            }
          } catch {
            console.error('❌ Invalid token');
          }
        }
        if (!isAuthorized) {
          return res.status(401).json({ error: 'Invalid token' });
        }

        const {
          logoUrl,
          appName,
          appSubtitle,
          loginLogoUrl,
          loginAppName,
          loginIcon,
          loginIconImage,
          pixKey,
          pixHolderName,
          pixCity,
        } = body;

        // Update or create configs
        const configsToUpdate = [
          { key: 'app.logoUrl', value: logoUrl || '', type: 'STRING', isPublic: true },
          { key: 'app.name', value: appName || 'Liga do Bem', type: 'STRING', isPublic: true },
          { key: 'app.subtitle', value: appSubtitle || 'Botucatu', type: 'STRING', isPublic: true },
          { key: 'login.logoUrl', value: loginLogoUrl || '', type: 'STRING', isPublic: true },
          { key: 'login.appName', value: loginAppName || 'Liga do Bem', type: 'STRING', isPublic: true },
          { key: 'login.icon', value: loginIcon || '🐾', type: 'STRING', isPublic: true },
          { key: 'login.iconImage', value: loginIconImage || '', type: 'STRING', isPublic: true },
        ];

        // PIX: só atualiza se o campo veio no body (permite salvar branding sem apagar PIX)
        if (pixKey !== undefined) {
          configsToUpdate.push({
            key: 'donation.pixKey',
            value: String(pixKey || '').replace(/\D/g, '') || String(pixKey || ''),
            type: 'STRING',
            isPublic: true,
          });
        }
        if (pixHolderName !== undefined) {
          configsToUpdate.push({
            key: 'donation.pixHolderName',
            value: String(pixHolderName || 'Liga do Bem Botucatu'),
            type: 'STRING',
            isPublic: true,
          });
        }
        if (pixCity !== undefined) {
          configsToUpdate.push({
            key: 'donation.pixCity',
            value: String(pixCity || 'Botucatu'),
            type: 'STRING',
            isPublic: true,
          });
        }

        for (const config of configsToUpdate) {
          await db.systemConfig.upsert({
            where: { key: config.key },
            update: {
              value: config.value,
              type: config.type as any,
              isPublic: config.isPublic,
            },
            create: {
              key: config.key,
              value: config.value,
              type: config.type as any,
              isPublic: config.isPublic,
            },
          });
        }

        return res.status(200).json({ message: 'Configuration updated successfully' });
      } catch (error: any) {
        console.error('❌ Error updating app config:', error);
        return res.status(500).json({ error: 'Error updating configuration' });
      }
    }

    // ============ HELP INFO ENDPOINTS (ADMIN) ============
    
    // GET all help info (admin)
    if (path === '/api/admin/help-info' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            isAuthorized = false;
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const helpInfos = await db.helpInfo.findMany({
          orderBy: { order: 'asc' },
        });
        return res.status(200).json({ helpInfos });
      } catch (error: any) {
        console.error('❌ Error loading help info:', error);
        return res.status(500).json({ error: 'Error loading help information' });
      }
    }

    // POST help info (admin)
    if (path === '/api/admin/help-info' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            isAuthorized = false;
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const { category, title, description, items, order, isActive } = body;
        if (!category || !title || !items) {
          return res.status(400).json({ error: 'Category, title and items are required' });
        }

        const helpInfo = await db.helpInfo.create({
          data: {
            category,
            title,
            description: description || null,
            items: items,
            order: order || 0,
            isActive: isActive !== undefined ? isActive : true,
          },
        });

        return res.status(201).json({ helpInfo });
      } catch (error: any) {
        console.error('❌ Error creating help info:', error);
        if (error.code === 'P2002') {
          return res.status(400).json({ error: 'Category already exists' });
        }
        return res.status(500).json({ error: 'Error creating help information' });
      }
    }

    // PUT help info (admin)
    if (path.startsWith('/api/admin/help-info/') && method === 'PUT') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            isAuthorized = false;
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const id = path.split('/api/admin/help-info/')[1];
        const { category, title, description, items, order, isActive } = body;

        const helpInfo = await db.helpInfo.update({
          where: { id },
          data: {
            ...(category && { category }),
            ...(title && { title }),
            ...(description !== undefined && { description }),
            ...(items && { items }),
            ...(order !== undefined && { order }),
            ...(isActive !== undefined && { isActive }),
          },
        });

        return res.status(200).json({ helpInfo });
      } catch (error: any) {
        console.error('❌ Error updating help info:', error);
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Help info not found' });
        }
        return res.status(500).json({ error: 'Error updating help information' });
      }
    }

    // DELETE help info (admin)
    if (path.startsWith('/api/admin/help-info/') && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            isAuthorized = false;
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const id = path.split('/api/admin/help-info/')[1];
        await db.helpInfo.delete({
          where: { id },
        });

        return res.status(200).json({ message: 'Help info deleted successfully' });
      } catch (error: any) {
        console.error('❌ Error deleting help info:', error);
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Help info not found' });
        }
        return res.status(500).json({ error: 'Error deleting help information' });
      }
    }

    // ============ PETS ENDPOINTS ============
    
    // GET user pets
    if (path === '/api/user/pets' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            return res.status(401).json({ error: 'Token inválido' });
          }
        } catch (e: any) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }

        const pets = await db.pet.findMany({
          where: { userId },
          include: {
            vaccinations: {
              orderBy: { applicationDate: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return res.status(200).json({ pets });
      } catch (error: any) {
        console.error('❌ Error loading pets:', error);
        if (error.message?.includes('does not exist') || error.code === 'P2021') {
          return res.status(200).json({ pets: [] });
        }
        return res.status(500).json({ error: 'Error loading pets' });
      }
    }

    // POST user pet
    if (path === '/api/user/pets' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            return res.status(401).json({ error: 'Token inválido' });
          }
        } catch (e: any) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }

        const { name, species, breed, birthDate, photo, gender, color, weight, microchip, notes } = body;
        if (!name || !species) {
          return res.status(400).json({ error: 'Nome e espécie são obrigatórios' });
        }

        const pet = await db.pet.create({
          data: {
            userId,
            name,
            species,
            breed: breed || null,
            birthDate: birthDate ? new Date(birthDate) : null,
            photo: photo || null,
            gender: gender || null,
            color: color || null,
            weight: weight || null,
            microchip: microchip || null,
            notes: notes || null,
          },
          include: {
            vaccinations: true,
          },
        });

        return res.status(201).json({ pet });
      } catch (error: any) {
        console.error('❌ Error creating pet:', error);
        if (error.code === 'P2003') {
          return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
        }
        if (error.message?.includes('does not exist') || error.code === 'P2021') {
          return res.status(503).json({ error: 'Tabela de pets não configurada no banco. Contate o suporte.' });
        }
        return res.status(500).json({ error: 'Erro ao criar pet. Tente novamente.' });
      }
    }

    // GET user pet by id
    if (path.startsWith('/api/user/pets/') && method === 'GET' && !path.includes('/vaccinations')) {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            return res.status(401).json({ error: 'Token inválido' });
          }
        } catch (e: any) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }

        const petId = path.split('/api/user/pets/')[1];
        const pet = await db.pet.findFirst({
          where: { id: petId, userId },
          include: {
            vaccinations: {
              orderBy: { applicationDate: 'desc' },
            },
          },
        });

        if (!pet) {
          return res.status(404).json({ error: 'Pet não encontrado' });
        }

        return res.status(200).json({ pet });
      } catch (error: any) {
        console.error('❌ Error loading pet:', error);
        return res.status(500).json({ error: 'Error loading pet' });
      }
    }

    // PUT user pet
    if (path.startsWith('/api/user/pets/') && method === 'PUT' && !path.includes('/vaccinations')) {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            return res.status(401).json({ error: 'Token inválido' });
          }
        } catch (e: any) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }

        const petId = path.split('/api/user/pets/')[1];
        const { name, species, breed, birthDate, photo, gender, color, weight, microchip, notes } = body;

        const pet = await db.pet.update({
          where: { id: petId },
          data: {
            ...(name && { name }),
            ...(species && { species }),
            ...(breed !== undefined && { breed }),
            ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
            ...(photo !== undefined && { photo }),
            ...(gender !== undefined && { gender }),
            ...(color !== undefined && { color }),
            ...(weight !== undefined && { weight }),
            ...(microchip !== undefined && { microchip }),
            ...(notes !== undefined && { notes }),
          },
          include: {
            vaccinations: {
              orderBy: { applicationDate: 'desc' },
            },
          },
        });

        // Verificar se o pet pertence ao usuário
        if (pet.userId !== userId) {
          return res.status(403).json({ error: 'Acesso negado' });
        }

        return res.status(200).json({ pet });
      } catch (error: any) {
        console.error('❌ Error updating pet:', error);
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Pet não encontrado' });
        }
        return res.status(500).json({ error: 'Error updating pet' });
      }
    }

    // DELETE user pet
    if (path.startsWith('/api/user/pets/') && method === 'DELETE' && !path.includes('/vaccinations')) {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            return res.status(401).json({ error: 'Token inválido' });
          }
        } catch (e: any) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }

        const petId = path.split('/api/user/pets/')[1];
        const pet = await db.pet.findFirst({
          where: { id: petId, userId },
        });

        if (!pet) {
          return res.status(404).json({ error: 'Pet não encontrado' });
        }

        await db.pet.delete({
          where: { id: petId },
        });

        return res.status(200).json({ message: 'Pet deletado com sucesso' });
      } catch (error: any) {
        console.error('❌ Error deleting pet:', error);
        return res.status(500).json({ error: 'Error deleting pet' });
      }
    }

    // ============ VACCINATIONS ENDPOINTS ============
    
    // GET pet vaccinations
    if (path.startsWith('/api/user/pets/') && path.endsWith('/vaccinations') && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            return res.status(401).json({ error: 'Token inválido' });
          }
        } catch (e: any) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }

        const petId = path.split('/api/user/pets/')[1].replace('/vaccinations', '');
        const pet = await db.pet.findFirst({
          where: { id: petId, userId },
        });

        if (!pet) {
          return res.status(404).json({ error: 'Pet não encontrado' });
        }

        const vaccinations = await db.vaccination.findMany({
          where: { petId },
          orderBy: { applicationDate: 'desc' },
        });

        return res.status(200).json({ vaccinations });
      } catch (error: any) {
        console.error('❌ Error loading vaccinations:', error);
        if (error.message?.includes('does not exist') || error.code === 'P2021') {
          return res.status(200).json({ vaccinations: [] });
        }
        return res.status(500).json({ error: 'Error loading vaccinations' });
      }
    }

    // POST pet vaccination
    if (path.startsWith('/api/user/pets/') && path.endsWith('/vaccinations') && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            return res.status(401).json({ error: 'Token inválido' });
          }
        } catch (e: any) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }

        const petId = path.split('/api/user/pets/')[1].replace('/vaccinations', '');
        const pet = await db.pet.findFirst({
          where: { id: petId, userId },
        });

        if (!pet) {
          return res.status(404).json({ error: 'Pet não encontrado' });
        }

        const { 
          vaccineName, 
          vaccineType, 
          applicationDate, 
          nextDoseDate, 
          batchNumber, 
          veterinarian, 
          veterinarianCRMV, 
          clinicName, 
          clinicId, 
          notes 
        } = body;

        if (!vaccineName || !applicationDate) {
          return res.status(400).json({ error: 'Nome da vacina e data de aplicação são obrigatórios' });
        }

        const vaccination = await db.vaccination.create({
          data: {
            petId,
            vaccineName,
            vaccineType: vaccineType || null,
            applicationDate: new Date(applicationDate),
            nextDoseDate: nextDoseDate ? new Date(nextDoseDate) : null,
            batchNumber: batchNumber || null,
            veterinarian: veterinarian || null,
            veterinarianCRMV: veterinarianCRMV || null,
            clinicName: clinicName || null,
            clinicId: clinicId || null,
            notes: notes || null,
          },
        });

        return res.status(201).json({ vaccination });
      } catch (error: any) {
        console.error('❌ Error creating vaccination:', error);
        return res.status(500).json({ error: 'Error creating vaccination' });
      }
    }

    // PUT vaccination
    if (path.startsWith('/api/user/pets/') && path.includes('/vaccinations/') && method === 'PUT') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            return res.status(401).json({ error: 'Token inválido' });
          }
        } catch (e: any) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }

        const pathParts = path.split('/api/user/pets/')[1].split('/');
        const petId = pathParts[0];
        const vaccinationId = pathParts[2];

        const pet = await db.pet.findFirst({
          where: { id: petId, userId },
        });

        if (!pet) {
          return res.status(404).json({ error: 'Pet não encontrado' });
        }

        const { 
          vaccineName, 
          vaccineType, 
          applicationDate, 
          nextDoseDate, 
          batchNumber, 
          veterinarian, 
          veterinarianCRMV, 
          clinicName, 
          clinicId, 
          notes 
        } = body;

        const vaccination = await db.vaccination.update({
          where: { id: vaccinationId },
          data: {
            ...(vaccineName && { vaccineName }),
            ...(vaccineType !== undefined && { vaccineType }),
            ...(applicationDate && { applicationDate: new Date(applicationDate) }),
            ...(nextDoseDate !== undefined && { nextDoseDate: nextDoseDate ? new Date(nextDoseDate) : null }),
            ...(batchNumber !== undefined && { batchNumber }),
            ...(veterinarian !== undefined && { veterinarian }),
            ...(veterinarianCRMV !== undefined && { veterinarianCRMV }),
            ...(clinicName !== undefined && { clinicName }),
            ...(clinicId !== undefined && { clinicId }),
            ...(notes !== undefined && { notes }),
          },
        });

        return res.status(200).json({ vaccination });
      } catch (error: any) {
        console.error('❌ Error updating vaccination:', error);
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Vacinação não encontrada' });
        }
        return res.status(500).json({ error: 'Error updating vaccination' });
      }
    }

    // DELETE vaccination
    if (path.startsWith('/api/user/pets/') && path.includes('/vaccinations/') && method === 'DELETE') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            return res.status(401).json({ error: 'Token inválido' });
          }
        } catch (e: any) {
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }

        const pathParts = path.split('/api/user/pets/')[1].split('/');
        const petId = pathParts[0];
        const vaccinationId = pathParts[2];

        const pet = await db.pet.findFirst({
          where: { id: petId, userId },
        });

        if (!pet) {
          return res.status(404).json({ error: 'Pet não encontrado' });
        }

        await db.vaccination.delete({
          where: { id: vaccinationId },
        });

        return res.status(200).json({ message: 'Vacinação deletada com sucesso' });
      } catch (error: any) {
        console.error('❌ Error deleting vaccination:', error);
        return res.status(500).json({ error: 'Error deleting vaccination' });
      }
    }

    // ============ APP VERSION ENDPOINTS ============
    
    // GET current app version (public - for mobile app)
    if (path === '/api/app/version' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const platform = req.query?.platform || 'android';
        const currentVersion = req.query?.version || '1.0.0';
        const currentVersionCode = parseInt(req.query?.versionCode || '1', 10);

        // Buscar versão mais recente disponível COM APK e que está ATIVA
        // IMPORTANTE: Só retorna versões que estão marcadas como isActive=true
        // Isso permite controle: apenas versões liberadas pelo admin aparecem
        const latestVersion = await db.appVersion.findFirst({
          where: {
            platform,
            isActive: true, // Apenas versões ativas (liberadas pelo admin)
            apkUrl: { not: null }, // Apenas versões com APK disponível
          },
          orderBy: { versionCode: 'desc' },
        });

        if (!latestVersion || !latestVersion.apkUrl) {
          console.log('📱 Nenhuma versão com APK disponível encontrada');
          return res.status(200).json({
            hasUpdate: false,
            currentVersion,
            currentVersionCode,
            message: 'Nenhuma versão disponível para download',
          });
        }

        // Comparação estrita: só há atualização se versionCode for MAIOR
        const hasUpdate = latestVersion.versionCode > currentVersionCode;
        const isMandatory = hasUpdate && latestVersion.isMandatory;
        
        // Verificar se a versão atual é menor que a mínima obrigatória
        let isBlocked = false;
        if (latestVersion.minVersion) {
          const minVersionCode = await db.appVersion.findFirst({
            where: {
              platform,
              version: latestVersion.minVersion,
            },
          });
          if (minVersionCode && currentVersionCode < minVersionCode.versionCode) {
            isBlocked = true;
          }
        }

        // Log para debug
        console.log('📱 Verificação de versão:', {
          currentVersion,
          currentVersionCode,
          latestVersion: latestVersion.version,
          latestVersionCode: latestVersion.versionCode,
          hasUpdate,
          isMandatory,
        });

        return res.status(200).json({
          hasUpdate,
          isMandatory: isMandatory || isBlocked,
          isBlocked,
          currentVersion,
          currentVersionCode,
          latestVersion: hasUpdate ? {
            version: latestVersion.version,
            versionCode: latestVersion.versionCode,
            apkUrl: latestVersion.apkUrl,
            apkSize: latestVersion.apkSize,
            releaseNotes: latestVersion.releaseNotes,
            minVersion: latestVersion.minVersion,
          } : null,
        });
      } catch (error: any) {
        console.error('❌ Error loading app version:', error);
        if (error.message?.includes('does not exist') || error.code === 'P2021') {
          return res.status(200).json({
            hasUpdate: false,
            currentVersion: req.query?.version || '1.0.0',
            currentVersionCode: parseInt(req.query?.versionCode || '1', 10),
          });
        }
        return res.status(500).json({ error: 'Error loading app version' });
      }
    }

    // GET all app versions (admin)
    if (path === '/api/admin/app/versions' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            isAuthorized = false;
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const platform = req.query?.platform || 'android';
        const versions = await db.appVersion.findMany({
          where: { platform },
          orderBy: { versionCode: 'desc' },
        });

        return res.status(200).json({ versions });
      } catch (error: any) {
        console.error('❌ Error loading app versions:', error);
        return res.status(500).json({ error: 'Error loading app versions' });
      }
    }

    // POST app version (admin)
    if (path === '/api/admin/app/versions' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            isAuthorized = false;
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const { version, versionCode, minVersion, apkUrl, apkSize, releaseNotes, isMandatory, platform } = body;
        if (!version || !versionCode) {
          return res.status(400).json({ error: 'Version and versionCode are required' });
        }

        // IMPORTANTE: Se não forneceu apkUrl, criar versão sem APK
        // O APK deve ser enviado via endpoint /upload depois
        if (!apkUrl) {
          console.log('⚠️ Versão criada sem APK. Use o endpoint /upload para enviar o APK.');
        }

        // Desativar versões anteriores se esta for obrigatória
        if (isMandatory) {
          await db.appVersion.updateMany({
            where: {
              platform: platform || 'android',
              isActive: true,
            },
            data: {
              isActive: false,
            },
          });
        }

        const appVersion = await db.appVersion.create({
          data: {
            version,
            versionCode,
            minVersion: minVersion || null,
            apkUrl: apkUrl || null,
            apkSize: apkSize || null,
            releaseNotes: releaseNotes || null,
            isMandatory: isMandatory || false,
            platform: platform || 'android',
            isActive: true,
          },
        });

        return res.status(201).json({ 
          appVersion,
          message: apkUrl ? 'Versão criada com APK' : 'Versão criada. Use /upload para enviar o APK.',
        });
      } catch (error: any) {
        console.error('❌ Error creating app version:', error);
        if (error.code === 'P2002') {
          return res.status(400).json({ error: 'Version or versionCode already exists' });
        }
        return res.status(500).json({ error: 'Error creating app version' });
      }
    }

    // POST /api/admin/app/upload-apk - Upload APK e criar versão
    if (path === '/api/admin/app/upload-apk' && method === 'POST') {
      console.log('📤 POST /api/admin/app/upload-apk - Iniciando processamento');
      
      // Função helper para garantir CORS em erros
      const sendErrorWithCORS = (status: number, message: string) => {
        res.setHeader('Access-Control-Allow-Origin', allowOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        return res.status(status).json({ error: message });
      };
      
      const db = getPrisma();
      if (!db) {
        console.error('❌ Database not configured');
        return sendErrorWithCORS(503, 'Database not configured');
      }
      
      return new Promise((resolve) => {
        try {
          // Verificar autenticação
          const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
          console.log('🔑 Token check:', {
            'x-admin-token': req.headers['x-admin-token'] ? 'present' : 'missing',
            'authorization': req.headers['authorization'] ? 'present' : 'missing',
            'token-prefix': token ? token.substring(0, 20) : 'missing'
          });
          
          if (!token) {
            console.error('❌ No token provided');
            return resolve(sendErrorWithCORS(401, 'Unauthorized'));
          }
          let isAuthorized = false;
          if (token.startsWith('demo-token-')) {
            isAuthorized = true;
            console.log('✅ Demo token accepted');
          } else {
            try {
              const decoded: any = jwt.verify(token, JWT_SECRET);
              if (decoded.role === 'ADMIN') {
                isAuthorized = true;
                console.log('✅ JWT token verified');
              }
            } catch (error) {
              console.error('❌ JWT verification failed:', error);
              isAuthorized = false;
            }
          }
          if (!isAuthorized) {
            console.error('❌ Not authorized');
            return resolve(sendErrorWithCORS(403, 'Forbidden'));
          }

          const contentType = req.headers['content-type'] || '';
          if (!contentType.includes('multipart/form-data')) {
            return resolve(res.status(400).json({ error: 'Content-Type must be multipart/form-data' }));
          }

          // Processar multipart/form-data com busboy
          const busboy = Busboy({ headers: req.headers as any });
          const fields: any = {};
          let fileData: Buffer | null = null;
          let fileName = '';
          let fileSize = 0;

          busboy.on('file', (name, file, info) => {
            const { filename, encoding, mimeType } = info;
            fileName = filename || 'app.apk';
            console.log(`📥 Recebendo arquivo: ${fileName}, tipo: ${mimeType}`);
            
            const chunks: Buffer[] = [];
            file.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
              fileSize += chunk.length;
            });
            
            file.on('end', () => {
              fileData = Buffer.concat(chunks);
              console.log(`✅ Arquivo recebido: ${fileName}, tamanho: ${fileSize} bytes`);
            });
          });

          busboy.on('field', (name, value) => {
            fields[name] = value;
            console.log(`📝 Campo: ${name} = ${value}`);
          });

          busboy.on('finish', async () => {
            try {
              if (!fileData) {
                return resolve(res.status(400).json({ error: 'Arquivo APK não fornecido' }));
              }

              const { version, versionCode, releaseNotes, isMandatory } = fields;

              if (!version || !versionCode) {
                return resolve(res.status(400).json({ error: 'Versão e código de versão são obrigatórios' }));
              }

              // Verificar se já existe versão
              const existingVersion = await db.appVersion.findUnique({
                where: { versionCode: parseInt(versionCode, 10) }
              });

              if (existingVersion) {
                return resolve(res.status(400).json({ error: `Já existe uma versão com código ${versionCode}` }));
              }

              // No Vercel, salvar em /tmp (único diretório writable)
              const uploadsDir = '/tmp/uploads/apks';
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }

              const timestamp = Date.now();
              const savedFileName = `liga-do-bem-v${version}-${timestamp}.apk`;
              const filePath = path.join(uploadsDir, savedFileName);
              
              fs.writeFileSync(filePath, fileData);
              console.log(`💾 Arquivo salvo em: ${filePath}`);

              // Criar versão no banco
              // No Vercel, vamos salvar o caminho relativo
              // Em produção, você pode fazer upload para S3/Blob Storage e salvar a URL
              const apkUrl = `/tmp/uploads/apks/${savedFileName}`; // Caminho temporário
              
              const appVersion = await db.appVersion.create({
                data: {
                  version: version,
                  versionCode: parseInt(versionCode, 10),
                  apkUrl: apkUrl, // Em produção, usar URL do storage
                  apkSize: fileSize,
                  releaseNotes: releaseNotes || null,
                  isMandatory: isMandatory === 'true' || isMandatory === true,
                  isActive: true,
                  platform: 'android'
                }
              });

              console.log('✅ APK uploadado e versão criada:', appVersion.id);

              return resolve(res.status(201).json({
                message: 'APK uploadado com sucesso',
                version: {
                  id: appVersion.id,
                  version: appVersion.version,
                  versionCode: appVersion.versionCode,
                  apkUrl: appVersion.apkUrl,
                  apkSize: appVersion.apkSize,
                  releaseNotes: appVersion.releaseNotes,
                  isMandatory: appVersion.isMandatory,
                  isActive: appVersion.isActive
                }
              }));
            } catch (error: any) {
              console.error('❌ Error processing upload:', error);
              return resolve(res.status(500).json({ error: 'Error processing upload: ' + (error?.message || 'Unknown error') }));
            }
          });

          busboy.on('error', (error: any) => {
            console.error('❌ Busboy error:', error);
            return resolve(res.status(500).json({ error: 'Error parsing form data' }));
          });

          // No Vercel serverless, o body pode vir como buffer
          // Precisamos acessar o body raw antes do parsing
          // Vercel passa o body como buffer para multipart
          if (req.body && Buffer.isBuffer(req.body)) {
            busboy.end(req.body);
          } else if (req.body && typeof req.body === 'string') {
            // Se for string, converter para buffer
            busboy.end(Buffer.from(req.body, 'binary'));
          } else if (req.on && typeof req.on === 'function') {
            // Tentar usar como stream
            req.pipe(busboy);
          } else {
            return resolve(res.status(400).json({ error: 'Invalid request body format for multipart upload' }));
          }
        } catch (error: any) {
          console.error('❌ Error uploading APK:', error);
          return resolve(res.status(500).json({ error: 'Error uploading APK: ' + (error?.message || 'Unknown error') }));
        }
      });
    }

    // PUT app version (admin)
    if (path.startsWith('/api/admin/app/versions/') && method === 'PUT' && !path.includes('/upload')) {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            isAuthorized = false;
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const id = path.split('/api/admin/app/versions/')[1];
        const { version, versionCode, minVersion, apkUrl, apkSize, releaseNotes, isMandatory, isActive, platform } = body;

        const appVersion = await db.appVersion.update({
          where: { id },
          data: {
            ...(version && { version }),
            ...(versionCode !== undefined && { versionCode }),
            ...(minVersion !== undefined && { minVersion }),
            ...(apkUrl !== undefined && { apkUrl }),
            ...(apkSize !== undefined && { apkSize }),
            ...(releaseNotes !== undefined && { releaseNotes }),
            ...(isMandatory !== undefined && { isMandatory }),
            ...(isActive !== undefined && { isActive }),
            ...(platform && { platform }),
          },
        });

        return res.status(200).json({ appVersion });
      } catch (error: any) {
        console.error('❌ Error updating app version:', error);
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'App version not found' });
        }
        return res.status(500).json({ error: 'Error updating app version' });
      }
    }

    // DELETE app version (admin)
    if (path.startsWith('/api/admin/app/versions/') && method === 'DELETE' && !path.includes('/upload')) {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            isAuthorized = false;
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const id = path.split('/api/admin/app/versions/')[1];
        await db.appVersion.delete({
          where: { id },
        });

        return res.status(200).json({ message: 'App version deleted successfully' });
      } catch (error: any) {
        console.error('❌ Error deleting app version:', error);
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'App version not found' });
        }
        return res.status(500).json({ error: 'Error deleting app version' });
      }
    }

    // GET signed upload URL for APK (admin) - retorna URL assinada para upload direto
    if (path.startsWith('/api/admin/app/versions/') && path.endsWith('/upload-url') && method === 'GET') {
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            isAuthorized = false;
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const id = path.split('/api/admin/app/versions/')[1].replace('/upload-url', '');
        const cloudinaryInstance = getCloudinary();
        
        if (!cloudinaryInstance) {
          return res.status(503).json({
            error: 'Cloudinary não configurado',
          });
        }

        // Gerar signed upload URL para upload direto do frontend
        const timestamp = Math.round(new Date().getTime() / 1000);
        const publicId = `app_${id}_${timestamp}`;
        
        // Parâmetros para assinatura (todos como strings)
        const params: any = {
          timestamp: timestamp.toString(),
          folder: 'liga-do-bem/app-versions',
          public_id: publicId,
          resource_type: 'raw',
          overwrite: 'true',
        };
        
        // Gerar assinatura
        const signature = cloudinaryInstance.utils.api_sign_request(
          params,
          process.env.CLOUDINARY_API_SECRET || ''
        );

        const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload`;
        
        return res.status(200).json({
          uploadUrl,
          signature,
          timestamp: params.timestamp,
          publicId,
          folder: params.folder,
          cloudName: process.env.CLOUDINARY_CLOUD_NAME,
          apiKey: process.env.CLOUDINARY_API_KEY,
        });
      } catch (error: any) {
        console.error('❌ Error generating upload URL:', error);
        return res.status(500).json({ error: 'Error generating upload URL' });
      }
    }

    // POST upload APK (admin) - recebe base64 e faz upload para Cloudinary ou retorna URL
    if (path.startsWith('/api/admin/app/versions/') && path.endsWith('/upload') && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers['authorization']?.replace('Bearer ', '');
        if (!token) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        let isAuthorized = false;
        if (token.startsWith('demo-token-')) {
          isAuthorized = true;
        } else {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'ADMIN') {
              isAuthorized = true;
            }
          } catch {
            isAuthorized = false;
          }
        }
        if (!isAuthorized) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const id = path.split('/api/admin/app/versions/')[1].replace('/upload', '');
        const { apkBase64, apkUrl, apkSize } = body;

        // Se forneceu URL direta (upload já foi feito no frontend), apenas atualizar no banco
        if (apkUrl) {
          const appVersion = await db.appVersion.update({
            where: { id },
            data: { 
              apkUrl,
              apkSize: apkSize || null,
            },
          });
          console.log('✅ Versão atualizada com APK hospedado:', apkUrl);
          return res.status(200).json({ appVersion, apkUrl });
        }

        // Se forneceu base64, fazer upload para Cloudinary
        if (apkBase64) {
          const cloudinaryInstance = getCloudinary();
          if (!cloudinaryInstance) {
            return res.status(503).json({
              error: 'Cloudinary não configurado. Use apkUrl para fornecer URL direta do APK.',
            });
          }

          console.log('📦 Iniciando upload do APK para Cloudinary...');
          console.log('📦 Tamanho do base64:', apkBase64.length, 'caracteres');
          
          try {
            const uploadResult = await new Promise((resolve, reject) => {
              cloudinaryInstance.uploader.upload(
                apkBase64,
                {
                  folder: 'liga-do-bem/app-versions',
                  public_id: `app_${id}_${Date.now()}`,
                  overwrite: true,
                  resource_type: 'raw', // APK é arquivo raw, não imagem
                },
                (error: any, result: any) => {
                  if (error) {
                    console.error('❌ Erro no upload do Cloudinary:', error);
                    reject(error);
                  } else {
                    console.log('✅ Upload do Cloudinary concluído:', result.secure_url);
                    resolve(result);
                  }
                }
              );
            });

            const uploadedUrl = (uploadResult as any).secure_url;
            const fileSize = (uploadResult as any).bytes;
            
            console.log('✅ APK hospedado com sucesso:', {
              url: uploadedUrl,
              size: fileSize,
              sizeMB: (fileSize / 1024 / 1024).toFixed(2),
            });

            // Desativar versões anteriores
            const currentVersion = await db.appVersion.findUnique({ where: { id } });
            if (currentVersion?.isMandatory) {
              await db.appVersion.updateMany({
                where: {
                  platform: currentVersion.platform,
                  id: { not: id },
                  isActive: true,
                },
                data: { isActive: false },
              });
            }

            const appVersion = await db.appVersion.update({
              where: { id },
              data: {
                apkUrl: uploadedUrl,
                apkSize: fileSize,
              },
            });

            return res.status(200).json({
              appVersion,
              apkUrl: uploadedUrl,
              apkSize: fileSize,
            });
          } catch (uploadError: any) {
            console.error('❌ Erro ao fazer upload do APK:', uploadError);
            return res.status(500).json({
              error: 'Erro ao fazer upload do APK',
              details: uploadError.message,
            });
          }
        }

        return res.status(400).json({ error: 'apkBase64 ou apkUrl é obrigatório' });
      } catch (error: any) {
        console.error('❌ Error uploading APK:', error);
        return res.status(500).json({ error: 'Error uploading APK' });
      }
    }

    // POST logs from mobile app
    if (path === '/api/logs' && method === 'POST') {
      try {
        const { logs } = body;
        if (Array.isArray(logs)) {
          // Logar os logs recebidos do app
          console.log('📱 Logs recebidos do app:', logs.length, 'logs');
          logs.forEach((log) => {
            const logData = log.data ? (typeof log.data === 'string' ? JSON.parse(log.data) : log.data) : null;
            console.log(`[${log.level.toUpperCase()}] ${log.timestamp} - ${log.message}`, logData || '');
          });
          return res.status(200).json({ message: 'Logs recebidos', count: logs.length });
        }
        return res.status(400).json({ error: 'Invalid logs format' });
      } catch (error: any) {
        console.error('❌ Error processing logs:', error);
        return res.status(500).json({ error: 'Error processing logs' });
      }
    }

    // --- User Profile Endpoints ---
    
    // GET user profile
    if (path === '/api/user/profile' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        console.error('❌ GET /api/user/profile: Database not configured');
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          console.error('❌ GET /api/user/profile: Token não fornecido');
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            console.error('❌ GET /api/user/profile: userId não encontrado no token', decoded);
            return res.status(401).json({ error: 'Token inválido - userId não encontrado' });
          }
          console.log('✅ GET /api/user/profile: Token válido, userId:', userId);
        } catch (e: any) {
          console.error('❌ GET /api/user/profile: Erro ao verificar token', e.message);
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
        
        // Buscar usuário COM CPF - Usar select explícito para garantir que CPF seja retornado
        let user: any;
        try {
          console.log('🔍 GET /api/user/profile: Buscando usuário no banco, userId:', userId);
          
          // PRIMEIRO: Buscar com select explícito incluindo CPF
          // Tentar buscar com todas as colunas, mas tratar erro se algumas não existirem
          try {
            user = await db.user.findUnique({
              where: { id: userId },
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                avatar: true,
                notificationsEnabled: true,
                locationEnabled: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                cpf: true, // Incluir CPF explicitamente
              }
            });
          } catch (selectError: any) {
            // Se colunas notificationsEnabled/locationEnabled não existirem, buscar sem elas
            if (selectError.message?.includes('notificationsEnabled') || 
                selectError.message?.includes('locationEnabled') || 
                selectError.code === 'P2021') {
              console.warn('⚠️ Colunas notificationsEnabled/locationEnabled não existem, buscando sem elas');
              user = await db.user.findUnique({
                where: { id: userId },
                select: {
                  id: true,
                  email: true,
                  name: true,
                  phone: true,
                  avatar: true,
                  role: true,
                  createdAt: true,
                  updatedAt: true,
                  cpf: true,
                }
              });
              // Adicionar valores padrão
              if (user) {
                (user as any).notificationsEnabled = true;
                (user as any).locationEnabled = true;
              }
            } else {
              throw selectError;
            }
          }
          
          console.log('🔍 GET /api/user/profile: Usuário encontrado COM select:', {
            id: user?.id,
            email: user?.email,
            name: user?.name,
            cpf: user?.cpf,
            cpfType: typeof user?.cpf,
            cpfRaw: JSON.stringify(user?.cpf),
            cpfIsNull: user?.cpf === null,
            cpfIsUndefined: user?.cpf === undefined,
            cpfEqualsZero: user?.cpf === '0' || user?.cpf === 0,
            hasCpfProperty: 'cpf' in (user || {}),
          });
          
          // VERIFICAÇÃO CRÍTICA: Se CPF vier null ou "0", fazer query SQL direta para verificar
          if (!user || user.cpf === null || user.cpf === undefined || user.cpf === '0' || user.cpf === 0) {
            console.log('⚠️ GET /api/user/profile: CPF é null/undefined/"0" no Prisma, fazendo query SQL direta para verificar...');
            try {
              const sqlResult: any[] = await db.$queryRaw`
                SELECT id, email, name, cpf
                FROM "users"
                WHERE id = ${userId}
                LIMIT 1
              `;
              
              if (sqlResult && sqlResult.length > 0) {
                const sqlUser = sqlResult[0];
                console.log('🔍 GET /api/user/profile: Resultado da query SQL direta:', {
                  id: sqlUser.id,
                  email: sqlUser.email,
                  name: sqlUser.name,
                  cpf: sqlUser.cpf,
                  cpfType: typeof sqlUser.cpf,
                  cpfRaw: JSON.stringify(sqlUser.cpf),
                  cpfIsNull: sqlUser.cpf === null,
                  cpfIsUndefined: sqlUser.cpf === undefined,
                  cpfEqualsZero: sqlUser.cpf === '0' || sqlUser.cpf === 0,
                });
                
                // Se SQL retornou CPF válido, usar esse valor
                if (sqlUser.cpf && sqlUser.cpf !== null && sqlUser.cpf !== undefined && 
                    sqlUser.cpf !== '0' && sqlUser.cpf !== 0 && String(sqlUser.cpf).trim() !== '0') {
                  console.log('✅ GET /api/user/profile: CPF encontrado via SQL direta, usando esse valor:', sqlUser.cpf);
                  if (user) {
                    user.cpf = sqlUser.cpf;
                  } else {
                    // Se user não existir, criar objeto mínimo
                    user = {
                      id: sqlUser.id,
                      email: sqlUser.email,
                      name: sqlUser.name,
                      cpf: sqlUser.cpf,
                    };
                  }
                } else {
                  console.log('⚠️ GET /api/user/profile: CPF também é null/"0" na query SQL direta');
                }
              }
            } catch (sqlError: any) {
              console.warn('⚠️ GET /api/user/profile: Erro ao fazer query SQL direta:', sqlError.message);
            }
          }
          
        } catch (error: any) {
          // Se coluna CPF ou outras colunas não existirem, buscar sem elas
          if (error.message?.includes('cpf') || 
              error.message?.includes('notificationsEnabled') || 
              error.message?.includes('locationEnabled') || 
              error.code === 'P2021') {
            console.warn('⚠️ Algumas colunas não existem, buscando sem elas');
            try {
              user = await db.user.findUnique({
                where: { id: userId },
                select: {
                  id: true,
                  email: true,
                  name: true,
                  phone: true,
                  avatar: true,
                  role: true,
                  createdAt: true,
                  updatedAt: true,
                }
              });
              // Adicionar valores padrão para colunas que não existem
              if (user) {
                (user as any).cpf = null;
                (user as any).notificationsEnabled = true;
                (user as any).locationEnabled = true;
              }
            } catch (retryError: any) {
              console.error('❌ GET /api/user/profile: Erro ao buscar usuário (retry):', retryError);
              throw retryError;
            }
          } else {
            console.error('❌ GET /api/user/profile: Erro ao buscar usuário:', error);
            throw error;
          }
        }
        
        if (!user) {
          console.error('❌ GET /api/user/profile: Usuário não encontrado, userId:', userId);
          return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        
        // Processar CPF - SIMPLIFICADO: apenas limpar formatação e retornar números
        let cpfValue = user.cpf;
        
        console.log('🔍 GET /api/user/profile: CPF do banco (ANTES de processar):', {
          cpfOriginal: cpfValue,
          cpfType: typeof cpfValue,
          cpfIsNull: cpfValue === null,
          cpfIsUndefined: cpfValue === undefined,
          cpfRaw: JSON.stringify(cpfValue),
          cpfEqualsZero: cpfValue === '0' || cpfValue === 0,
          cpfEqualsZeroString: String(cpfValue) === '0',
        });
        
        // IMPORTANTE: Tratar explicitamente "0" como inválido ANTES de qualquer processamento
        if (cpfValue === '0' || cpfValue === 0 || String(cpfValue).trim() === '0') {
          console.log('⚠️ GET /api/user/profile: CPF é "0" (inválido), convertendo para null imediatamente');
          cpfValue = null;
        }
        // Se CPF existe e não é "0", limpar formatação e retornar apenas números
        else if (cpfValue !== null && cpfValue !== undefined && cpfValue !== '') {
          const cpfStr = String(cpfValue).trim();
          const cpfNumbers = cpfStr.replace(/\D/g, ''); // Remove tudo que não é dígito
          
          console.log('🔍 GET /api/user/profile: CPF processado:', {
            original: cpfStr,
            apenasNumeros: cpfNumbers,
            length: cpfNumbers.length,
            isZero: cpfNumbers === '0',
            isAllZeros: cpfNumbers === '00000000000',
          });
          
          // Se após limpar formatação ficou vazio, só zeros, ou apenas "0", retornar null
          if (cpfNumbers === '' || cpfNumbers === '0' || cpfNumbers === '00000000000') {
            cpfValue = null;
            console.log('⚠️ GET /api/user/profile: CPF inválido (vazio ou só zeros), retornando null');
          } else {
            // Retornar apenas números (mesmo que não tenha 11 dígitos)
            cpfValue = cpfNumbers;
            console.log('✅ GET /api/user/profile: CPF válido, retornando:', cpfValue);
          }
        } else {
          console.log('🔍 GET /api/user/profile: CPF é null/undefined/vazio, retornando null');
          cpfValue = null;
        }
        
        console.log('🔍 GET /api/user/profile: CPF FINAL que será retornado:', {
          cpfValue,
          cpfType: typeof cpfValue,
        });
        
        // GARANTIR que cpfValue nunca seja "0" na resposta final
        if (cpfValue === '0' || cpfValue === 0 || String(cpfValue).trim() === '0') {
          console.log('⚠️ GET /api/user/profile: CPF ainda é "0" na resposta final, forçando null');
          cpfValue = null;
        }
        
        // Serializar datas corretamente e garantir que todos os campos sejam JSON-safe
        const userResponse = {
          id: user.id,
          email: user.email || '',
          name: user.name || '',
          phone: user.phone || null,
          avatar: user.avatar || null,
          notificationsEnabled: user.notificationsEnabled ?? true,
          locationEnabled: user.locationEnabled ?? true,
          role: user.role || 'MEMBER',
          createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : (user.createdAt || new Date().toISOString()),
          updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : (user.updatedAt || new Date().toISOString()),
          cpf: cpfValue, // Retornar CPF processado (null se inválido)
        };
        
        // Log do CPF e resposta completa
        console.log('📋 GET /api/user/profile: Resposta preparada:', {
          id: userResponse.id,
          email: userResponse.email,
          name: userResponse.name,
          phone: userResponse.phone,
          cpf: userResponse.cpf,
          cpfType: typeof userResponse.cpf,
        });
        
        // Retornar usuário serializado
        return res.status(200).json(userResponse);
      } catch (error: any) {
        console.error('❌ Erro ao buscar perfil:', error);
        console.error('❌ Erro detalhado:', {
          message: error?.message,
          code: error?.code,
          name: error?.name,
          stack: error?.stack?.substring(0, 200),
        });
        return res.status(500).json({ 
          error: 'Erro interno do servidor',
          details: process.env.NODE_ENV === 'development' ? error?.message : undefined
        });
      }
    }

    // PUT user profile
    if (path === '/api/user/profile' && method === 'PUT') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        // Verificar token em múltiplos lugares (header Authorization ou x-auth-token)
        const token = req.headers?.authorization?.replace('Bearer ', '') || 
                     req.headers?.['x-auth-token'] || 
                     req.headers?.['authorization']?.replace('Bearer ', '') ||
                     null;
        
        if (!token) {
          console.error('❌ PUT /api/user/profile: Token não fornecido');
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) {
            console.error('❌ PUT /api/user/profile: userId não encontrado no token', decoded);
            return res.status(401).json({ error: 'Token inválido - userId não encontrado' });
          }
        } catch (e: any) {
          console.error('❌ PUT /api/user/profile: Erro ao verificar token', e.message);
          return res.status(401).json({ error: 'Token inválido ou expirado' });
        }
        
        const { name, phone, cpf, avatar } = body;
        
        const updateData: any = {};
        if (name && name.trim()) {
          updateData.name = name.trim();
        }
        if (phone !== undefined) {
          updateData.phone = phone ? phone.trim() : null;
        }
        
        // Processar CPF: bloquear alteração se já existe, permitir apenas se for null
        if (cpf !== undefined) {
          // Buscar CPF atual do usuário
          const currentUser = await db.user.findUnique({
            where: { id: userId },
            select: { cpf: true }
          });
          
          const cpfClean = cpf ? String(cpf).replace(/\D/g, '') : null;
          
          // Se o CPF enviado é o mesmo que já está no banco, não fazer nada (permitir)
          if (currentUser?.cpf && cpfClean && currentUser.cpf === cpfClean) {
            console.log('ℹ️ PUT /api/user/profile: CPF não alterado, mantendo valor atual:', cpfClean);
            // Não adicionar ao updateData, manter o valor atual
          }
          // Se o usuário já tem CPF cadastrado e está tentando alterar, bloquear
          else if (currentUser?.cpf && cpfClean && currentUser.cpf !== cpfClean) {
            console.warn('⚠️ PUT /api/user/profile: Tentativa de alterar CPF existente bloqueada');
            return res.status(403).json({
              error: 'CPF não pode ser alterado após o cadastro. Esta medida previne fraudes.'
            });
          }
          // Se o usuário não tem CPF, permitir cadastrar (apenas se for válido)
          else if (!currentUser?.cpf && cpfClean) {
            // Validar formato
            if (cpfClean.length !== 11) {
              console.warn('⚠️ PUT /api/user/profile: CPF inválido (não tem 11 dígitos):', cpfClean);
              return res.status(400).json({ error: 'CPF inválido. Deve conter 11 dígitos' });
            } else if (cpfClean === '00000000000') {
              console.warn('⚠️ PUT /api/user/profile: CPF inválido (só zeros)');
              return res.status(400).json({ error: 'CPF inválido' });
            }
            
            // Verificar se CPF já está em uso por outro usuário
            try {
              const existingUser = await db.user.findFirst({
                where: {
                  cpf: cpfClean,
                  id: { not: userId }
                },
                select: {
                  id: true,
                }
              });
              
              if (existingUser) {
                console.warn('⚠️ PUT /api/user/profile: CPF já cadastrado para outro usuário');
                return res.status(400).json({ error: 'CPF já cadastrado para outro usuário' });
              }
            } catch (error: any) {
              if (error.message?.includes('cpf') || error.code === 'P2021') {
                console.warn('⚠️ Coluna cpf não existe ainda, pulando verificação de duplicidade');
              } else {
                throw error;
              }
            }
            
            // CPF válido e não duplicado: adicionar ao updateData
            updateData.cpf = cpfClean;
            console.log('✅ PUT /api/user/profile: CPF será cadastrado:', cpfClean);
          } else if (cpf === null || cpf === '' || !cpfClean) {
            // Se enviado como null ou vazio, não atualizar (manter o que está no banco)
            console.log('ℹ️ PUT /api/user/profile: CPF não fornecido ou vazio, mantendo valor atual');
          }
        } else {
          // CPF não foi enviado no body, não fazer nada
          console.log('ℹ️ PUT /api/user/profile: CPF não foi enviado, mantendo valor atual');
        }
        if (avatar !== undefined) {
          updateData.avatar = avatar ? avatar.trim() : null;
        }
        
        console.log('🔄 PUT /api/user/profile: Atualizando perfil', { userId, updateData });
        
        // Tentar atualizar com cpf, mas tratar erro se coluna não existir
        let updatedUser;
        try {
          updatedUser = await db.user.update({
            where: { id: userId },
            data: updateData,
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              cpf: true,
              avatar: true,
              notificationsEnabled: true,
              locationEnabled: true,
              role: true,
            }
          });
        } catch (error: any) {
          // Se erro for relacionado a colunas não existirem, atualizar sem elas
          if (error.message?.includes('cpf') || error.message?.includes('notificationsEnabled') || error.message?.includes('locationEnabled') || error.code === 'P2021' || error.code === 'P2002') {
            console.warn('⚠️ Algumas colunas não existem ainda, atualizando sem elas');
            // Remover campos que não existem do updateData
            const { cpf: _, notificationsEnabled: __, locationEnabled: ___, ...updateDataWithoutNewFields } = updateData;
            updatedUser = await db.user.update({
              where: { id: userId },
              data: updateDataWithoutNewFields,
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                avatar: true,
                role: true,
              }
            });
            // Adicionar campos como null/default na resposta
            (updatedUser as any).cpf = null;
            (updatedUser as any).notificationsEnabled = true;
            (updatedUser as any).locationEnabled = true;
          } else {
            throw error;
          }
        }
        
        console.log('✅ PUT /api/user/profile: Perfil atualizado com sucesso', updatedUser.id);
        
        return res.status(200).json({
          message: 'Perfil atualizado com sucesso',
          user: updatedUser
        });
      } catch (error: any) {
        console.error('❌ Erro ao atualizar perfil:', error);
        // Se for erro do Prisma, retornar mensagem mais específica
        if (error.code === 'P2002') {
          return res.status(400).json({ error: 'CPF já cadastrado para outro usuário' });
        }
        if (error.code === 'P2025') {
          return res.status(404).json({ error: 'Usuário não encontrado' });
        }
        return res.status(500).json({ error: error?.message || 'Erro interno do servidor' });
      }
    }

    // GET PIX donation info (public)
    if (path === '/api/donations/pix-info' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const configs = await db.systemConfig.findMany({
          where: {
            key: { in: ['donation.pixKey', 'donation.pixHolderName', 'donation.pixCity'] },
          },
        });
        const map: Record<string, string> = {};
        for (const c of configs) map[c.key] = c.value;

        const pixKey = map['donation.pixKey'] || '';
        if (!pixKey) {
          return res.status(503).json({
            error: 'Chave PIX ainda não configurada. Contate a Liga do Bem.',
          });
        }

        return res.status(200).json({
          pixKey,
          holderName: map['donation.pixHolderName'] || 'Liga do Bem Botucatu',
          city: map['donation.pixCity'] || 'Botucatu',
        });
      } catch (error: any) {
        console.error('❌ Erro ao buscar info PIX:', error);
        return res.status(500).json({ error: 'Erro ao buscar dados do PIX' });
      }
    }

    // POST create donation
    if (path === '/api/donations' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { amount, method, description, isAnonymous, donorName, donorEmail, recurring } = body || {};
        const parsedAmount = parseFloat(amount);

        if (!parsedAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
          return res.status(400).json({ error: 'Informe um valor válido para doar' });
        }
        if (parsedAmount > 100000) {
          return res.status(400).json({ error: 'Valor máximo por doação: R$ 100.000,00' });
        }

        const allowedMethods = ['PIX', 'CREDIT_CARD', 'BANK_TRANSFER', 'CASH', 'OTHER'];
        const paymentMethod = (method || 'PIX').toString().toUpperCase();
        if (!allowedMethods.includes(paymentMethod)) {
          return res.status(400).json({ error: 'Forma de pagamento inválida' });
        }

        // Por enquanto só PIX está operacional no app
        if (paymentMethod !== 'PIX') {
          return res.status(400).json({
            error: 'No momento só aceitamos doações via PIX. Cartão e boleto em breve.',
          });
        }

        let userId: string | null = null;
        let userName: string | null = null;
        let userEmail: string | null = null;
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (token) {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            userId = decoded.userId || decoded.id || null;
            if (userId) {
              const user = await db.user.findUnique({
                where: { id: userId },
                select: { name: true, email: true },
              });
              userName = user?.name || null;
              userEmail = user?.email || null;
            }
          } catch {
            // Token inválido: doação anônima/sem vínculo
            userId = null;
          }
        }

        if (isAnonymous && (!donorName || !donorEmail)) {
          return res.status(400).json({
            error: 'Para doações anônimas, nome e e-mail são obrigatórios',
          });
        }

        const descParts: string[] = [];
        if (recurring) descParts.push('Doação mensal (intenção)');
        if (description) descParts.push(String(description).slice(0, 180));
        const finalDescription = descParts.join(' — ') || 'Doação via app';

        const donation = await db.donation.create({
          data: {
            userId,
            amount: parsedAmount,
            method: paymentMethod as any,
            description: finalDescription,
            isAnonymous: !!isAnonymous,
            donorName: isAnonymous ? donorName : null,
            donorEmail: isAnonymous ? donorEmail : null,
            status: 'PENDING',
          },
        });

        const configs = await db.systemConfig.findMany({
          where: {
            key: { in: ['donation.pixKey', 'donation.pixHolderName', 'donation.pixCity'] },
          },
        });
        const map: Record<string, string> = {};
        for (const c of configs) map[c.key] = c.value;
        const pixKey = map['donation.pixKey'] || '';

        if (!pixKey) {
          return res.status(503).json({
            error: 'Chave PIX ainda não configurada. Contate a Liga do Bem.',
            donation: {
              id: donation.id,
              amount: donation.amount,
              method: donation.method,
              status: donation.status,
            },
          });
        }

        return res.status(201).json({
          message: 'Doação criada. Realize o PIX e confirme o pagamento.',
          donation: {
            id: donation.id,
            amount: parseFloat(donation.amount.toString()),
            method: donation.method,
            status: donation.status,
            description: donation.description,
            createdAt: donation.createdAt,
          },
          pix: {
            key: pixKey,
            holderName: map['donation.pixHolderName'] || 'Liga do Bem Botucatu',
            city: map['donation.pixCity'] || 'Botucatu',
            amount: parsedAmount,
            copyPaste: pixKey,
          },
          donor: {
            name: isAnonymous ? donorName : userName,
            email: isAnonymous ? donorEmail : userEmail,
          },
        });
      } catch (error: any) {
        console.error('❌ Erro ao criar doação:', error);
        return res.status(500).json({ error: 'Erro ao criar doação. Tente novamente.' });
      }
    }

    // POST confirm donation payment (user confirms PIX was sent)
    if (path === '/api/donations/confirm' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const { donationId } = body || {};
        if (!donationId) {
          return res.status(400).json({ error: 'ID da doação é obrigatório' });
        }

        const donation = await db.donation.findUnique({ where: { id: donationId } });
        if (!donation) {
          return res.status(404).json({ error: 'Doação não encontrada' });
        }

        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (donation.userId) {
          if (!token) {
            return res.status(401).json({ error: 'Token de autenticação necessário' });
          }
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            const userId = decoded.userId || decoded.id;
            if (userId !== donation.userId) {
              return res.status(403).json({ error: 'Acesso negado a esta doação' });
            }
          } catch {
            return res.status(401).json({ error: 'Token inválido' });
          }
        }

        if (donation.status === 'APPROVED') {
          return res.status(200).json({
            message: 'Doação já confirmada',
            donation: {
              id: donation.id,
              amount: parseFloat(donation.amount.toString()),
              status: donation.status,
              method: donation.method,
            },
          });
        }

        if (donation.status !== 'PENDING') {
          return res.status(400).json({
            error: `Não é possível confirmar doação com status ${donation.status}`,
          });
        }

        // Usuário declara que pagou; permanece PENDING até o admin aprovar
        const updated = await db.donation.update({
          where: { id: donationId },
          data: {
            status: 'PENDING',
            transactionId: donation.transactionId || `PIX_CLAIMED_${Date.now()}`,
          },
        });

        return res.status(200).json({
          message: 'Pagamento informado! A Liga do Bem vai confirmar e liberar no seu histórico.',
          donation: {
            id: updated.id,
            amount: parseFloat(updated.amount.toString()),
            status: updated.status,
            method: updated.method,
            transactionId: updated.transactionId,
          },
          awaitingAdmin: true,
        });
      } catch (error: any) {
        console.error('❌ Erro ao confirmar doação:', error);
        return res.status(500).json({ error: 'Erro ao confirmar doação' });
      }
    }

    // GET admin donations (+ stats)
    if (path === '/api/admin/donations' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let isAuthorized = token.startsWith('demo-token-');
        if (!isAuthorized) {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            isAuthorized = decoded.role === 'ADMIN';
          } catch { /* ignore */ }
        }
        if (!isAuthorized) return res.status(401).json({ error: 'Invalid token' });

        const status = (req.query?.status || '').toString();
        const page = Math.max(1, parseInt(String(req.query?.page || '1'), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query?.limit || '20'), 10) || 20));
        const offset = (page - 1) * limit;

        const whereSql = status ? `WHERE d.status = $1` : '';
        const params: any[] = status ? [status] : [];

        const countRows: any[] = await db.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS total FROM donations d ${whereSql}`,
          ...params
        );
        const total = countRows?.[0]?.total || 0;

        const listParams = status ? [status, limit, offset] : [limit, offset];
        const limitIdx = status ? 2 : 1;
        const offsetIdx = status ? 3 : 2;

        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT d.id, d.amount, d.method, d.status, d.description, d."isAnonymous",
                  d."donorName", d."donorEmail", d."transactionId", d."createdAt",
                  u.id AS user_id, u.name AS user_name, u.email AS user_email
           FROM donations d
           LEFT JOIN users u ON u.id = d."userId"
           ${whereSql}
           ORDER BY d."createdAt" DESC
           LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
          ...listParams
        );

        const donations = (rows || []).map((d) => ({
          id: d.id,
          amount: parseFloat(d.amount?.toString?.() || '0'),
          method: d.method,
          type: 'DONATION',
          status: d.status,
          description: d.description,
          isAnonymous: d.isAnonymous,
          donorName: d.donorName,
          donorEmail: d.donorEmail,
          transactionId: d.transactionId,
          gateway: d.method || 'PIX',
          createdAt: d.createdAt,
          user: d.user_id
            ? { id: d.user_id, name: d.user_name, email: d.user_email }
            : null,
          userName: d.donorName || d.user_name || null,
        }));

        const statsRows: any[] = await db.$queryRawUnsafe(
          `SELECT
             COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0) AS total_revenue,
             COALESCE(SUM(CASE WHEN status = 'APPROVED' AND "createdAt" >= date_trunc('month', NOW()) THEN amount ELSE 0 END), 0) AS monthly_revenue,
             COUNT(*)::int AS total_transactions,
             COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_payments
           FROM donations`
        );

        return res.status(200).json({
          donations,
          payments: donations,
          total,
          pagination: {
            page,
            limit,
            pages: Math.max(1, Math.ceil(total / limit)),
            total,
          },
          stats: {
            totalRevenue: parseFloat(statsRows?.[0]?.total_revenue?.toString?.() || '0'),
            monthlyRevenue: parseFloat(statsRows?.[0]?.monthly_revenue?.toString?.() || '0'),
            totalTransactions: statsRows?.[0]?.total_transactions || 0,
            pendingPayments: statsRows?.[0]?.pending_payments || 0,
          },
        });
      } catch (error: any) {
        console.error('❌ Admin donations error:', error);
        return res.status(500).json({ error: 'Erro ao listar doações', detail: error?.message });
      }
    }

    // POST admin donation status
    if (path === '/api/admin/donations/status' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let isAuthorized = token.startsWith('demo-token-');
        if (!isAuthorized) {
          try {
            const decoded: any = jwt.verify(token, JWT_SECRET);
            isAuthorized = decoded.role === 'ADMIN';
          } catch { /* ignore */ }
        }
        if (!isAuthorized) return res.status(401).json({ error: 'Invalid token' });

        const donationId = body?.donationId;
        const status = (body?.status || '').toString().toUpperCase();
        if (!donationId || !['APPROVED', 'REJECTED', 'CANCELLED', 'PENDING'].includes(status)) {
          return res.status(400).json({ error: 'donationId e status válidos são obrigatórios' });
        }

        await db.$executeRawUnsafe(
          `UPDATE donations
           SET status = $1::"PaymentStatus",
               "transactionId" = CASE
                 WHEN $1 = 'APPROVED' THEN COALESCE("transactionId", $2)
                 ELSE "transactionId"
               END,
               "updatedAt" = NOW()
           WHERE id = $3`,
          status,
          `ADMIN_${Date.now()}`,
          donationId
        );

        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT id, amount, method, status, "transactionId", "createdAt" FROM donations WHERE id = $1`,
          donationId
        );

        return res.status(200).json({
          message: `Doação marcada como ${status}`,
          donation: rows?.[0] || null,
        });
      } catch (error: any) {
        console.error('❌ Admin donation status error:', error);
        return res.status(500).json({ error: 'Erro ao atualizar doação', detail: error?.message });
      }
    }

    // ========== ADMIN NOTIFICATIONS ==========
    if (path === '/api/notifications/admin/stats' && method === 'GET') {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const stats: any[] = await db.$queryRawUnsafe(
          `SELECT
             (SELECT COUNT(*)::int FROM device_tokens WHERE "isActive" = true) AS "activeDeviceTokens",
             (SELECT COUNT(*)::int FROM notifications) AS "totalNotifications",
             (SELECT COUNT(*)::int FROM notifications WHERE "sentAt" >= NOW() - INTERVAL '1 day') AS "notificationsToday",
             (SELECT COUNT(*)::int FROM notifications WHERE "isRead" = false) AS "unreadNotifications"`
        );
        return res.status(200).json({
          activeDeviceTokens: stats?.[0]?.activeDeviceTokens || 0,
          totalNotifications: stats?.[0]?.totalNotifications || 0,
          notificationsToday: stats?.[0]?.notificationsToday || 0,
          unreadNotifications: stats?.[0]?.unreadNotifications || 0,
        });
      } catch (error: any) {
        console.error('❌ Admin notif stats:', error);
        return res.status(500).json({ error: 'Erro ao carregar estatísticas', detail: error?.message });
      }
    }

    if (path === '/api/admin/notifications' && method === 'GET') {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT n.id, n.title, n.message, n.type, n."isRead", n."sentAt",
                  u.name AS user_name, u.email AS user_email
           FROM notifications n
           LEFT JOIN users u ON u.id = n."userId"
           ORDER BY n."sentAt" DESC
           LIMIT 100`
        );
        return res.status(200).json({
          notifications: (rows || []).map((n) => ({
            id: n.id,
            title: n.title,
            body: n.message,
            type: n.type,
            isRead: n.isRead,
            sentAt: n.sentAt,
            userName: n.user_name,
            userEmail: n.user_email,
          })),
          total: rows?.length || 0,
        });
      } catch (error: any) {
        return res.status(500).json({ error: 'Erro ao listar notificações', detail: error?.message });
      }
    }

    const isAdminNotifSend =
      method === 'POST' &&
      (path === '/api/notifications/admin/send-to-all' ||
        path === '/api/notifications/admin/send-to-role' ||
        path === '/api/notifications/admin/send-payment-reminder' ||
        path === '/api/notifications/admin/send-event' ||
        path === '/api/admin/notifications/send');

    if (isAdminNotifSend) {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const title = (body?.title || '').toString().trim();
        const message = (body?.body || body?.message || '').toString().trim();
        if (!title || !message) {
          return res.status(400).json({ error: 'Título e mensagem são obrigatórios', message: 'Título e mensagem são obrigatórios' });
        }

        let notifType = 'GENERAL';
        let userIds: string[] = [];

        if (path.includes('send-payment-reminder')) {
          notifType = 'PAYMENT_REMINDER';
          const targetUserId = body?.targetUserId || body?.userId;
          if (!targetUserId) {
            return res.status(400).json({ error: 'targetUserId é obrigatório', message: 'Informe o usuário' });
          }
          userIds = [String(targetUserId)];
        } else if (path.includes('send-event')) {
          notifType = 'EVENT_REMINDER';
          const eventId = body?.eventId;
          if (eventId) {
            const regs: any[] = await db.$queryRawUnsafe(
              `SELECT DISTINCT "userId" FROM event_registrations WHERE "eventId" = $1`,
              eventId
            );
            userIds = (regs || []).map((r) => r.userId).filter(Boolean);
          }
          if (userIds.length === 0) {
            const all: any[] = await db.$queryRawUnsafe(
              `SELECT id FROM users WHERE "isActive" = true`
            );
            userIds = (all || []).map((u) => u.id);
          }
        } else if (path.includes('send-to-role')) {
          const roleRaw = (body?.role || '').toString().toUpperCase();
          const role =
            roleRaw === 'VOLUNTEERS' || roleRaw === 'VOLUNTEER'
              ? 'VOLUNTEER'
              : roleRaw === 'PARTNERS' || roleRaw === 'PARTNER'
                ? 'PARTNER'
                : roleRaw === 'MEMBERS' || roleRaw === 'MEMBER'
                  ? 'MEMBER'
                  : roleRaw;

          if (role === 'VOLUNTEER') {
            const rows: any[] = await db.$queryRawUnsafe(
              `SELECT DISTINCT "userId" FROM volunteer_works WHERE "isActive" = true`
            );
            userIds = (rows || []).map((r) => r.userId);
            notifType = 'VOLUNTEER_OPPORTUNITY';
          } else if (role === 'PARTNER' || role === 'MEMBER' || role === 'ADMIN') {
            const rows: any[] = await db.$queryRawUnsafe(
              `SELECT id FROM users WHERE "isActive" = true AND role = $1::"UserRole"`,
              role
            );
            userIds = (rows || []).map((r) => r.id);
          } else {
            return res.status(400).json({ error: 'Role inválida', message: 'Role inválida' });
          }
        } else {
          // send-to-all / admin/notifications/send
          const rows: any[] = await db.$queryRawUnsafe(
            `SELECT id FROM users WHERE "isActive" = true`
          );
          userIds = (rows || []).map((r) => r.id);
          notifType = 'GENERAL';
        }

        // Deduplicate
        userIds = [...new Set(userIds.filter(Boolean))];
        if (userIds.length === 0) {
          return res.status(400).json({
            error: 'Nenhum destinatário encontrado',
            message: 'Nenhum destinatário encontrado',
            successCount: 0,
          });
        }

        const dataJson = JSON.stringify(body?.data || { screen: 'Notifications' });
        let successCount = 0;
        for (const userId of userIds) {
          const id = require('crypto').randomUUID();
          try {
            await db.$executeRawUnsafe(
              `INSERT INTO notifications
                (id, "userId", title, message, type, data, "isRead", "sentAt")
               VALUES ($1, $2, $3, $4, $5::"NotificationType", $6::jsonb, false, NOW())`,
              id,
              userId,
              title,
              message,
              notifType,
              dataJson
            );
            successCount += 1;
          } catch (e) {
            console.warn('Falha ao criar notificação para', userId, e);
          }
        }

        return res.status(200).json({
          message: 'Notificações criadas com sucesso',
          successCount,
          totalTargets: userIds.length,
        });
      } catch (error: any) {
        console.error('❌ Admin send notification:', error);
        return res.status(500).json({
          error: 'Erro ao enviar notificação',
          message: error?.message || 'Erro ao enviar notificação',
        });
      }
    }

    // ========== ADMIN MEMBERSHIPS ==========
    if (path === '/api/admin/memberships' && method === 'GET') {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT m.id, m."userId", m."memberId", m.status, m."startDate", m."endDate",
                  m."monthlyFee", m."nextPayment", m."paymentMethod", m."qrCode",
                  u.name AS user_name, u.email AS user_email, u.phone AS user_phone
           FROM memberships m
           LEFT JOIN users u ON u.id = m."userId"
           ORDER BY m."updatedAt" DESC
           LIMIT 200`
        );
        return res.status(200).json({
          memberships: (rows || []).map((m) => ({
            id: m.id,
            userId: m.userId,
            memberId: m.memberId,
            status: m.status,
            startDate: m.startDate,
            endDate: m.endDate,
            monthlyFee: parseFloat(m.monthlyFee?.toString?.() || '29.9'),
            nextPayment: m.nextPayment,
            paymentMethod: m.paymentMethod,
            qrCode: m.qrCode,
            user: { name: m.user_name, email: m.user_email, phone: m.user_phone },
          })),
          total: rows?.length || 0,
        });
      } catch (error: any) {
        return res.status(500).json({ error: 'Erro ao listar memberships', detail: error?.message });
      }
    }

    if (path === '/api/admin/memberships/renew' && method === 'POST') {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const membershipId = body?.membershipId || body?.id;
        const days = Math.max(1, parseInt(String(body?.days || '30'), 10) || 30);
        if (!membershipId) return res.status(400).json({ error: 'membershipId é obrigatório' });

        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT id, "endDate" FROM memberships WHERE id = $1 LIMIT 1`,
          membershipId
        );
        if (!rows?.[0]) return res.status(404).json({ error: 'Membership não encontrada' });

        const base =
          rows[0].endDate && new Date(rows[0].endDate).getTime() > Date.now()
            ? new Date(rows[0].endDate).getTime()
            : Date.now();
        const newEnd = new Date(base + days * 24 * 60 * 60 * 1000);

        await db.$executeRawUnsafe(
          `UPDATE memberships
           SET status = 'ACTIVE', "endDate" = $1, "nextPayment" = $1, "updatedAt" = NOW()
           WHERE id = $2`,
          newEnd,
          membershipId
        );
        return res.status(200).json({ message: `Renovada por ${days} dias`, endDate: newEnd });
      } catch (error: any) {
        return res.status(500).json({ error: 'Erro ao renovar membership', detail: error?.message });
      }
    }

    if (path === '/api/admin/memberships/status' && method === 'POST') {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const membershipId = body?.membershipId || body?.id;
        const status = (body?.status || '').toString().toUpperCase();
        if (!membershipId || !['ACTIVE', 'INACTIVE', 'PENDING_PAYMENT', 'SUSPENDED'].includes(status)) {
          return res.status(400).json({ error: 'membershipId e status válidos são obrigatórios' });
        }
        await db.$executeRawUnsafe(
          `UPDATE memberships SET status = $1::"MembershipStatus", "updatedAt" = NOW() WHERE id = $2`,
          status,
          membershipId
        );
        return res.status(200).json({ message: `Status atualizado para ${status}` });
      } catch (error: any) {
        return res.status(500).json({ error: 'Erro ao atualizar status', detail: error?.message });
      }
    }

    // ========== ADMIN FINANCIAL REPORTS ==========
    if (path === '/api/admin/financial-reports' && method === 'GET') {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const reports: any[] = await db.$queryRawUnsafe(
          `SELECT id, year, month, type, title, description, income, expenses,
                  "fileUrl", "isPublished", "createdAt", "updatedAt"
           FROM financial_reports
           ORDER BY year DESC, month DESC NULLS LAST
           LIMIT 100`
        );
        const withExpenses = [];
        for (const r of reports || []) {
          const expenses: any[] = await db.$queryRawUnsafe(
            `SELECT id, category, description, amount, "createdAt"
             FROM financial_expenses WHERE "reportId" = $1 ORDER BY "createdAt" DESC`,
            r.id
          );
          withExpenses.push({
            ...r,
            income: parseFloat(r.income?.toString?.() || '0'),
            expenses: parseFloat(r.expenses?.toString?.() || '0'),
            expenseItems: (expenses || []).map((e) => ({
              ...e,
              amount: parseFloat(e.amount?.toString?.() || '0'),
            })),
          });
        }
        return res.status(200).json({ reports: withExpenses, total: withExpenses.length });
      } catch (error: any) {
        return res.status(500).json({ error: 'Erro ao listar relatórios', detail: error?.message });
      }
    }

    if (path === '/api/admin/financial-reports' && method === 'POST') {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const title = (body?.title || '').toString().trim();
        const year = parseInt(String(body?.year || new Date().getFullYear()), 10);
        const month = body?.month != null && body?.month !== '' ? parseInt(String(body.month), 10) : null;
        const type = (body?.type || 'MONTHLY').toString().toUpperCase();
        const income = parseFloat(String(body?.income || '0')) || 0;
        const expenses = parseFloat(String(body?.expenses || '0')) || 0;
        const description = body?.description ? String(body.description) : null;
        const isPublished = !!body?.isPublished;
        if (!title) return res.status(400).json({ error: 'Título é obrigatório' });

        const id = require('crypto').randomUUID();
        await db.$executeRawUnsafe(
          `INSERT INTO financial_reports
            (id, year, month, type, title, description, income, expenses, "isPublished", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4::"ReportType", $5, $6, $7, $8, $9, NOW(), NOW())`,
          id,
          year,
          month,
          type,
          title,
          description,
          income,
          expenses,
          isPublished
        );

        const expenseItems = Array.isArray(body?.expenseItems) ? body.expenseItems : [];
        for (const item of expenseItems) {
          const expId = require('crypto').randomUUID();
          const cat = (item.category || 'OTHER').toString().toUpperCase();
          await db.$executeRawUnsafe(
            `INSERT INTO financial_expenses (id, "reportId", category, description, amount, "createdAt")
             VALUES ($1, $2, $3::"ExpenseCategory", $4, $5, NOW())`,
            expId,
            id,
            cat,
            String(item.description || cat),
            parseFloat(String(item.amount || 0)) || 0
          );
        }

        return res.status(201).json({ message: 'Relatório criado', id });
      } catch (error: any) {
        return res.status(500).json({ error: 'Erro ao criar relatório', detail: error?.message });
      }
    }

    if (path === '/api/admin/financial-reports/publish' && method === 'POST') {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const reportId = body?.reportId || body?.id;
        const isPublished = body?.isPublished !== false;
        if (!reportId) return res.status(400).json({ error: 'reportId é obrigatório' });

        await db.$executeRawUnsafe(
          `UPDATE financial_reports SET "isPublished" = $1, "updatedAt" = NOW() WHERE id = $2`,
          !!isPublished,
          reportId
        );
        return res.status(200).json({
          message: isPublished ? 'Relatório publicado no app' : 'Relatório despublicado',
        });
      } catch (error: any) {
        return res.status(500).json({ error: 'Erro ao publicar relatório', detail: error?.message });
      }
    }

    // ========== ADMIN VOLUNTEERS ==========
    if (path === '/api/admin/volunteers' && method === 'GET') {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT vw.id, vw."userId", vw.role, vw.description, vw."startDate", vw."endDate",
                  vw."isActive", vw."createdAt",
                  u.name AS user_name, u.email AS user_email, u.phone AS user_phone
           FROM volunteer_works vw
           LEFT JOIN users u ON u.id = vw."userId"
           ORDER BY vw."createdAt" DESC
           LIMIT 200`
        );
        return res.status(200).json({
          volunteers: (rows || []).map((v) => ({
            id: v.id,
            userId: v.userId,
            role: v.role,
            description: v.description,
            startDate: v.startDate,
            endDate: v.endDate,
            isActive: v.isActive,
            createdAt: v.createdAt,
            user: { name: v.user_name, email: v.user_email, phone: v.user_phone },
          })),
          total: rows?.length || 0,
        });
      } catch (error: any) {
        return res.status(500).json({ error: 'Erro ao listar voluntários', detail: error?.message });
      }
    }

    if (path === '/api/admin/volunteers/status' && method === 'POST') {
      const db = getPrisma();
      if (!db) return res.status(503).json({ error: 'Database not configured' });
      try {
        const token = req.headers['x-admin-token'] || req.headers?.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        let ok = token.startsWith('demo-token-');
        if (!ok) {
          try { const d: any = jwt.verify(token, JWT_SECRET); ok = d.role === 'ADMIN'; } catch {}
        }
        if (!ok) return res.status(401).json({ error: 'Invalid token' });

        const volunteerId = body?.volunteerId || body?.id;
        const isActive = body?.isActive !== false && body?.isActive !== 'false';
        if (!volunteerId) return res.status(400).json({ error: 'volunteerId é obrigatório' });

        await db.$executeRawUnsafe(
          `UPDATE volunteer_works
           SET "isActive" = $1,
               "endDate" = CASE WHEN $1 = false THEN NOW() ELSE "endDate" END,
               "updatedAt" = NOW()
           WHERE id = $2`,
          !!isActive,
          volunteerId
        );
        return res.status(200).json({
          message: isActive ? 'Voluntário ativado' : 'Voluntário desativado',
        });
      } catch (error: any) {
        return res.status(500).json({ error: 'Erro ao atualizar voluntário', detail: error?.message });
      }
    }

    // GET user notifications
    if (path === '/api/user/notifications' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }

        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) throw new Error('no user');
        } catch {
          return res.status(401).json({ error: 'Token inválido' });
        }

        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT id, "userId", title, message, type, data, "isRead", "sentAt", "readAt"
           FROM notifications
           WHERE "userId" = $1
           ORDER BY "sentAt" DESC
           LIMIT 100`,
          userId
        );

        const notifications = (rows || []).map((n) => ({
          id: n.id,
          title: n.title,
          body: n.message,
          message: n.message,
          type: n.type,
          data: n.data || {},
          isRead: !!n.isRead,
          sentAt: n.sentAt,
          readAt: n.readAt,
        }));

        const unreadCount = notifications.filter((n) => !n.isRead).length;

        return res.status(200).json({
          notifications,
          unreadCount,
          total: notifications.length,
        });
      } catch (error: any) {
        console.error('❌ Erro ao buscar notificações:', error);
        return res.status(500).json({
          error: 'Erro ao carregar notificações',
          detail: error?.message || String(error),
        });
      }
    }

    // POST mark notification(s) as read
    if (path === '/api/user/notifications/read' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }

        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) throw new Error('no user');
        } catch {
          return res.status(401).json({ error: 'Token inválido' });
        }

        const { notificationId, markAll } = body || {};

        if (markAll) {
          await db.$executeRawUnsafe(
            `UPDATE notifications
             SET "isRead" = true, "readAt" = NOW()
             WHERE "userId" = $1 AND "isRead" = false`,
            userId
          );
          return res.status(200).json({ message: 'Todas as notificações foram marcadas como lidas' });
        }

        if (!notificationId) {
          return res.status(400).json({ error: 'notificationId é obrigatório' });
        }

        await db.$executeRawUnsafe(
          `UPDATE notifications
           SET "isRead" = true, "readAt" = NOW()
           WHERE id = $1 AND "userId" = $2`,
          notificationId,
          userId
        );

        return res.status(200).json({ message: 'Notificação marcada como lida' });
      } catch (error: any) {
        console.error('❌ Erro ao marcar notificação:', error);
        return res.status(500).json({ error: 'Erro ao atualizar notificação' });
      }
    }

    // GET user volunteer status/stats
    if (path === '/api/user/volunteer' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }

        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) throw new Error('no user');
        } catch {
          return res.status(401).json({ error: 'Token inválido' });
        }

        const works: any[] = await db.$queryRawUnsafe(
          `SELECT id, role, description, "startDate", "endDate", "isActive", "createdAt"
           FROM volunteer_works
           WHERE "userId" = $1
           ORDER BY "createdAt" DESC`,
          userId
        );

        const activeWork = (works || []).find((w) => w.isActive) || null;

        const eventRegs: any[] = await db.$queryRawUnsafe(
          `SELECT er.id, er.status, er."createdAt",
                  e.id AS event_id, e.title, e."startDate", e."endDate", e.location
           FROM event_registrations er
           INNER JOIN events e ON e.id = er."eventId"
           WHERE er."userId" = $1
           ORDER BY e."startDate" DESC
           LIMIT 20`,
          userId
        );

        const eventsAttended = (eventRegs || []).filter(
          (e) => e.status === 'CONFIRMED' || e.status === 'REGISTERED'
        ).length;
        // Estimativa simples: 3h por evento + 2h/semana se voluntário ativo
        let totalHours = eventsAttended * 3;
        if (activeWork?.startDate) {
          const start = new Date(activeWork.startDate).getTime();
          const weeks = Math.max(1, Math.floor((Date.now() - start) / (7 * 24 * 60 * 60 * 1000)));
          totalHours += weeks * 2;
        }
        const points = totalHours * 10;

        const rankingRows: any[] = await db.$queryRawUnsafe(
          `SELECT vw."userId", u.name,
                  COUNT(er.id)::int AS events_count
           FROM volunteer_works vw
           INNER JOIN users u ON u.id = vw."userId"
           LEFT JOIN event_registrations er ON er."userId" = vw."userId"
           WHERE vw."isActive" = true
           GROUP BY vw."userId", u.name
           ORDER BY events_count DESC, u.name ASC
           LIMIT 50`
        );

        let rank = 0;
        const ranking = (rankingRows || []).map((row, index) => {
          const entry = {
            position: index + 1,
            userId: row.userId,
            name: row.name,
            eventsCount: row.events_count || 0,
            points: (row.events_count || 0) * 30,
          };
          if (row.userId === userId) rank = entry.position;
          return entry;
        });

        if (!rank && activeWork) {
          rank = ranking.length + 1;
        }

        let level = 'Bronze';
        let nextLevelPoints = 100;
        let progress = Math.min(100, (points / 100) * 100);
        if (points >= 300) {
          level = 'Ouro';
          nextLevelPoints = 0;
          progress = 100;
        } else if (points >= 100) {
          level = 'Prata';
          nextLevelPoints = 300 - points;
          progress = ((points - 100) / 200) * 100;
        } else {
          nextLevelPoints = 100 - points;
          progress = (points / 100) * 100;
        }

        const now = Date.now();
        const events = (eventRegs || []).map((e) => {
          const start = new Date(e.startDate).getTime();
          return {
            id: e.event_id,
            title: e.title,
            date: e.startDate,
            location: e.location,
            hours: 3,
            status: start >= now ? 'upcoming' : 'completed',
            registrationStatus: e.status,
          };
        });

        return res.status(200).json({
          isVolunteer: !!activeWork,
          volunteerWork: activeWork,
          stats: {
            totalHours,
            eventsAttended,
            rank,
            points,
            level,
            nextLevelPoints,
            progress,
          },
          events,
          ranking: ranking.slice(0, 10),
        });
      } catch (error: any) {
        console.error('❌ Erro volunteer status:', error);
        return res.status(500).json({
          error: 'Erro ao carregar voluntariado',
          detail: error?.message || String(error),
        });
      }
    }

    // POST register as volunteer
    if (path === '/api/volunteers/register' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }

        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) throw new Error('no user');
        } catch {
          return res.status(401).json({ error: 'Token inválido' });
        }

        const role = (body?.role || '').toString().trim();
        const description = (body?.description || '').toString().trim();
        if (!role || role.length < 2) {
          return res.status(400).json({ error: 'Informe a área de atuação' });
        }

        const existing: any[] = await db.$queryRawUnsafe(
          `SELECT id FROM volunteer_works WHERE "userId" = $1 AND "isActive" = true LIMIT 1`,
          userId
        );
        if (existing?.[0]) {
          return res.status(400).json({ error: 'Você já está cadastrado como voluntário' });
        }

        const id = require('crypto').randomUUID();
        const startDate = body?.startDate ? new Date(body.startDate) : new Date();

        await db.$executeRawUnsafe(
          `INSERT INTO volunteer_works
            (id, "userId", role, description, "startDate", "endDate", "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, NULL, true, NOW(), NOW())`,
          id,
          userId,
          role,
          description || null,
          startDate
        );

        // Notificação de boas-vindas ao voluntariado
        try {
          const notifId = require('crypto').randomUUID();
          await db.$executeRawUnsafe(
            `INSERT INTO notifications
              (id, "userId", title, message, type, data, "isRead", "sentAt")
             VALUES ($1, $2, $3, $4, 'VOLUNTEER_OPPORTUNITY', $5::jsonb, false, NOW())`,
            notifId,
            userId,
            'Bem-vindo ao voluntariado!',
            `Você se cadastrou como voluntário na área: ${role}. Confira os próximos eventos.`,
            JSON.stringify({ screen: 'EventsCalendar' })
          );
        } catch (notifErr) {
          console.warn('Não foi possível criar notificação de voluntário:', notifErr);
        }

        return res.status(201).json({
          message: 'Cadastro de voluntário realizado com sucesso',
          volunteerWork: {
            id,
            userId,
            role,
            description: description || null,
            startDate,
            isActive: true,
          },
        });
      } catch (error: any) {
        console.error('❌ Erro register volunteer:', error);
        return res.status(500).json({
          error: 'Erro ao cadastrar voluntário',
          detail: error?.message || String(error),
        });
      }
    }

    // GET user volunteer status/stats - placeholder removed
    // GET transparency summary already above

    // GET user membership (cria automaticamente se não existir)
    if (path === '/api/user/membership' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }

        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) throw new Error('no user');
        } catch {
          return res.status(401).json({ error: 'Token inválido' });
        }

        const users: Array<{ id: string; name: string; email: string }> =
          await db.$queryRawUnsafe(
            `SELECT id, name, email FROM users WHERE id = $1 LIMIT 1`,
            userId
          );
        const user = users?.[0];
        if (!user) {
          return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        let rows: any[] = await db.$queryRawUnsafe(
          `SELECT id, "userId", "memberId", status, "startDate", "endDate",
                  "monthlyFee", "nextPayment", "paymentMethod", "qrCode",
                  "createdAt", "updatedAt"
           FROM memberships WHERE "userId" = $1 LIMIT 1`,
          userId
        );

        if (!rows?.[0]) {
          const membershipId = require('crypto').randomUUID();
          const memberId = `MEM${Date.now().toString().slice(-8)}`;
          const qrCode = `LIGADOBEM|${memberId}|${userId}`;
          const startDate = new Date();
          const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          const nextPayment = endDate;

          await db.$executeRawUnsafe(
            `INSERT INTO memberships
              (id, "userId", "memberId", status, "startDate", "endDate",
               "monthlyFee", "nextPayment", "paymentMethod", "qrCode",
               "createdAt", "updatedAt")
             VALUES ($1, $2, $3, 'ACTIVE', $4, $5, 29.90, $6, 'PIX', $7, NOW(), NOW())`,
            membershipId,
            userId,
            memberId,
            startDate,
            endDate,
            nextPayment,
            qrCode
          );

          rows = await db.$queryRawUnsafe(
            `SELECT id, "userId", "memberId", status, "startDate", "endDate",
                    "monthlyFee", "nextPayment", "paymentMethod", "qrCode",
                    "createdAt", "updatedAt"
             FROM memberships WHERE "userId" = $1 LIMIT 1`,
            userId
          );
        } else if (!rows[0].qrCode) {
          const qrCode = `LIGADOBEM|${rows[0].memberId}|${userId}`;
          await db.$executeRawUnsafe(
            `UPDATE memberships SET "qrCode" = $1, "updatedAt" = NOW() WHERE id = $2`,
            qrCode,
            rows[0].id
          );
          rows[0].qrCode = qrCode;
        }

        // Se vencida, marcar como PENDING_PAYMENT (sem apagar o cartão)
        const membership = rows[0];
        const end = membership.endDate ? new Date(membership.endDate) : null;
        let status = membership.status;
        if (end && end.getTime() < Date.now() && status === 'ACTIVE') {
          status = 'PENDING_PAYMENT';
          await db.$executeRawUnsafe(
            `UPDATE memberships SET status = 'PENDING_PAYMENT', "updatedAt" = NOW() WHERE id = $1`,
            membership.id
          );
        }

        return res.status(200).json({
          membership: {
            id: membership.id,
            userId: membership.userId,
            memberId: membership.memberId,
            status,
            startDate: membership.startDate,
            endDate: membership.endDate,
            monthlyFee: parseFloat(membership.monthlyFee?.toString?.() || '29.9'),
            nextPayment: membership.nextPayment,
            paymentMethod: membership.paymentMethod,
            qrCode: membership.qrCode,
            createdAt: membership.createdAt,
            updatedAt: membership.updatedAt,
          },
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        });
      } catch (error: any) {
        console.error('❌ Erro ao buscar membership:', error);
        return res.status(500).json({
          error: 'Erro ao carregar cartão de membro',
          detail: error?.message || String(error),
        });
      }
    }

    // POST renew membership (+30 dias)
    if (path === '/api/user/membership/renew' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }

        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
          if (!userId) throw new Error('no user');
        } catch {
          return res.status(401).json({ error: 'Token inválido' });
        }

        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT id, "memberId", "endDate", "monthlyFee", "qrCode"
           FROM memberships WHERE "userId" = $1 LIMIT 1`,
          userId
        );

        if (!rows?.[0]) {
          return res.status(404).json({
            error: 'Cartão não encontrado. Abra a aba Cartão para gerar o seu.',
          });
        }

        const current = rows[0];
        const base =
          current.endDate && new Date(current.endDate).getTime() > Date.now()
            ? new Date(current.endDate).getTime()
            : Date.now();
        const newEnd = new Date(base + 30 * 24 * 60 * 60 * 1000);
        const qrCode =
          current.qrCode || `LIGADOBEM|${current.memberId}|${userId}`;

        await db.$executeRawUnsafe(
          `UPDATE memberships
           SET status = 'ACTIVE',
               "endDate" = $1,
               "nextPayment" = $1,
               "paymentMethod" = 'PIX',
               "qrCode" = $2,
               "updatedAt" = NOW()
           WHERE id = $3`,
          newEnd,
          qrCode,
          current.id
        );

        const updated: any[] = await db.$queryRawUnsafe(
          `SELECT id, "userId", "memberId", status, "startDate", "endDate",
                  "monthlyFee", "nextPayment", "paymentMethod", "qrCode"
           FROM memberships WHERE id = $1 LIMIT 1`,
          current.id
        );

        return res.status(200).json({
          message: 'Mensalidade renovada por mais 30 dias',
          membership: {
            ...updated[0],
            monthlyFee: parseFloat(updated[0].monthlyFee?.toString?.() || '29.9'),
          },
        });
      } catch (error: any) {
        console.error('❌ Erro ao renovar membership:', error);
        return res.status(500).json({
          error: 'Erro ao renovar mensalidade',
          detail: error?.message || String(error),
        });
      }
    }

    // GET user donations
    if (path === '/api/user/donations' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        const donations = await db.donation.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            description: true,
            createdAt: true,
          }
        });
        
        return res.status(200).json({ donations, total: donations.length });
      } catch (error: any) {
        console.error('❌ Erro ao buscar doações:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }

    // GET user adoptions
    if (path === '/api/user/adoptions' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        const adoptions = await db.adoption.findMany({
          where: { userId },
          include: {
            animal: {
              select: {
                id: true,
                name: true,
                species: true,
                breed: true,
                image: true,
              }
            }
          },
          orderBy: { applicationDate: 'desc' }
        });
        
        return res.status(200).json({ adoptions, total: adoptions.length });
      } catch (error: any) {
        console.error('❌ Erro ao buscar adoções:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }

    // GET user events
    if (path === '/api/user/events' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        const registrations = await db.eventRegistration.findMany({
          where: { userId },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                description: true,
                type: true,
                startDate: true,
                endDate: true,
                location: true,
                address: true,
                image: true,
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        
        return res.status(200).json({ events: registrations, total: registrations.length });
      } catch (error: any) {
        console.error('❌ Erro ao buscar eventos:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }

    // POST user avatar upload
    if (path === '/api/user/avatar/upload' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        const { imageBase64 } = body;
        
        if (!imageBase64) {
          return res.status(400).json({ error: 'Imagem não fornecida' });
        }
        
        // Verificar se Cloudinary está configurado
        const cloudinaryInstance = getCloudinary();
        let avatarUrl: string;
        
        if (cloudinaryInstance) {
          // Upload para Cloudinary (método preferido)
          try {
            const uploadResult = await new Promise((resolve, reject) => {
              cloudinaryInstance.uploader.upload(
                imageBase64,
                {
                  folder: 'liga-do-bem/avatars',
                  public_id: `avatar_${userId}_${Date.now()}`,
                  overwrite: true,
                  resource_type: 'image',
                  transformation: [
                    { width: 400, height: 400, crop: 'fill', gravity: 'face' },
                    { quality: 'auto' },
                  ],
                },
                (error: any, result: any) => {
                  if (error) reject(error);
                  else resolve(result);
                }
              );
            });
            
            avatarUrl = (uploadResult as any).secure_url;
            console.log('✅ Avatar enviado para Cloudinary:', avatarUrl);
          } catch (uploadError: any) {
            console.error('❌ Erro ao fazer upload para Cloudinary:', uploadError);
            return res.status(500).json({ 
              error: 'Erro ao fazer upload da imagem',
              details: uploadError.message 
            });
          }
        } else {
          // Fallback: salvar como data URI base64 (temporário até configurar Cloudinary)
          console.warn('⚠️ Cloudinary não configurado, usando fallback base64');
          
          // Garantir que o base64 tenha o prefixo data:image
          let base64Data = imageBase64;
          if (!base64Data.startsWith('data:')) {
            // Tentar detectar o tipo da imagem pelo conteúdo
            // Por padrão, assumir JPEG se não conseguir detectar
            const imageType = 'image/jpeg';
            base64Data = `data:${imageType};base64,${base64Data}`;
          }
          
          // Verificar tamanho do base64 (limite de ~1MB para evitar problemas)
          // Calcular tamanho aproximado: base64 é ~33% maior que o binário original
          const base64Length = base64Data.length;
          // Estimar tamanho aproximado (base64 tem overhead de ~33%)
          const estimatedSize = (base64Length * 3) / 4;
          const maxSize = 1024 * 1024; // 1MB
          
          console.log(`📊 Tamanho estimado do base64: ${(estimatedSize / 1024).toFixed(2)} KB (${base64Length} caracteres)`);
          
          if (estimatedSize > maxSize) {
            console.error('❌ Imagem muito grande para salvar como base64:', estimatedSize, 'bytes estimados');
            return res.status(413).json({ 
              error: 'Imagem muito grande. Por favor, use uma imagem menor ou configure Cloudinary.',
              details: `Tamanho estimado da imagem: ${(estimatedSize / 1024).toFixed(2)} KB. Limite: ${(maxSize / 1024).toFixed(2)} KB. Configure Cloudinary nas variáveis de ambiente para suportar imagens maiores.`
            });
          }
          
          avatarUrl = base64Data;
          console.log('✅ Avatar salvo como data URI (fallback)');
        }
        
        // Verificar se o usuário existe antes de atualizar
        console.log('🔍 Verificando se usuário existe:', userId);
        const userExists = await db.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, name: true }
        });
        
        if (!userExists) {
          console.error('❌ Usuário não encontrado:', userId);
          return res.status(404).json({ 
            error: 'Usuário não encontrado',
            details: `Usuário com ID ${userId} não existe no banco de dados`
          });
        }
        
        console.log('✅ Usuário encontrado:', userExists.email);
        
        // Atualizar avatar do usuário no banco
        try {
          // Limitar tamanho do avatarUrl para evitar problemas (PostgreSQL TEXT pode ser muito grande, mas vamos limitar para segurança)
          const maxAvatarLength = 10 * 1024 * 1024; // 10MB (muito generoso, mas seguro)
          if (avatarUrl.length > maxAvatarLength) {
            console.error('❌ Avatar URL muito grande:', avatarUrl.length, 'caracteres');
            return res.status(413).json({ 
              error: 'Imagem muito grande. Por favor, use uma imagem menor ou configure Cloudinary.',
              details: `Tamanho: ${(avatarUrl.length / 1024).toFixed(2)} KB. Limite: ${(maxAvatarLength / 1024).toFixed(2)} KB.`
            });
          }
          
          console.log('💾 Tentando atualizar avatar no banco...', {
            userId,
            avatarUrlLength: avatarUrl.length,
            avatarUrlPreview: avatarUrl.substring(0, 50) + '...'
          });
          
          const updatedUser = await db.user.update({
            where: { id: userId },
            data: { avatar: avatarUrl },
            select: {
              id: true,
              email: true,
              avatar: true
            }
          });
          
          console.log('✅ Avatar atualizado no banco de dados com sucesso:', {
            userId: updatedUser.id,
            email: updatedUser.email,
            avatarLength: updatedUser.avatar?.length || 0
          });
          
          return res.status(200).json({
            success: true,
            avatarUrl: avatarUrl,
            message: 'Avatar atualizado com sucesso',
          });
        } catch (dbError: any) {
          console.error('❌ Erro ao atualizar avatar no banco:', dbError);
          console.error('❌ Detalhes completos do erro:', {
            code: dbError.code,
            message: dbError.message,
            meta: dbError.meta,
            stack: dbError.stack?.substring(0, 500), // Primeiros 500 chars do stack
          });
          
          // Verificar tipos específicos de erro
          if (dbError.code === 'P2025') {
            return res.status(404).json({ 
              error: 'Usuário não encontrado',
              details: 'O usuário não existe no banco de dados'
            });
          }
          
          if (dbError.message?.includes('value too long') || 
              dbError.message?.includes('string too long') ||
              dbError.message?.includes('exceeds maximum')) {
            return res.status(413).json({ 
              error: 'Imagem muito grande. Por favor, use uma imagem menor ou configure Cloudinary.',
              details: 'O tamanho máximo permitido foi excedido. Configure Cloudinary nas variáveis de ambiente para suportar imagens maiores.'
            });
          }
          
          if (dbError.message?.includes('column') && dbError.message?.includes('does not exist')) {
            return res.status(500).json({ 
              error: 'Erro de configuração do banco de dados',
              details: 'O campo avatar não existe na tabela. Execute as migrações do Prisma.'
            });
          }
          
          return res.status(500).json({ 
            error: 'Erro ao salvar avatar no banco de dados',
            details: dbError.message || 'Erro desconhecido',
            code: dbError.code || 'UNKNOWN'
          });
        }
      } catch (error: any) {
        console.error('❌ Erro ao fazer upload de avatar:', error);
        console.error('❌ Stack trace:', error.stack);
        return res.status(500).json({ 
          error: 'Erro interno do servidor',
          details: error.message || 'Erro desconhecido'
        });
      }
    }

    // GET user stats
    if (path === '/api/user/stats' && method === 'GET') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      try {
        const token = req.headers?.authorization?.replace('Bearer ', '') || null;
        if (!token) {
          return res.status(401).json({ error: 'Token de autenticação necessário' });
        }
        
        let userId: string;
        try {
          const decoded: any = jwt.verify(token, JWT_SECRET);
          userId = decoded.userId || decoded.id;
        } catch (e) {
          return res.status(401).json({ error: 'Token inválido' });
        }
        
        const [donationsCount, donationsTotal, adoptionsCount, volunteerWorks] = await Promise.all([
          db.donation.count({ where: { userId, status: 'APPROVED' } }),
          db.donation.aggregate({
            where: { userId, status: 'APPROVED' },
            _sum: { amount: true }
          }),
          db.adoption.count({ where: { userId, status: 'COMPLETED' } }),
          db.volunteerWork.findMany({
            where: { userId, isActive: true },
            select: { startDate: true, endDate: true }
          }).catch(() => [])
        ]);
        
        const totalDonations = donationsTotal._sum.amount ? parseFloat(donationsTotal._sum.amount.toString()) : 0;
        
        // Calcular horas de voluntariado (simulado - baseado em trabalhos ativos)
        // Se não houver campo hours, usar contagem de trabalhos ativos
        const volunteerHours = volunteerWorks.length; // Simplificado por enquanto
        
        return res.status(200).json({
          donations: donationsCount,
          donationsTotal: totalDonations,
          adoptions: adoptionsCount,
          volunteerHours: volunteerHours,
        });
      } catch (error: any) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }

    // POST /api/admin/migrate - Executar migrations (apenas para administradores)
    if (path === '/api/admin/migrate' && method === 'POST') {
      const db = getPrisma();
      if (!db) {
        return res.status(503).json({ error: 'Database not configured' });
      }
      
      try {
        // Verificar token administrativo
        const adminToken = req.headers?.['x-admin-token'] || req.headers?.['authorization']?.replace('Bearer ', '');
        const validAdminTokens = [
          'demo-token-admin',
          'liga-do-bem-admin-2024',
          process.env.ADMIN_TOKEN || 'admin-secret-token'
        ];
        
        if (!adminToken || !validAdminTokens.includes(adminToken)) {
          return res.status(401).json({ error: 'Token administrativo inválido' });
        }

        const migrationType = body.migrationType || 'cpf'; // 'cpf' ou 'new-features'
        
        if (migrationType === 'new-features') {
          console.log('🔄 Executando migration para novas funcionalidades (Help Info, Pets, Vaccinations, App Versions)...');
          
          try {
            // Ler e executar o arquivo de migration
            const fs = require('fs');
            const path = require('path');
            const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', '20250120000000_add_new_features', 'migration.sql');
            
            let migrationSQL: string;
            try {
              migrationSQL = fs.readFileSync(migrationPath, 'utf8');
            } catch (fileError: any) {
              // Se não conseguir ler o arquivo, executar SQL inline
              console.log('⚠️ Não foi possível ler arquivo de migration, executando SQL inline...');
              migrationSQL = `
                -- Criar enum PetGender se não existir
                DO $$ BEGIN
                    CREATE TYPE "PetGender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;

                -- Nota: VaccinationStatus não é usado no schema atual

                -- Criar tabela help_info
                CREATE TABLE IF NOT EXISTS "help_info" (
                    "id" TEXT NOT NULL,
                    "category" TEXT NOT NULL,
                    "title" TEXT NOT NULL,
                    "description" TEXT,
                    "items" JSONB NOT NULL DEFAULT '[]',
                    "order" INTEGER NOT NULL DEFAULT 0,
                    "isActive" BOOLEAN NOT NULL DEFAULT true,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP(3) NOT NULL,
                    CONSTRAINT "help_info_pkey" PRIMARY KEY ("id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "help_info_category_key" ON "help_info"("category");

                -- Criar tabela pets
                CREATE TABLE IF NOT EXISTS "pets" (
                    "id" TEXT NOT NULL,
                    "userId" TEXT NOT NULL,
                    "name" TEXT NOT NULL,
                    "species" TEXT NOT NULL,
                    "breed" TEXT,
                    "birthDate" TIMESTAMP(3),
                    "photo" TEXT,
                    "gender" TEXT,
                    "color" TEXT,
                    "weight" DOUBLE PRECISION,
                    "microchip" TEXT,
                    "notes" TEXT,
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP(3) NOT NULL,
                    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
                );

                DO $$ BEGIN
                    ALTER TABLE "pets" ADD CONSTRAINT "pets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;

                -- Criar tabela vaccinations
                CREATE TABLE IF NOT EXISTS "vaccinations" (
                    "id" TEXT NOT NULL,
                    "petId" TEXT NOT NULL,
                    "vaccineName" TEXT NOT NULL,
                    "vaccineType" TEXT,
                    "applicationDate" TIMESTAMP(3) NOT NULL,
                    "nextDoseDate" TIMESTAMP(3),
                    "batchNumber" TEXT,
                    "veterinarian" TEXT,
                    "veterinarianCRMV" TEXT,
                    "clinicName" TEXT,
                    "clinicId" TEXT,
                    "notes" TEXT,
                    "isVerified" BOOLEAN NOT NULL DEFAULT false,
                    "verifiedAt" TIMESTAMP(3),
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP(3) NOT NULL,
                    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
                );

                DO $$ BEGIN
                    ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;

                -- Criar tabela app_versions
                CREATE TABLE IF NOT EXISTS "app_versions" (
                    "id" TEXT NOT NULL,
                    "version" TEXT NOT NULL,
                    "versionCode" INTEGER NOT NULL,
                    "minVersion" TEXT,
                    "apkUrl" TEXT,
                    "apkSize" INTEGER,
                    "releaseNotes" TEXT,
                    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
                    "isActive" BOOLEAN NOT NULL DEFAULT true,
                    "platform" TEXT NOT NULL DEFAULT 'android',
                    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    "updatedAt" TIMESTAMP(3) NOT NULL,
                    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
                );

                CREATE UNIQUE INDEX IF NOT EXISTS "app_versions_version_key" ON "app_versions"("version");
                CREATE UNIQUE INDEX IF NOT EXISTS "app_versions_versionCode_key" ON "app_versions"("versionCode");
              `;
            }
            
            // Executar cada comando SQL separadamente
            const commands = migrationSQL.split(';').filter((cmd: string) => cmd.trim().length > 0);
            
            for (const command of commands) {
              const trimmedCmd = command.trim();
              if (trimmedCmd) {
                try {
                  await db.$executeRawUnsafe(trimmedCmd);
                } catch (cmdError: any) {
                  // Ignorar erros de "already exists" ou "duplicate"
                  if (!cmdError.message?.includes('already exists') && 
                      !cmdError.message?.includes('duplicate') &&
                      !cmdError.message?.includes('duplicate_object')) {
                    console.warn('⚠️ Erro ao executar comando SQL:', cmdError.message);
                  }
                }
              }
            }
            
            console.log('✅ Migration de novas funcionalidades executada com sucesso');
            
            return res.status(200).json({
              success: true,
              message: 'Migration de novas funcionalidades executada com sucesso',
              tablesCreated: ['help_info', 'pets', 'vaccinations', 'app_versions']
            });
          } catch (migrationError: any) {
            console.error('❌ Erro ao executar migration de novas funcionalidades:', migrationError);
            return res.status(500).json({
              success: false,
              error: 'Erro ao executar migration',
              message: migrationError.message
            });
          }
        } else {
          // Migration original do CPF
          console.log('🔄 Executando migration para adicionar coluna CPF...');
          
          try {
            // Verificar se a coluna já existe
            const checkColumn = await db.$queryRaw`
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = 'users' AND column_name = 'cpf'
            ` as any[];
            
            if (checkColumn && checkColumn.length > 0) {
              console.log('✅ Coluna CPF já existe');
              return res.status(200).json({
                success: true,
                message: 'Coluna CPF já existe no banco de dados',
                alreadyExists: true
              });
            }
            
            // Adicionar coluna CPF
            await db.$executeRaw`
              ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cpf" TEXT
            `;
            
            // Criar índice único para CPF
            await db.$executeRaw`
              CREATE UNIQUE INDEX IF NOT EXISTS "users_cpf_key" 
              ON "users"("cpf") WHERE "cpf" IS NOT NULL
            `;
            
            console.log('✅ Migration executada com sucesso - Coluna CPF adicionada');
            
            return res.status(200).json({
              success: true,
              message: 'Migration executada com sucesso - Coluna CPF adicionada ao banco de dados',
              alreadyExists: false
            });
          } catch (migrationError: any) {
            // Se a coluna já existe ou o índice já existe, isso é OK
            if (migrationError.message?.includes('already exists') || 
                migrationError.message?.includes('duplicate key')) {
              console.log('✅ Coluna ou índice já existe');
              return res.status(200).json({
                success: true,
                message: 'Coluna CPF ou índice já existe',
                alreadyExists: true
              });
            }
            
            console.error('❌ Erro ao executar migration:', migrationError);
            return res.status(500).json({
              success: false,
              error: 'Erro ao executar migration',
              message: migrationError.message
            });
          }
        }
      } catch (error: any) {
        console.error('❌ Erro ao executar migrations:', error);
        return res.status(500).json({ error: error?.message || 'Erro interno do servidor' });
      }
    }

    // 404 - Must be last, after all endpoints
    return res.status(404).json({ error: 'Not found', path });

  } catch (error: any) {
    console.error('❌ Error:', error?.message);
    return res.status(500).json({ error: error?.message || 'Internal error' });
  }
}

