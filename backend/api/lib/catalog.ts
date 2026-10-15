/**
 * Catálogo padrão da Liga + tabela de preços dos parceiros.
 *
 * O catálogo (catalog_items) dá o MESMO nome para o mesmo produto/serviço em todas as lojas
 * ("Bravecto 10–20 kg", "Castração · gato macho"), o que permite comparar preços.
 * Cada parceiro informa o preço normal e o preço para membros (partner_prices).
 * Itens que não existem no catálogo podem ser criados pelo parceiro (partnerId preenchido):
 * aparecem só na página dele até a Liga incluir no catálogo padrão (promote).
 */
import crypto from 'crypto';
import { markSchemaApplied, schemaApplied, schemaFingerprint } from './schemaOnce';

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

export const CATALOG_CATEGORIES = [
  { id: 'CONSULTAS', label: 'Consultas', kind: 'SERVICE' },
  { id: 'VACINAS', label: 'Vacinas', kind: 'SERVICE' },
  { id: 'PROCEDIMENTOS', label: 'Cirurgias e procedimentos', kind: 'SERVICE' },
  { id: 'EXAMES', label: 'Exames', kind: 'SERVICE' },
  { id: 'INTERNACAO', label: 'Internação', kind: 'SERVICE' },
  { id: 'ESTETICA', label: 'Banho e tosa', kind: 'SERVICE' },
  { id: 'HOSPEDAGEM', label: 'Hotel e creche', kind: 'SERVICE' },
  { id: 'ANTIPULGAS', label: 'Antipulgas e vermífugos', kind: 'PRODUCT' },
  { id: 'MEDICAMENTOS', label: 'Medicamentos', kind: 'PRODUCT' },
  { id: 'RACAO', label: 'Ração e petiscos', kind: 'PRODUCT' },
  { id: 'ACESSORIOS', label: 'Acessórios e higiene', kind: 'PRODUCT' },
] as const;
const CAT_IDS = CATALOG_CATEGORIES.map((c) => c.id) as string[];
export const SPECIES = ['ALL', 'DOG', 'CAT'] as const;

