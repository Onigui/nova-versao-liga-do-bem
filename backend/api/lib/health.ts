/**
 * Histórico de saúde do pet: uma linha do tempo única com
 *  - registros do veterinário parceiro (consulta, exame, cirurgia…) — conferidos, com CRMV;
 *  - anotações do tutor (sintoma, remédio, exame de outra clínica, foto do resultado);
 *  - vacinas e vermífugos da carteira (carimbados ou lançados pelo tutor);
 *  - listas de compras montadas pelo veterinário (orçamento);
 *  - peso ao longo do tempo (gráfico).
 * O veterinário só vê e escreve durante um atendimento aberto pelo QR do pet (autorização do tutor).
 */
import crypto from 'crypto';
import { ensurePetHealthSchema, formatRecord, formatCrmv } from './petHealth';
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
  authUser: () => { userId: string; email?: string; role?: string };
};

export const HEALTH_KINDS = [
  { id: 'CONSULTA', label: 'Consulta' },
  { id: 'EXAME', label: 'Exame' },
  { id: 'CIRURGIA', label: 'Cirurgia ou procedimento' },
  { id: 'MEDICACAO', label: 'Medicação' },
  { id: 'SINTOMA', label: 'Sintoma' },
  { id: 'PESO', label: 'Peso' },
  { id: 'OBSERVACAO', label: 'Anotação' },
] as const;
const KIND_IDS = HEALTH_KINDS.map((k) => k.id) as string[];
const CORRECTION_HOURS = 24;
const PHOTO_MAX = 800 * 1024;

