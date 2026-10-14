/**
 * Nota Fiscal Paulista → Liga do Bem.
 *
 * O vínculo (doação automática dos cupons com CPF) é feito pela pessoa no sistema da Sefaz-SP:
 * não há API oficial, e o app nunca pede senha da Nota Fiscal Paulista. O app guia o passo a passo
 * e o membro marca "já fiz". A comprovação vem da própria Liga: o admin cola/importa a lista de
 * doadores que aparece no painel da entidade, e o sistema confere pelo CPF do cadastro.
 *
 * Privacidade: os CPFs da lista importada são usados só para conferir na hora; não são guardados.
 * Ficam salvos apenas quem foi confirmado (pelo id do usuário) e os totais de cada importação.
 */
import crypto from 'crypto';
import { sendFcmToTokens } from './push';

class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

type Ctx = {
  req: any;
  res: any;
  path: string;
  method: string;
  body: any;
  db: any;
  isAdmin: boolean;
  authUser: () => { userId: string; email?: string; role?: string };
};

export const NFP_DEFAULTS = {
  enabled: true,
  entityName: 'Liga do Bem',
  cnpj: '',
  siteUrl: 'https://www.nfp.fazenda.sp.gov.br',
};
const MAX_IMPORT_LINES = 20000;

let ensuredAt = 0;
export async function ensureNfpSchema(db: any) {
  if (Date.now() - ensuredAt < 6 * 60 * 60 * 1000) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS nfp_settings (
       key TEXT PRIMARY KEY,
       value TEXT NOT NULL,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS nfp_supporters (
       "userId" TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       status TEXT NOT NULL CHECK (status IN ('DECLARED','CONFIRMED','LAPSED')),
       "declaredAt" TIMESTAMP(3),
       "confirmedAt" TIMESTAMP(3),
       "lastSeenAt" TIMESTAMP(3),
       "lapsedAt" TIMESTAMP(3),
       source TEXT,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS nfp_supporters_status_idx ON nfp_supporters(status)`,
    `CREATE TABLE IF NOT EXISTS nfp_imports (
       id TEXT PRIMARY KEY,
       "adminId" TEXT,
       "fullList" BOOLEAN NOT NULL DEFAULT false,
       "totalRows" INTEGER NOT NULL,
       matched INTEGER NOT NULL,
       "newlyConfirmed" INTEGER NOT NULL,
       lapsed INTEGER NOT NULL,
       "notFound" INTEGER NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
  ];
  for (const sql of statements) await db.$executeRawUnsafe(sql);
  ensuredAt = Date.now();
}

// ---------------------------------------------------------------- helpers

export function isValidCpf(raw: string): boolean {
  const c = String(raw || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(c[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

export function formatCnpj(raw: string) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length !== 14) return raw || '';
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function isValidCnpj(raw: string) {
  const c = String(raw || '').replace(/\D/g, '');
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = w.reduce((acc, wi, i) => acc + Number(c[i]) * wi, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(c[12]) && calc(13) === Number(c[13]);
}

export function maskCpf(raw: string) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length !== 11) return '';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

const norm = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Lê uma linha da lista de doadores (CSV, planilha colada ou texto do painel).
 * Aceita CPF completo (123.456.789-09 ou 12345678909) ou mascarado (***.456.789-** / XXX.456.789-XX).
 * Devolve o padrão de 11 posições (dígito ou null quando escondido) e o nome, se houver.
 */
export function parseDonorLine(line: string): { pattern: (string | null)[] | null; name: string; full: string | null } | null {
  const raw = String(line || '').trim();
  if (!raw) return null;
  const m = raw.match(/([\d*xX•]{3})\.?([\d*xX•]{3})\.?([\d*xX•]{3})-?([\d*xX•]{2})/);
  let pattern: (string | null)[] | null = null;
  let full: string | null = null;
  let rest = raw;
  if (m && /\d/.test(m[0])) {
    const chars = (m[1] + m[2] + m[3] + m[4]).split('');
    pattern = chars.map((ch) => (/\d/.test(ch) ? ch : null));
    if (pattern.every((x) => x !== null)) full = pattern.join('');
    rest = raw.replace(m[0], ' ');
  }
  const name = rest
    .split(/[;,\t|]/)
    .map((p) => p.trim())
    .filter((p) => /[a-zA-ZÀ-ú]{2,}/.test(p) && !/^(cpf|nome|doador|data|valor|situa)/i.test(p) && !/\d{2}\/\d{2}\/\d{4}/.test(p))
    .sort((a, b) => b.length - a.length)[0] || '';
  if (!pattern && !name) return null;
  return { pattern, name: name.replace(/\s+/g, ' ').trim(), full };
}

type MatchRow = {
  line: number;
  cpf: string;
  name: string;
  status: 'MATCHED' | 'AMBIGUOUS' | 'NOT_FOUND' | 'INVALID';
  method?: 'CPF' | 'CPF_PARCIAL' | 'NOME';
  userId?: string;
  userName?: string;
};

/** Confere a lista com os usuários cadastrados (CPF; CPF parcial + nome; nome completo se permitido). */
export async function matchDonors(db: any, text: string, opts: { allowNameOnly?: boolean } = {}) {
  const lines = String(text || '').split(/\r?\n/).slice(0, MAX_IMPORT_LINES);
  const users: any[] = await db.$queryRawUnsafe(
    `SELECT id, name, regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g') AS cpf FROM users WHERE "isActive" = true`,
  );
  const byCpf = new Map<string, any>();
  for (const u of users) if (u.cpf && u.cpf.length === 11) byCpf.set(u.cpf, u);
  const byName = new Map<string, any[]>();
  for (const u of users) {
    const k = norm(u.name);
    if (!k) continue;
    byName.set(k, [...(byName.get(k) || []), u]);
  }
  const rows: MatchRow[] = [];
  let header = true;
  lines.forEach((line, i) => {
    const p = parseDonorLine(line);
    if (!p) return;
    // Pula cabeçalho ("CPF;Nome;Data…")
    if (header && !p.pattern && /cpf|nome|doador/i.test(line)) return;
    header = false;
    const row: MatchRow = { line: i + 1, cpf: p.full ? maskCpf(p.full) : p.pattern ? p.pattern.map((c) => c ?? '*').join('').replace(/^(...)(...)(...)(..)$/, '$1.$2.$3-$4') : '', name: p.name, status: 'NOT_FOUND' };
    let found: any[] = [];
    if (p.full) {
      if (!isValidCpf(p.full)) row.status = 'INVALID';
      const u = byCpf.get(p.full);
      if (u) {
        found = [u];
        row.method = 'CPF';
      }
    } else if (p.pattern) {
      const visible = p.pattern.filter((x) => x !== null).length;
      if (visible >= 5) {
        found = users.filter((u) => u.cpf && u.cpf.length === 11 && p.pattern!.every((d, idx) => d === null || u.cpf[idx] === d));
        // CPF parcial: confirma pelo primeiro nome quando a lista tem nome
        if (found.length && p.name) {
          const first = norm(p.name).split(' ')[0];
          found = found.filter((u) => norm(u.name).split(' ')[0] === first);
        }
        row.method = 'CPF_PARCIAL';
      }
    } else if (p.name && opts.allowNameOnly) {
      const k = norm(p.name);
      found = k.split(' ').length >= 2 ? byName.get(k) || [] : [];
      row.method = 'NOME';
    }
    if (row.status !== 'INVALID') {
      if (found.length === 1) {
        row.status = 'MATCHED';
        row.userId = found[0].id;
        row.userName = found[0].name;
      } else if (found.length > 1) {
        row.status = 'AMBIGUOUS';
      } else {
        delete row.method;
      }
    }
    rows.push(row);
  });
  const matchedIds = Array.from(new Set(rows.filter((r) => r.status === 'MATCHED').map((r) => r.userId!)));
  return {
    rows,
    matchedIds,
    counts: {
      total: rows.length,
      matched: matchedIds.length,
      ambiguous: rows.filter((r) => r.status === 'AMBIGUOUS').length,
      notFound: rows.filter((r) => r.status === 'NOT_FOUND').length,
      invalid: rows.filter((r) => r.status === 'INVALID').length,
    },
  };
}

export async function getNfpSettings(db: any) {
  const rows: any[] = await db.$queryRawUnsafe(`SELECT key, value FROM nfp_settings`);
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    enabled: m.enabled === undefined ? NFP_DEFAULTS.enabled : m.enabled === 'true',
    entityName: m.entityName || NFP_DEFAULTS.entityName,
    cnpj: m.cnpj || NFP_DEFAULTS.cnpj,
    siteUrl: m.siteUrl || NFP_DEFAULTS.siteUrl,
  };
}

async function setSetting(db: any, key: string, value: string) {
  await db.$executeRawUnsafe(
    `INSERT INTO nfp_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()`,
    key,
    value,
  );
}

async function notify(db: any, userId: string, title: string, message: string) {
  const data = { screen: 'NotaFiscal' };
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO notifications (id, "userId", title, message, type, data, "isRead", "sentAt")
       VALUES ($1, $2, $3, $4, 'GENERAL'::"NotificationType", $5::jsonb, false, NOW())`,
      crypto.randomUUID(), userId, title, message, JSON.stringify(data),
    );
    const tokens: any[] = await db.$queryRawUnsafe(
      `SELECT token FROM device_tokens WHERE "userId" = $1 AND "isActive" = true AND platform <> 'android-partner'`,
      userId,
    );
    if (tokens.length) await sendFcmToTokens(tokens.map((t) => t.token), { title, body: message, data });
  } catch (e: any) {
    console.warn('⚠️ Aviso Nota Fiscal Paulista falhou:', e?.message);
  }
}

async function supporterCount(db: any) {
  const r: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM nfp_supporters WHERE status = 'CONFIRMED'`);
  return r[0]?.n || 0;
}

function statusView(s: any) {
  if (!s) return { status: 'NONE' };
  const waitingDays = s.status === 'DECLARED' && s.declaredAt ? Math.floor((Date.now() - new Date(s.declaredAt).getTime()) / 864e5) : null;
  return {
    status: s.status,
    declaredAt: s.declaredAt,
    confirmedAt: s.confirmedAt,
    lastSeenAt: s.lastSeenAt,
    lapsedAt: s.lapsedAt,
    waitingDays,
  };
}

/** O membro é apoiador confirmado? (para ligar benefícios depois) */
export async function isNfpSupporter(db: any, userId: string) {
  await ensureNfpSchema(db);
  const r: any[] = await db.$queryRawUnsafe(`SELECT 1 FROM nfp_supporters WHERE "userId" = $1 AND status = 'CONFIRMED'`, userId);
  return !!r[0];
}

// ---------------------------------------------------------------- roteador

export function isNfpPath(path: string) {
  return path === '/api/nfp' || path.startsWith('/api/nfp/') || path === '/api/admin/nfp' || path.startsWith('/api/admin/nfp/');
}

export async function handleNfp(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db } = ctx;
  if (!isNfpPath(path)) return false;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }
  try {
    await ensureNfpSchema(db);
    const settings = await getNfpSettings(db);

    if (path === '/api/nfp' && method === 'GET') {
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).json({
        enabled: settings.enabled && !!settings.cnpj,
        entityName: settings.entityName,
        cnpj: formatCnpj(settings.cnpj),
        siteUrl: settings.siteUrl,
        supporters: await supporterCount(db),
      });
      return true;
    }

    // ---------- membro
    if (path === '/api/nfp/me') {
      const { userId } = ctx.authUser();
      const users: any[] = await db.$queryRawUnsafe(`SELECT id, cpf FROM users WHERE id = $1`, userId);
      if (!users[0]) throw new HttpError(404, 'Usuário não encontrado');
      const cpf = String(users[0].cpf || '').replace(/\D/g, '');
      if (method === 'GET') {
        const s: any[] = await db.$queryRawUnsafe(`SELECT * FROM nfp_supporters WHERE "userId" = $1`, userId);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ ...statusView(s[0]), hasCpf: cpf.length === 11, cpfMasked: maskCpf(cpf) || null });
        return true;
      }
      if (method === 'POST') {
        // "Já fiz a doação automática para a Liga"
        let finalCpf = cpf;
        if (finalCpf.length !== 11) {
          const given = String(body.cpf || '').replace(/\D/g, '');
          if (!isValidCpf(given)) {
            throw new HttpError(400, 'Informe o seu CPF (o mesmo que você usa na Nota Fiscal Paulista) para a Liga conferir a doação.', 'CPF_REQUIRED');
          }
          const taken: any[] = await db.$queryRawUnsafe(
            `SELECT 1 FROM users WHERE regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g') = $1 AND id <> $2`,
            given,
            userId,
          );
          if (taken[0]) throw new HttpError(409, 'Este CPF já está em outra conta. Fale com a Liga.', 'CPF_TAKEN');
          await db.$executeRawUnsafe(`UPDATE users SET cpf = $2, "updatedAt" = NOW() WHERE id = $1`, userId, given);
          finalCpf = given;
        }
        await db.$executeRawUnsafe(
          `INSERT INTO nfp_supporters ("userId", status, "declaredAt", source) VALUES ($1, 'DECLARED', NOW(), 'APP')
           ON CONFLICT ("userId") DO UPDATE SET
             status = CASE WHEN nfp_supporters.status = 'CONFIRMED' THEN 'CONFIRMED' ELSE 'DECLARED' END,
             "declaredAt" = NOW(), "updatedAt" = NOW()`,
          userId,
        );
        const s: any[] = await db.$queryRawUnsafe(`SELECT * FROM nfp_supporters WHERE "userId" = $1`, userId);
        res.status(200).json({ ...statusView(s[0]), hasCpf: true, cpfMasked: maskCpf(finalCpf) });
        return true;
      }
      if (method === 'DELETE') {
        await db.$executeRawUnsafe(`DELETE FROM nfp_supporters WHERE "userId" = $1`, userId);
        res.status(200).json({ status: 'NONE', hasCpf: cpf.length === 11, cpfMasked: maskCpf(cpf) || null });
        return true;
      }
      throw new HttpError(405, 'Método não suportado');
    }

    // ---------- admin
    if (path.startsWith('/api/admin/nfp')) {
      if (!ctx.isAdmin) throw new HttpError(403, 'Acesso restrito');
      if (path === '/api/admin/nfp' && method === 'GET') {
        const stats: any[] = await db.$queryRawUnsafe(`SELECT status, COUNT(*)::int AS n FROM nfp_supporters GROUP BY status`);
        const by = Object.fromEntries(stats.map((s) => [s.status, s.n]));
        const list: any[] = await db.$queryRawUnsafe(
          `SELECT s.*, u.name, u.email, u.cpf FROM nfp_supporters s JOIN users u ON u.id = s."userId"
            ORDER BY (s.status = 'DECLARED') DESC, s."updatedAt" DESC LIMIT 500`,
        );
        const imports: any[] = await db.$queryRawUnsafe(`SELECT * FROM nfp_imports ORDER BY "createdAt" DESC LIMIT 12`);
        res.status(200).json({
          settings: { ...settings, cnpj: formatCnpj(settings.cnpj) },
          stats: { confirmed: by.CONFIRMED || 0, declared: by.DECLARED || 0, lapsed: by.LAPSED || 0 },
          supporters: list.map((s) => ({
            userId: s.userId, name: s.name, email: s.email, cpf: maskCpf(s.cpf), ...statusView(s), source: s.source,
          })),
          imports,
        });
        return true;
      }
      if (path === '/api/admin/nfp/settings' && method === 'PUT') {
        if (body.cnpj !== undefined) {
          const c = String(body.cnpj || '').replace(/\D/g, '');
          if (c && !isValidCnpj(c)) throw new HttpError(400, 'CNPJ inválido');
          await setSetting(db, 'cnpj', c);
        }
        if (body.entityName !== undefined) {
          const n = String(body.entityName || '').trim().slice(0, 100);
          if (n.length < 3) throw new HttpError(400, 'Informe o nome da entidade como aparece na Nota Fiscal Paulista');
          await setSetting(db, 'entityName', n);
        }
        if (body.enabled !== undefined) await setSetting(db, 'enabled', body.enabled ? 'true' : 'false');
        const s = await getNfpSettings(db);
        res.status(200).json({ settings: { ...s, cnpj: formatCnpj(s.cnpj) } });
        return true;
      }
      if (path === '/api/admin/nfp/import' && method === 'POST') {
        const text = String(body.text || '');
        if (text.trim().length < 5) throw new HttpError(400, 'Cole a lista de doadores ou envie o arquivo CSV');
        const result = await matchDonors(db, text, { allowNameOnly: !!body.allowNameOnly });
        const fullList = !!body.fullList;
        if (body.dryRun !== false) {
          // Prévia: quem já está confirmado e sumiria da lista (se for a lista completa)
          let wouldLapse = 0;
          if (fullList) {
            const r: any[] = await db.$queryRawUnsafe(
              `SELECT COUNT(*)::int AS n FROM nfp_supporters WHERE status = 'CONFIRMED' AND NOT ("userId" = ANY($1::text[]))`,
              result.matchedIds,
            );
            wouldLapse = r[0]?.n || 0;
          }
          res.status(200).json({ dryRun: true, counts: { ...result.counts, wouldLapse }, rows: result.rows.slice(0, 500) });
          return true;
        }
        let newly = 0;
        for (const uid of result.matchedIds) {
          const before: any[] = await db.$queryRawUnsafe(`SELECT status FROM nfp_supporters WHERE "userId" = $1`, uid);
          await db.$executeRawUnsafe(
            `INSERT INTO nfp_supporters ("userId", status, "confirmedAt", "lastSeenAt", source) VALUES ($1, 'CONFIRMED', NOW(), NOW(), 'IMPORT')
             ON CONFLICT ("userId") DO UPDATE SET status = 'CONFIRMED', "confirmedAt" = COALESCE(nfp_supporters."confirmedAt", NOW()),
               "lastSeenAt" = NOW(), "lapsedAt" = NULL, source = 'IMPORT', "updatedAt" = NOW()`,
            uid,
          );
          if (before[0]?.status !== 'CONFIRMED') {
            newly++;
            await notify(db, uid, '💚 Doação da Nota Fiscal confirmada!', `Encontramos você na lista de doadores da ${settings.entityName}. Obrigado por apoiar a causa a cada compra!`);
          }
        }
        let lapsed = 0;
        if (fullList) {
          const gone: any[] = await db.$queryRawUnsafe(
            `UPDATE nfp_supporters SET status = 'LAPSED', "lapsedAt" = NOW(), "updatedAt" = NOW()
              WHERE status = 'CONFIRMED' AND NOT ("userId" = ANY($1::text[])) RETURNING "userId"`,
            result.matchedIds,
          );
          lapsed = gone.length;
          for (const g of gone) {
            await notify(db, g.userId, 'Nota Fiscal Paulista: sua doação não apareceu', `Não encontramos mais a doação automática para a ${settings.entityName}. Toque para conferir o passo a passo.`);
          }
        }
        let adminId: string | null = null;
        try {
          adminId = ctx.authUser().userId;
        } catch {
          adminId = null;
        }
        await db.$executeRawUnsafe(
          `INSERT INTO nfp_imports (id, "adminId", "fullList", "totalRows", matched, "newlyConfirmed", lapsed, "notFound") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          crypto.randomUUID(), adminId, fullList, result.counts.total, result.counts.matched, newly, lapsed, result.counts.notFound,
        );
        res.status(200).json({ dryRun: false, counts: { ...result.counts, newlyConfirmed: newly, lapsed } });
        return true;
      }
      const am = path.match(/^\/api\/admin\/nfp\/supporters\/([^/]+)\/(confirm|revoke)$/);
      if (am && method === 'POST') {
        if (am[2] === 'confirm') {
          await db.$executeRawUnsafe(
            `INSERT INTO nfp_supporters ("userId", status, "confirmedAt", "lastSeenAt", source) VALUES ($1, 'CONFIRMED', NOW(), NOW(), 'ADMIN')
             ON CONFLICT ("userId") DO UPDATE SET status = 'CONFIRMED', "confirmedAt" = COALESCE(nfp_supporters."confirmedAt", NOW()),
               "lastSeenAt" = NOW(), "lapsedAt" = NULL, source = 'ADMIN', "updatedAt" = NOW()`,
            am[1],
          );
          await notify(db, am[1], '💚 Doação da Nota Fiscal confirmada!', `Obrigado por apoiar a ${settings.entityName} a cada compra!`);
        } else {
          await db.$executeRawUnsafe(`DELETE FROM nfp_supporters WHERE "userId" = $1`, am[1]);
        }
        res.status(200).json({ message: am[2] === 'confirm' ? 'Confirmado' : 'Removido' });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    throw new HttpError(404, 'Rota não encontrada');
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : e?.status || 500;
    if (status >= 500) console.error('❌ Nota Fiscal Paulista:', e);
    res.status(status).json({ error: status >= 500 ? 'Erro interno' : e.message, code: e?.code });
    return true;
  }
}