/** Catálogo inicial: os itens mais procurados. A Liga amplia pelo admin. */
const SEED: Array<[string, string, string, string?]> = [
  // [categoria, nome, espécie, variante]
  ['CONSULTAS', 'Consulta clínica', 'ALL'],
  ['CONSULTAS', 'Consulta de retorno', 'ALL'],
  ['CONSULTAS', 'Consulta de emergência / plantão', 'ALL'],
  ['CONSULTAS', 'Consulta com especialista', 'ALL'],
  ['VACINAS', 'Vacina V8', 'DOG'],
  ['VACINAS', 'Vacina V10', 'DOG'],
  ['VACINAS', 'Vacina antirrábica', 'ALL'],
  ['VACINAS', 'Vacina gripe canina (tosse dos canis)', 'DOG'],
  ['VACINAS', 'Vacina giárdia', 'DOG'],
  ['VACINAS', 'Vacina leishmaniose', 'DOG'],
  ['VACINAS', 'Vacina V3 felina', 'CAT'],
  ['VACINAS', 'Vacina V4 felina', 'CAT'],
  ['VACINAS', 'Vacina V5 felina (com FeLV)', 'CAT'],
  ['PROCEDIMENTOS', 'Castração', 'CAT', 'gato macho'],
  ['PROCEDIMENTOS', 'Castração', 'CAT', 'gata fêmea'],
  ['PROCEDIMENTOS', 'Castração', 'DOG', 'cão macho até 15 kg'],
  ['PROCEDIMENTOS', 'Castração', 'DOG', 'cão macho acima de 15 kg'],
  ['PROCEDIMENTOS', 'Castração', 'DOG', 'cadela até 15 kg'],
  ['PROCEDIMENTOS', 'Castração', 'DOG', 'cadela acima de 15 kg'],
  ['PROCEDIMENTOS', 'Limpeza de tártaro (profilaxia dentária)', 'ALL'],
  ['PROCEDIMENTOS', 'Microchipagem', 'ALL'],
  ['PROCEDIMENTOS', 'Aplicação de medicamento (injeção)', 'ALL'],
  ['EXAMES', 'Hemograma completo', 'ALL'],
  ['EXAMES', 'Bioquímico (função renal e hepática)', 'ALL'],
  ['EXAMES', 'Ultrassom abdominal', 'ALL'],
  ['EXAMES', 'Raio-X', 'ALL', 'uma região'],
  ['EXAMES', 'Teste rápido FIV/FeLV', 'CAT'],
  ['EXAMES', 'Teste rápido cinomose / parvovirose', 'DOG'],
  ['EXAMES', 'Eletrocardiograma', 'ALL'],
  ['INTERNACAO', 'Internação', 'ALL', 'diária'],
  ['INTERNACAO', 'Internação com UTI', 'ALL', 'diária'],
  ['ESTETICA', 'Banho', 'DOG', 'porte pequeno'],
  ['ESTETICA', 'Banho', 'DOG', 'porte médio'],
  ['ESTETICA', 'Banho', 'DOG', 'porte grande'],
  ['ESTETICA', 'Banho e tosa', 'DOG', 'porte pequeno'],
  ['ESTETICA', 'Banho e tosa', 'DOG', 'porte médio'],
  ['ESTETICA', 'Banho e tosa', 'DOG', 'porte grande'],
  ['ESTETICA', 'Tosa higiênica', 'ALL'],
  ['ESTETICA', 'Banho', 'CAT'],
  ['HOSPEDAGEM', 'Hotel', 'DOG', 'diária'],
  ['HOSPEDAGEM', 'Hotel', 'CAT', 'diária'],
  ['HOSPEDAGEM', 'Creche', 'DOG', 'diária'],
  ['ANTIPULGAS', 'Bravecto', 'DOG', '2–4,5 kg'],
  ['ANTIPULGAS', 'Bravecto', 'DOG', '4,5–10 kg'],
  ['ANTIPULGAS', 'Bravecto', 'DOG', '10–20 kg'],
  ['ANTIPULGAS', 'Bravecto', 'DOG', '20–40 kg'],
  ['ANTIPULGAS', 'NexGard', 'DOG', '4–10 kg'],
  ['ANTIPULGAS', 'NexGard', 'DOG', '10–25 kg'],
  ['ANTIPULGAS', 'Simparic', 'DOG', '10–20 kg'],
  ['ANTIPULGAS', 'Revolution', 'CAT', '2,6–7,5 kg'],
  ['ANTIPULGAS', 'Seresto (coleira)', 'DOG', 'acima de 8 kg'],
  ['ANTIPULGAS', 'Drontal', 'DOG', 'comprimido'],
  ['ANTIPULGAS', 'Drontal', 'CAT', 'comprimido'],
  ['ANTIPULGAS', 'Milbemax', 'CAT', 'comprimido'],
  ['MEDICAMENTOS', 'Apoquel', 'DOG', '5,4 mg · 30 comprimidos'],
  ['MEDICAMENTOS', 'Meloxicam veterinário', 'ALL', 'comprimido'],
  ['MEDICAMENTOS', 'Omeprazol', 'ALL', 'comprimido'],
  ['MEDICAMENTOS', 'Antibiótico (amoxicilina + clavulanato)', 'ALL', 'comprimido'],
  ['RACAO', 'Ração premium especial', 'DOG', 'adulto · 15 kg'],
  ['RACAO', 'Ração premium especial', 'CAT', 'adulto · 10 kg'],
  ['RACAO', 'Ração premium especial', 'DOG', 'filhote · 15 kg'],
  ['RACAO', 'Areia higiênica', 'CAT', '4 kg'],
  ['ACESSORIOS', 'Tapete higiênico', 'DOG', '30 unidades'],
  ['ACESSORIOS', 'Coleira peitoral', 'DOG'],
  ['ACESSORIOS', 'Caixa de transporte', 'ALL', 'tamanho médio'],
];