let ensuredAt = 0;
export async function ensureHealthSchema(db: any) {
  await ensurePetHealthSchema(db);
  if (Date.now() - ensuredAt < 6 * 60 * 60 * 1000) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS pet_health_entries (
       id TEXT PRIMARY KEY,
       "petId" TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
       kind TEXT NOT NULL,
       date TIMESTAMP(3) NOT NULL,
       title TEXT NOT NULL,
       details TEXT,
       guidance TEXT,
       weight DOUBLE PRECISION,
       "returnDate" TIMESTAMP(3),
       source TEXT NOT NULL CHECK (source IN ('TUTOR','VET')),
       "partnerId" TEXT,
       "accountId" TEXT,
       "authorUserId" TEXT,
       "vetName" TEXT,
       "vetCrmv" TEXT,
       "clinicName" TEXT,
       "visitId" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS pet_health_entries_pet_idx ON pet_health_entries("petId", date DESC)`,
    `CREATE TABLE IF NOT EXISTS pet_health_photos (
       "entryId" TEXT PRIMARY KEY REFERENCES pet_health_entries(id) ON DELETE CASCADE,
       mime TEXT NOT NULL,
       data BYTEA NOT NULL
     )`,
  ];
  for (const sql of statements) await db.$executeRawUnsafe(sql);
  ensuredAt = Date.now();
}

// ---------------------------------------------------------------- helpers

function decodePhoto(input: any) {
  if (!input) return null;
  const raw = String(input);
  const m = raw.match(/^data:([^;]+);base64,(.*)$/);
  const data = Buffer.from((m ? m[2] : raw).replace(/\s/g, ''), 'base64');
  if (!data.length || data.length > PHOTO_MAX) throw new HttpError(400, 'Foto inválida ou muito grande (máx. 800 KB)');
  const hex = data.subarray(0, 4).toString('hex');
  const mime = hex.startsWith('ffd8ff') ? 'image/jpeg' : hex.startsWith('89504e47') ? 'image/png' : null;
  if (!mime) throw new HttpError(400, 'Envie a foto em JPG ou PNG');
  return { mime, data };
}

function parseDay(v: any, field: string, required = false): Date | null {
  if (v == null || v === '') {
    if (required) throw new HttpError(400, `Informe ${field}`);
    return null;
  }
  const s = String(v);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00Z`) : new Date(s);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Data inválida: ${field}`);
  return d;
}

function parseWeight(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > 150) throw new HttpError(400, 'Peso inválido (em kg)');
  return Math.round(n * 100) / 100;
}

/** Lê e valida os campos de um registro. */
function entryFields(body: any, source: 'TUTOR' | 'VET') {
  const kind = String(body.kind || '').toUpperCase();
  if (!KIND_IDS.includes(kind)) throw new HttpError(400, 'Escolha o tipo de registro');
  const weight = parseWeight(body.weight);
  let title = String(body.title || '').trim().slice(0, 100);
  if (kind === 'PESO') {
    if (weight == null) throw new HttpError(400, 'Informe o peso');
    title = title || 'Pesagem';
  }
  if (title.length < 2) throw new HttpError(400, source === 'VET' ? 'Informe o motivo do atendimento' : 'Dê um título ao registro');
  const now = Date.now();
  const date = parseDay(body.date, 'a data') || new Date();
  if (date.getTime() > now + 864e5) throw new HttpError(400, 'A data não pode ser no futuro');
  const returnDate = parseDay(body.returnDate, 'a data de retorno');
  if (returnDate && returnDate.getTime() < date.getTime()) throw new HttpError(400, 'O retorno não pode ser antes do atendimento');
  return {
    kind,
    title,
    date,
    weight,
    returnDate,
    details: String(body.details || '').trim().slice(0, 2000) || null,
    guidance: String(body.guidance || '').trim().slice(0, 2000) || null,
  };
}

export function entryView(e: any, opts: { forPartnerId?: string } = {}) {
  const created = new Date(e.createdAt).getTime();
  const correctableUntil = e.source === 'VET' ? new Date(created + CORRECTION_HOURS * 3600e3) : null;
  return {
    id: e.id,
    type: 'ENTRY',
    kind: e.kind,
    date: e.date,
    title: e.title,
    details: e.details,
    guidance: e.guidance,
    weight: e.weight != null ? Number(e.weight) : null,
    returnDate: e.returnDate,
    source: e.source,
    verified: e.source === 'VET',
    vetName: e.vetName,
    vetCrmv: e.vetCrmv,
    clinicName: e.clinicName,
    hasPhoto: !!e.hasPhoto,
    createdAt: e.createdAt,
    correctableUntil,
    mine: opts.forPartnerId ? e.partnerId === opts.forPartnerId : undefined,
  };
}

async function tableExists(db: any, name: string) {
  const r: any[] = await db.$queryRawUnsafe(`SELECT to_regclass($1) IS NOT NULL AS ok`, `public.${name}`);
  return !!r[0]?.ok;
}

/** Linha do tempo completa de um pet (mais recente primeiro) + série de peso. */
export async function petTimeline(db: any, pet: any, opts: { forPartnerId?: string; limit?: number } = {}) {
  const entries: any[] = await db.$queryRawUnsafe(
    `SELECT e.*, (ph."entryId" IS NOT NULL) AS "hasPhoto"
       FROM pet_health_entries e LEFT JOIN pet_health_photos ph ON ph."entryId" = e.id
      WHERE e."petId" = $1 ORDER BY e.date DESC, e."createdAt" DESC`,
    pet.id,
  );
  const vacc: any[] = await db.$queryRawUnsafe(
    `SELECT * FROM vaccinations WHERE "petId" = $1 ORDER BY "applicationDate" DESC`,
    pet.id,
  );
  let lists: any[] = [];
  if (await tableExists(db, 'quote_requests')) {
    lists = await db.$queryRawUnsafe(
      `SELECT q.id, q."createdAt", q.notes, p.name AS "clinicName",
              (SELECT string_agg(CASE WHEN i.quantity > 1 THEN i.quantity || '× ' ELSE '' END || i.label, ', ' ORDER BY i.position)
                 FROM quote_request_items i WHERE i."requestId" = q.id) AS items
         FROM quote_requests q LEFT JOIN partners p ON p.id = q."createdByPartnerId"
        WHERE q."petId" = $1 AND q."createdByPartnerId" IS NOT NULL ORDER BY q."createdAt" DESC`,
      pet.id,
    );
  }

  const items: any[] = [
    ...entries.map((e) => entryView(e, opts)),
    ...vacc.map((v) => {
      const r = formatRecord(v);
      return {
        id: r.id,
        type: 'VACCINATION',
        kind: r.category,
        date: r.applicationDate,
        title: r.vaccineName,
        details: [r.manufacturer, r.batchNumber ? `lote ${r.batchNumber}` : null, r.notes].filter(Boolean).join(' · ') || null,
        weight: r.petWeight,
        returnDate: r.nextDoseDate,
        source: r.isVerified ? 'VET' : 'TUTOR',
        verified: r.isVerified,
        vetName: r.veterinarian,
        vetCrmv: r.veterinarianCRMV,
        clinicName: r.clinicName,
        createdAt: v.createdAt,
      };
    }),
    ...lists.map((q) => ({
      id: q.id,
      type: 'QUOTE_LIST',
      kind: 'MEDICACAO',
      date: q.createdAt,
      title: 'Lista do veterinário',
      details: [q.items, q.notes].filter(Boolean).join('\n'),
      source: 'VET',
      verified: true,
      clinicName: q.clinicName,
      createdAt: q.createdAt,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Peso: cada medição datada (registro ou carimbo), uma por dia (a mais recente)
  const byDay = new Map<string, { date: string; weight: number; source: string }>();
  for (const it of [...items].reverse()) {
    if (it.weight == null) continue;
    const day = new Date(it.date).toISOString().slice(0, 10);
    byDay.set(day, { date: day, weight: Number(it.weight), source: it.verified ? 'VET' : 'TUTOR' });
  }
  const weights = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));

  const now = Date.now();
  const nextReturn = items
    .filter((i) => i.returnDate && new Date(i.returnDate).getTime() > now - 864e5)
    .sort((a, b) => new Date(a.returnDate).getTime() - new Date(b.returnDate).getTime())[0];

  return {
    items: opts.limit ? items.slice(0, opts.limit) : items,
    total: items.length,
    weights,
    nextReturn: nextReturn ? { date: nextReturn.returnDate, title: nextReturn.title, type: nextReturn.type } : null,
    counts: {
      consultas: items.filter((i) => i.kind === 'CONSULTA').length,
      vacinas: items.filter((i) => i.type === 'VACCINATION').length,
      exames: items.filter((i) => i.kind === 'EXAME').length,
    },
  };
}

/** Peso mais recente vira o peso do cadastro do pet. */
async function syncPetWeight(db: any, petId: string) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT w FROM (
       SELECT weight AS w, date AS d, "createdAt" AS c FROM pet_health_entries WHERE "petId" = $1 AND weight IS NOT NULL
       UNION ALL
       SELECT "petWeight", "applicationDate", "createdAt" FROM vaccinations WHERE "petId" = $1 AND "petWeight" IS NOT NULL
     ) s ORDER BY d DESC, c DESC LIMIT 1`,
    petId,
  );
  if (rows[0]?.w != null) await db.$executeRawUnsafe(`UPDATE pets SET weight = $2, "updatedAt" = NOW() WHERE id = $1`, petId, Number(rows[0].w));
}