let ensuredAt = 0;
export async function ensureCatalogSchema(db: any) {
  if (Date.now() - ensuredAt < 6 * 60 * 60 * 1000) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS catalog_items (
       id TEXT PRIMARY KEY,
       category TEXT NOT NULL,
       name TEXT NOT NULL,
       variant TEXT,
       species TEXT NOT NULL DEFAULT 'ALL',
       "partnerId" TEXT REFERENCES partners(id) ON DELETE CASCADE,
       "isActive" BOOLEAN NOT NULL DEFAULT true,
       "seedKey" TEXT UNIQUE,
       "createdById" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS catalog_items_cat_idx ON catalog_items(category)`,
    `CREATE INDEX IF NOT EXISTS catalog_items_partner_idx ON catalog_items("partnerId")`,
    `CREATE TABLE IF NOT EXISTS partner_prices (
       "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
       "itemId" TEXT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
       price DECIMAL(10,2),
       "memberPrice" DECIMAL(10,2) NOT NULL,
       available BOOLEAN NOT NULL DEFAULT true,
       note TEXT,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       PRIMARY KEY ("partnerId", "itemId")
     )`,
    `CREATE INDEX IF NOT EXISTS partner_prices_item_idx ON partner_prices("itemId")`,
  ];
  const fp = schemaFingerprint(statements, SEED);
  if (!(await schemaApplied(db, 'catalog', fp))) {
    for (const sql of statements) await db.$executeRawUnsafe(sql);
    // Semente idempotente (seedKey único): rodar de novo não duplica nem reativa item que a Liga desligou
    for (const [category, name, species, variant] of SEED) {
      const key = `${category}|${name}|${species}|${variant || ''}`;
      await db.$executeRawUnsafe(
        `INSERT INTO catalog_items (id, category, name, variant, species, "seedKey") VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT ("seedKey") DO NOTHING`,
        crypto.createHash('sha1').update(key).digest('hex').slice(0, 20),
        category,
        name,
        variant || null,
        species,
        key,
      );
    }
    await markSchemaApplied(db, 'catalog', fp);
  }
  ensuredAt = Date.now();
}

// ---------------------------------------------------------------- helpers

const norm = (s: any) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function money(v: any, field: string, required: boolean): number | null {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `Informe ${field}`);
    return null;
  }
  const raw = String(v).trim();
  const n = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw);
  if (!Number.isFinite(n) || n <= 0 || n > 100000) throw new HttpError(400, `${field[0].toUpperCase()}${field.slice(1)} inválido`);
  return Math.round(n * 100) / 100;
}

export function itemLabel(i: { name: string; variant?: string | null }) {
  return i.variant ? `${i.name} · ${i.variant}` : i.name;
}

function itemView(r: any) {
  return {
    id: r.id,
    category: r.category,
    categoryLabel: CATALOG_CATEGORIES.find((c) => c.id === r.category)?.label || r.category,
    name: r.name,
    variant: r.variant,
    label: itemLabel(r),
    species: r.species,
    custom: !!r.partnerId,
  };
}

function priceView(r: any) {
  const price = r.price != null ? Number(r.price) : null;
  const memberPrice = Number(r.memberPrice);
  return {
    price,
    memberPrice,
    savings: price && price > memberPrice ? Math.round((1 - memberPrice / price) * 100) : null,
    available: r.available !== false,
    note: r.note || null,
    updatedAt: r.updatedAt,
  };
}

/** Busca por texto ignorando acentos: todos os termos precisam aparecer no nome/variante/categoria. */
function matchSql(search: string, params: any[], alias = 'i') {
  const terms = norm(search).split(/\s+/).filter(Boolean).slice(0, 5);
  return terms
    .map((t) => {
      params.push(`%${t}%`);
      return `translate(lower(${alias}.name || ' ' || coalesce(${alias}.variant,'') || ' ' || ${alias}.category),
        'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') LIKE $${params.length}`;
    })
    .join(' AND ');
}

async function partnerAccount(db: any, userId: string) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT a.id, a.role, a."partnerId", p."isActive" AS "partnerActive"
       FROM partner_accounts a JOIN partners p ON p.id = a."partnerId" WHERE a."userId" = $1 LIMIT 1`,
    userId,
  );
  const acc = rows[0];
  if (!acc) throw new HttpError(403, 'Este usuário não tem acesso de parceiro.', 'NOT_PARTNER');
  if (!acc.partnerActive) throw new HttpError(403, 'Esta empresa está desativada na Liga do Bem.', 'PARTNER_INACTIVE');
  return acc;
}

function requireOwner(acc: any) {
  if (acc.role !== 'OWNER') throw new HttpError(403, 'Apenas o responsável pela empresa pode alterar preços.', 'OWNER_ONLY');
}

function readItemInput(body: any, partial = false) {
  const out: any = {};
  if (!partial || body.category !== undefined) {
    const c = String(body.category || '').toUpperCase();
    if (!CAT_IDS.includes(c)) throw new HttpError(400, 'Escolha a categoria');
    out.category = c;
  }
  if (!partial || body.name !== undefined) {
    const n = String(body.name || '').trim();
    if (n.length < 3 || n.length > 80) throw new HttpError(400, 'Nome com 3 a 80 caracteres');
    out.name = n;
  }
  if (!partial || body.variant !== undefined) {
    const v = String(body.variant || '').trim();
    if (v.length > 60) throw new HttpError(400, 'Detalhe com no máximo 60 caracteres');
    out.variant = v || null;
  }
  if (!partial || body.species !== undefined) {
    const s = String(body.species || 'ALL').toUpperCase();
    if (!(SPECIES as readonly string[]).includes(s)) throw new HttpError(400, 'Espécie inválida');
    out.species = s;
  }
  return out;
}

// ---------------------------------------------------------------- roteador

export function isCatalogPath(path: string) {
  return (
    path === '/api/catalog' ||
    path === '/api/catalog/categories' ||
    /^\/api\/catalog\/items\/[^/]+\/offers$/.test(path) ||
    /^\/api\/partners\/[^/]+\/prices$/.test(path) ||
    path === '/api/partner/catalog' ||
    path === '/api/partner/prices' ||
    path.startsWith('/api/partner/prices/') ||
    path === '/api/partner/catalog-items' ||
    path === '/api/admin/catalog-items' ||
    path.startsWith('/api/admin/catalog-items/')
  );
}