async function savePhoto(db: any, entryId: string, input: any) {
  if (input === undefined) return;
  if (input === null || input === '') {
    await db.$executeRawUnsafe(`DELETE FROM pet_health_photos WHERE "entryId" = $1`, entryId);
    return;
  }
  const photo = decodePhoto(input)!;
  await db.$executeRawUnsafe(
    `INSERT INTO pet_health_photos ("entryId", mime, data) VALUES ($1, $2, $3)
     ON CONFLICT ("entryId") DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data`,
    entryId,
    photo.mime,
    photo.data,
  );
}

async function ownedPet(db: any, userId: string, petId: string) {
  const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM pets WHERE id = $1 AND "userId" = $2`, petId, userId);
  if (!rows[0]) throw new HttpError(404, 'Pet não encontrado');
  return rows[0];
}

async function partnerAccount(db: any, userId: string) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT a.id, a.role, a."partnerId", p.name AS "partnerName", p."isActive" AS "partnerActive"
       FROM partner_accounts a JOIN partners p ON p.id = a."partnerId" WHERE a."userId" = $1 LIMIT 1`,
    userId,
  );
  const acc = rows[0];
  if (!acc) throw new HttpError(403, 'Este usuário não tem acesso de parceiro.', 'NOT_PARTNER');
  if (!acc.partnerActive) throw new HttpError(403, 'Esta empresa está desativada na Liga do Bem.', 'PARTNER_INACTIVE');
  return acc;
}

/** Atendimento aberto pelo QR do pet nesta empresa (autorização do tutor). */
async function openVisit(db: any, visitId: string, partnerId: string) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT v.*, p."userId" AS "ownerId", p.name AS "petName" FROM pet_visits v JOIN pets p ON p.id = v."petId"
      WHERE v.id = $1 AND v."partnerId" = $2`,
    visitId,
    partnerId,
  );
  const v = rows[0];
  if (!v) throw new HttpError(404, 'Atendimento não encontrado');
  if (new Date(v.expiresAt).getTime() < Date.now()) throw new HttpError(410, 'Atendimento expirado. Leia o QR do pet de novo.', 'VISIT_EXPIRED');
  return v;
}

async function notifyOwner(db: any, userId: string, title: string, message: string, data: Record<string, string>) {
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
    console.warn('⚠️ Aviso do histórico falhou:', e?.message);
  }
}

// ---------------------------------------------------------------- roteador

export function isHealthPath(path: string) {
  return (
    /^\/api\/user\/pets\/[^/]+\/history(\/[^/]+(\/photo)?)?$/.test(path) ||
    /^\/api\/partner\/pets\/visits\/[^/]+\/history$/.test(path) ||
    /^\/api\/partner\/health\/[^/]+(\/photo)?$/.test(path)
  );
}

export async function handleHealth(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db } = ctx;
  if (!isHealthPath(path)) return false;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }
  try {
    await ensureHealthSchema(db);
    const { userId } = ctx.authUser();

    // ---------- tutor
    const um = path.match(/^\/api\/user\/pets\/([^/]+)\/history(?:\/([^/]+)(\/photo)?)?$/);
    if (um) {
      const pet = await ownedPet(db, userId, um[1]);
      if (!um[2] && method === 'GET') {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ pet: { id: pet.id, name: pet.name, species: pet.species, weight: pet.weight }, ...(await petTimeline(db, pet)), kinds: HEALTH_KINDS });
        return true;
      }
      if (!um[2] && method === 'POST') {
        const f = entryFields(body, 'TUTOR');
        const id = crypto.randomUUID();
        await db.$executeRawUnsafe(
          `INSERT INTO pet_health_entries (id, "petId", kind, date, title, details, guidance, weight, "returnDate", source, "authorUserId", "clinicName")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'TUTOR',$10,$11)`,
          id, pet.id, f.kind, f.date, f.title, f.details, f.guidance, f.weight, f.returnDate, userId,
          String(body.clinicName || '').trim().slice(0, 100) || null,
        );
        await savePhoto(db, id, body.photo || undefined);
        if (f.weight != null) await syncPetWeight(db, pet.id);
        const rows: any[] = await db.$queryRawUnsafe(`SELECT e.*, EXISTS(SELECT 1 FROM pet_health_photos WHERE "entryId" = e.id) AS "hasPhoto" FROM pet_health_entries e WHERE id = $1`, id);
        res.status(201).json({ entry: entryView(rows[0]) });
        return true;
      }
      const entries: any[] = um[2]
        ? await db.$queryRawUnsafe(`SELECT * FROM pet_health_entries WHERE id = $1 AND "petId" = $2`, um[2], pet.id)
        : [];
      const e = entries[0];
      if (!e) throw new HttpError(404, 'Registro não encontrado');
      if (um[3] && method === 'GET') {
        const ph: any[] = await db.$queryRawUnsafe(`SELECT mime, data FROM pet_health_photos WHERE "entryId" = $1`, e.id);
        if (!ph[0]) throw new HttpError(404, 'Sem foto');
        res.setHeader('Content-Type', ph[0].mime);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.status(200).end(Buffer.from(ph[0].data));
        return true;
      }
      if (e.source !== 'TUTOR') throw new HttpError(403, 'Registro do veterinário não pode ser alterado pelo tutor.', 'VET_ENTRY');
      if (!um[3] && method === 'PUT') {
        const f = entryFields({ ...e, date: e.date, ...body }, 'TUTOR');
        await db.$executeRawUnsafe(
          `UPDATE pet_health_entries SET kind=$2, date=$3, title=$4, details=$5, guidance=$6, weight=$7, "returnDate"=$8, "clinicName"=$9, "updatedAt"=NOW() WHERE id=$1`,
          e.id, f.kind, f.date, f.title, f.details, f.guidance, f.weight, f.returnDate,
          body.clinicName !== undefined ? String(body.clinicName || '').trim().slice(0, 100) || null : e.clinicName,
        );
        await savePhoto(db, e.id, body.photo);
        await syncPetWeight(db, pet.id);
        const rows: any[] = await db.$queryRawUnsafe(`SELECT e.*, EXISTS(SELECT 1 FROM pet_health_photos WHERE "entryId" = e.id) AS "hasPhoto" FROM pet_health_entries e WHERE id = $1`, e.id);
        res.status(200).json({ entry: entryView(rows[0]) });
        return true;
      }
      if (!um[3] && method === 'DELETE') {
        await db.$executeRawUnsafe(`DELETE FROM pet_health_entries WHERE id = $1`, e.id);
        res.status(200).json({ message: 'Registro apagado' });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    // ---------- veterinário (durante o atendimento)
    const acc = await partnerAccount(db, userId);
    const vm = path.match(/^\/api\/partner\/pets\/visits\/([^/]+)\/history$/);
    if (vm) {
      const visit = await openVisit(db, vm[1], acc.partnerId);
      const pets: any[] = await db.$queryRawUnsafe(`SELECT * FROM pets WHERE id = $1`, visit.petId);
      if (method === 'GET') {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json(await petTimeline(db, pets[0], { forPartnerId: acc.partnerId, limit: 30 }));
        return true;
      }
      if (method === 'POST') {
        const vets: any[] = await db.$queryRawUnsafe(`SELECT * FROM partner_vets WHERE "accountId" = $1 AND status = 'APPROVED'`, acc.id);
        const vet = vets[0];
        if (!vet) throw new HttpError(403, 'Só veterinário com CRMV aprovado registra atendimentos.', 'VET_REQUIRED');
        const f = entryFields(body, 'VET');
        if (f.date.getTime() < Date.now() - 7 * 864e5) throw new HttpError(400, 'Registre atendimentos dos últimos 7 dias');
        const id = crypto.randomUUID();
        await db.$executeRawUnsafe(
          `INSERT INTO pet_health_entries (id, "petId", kind, date, title, details, guidance, weight, "returnDate", source, "partnerId", "accountId", "authorUserId", "vetName", "vetCrmv", "clinicName", "visitId")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'VET',$10,$11,$12,$13,$14,$15,$16)`,
          id, visit.petId, f.kind, f.date, f.title, f.details, f.guidance, f.weight, f.returnDate,
          acc.partnerId, acc.id, userId, vet.fullName, formatCrmv(vet.crmv, vet.crmvUf), acc.partnerName, visit.id,
        );
        await savePhoto(db, id, body.photo || undefined);
        if (f.weight != null) await syncPetWeight(db, visit.petId);
        await notifyOwner(
          db,
          visit.ownerId,
          `🩺 ${vet.fullName} registrou ${f.kind === 'CONSULTA' ? 'a consulta' : 'um atendimento'} de ${visit.petName}`,
          `${f.title}${f.returnDate ? ' · retorno marcado' : ''}. Veja no histórico de saúde.`,
          { screen: 'PetHealth', petId: String(visit.petId) },
        );
        const rows: any[] = await db.$queryRawUnsafe(`SELECT e.*, EXISTS(SELECT 1 FROM pet_health_photos WHERE "entryId" = e.id) AS "hasPhoto" FROM pet_health_entries e WHERE id = $1`, id);
        res.status(201).json({ entry: entryView(rows[0], { forPartnerId: acc.partnerId }) });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    const pm = path.match(/^\/api\/partner\/health\/([^/]+)(\/photo)?$/);
    if (pm) {
      const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM pet_health_entries WHERE id = $1 AND "partnerId" = $2`, pm[1], acc.partnerId);
      const e = rows[0];
      if (!e) throw new HttpError(404, 'Registro não encontrado');
      if (pm[2] && method === 'GET') {
        const ph: any[] = await db.$queryRawUnsafe(`SELECT mime, data FROM pet_health_photos WHERE "entryId" = $1`, e.id);
        if (!ph[0]) throw new HttpError(404, 'Sem foto');
        res.setHeader('Content-Type', ph[0].mime);
        res.status(200).end(Buffer.from(ph[0].data));
        return true;
      }
      if (!pm[2] && method === 'PUT') {
        if (e.accountId !== acc.id) throw new HttpError(403, 'Só quem registrou pode corrigir.', 'NOT_AUTHOR');
        if (Date.now() - new Date(e.createdAt).getTime() > CORRECTION_HOURS * 3600e3) {
          throw new HttpError(409, `O prazo de ${CORRECTION_HOURS} h para corrigir terminou. Faça um novo registro.`, 'LOCKED');
        }
        const f = entryFields({ kind: e.kind, title: e.title, date: e.date, details: e.details, guidance: e.guidance, weight: e.weight, returnDate: e.returnDate, ...body }, 'VET');
        await db.$executeRawUnsafe(
          `UPDATE pet_health_entries SET kind=$2, date=$3, title=$4, details=$5, guidance=$6, weight=$7, "returnDate"=$8, "updatedAt"=NOW() WHERE id=$1`,
          e.id, f.kind, f.date, f.title, f.details, f.guidance, f.weight, f.returnDate,
        );
        await savePhoto(db, e.id, body.photo);
        await syncPetWeight(db, e.petId);
        const out: any[] = await db.$queryRawUnsafe(`SELECT e.*, EXISTS(SELECT 1 FROM pet_health_photos WHERE "entryId" = e.id) AS "hasPhoto" FROM pet_health_entries e WHERE id = $1`, e.id);
        res.status(200).json({ entry: entryView(out[0], { forPartnerId: acc.partnerId }) });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    throw new HttpError(404, 'Rota não encontrada');
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : e?.status || 500;
    if (status >= 500) console.error('❌ Histórico de saúde:', e);
    res.status(status).json({ error: status >= 500 ? 'Erro interno no histórico' : e.message, code: e?.code });
    return true;
  }
}