export async function handleCatalog(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db } = ctx;
  if (!isCatalogPath(path)) return false;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  const q = ctx.req?.query || {};
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }
  try {
    await ensureCatalogSchema(db);

    // ---------- público (membros e visitantes)
    if (path === '/api/catalog/categories' && method === 'GET') {
      res.status(200).json({ categories: CATALOG_CATEGORIES });
      return true;
    }

    if (path === '/api/catalog' && method === 'GET') {
      const params: any[] = [];
      const where = [`i."isActive" = true`, `i."partnerId" IS NULL`];
      if (q.category && CAT_IDS.includes(String(q.category).toUpperCase())) {
        params.push(String(q.category).toUpperCase());
        where.push(`i.category = $${params.length}`);
      }
      if (q.species && ['DOG', 'CAT'].includes(String(q.species).toUpperCase())) {
        params.push(String(q.species).toUpperCase());
        where.push(`i.species IN ('ALL', $${params.length})`);
      }
      if (q.search) {
        const m = matchSql(String(q.search), params);
        if (m) where.push(m);
      }
      const onlyOffered = String(q.offered || '') === '1';
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT i.*, o.n AS offers, o.min AS "minMemberPrice"
           FROM catalog_items i
           LEFT JOIN LATERAL (
             SELECT COUNT(*)::int AS n, MIN(pp."memberPrice") AS min
               FROM partner_prices pp JOIN partners p ON p.id = pp."partnerId"
              WHERE pp."itemId" = i.id AND pp.available = true AND p."isActive" = true
           ) o ON true
          WHERE ${where.join(' AND ')} ${onlyOffered ? 'AND o.n > 0' : ''}
          ORDER BY o.n DESC NULLS LAST, i.category, i.name, i.variant NULLS FIRST
          LIMIT 300`,
        ...params,
      );
      res.status(200).json({
        items: rows.map((r) => ({ ...itemView(r), offers: r.offers || 0, minMemberPrice: r.minMemberPrice != null ? Number(r.minMemberPrice) : null })),
      });
      return true;
    }

    const offersM = path.match(/^\/api\/catalog\/items\/([^/]+)\/offers$/);
    if (offersM && method === 'GET') {
      const items: any[] = await db.$queryRawUnsafe(`SELECT * FROM catalog_items WHERE id = $1 AND "isActive" = true`, offersM[1]);
      if (!items[0]) throw new HttpError(404, 'Item não encontrado');
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT pp.*, p.id AS pid, p.name AS "partnerName", p.category AS "partnerCategory", p.logo, p.address, p.city,
                p.latitude, p.longitude, p.hours, p.phone
           FROM partner_prices pp JOIN partners p ON p.id = pp."partnerId"
          WHERE pp."itemId" = $1 AND p."isActive" = true
          ORDER BY pp.available DESC, pp."memberPrice" ASC, p.name ASC`,
        offersM[1],
      );
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).json({
        item: itemView(items[0]),
        offers: rows.map((r) => ({
          partner: {
            id: r.pid, name: r.partnerName, category: r.partnerCategory, logo: r.logo || null, address: r.address, city: r.city,
            latitude: r.latitude != null ? Number(r.latitude) : null, longitude: r.longitude != null ? Number(r.longitude) : null,
            hours: r.hours || null, phone: r.phone || null,
          },
          ...priceView(r),
        })),
      });
      return true;
    }

    const pPricesM = path.match(/^\/api\/partners\/([^/]+)\/prices$/);
    if (pPricesM && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT i.*, pp.price, pp."memberPrice", pp.available, pp.note, pp."updatedAt" AS "priceUpdatedAt"
           FROM partner_prices pp JOIN catalog_items i ON i.id = pp."itemId" JOIN partners p ON p.id = pp."partnerId"
          WHERE pp."partnerId" = $1 AND p."isActive" = true AND i."isActive" = true
          ORDER BY pp.available DESC, i.category, i.name, i.variant NULLS FIRST`,
        pPricesM[1],
      );
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.status(200).json({
        prices: rows.map((r) => ({ item: itemView(r), ...priceView({ ...r, updatedAt: r.priceUpdatedAt }) })),
      });
      return true;
    }

    // ---------- admin
    if (path === '/api/admin/catalog-items' || path.startsWith('/api/admin/catalog-items/')) {
      if (!ctx.isAdmin) throw new HttpError(401, 'Acesso restrito ao administrador');
      if (path === '/api/admin/catalog-items' && method === 'GET') {
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT i.*, p.name AS "partnerName",
                  (SELECT COUNT(*)::int FROM partner_prices pp WHERE pp."itemId" = i.id) AS offers
             FROM catalog_items i LEFT JOIN partners p ON p.id = i."partnerId"
            ORDER BY (i."partnerId" IS NULL), i.category, i.name, i.variant NULLS FIRST`,
        );
        res.status(200).json({
          categories: CATALOG_CATEGORIES,
          items: rows.map((r) => ({ ...itemView(r), isActive: r.isActive, offers: r.offers, partnerName: r.partnerName || null })),
        });
        return true;
      }
      if (path === '/api/admin/catalog-items' && method === 'POST') {
        const f = readItemInput(body);
        const id = crypto.randomUUID();
        await db.$executeRawUnsafe(
          `INSERT INTO catalog_items (id, category, name, variant, species) VALUES ($1, $2, $3, $4, $5)`,
          id, f.category, f.name, f.variant, f.species,
        );
        const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM catalog_items WHERE id = $1`, id);
        res.status(201).json({ item: itemView(rows[0]) });
        return true;
      }
      const m = path.match(/^\/api\/admin\/catalog-items\/([^/]+)(\/promote)?$/);
      if (m && method === 'PUT' && !m[2]) {
        const f = readItemInput(body, true);
        if (body.isActive !== undefined) f.isActive = !!body.isActive;
        const keys = Object.keys(f);
        if (!keys.length) throw new HttpError(400, 'Nada para alterar');
        const rows: any[] = await db.$queryRawUnsafe(
          `UPDATE catalog_items SET ${keys.map((k, i) => `"${k}" = $${i + 2}`).join(', ')}, "updatedAt" = NOW() WHERE id = $1 RETURNING *`,
          m[1],
          ...keys.map((k) => f[k]),
        );
        if (!rows[0]) throw new HttpError(404, 'Item não encontrado');
        res.status(200).json({ item: { ...itemView(rows[0]), isActive: rows[0].isActive } });
        return true;
      }
      if (m && m[2] && method === 'POST') {
        // Item criado por um parceiro entra no catálogo padrão (todos passam a poder dar preço)
        const rows: any[] = await db.$queryRawUnsafe(
          `UPDATE catalog_items SET "partnerId" = NULL, "updatedAt" = NOW() WHERE id = $1 AND "partnerId" IS NOT NULL RETURNING *`,
          m[1],
        );
        if (!rows[0]) throw new HttpError(404, 'Item sugerido não encontrado');
        res.status(200).json({ item: itemView(rows[0]) });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    // ---------- App Parceiros
    const { userId } = ctx.authUser();
    const acc = await partnerAccount(db, userId);

    if (path === '/api/partner/catalog' && method === 'GET') {
      const params: any[] = [acc.partnerId];
      const where = [`i."isActive" = true`, `(i."partnerId" IS NULL OR i."partnerId" = $1)`];
      if (q.category && CAT_IDS.includes(String(q.category).toUpperCase())) {
        params.push(String(q.category).toUpperCase());
        where.push(`i.category = $${params.length}`);
      }
      if (q.search) {
        const m = matchSql(String(q.search), params);
        if (m) where.push(m);
      }
      if (String(q.mine || '') === '1') where.push(`pp."itemId" IS NOT NULL`);
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT i.*, pp.price, pp."memberPrice", pp.available, pp.note, pp."updatedAt" AS "priceUpdatedAt"
           FROM catalog_items i LEFT JOIN partner_prices pp ON pp."itemId" = i.id AND pp."partnerId" = $1
          WHERE ${where.join(' AND ')}
          ORDER BY (pp."itemId" IS NULL), i.category, i.name, i.variant NULLS FIRST
          LIMIT 400`,
        ...params,
      );
      const count: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM partner_prices WHERE "partnerId" = $1`, acc.partnerId);
      res.status(200).json({
        categories: CATALOG_CATEGORIES,
        priced: count[0]?.n || 0,
        canEdit: acc.role === 'OWNER',
        items: rows.map((r) => ({
          ...itemView(r),
          myPrice: r.memberPrice != null ? priceView({ ...r, updatedAt: r.priceUpdatedAt }) : null,
        })),
      });
      return true;
    }

    if (path === '/api/partner/prices' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT i.*, pp.price, pp."memberPrice", pp.available, pp.note, pp."updatedAt" AS "priceUpdatedAt"
           FROM partner_prices pp JOIN catalog_items i ON i.id = pp."itemId"
          WHERE pp."partnerId" = $1 ORDER BY i.category, i.name, i.variant NULLS FIRST`,
        acc.partnerId,
      );
      res.status(200).json({ prices: rows.map((r) => ({ item: itemView(r), ...priceView({ ...r, updatedAt: r.priceUpdatedAt }) })) });
      return true;
    }

    const priceM = path.match(/^\/api\/partner\/prices\/([^/]+)$/);
    if (priceM && (method === 'PUT' || method === 'DELETE')) {
      requireOwner(acc);
      const items: any[] = await db.$queryRawUnsafe(
        `SELECT * FROM catalog_items WHERE id = $1 AND "isActive" = true AND ("partnerId" IS NULL OR "partnerId" = $2)`,
        priceM[1],
        acc.partnerId,
      );
      if (!items[0]) throw new HttpError(404, 'Item não encontrado');
      if (method === 'DELETE') {
        await db.$executeRawUnsafe(`DELETE FROM partner_prices WHERE "partnerId" = $1 AND "itemId" = $2`, acc.partnerId, priceM[1]);
        res.status(200).json({ message: 'Preço removido' });
        return true;
      }
      const price = money(body.price, 'o preço normal', false);
      const memberPrice = money(body.memberPrice, 'o preço para membros', true)!;
      if (price != null && memberPrice > price) throw new HttpError(400, 'O preço para membros não pode ser maior que o preço normal');
      const note = String(body.note || '').trim().slice(0, 120) || null;
      const available = body.available === undefined ? true : !!body.available;
      await db.$executeRawUnsafe(
        `INSERT INTO partner_prices ("partnerId", "itemId", price, "memberPrice", available, note, "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT ("partnerId", "itemId") DO UPDATE SET price = EXCLUDED.price, "memberPrice" = EXCLUDED."memberPrice",
           available = EXCLUDED.available, note = EXCLUDED.note, "updatedAt" = NOW()`,
        acc.partnerId, priceM[1], price, memberPrice, available, note,
      );
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT * FROM partner_prices WHERE "partnerId" = $1 AND "itemId" = $2`,
        acc.partnerId,
        priceM[1],
      );
      res.status(200).json({ item: itemView(items[0]), myPrice: priceView(rows[0]) });
      return true;
    }

    if (path === '/api/partner/catalog-items' && method === 'POST') {
      requireOwner(acc);
      const f = readItemInput(body);
      // Evita duplicar um item que já existe no catálogo padrão
      const dup: any[] = await db.$queryRawUnsafe(
        `SELECT id, name, variant FROM catalog_items
          WHERE "isActive" = true AND ("partnerId" IS NULL OR "partnerId" = $1) AND category = $2
            AND translate(lower(name || ' ' || coalesce(variant,'')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') = $3 LIMIT 1`,
        acc.partnerId,
        f.category,
        norm(`${f.name} ${f.variant || ''}`).trim(),
      );
      if (dup[0]) throw new HttpError(409, `Já existe no catálogo: ${itemLabel(dup[0])}. Use esse item.`, 'EXISTS');
      const id = crypto.randomUUID();
      await db.$executeRawUnsafe(
        `INSERT INTO catalog_items (id, category, name, variant, species, "partnerId", "createdById") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        id, f.category, f.name, f.variant, f.species, acc.partnerId, userId,
      );
      const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM catalog_items WHERE id = $1`, id);
      res.status(201).json({ item: itemView(rows[0]) });
      return true;
    }

    throw new HttpError(404, 'Rota não encontrada');
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : e?.status || 500;
    if (status >= 500) console.error('❌ Catálogo/preços:', e);
    res.status(status).json({ error: status >= 500 ? 'Erro interno no catálogo de preços' : e.message, code: e?.code });
    return true;
  }
}
