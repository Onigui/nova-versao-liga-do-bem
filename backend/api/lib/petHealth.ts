/**
 * Carteira de vacinação carimbada.
 *
 * - O tutor mostra o QR do pet (LDBP.<petId>.<exp>.<assinatura>, vale 10 min) = consentimento.
 * - Só veterinário com CRMV aprovado pela Liga carimba (App Parceiros). O carimbo fica com
 *   nome, CRMV, clínica, lote, foto do selo e não pode ser alterado pelo tutor. A clínica
 *   corrige ou anula em até 24 h, tudo registrado em vaccination_audit.
 * - Lembrete da próxima dose (7 dias antes e no dia), só em horário comercial.
 * - Carteira compartilhável: link público com a carteira ao vivo, para hotel, creche, viagem.
 */
import crypto from 'crypto';
import { sendFcmToTokens } from './push';
import { isMembershipCurrentlyActive } from './membershipBilling';
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
  jwtSecret: string;
  isAdmin: boolean;
  authUser: () => { userId: string; email?: string; role?: string };
};

export const PET_TOKEN_PREFIX = 'LDBP';
export const PET_TOKEN_TTL_SECONDS = 10 * 60;
const SIG_LEN = 22;
const ID_RE = /^[A-Za-z0-9_-]{6,60}$/;
export const CORRECTION_HOURS = 24;
const VISIT_HOURS = 3;
const LOOKUPS_PER_HOUR = 60;
const PHOTO_MAX_BYTES = 600 * 1024;
export const RECORD_CATEGORIES = ['VACCINE', 'DEWORMER', 'ANTIPARASITIC'] as const;
const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

// ---------------------------------------------------------------- QR do pet

export function petTokenSecret(jwtSecret: string): Buffer {
  if (!jwtSecret) throw new Error('JWT_SECRET ausente');
  return crypto.createHmac('sha256', jwtSecret).update('liga-do-bem/pet-qr/v1').digest();
}

function sign(secret: Buffer, petId: string, exp: number) {
  return crypto.createHmac('sha256', secret).update(`${PET_TOKEN_PREFIX}.${petId}.${exp}`).digest('base64url').slice(0, SIG_LEN);
}

export function issuePetToken(secret: Buffer, petId: string, nowMs = Date.now()) {
  if (!ID_RE.test(petId)) throw new Error('petId inválido');
  const exp = Math.floor(nowMs / 1000) + PET_TOKEN_TTL_SECONDS;
  return {
    code: `${PET_TOKEN_PREFIX}.${petId}.${exp}.${sign(secret, petId, exp)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
    ttlSeconds: PET_TOKEN_TTL_SECONDS,
  };
}

export function parsePetToken(raw: unknown, secret: Buffer, nowMs = Date.now()):
  | { ok: true; petId: string }
  | { ok: false; reason: 'EXPIRED' | 'INVALID_SIGNATURE' | 'UNRECOGNIZED' | 'CARD_QR' } {
  const text = String(raw ?? '').trim();
  if (text.startsWith('LDB2.') || text.startsWith('LIGADOBEM|')) return { ok: false, reason: 'CARD_QR' };
  if (!text.startsWith(`${PET_TOKEN_PREFIX}.`) || text.length > 200) return { ok: false, reason: 'UNRECOGNIZED' };
  const parts = text.split('.');
  if (parts.length !== 4) return { ok: false, reason: 'UNRECOGNIZED' };
  const [, petId, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!ID_RE.test(petId) || !Number.isInteger(exp) || sig.length !== SIG_LEN) return { ok: false, reason: 'UNRECOGNIZED' };
  const a = Buffer.from(sign(secret, petId, exp));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'INVALID_SIGNATURE' };
  if (exp * 1000 < nowMs) return { ok: false, reason: 'EXPIRED' };
  return { ok: true, petId };
}

export const PET_TOKEN_ERRORS: Record<string, string> = {
  EXPIRED: 'Este QR expirou. Peça para o tutor abrir o pet no app de novo.',
  INVALID_SIGNATURE: 'QR inválido ou adulterado.',
  UNRECOGNIZED: 'Este não é o QR de um pet da Liga do Bem.',
  CARD_QR:
    'Este é o QR da carteirinha do membro. Para carimbar, peça o QR do pet: Meus Pets → escolha o pet → "Mostrar ao veterinário".',
};

// ---------------------------------------------------------------- esquema

let ensuredAt = 0;
export async function ensurePetHealthSchema(db: any) {
  if (Date.now() - ensuredAt < 6 * 60 * 60 * 1000) return;
  const statements = [
    `ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'VACCINE'`,
    `ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS manufacturer TEXT`,
    `ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "petWeight" DOUBLE PRECISION`,
    `ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "stampedByAccountId" TEXT`,
    `ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "stampedByUserId" TEXT`,
    `ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "hasLabelPhoto" BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "correctedAt" TIMESTAMP(3)`,
    `ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "reminder7SentAt" TIMESTAMP(3)`,
    `ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "reminderDueSentAt" TIMESTAMP(3)`,
    `CREATE INDEX IF NOT EXISTS vaccinations_next_dose_idx ON vaccinations("nextDoseDate")`,
    `CREATE INDEX IF NOT EXISTS vaccinations_clinic_idx ON vaccinations("clinicId", "verifiedAt")`,
    `ALTER TABLE pets ADD COLUMN IF NOT EXISTS "shareToken" TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS pets_share_token_idx ON pets("shareToken")`,
    `CREATE TABLE IF NOT EXISTS vaccination_label_photos (
       "vaccinationId" TEXT PRIMARY KEY REFERENCES vaccinations(id) ON DELETE CASCADE,
       mime TEXT NOT NULL,
       data BYTEA NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS vaccination_audit (
       id TEXT PRIMARY KEY,
       "vaccinationId" TEXT NOT NULL,
       "petId" TEXT,
       action TEXT NOT NULL,
       "actorUserId" TEXT,
       "partnerId" TEXT,
       before JSONB,
       after JSONB,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS vaccination_audit_vacc_idx ON vaccination_audit("vaccinationId")`,
    `CREATE TABLE IF NOT EXISTS partner_vets (
       "accountId" TEXT PRIMARY KEY REFERENCES partner_accounts(id) ON DELETE CASCADE,
       "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
       "fullName" TEXT NOT NULL,
       crmv TEXT NOT NULL,
       "crmvUf" TEXT NOT NULL,
       status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
       "reviewNote" TEXT,
       "reviewedAt" TIMESTAMP(3),
       "reviewedById" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS pet_visits (
       id TEXT PRIMARY KEY,
       "accountId" TEXT NOT NULL,
       "partnerId" TEXT NOT NULL,
       "petId" TEXT NOT NULL,
       "expiresAt" TIMESTAMP(3) NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS pet_visits_account_idx ON pet_visits("accountId", "createdAt")`,
  ];
  const fp = schemaFingerprint(statements);
  if (!(await schemaApplied(db, 'petHealth', fp))) {
    for (const sql of statements) await db.$executeRawUnsafe(sql);
    await markSchemaApplied(db, 'petHealth', fp);
  }
  ensuredAt = Date.now();
}

// ---------------------------------------------------------------- helpers

const str = (v: any, max: number, field: string) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = String(v).trim();
  if (s.length > max) throw new HttpError(400, `${field}: no máximo ${max} caracteres`);
  return s || null;
};

function parseDate(v: any, field: string): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `${field} inválida`);
  return d;
}

function publicBase() {
  return (process.env.API_PUBLIC_URL || 'https://nova-versao-liga-do-bem.vercel.app').replace(/\/+$/, '');
}

export function formatCrmv(crmv: string, uf: string) {
  return `CRMV-${uf} ${crmv}`;
}

export function formatRecord(v: any) {
  const stampedAt = v.verifiedAt ? new Date(v.verifiedAt) : null;
  return {
    id: v.id,
    petId: v.petId,
    category: v.category || 'VACCINE',
    vaccineName: v.vaccineName,
    vaccineType: v.vaccineType,
    manufacturer: v.manufacturer || null,
    applicationDate: v.applicationDate,
    nextDoseDate: v.nextDoseDate,
    batchNumber: v.batchNumber,
    veterinarian: v.veterinarian,
    veterinarianCRMV: v.veterinarianCRMV,
    clinicName: v.clinicName,
    clinicId: v.clinicId,
    notes: v.notes,
    petWeight: v.petWeight ?? null,
    isVerified: !!v.isVerified,
    verifiedAt: v.verifiedAt,
    correctedAt: v.correctedAt || null,
    hasLabelPhoto: !!v.hasLabelPhoto,
    correctableUntil: stampedAt ? new Date(stampedAt.getTime() + CORRECTION_HOURS * 3600e3) : null,
  };
}

function decodePhoto(input: any): { mime: string; data: Buffer } | null {
  if (!input) return null;
  const raw = String(input);
  const m = raw.match(/^data:([^;]+);base64,(.*)$/);
  const b64 = (m ? m[2] : raw).replace(/\s/g, '');
  let data: Buffer;
  try {
    data = Buffer.from(b64, 'base64');
  } catch {
    throw new HttpError(400, 'Foto inválida');
  }
  if (!data.length) throw new HttpError(400, 'Foto inválida');
  if (data.length > PHOTO_MAX_BYTES) throw new HttpError(400, 'Foto muito grande (máx. 600 KB)');
  const hex = data.subarray(0, 12).toString('hex');
  const mime = hex.startsWith('ffd8ff')
    ? 'image/jpeg'
    : hex.startsWith('89504e47')
      ? 'image/png'
      : hex.startsWith('52494646') && data.subarray(8, 12).toString() === 'WEBP'
        ? 'image/webp'
        : null;
  if (!mime) throw new HttpError(400, 'Use uma foto JPG, PNG ou WEBP');
  return { mime, data };
}

async function audit(db: any, a: { vaccinationId: string; petId?: string; action: string; actorUserId?: string; partnerId?: string; before?: any; after?: any }) {
  await db.$executeRawUnsafe(
    `INSERT INTO vaccination_audit (id, "vaccinationId", "petId", action, "actorUserId", "partnerId", before, after)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
    crypto.randomUUID(),
    a.vaccinationId,
    a.petId || null,
    a.action,
    a.actorUserId || null,
    a.partnerId || null,
    a.before ? JSON.stringify(a.before) : null,
    a.after ? JSON.stringify(a.after) : null,
  );
}

async function notifyUser(db: any, userId: string, title: string, message: string, data: Record<string, string>, partnerApp = false) {
  try {
    if (!partnerApp) {
      await db.$executeRawUnsafe(
        `INSERT INTO notifications (id, "userId", title, message, type, data, "isRead", "sentAt")
         VALUES ($1, $2, $3, $4, 'GENERAL'::"NotificationType", $5::jsonb, false, NOW())`,
        crypto.randomUUID(),
        userId,
        title,
        message,
        JSON.stringify(data),
      );
    }
    const tokens: any[] = await db.$queryRawUnsafe(
      `SELECT token FROM device_tokens WHERE "userId" = $1 AND "isActive" = true AND platform ${partnerApp ? "= 'android-partner'" : "<> 'android-partner'"}`,
      userId,
    );
    if (tokens.length) await sendFcmToTokens(tokens.map((t) => t.token), { title, body: message, data });
  } catch (e: any) {
    console.warn('⚠️ Aviso ao usuário falhou:', e?.message);
  }
}

async function ownedPet(db: any, userId: string, petId: string) {
  const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM pets WHERE id = $1 AND "userId" = $2`, petId, userId);
  if (!rows[0]) throw new HttpError(404, 'Pet não encontrado');
  return rows[0];
}

async function petRecords(db: any, petId: string) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT * FROM vaccinations WHERE "petId" = $1 ORDER BY "applicationDate" DESC, "createdAt" DESC`,
    petId,
  );
  return rows.map(formatRecord);
}

function petView(p: any) {
  return {
    id: p.id,
    name: p.name,
    species: p.species,
    breed: p.breed,
    birthDate: p.birthDate,
    gender: p.gender,
    color: p.color,
    weight: p.weight,
    microchip: p.microchip,
    photo: p.photo,
    notes: p.notes,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
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

async function vetOf(db: any, accountId: string) {
  const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM partner_vets WHERE "accountId" = $1`, accountId);
  return rows[0] || null;
}

async function requireVet(db: any, accountId: string) {
  const vet = await vetOf(db, accountId);
  if (!vet || vet.status !== 'APPROVED') {
    throw new HttpError(
      403,
      vet?.status === 'PENDING'
        ? 'Seu CRMV ainda está em análise pela Liga do Bem.'
        : 'Só veterinários com CRMV aprovado pela Liga podem carimbar. Cadastre seu CRMV em Empresa → Veterinário.',
      'VET_REQUIRED',
    );
  }
  return vet;
}

function vetView(v: any) {
  if (!v) return null;
  return {
    fullName: v.fullName,
    crmv: v.crmv,
    crmvUf: v.crmvUf,
    crmvLabel: formatCrmv(v.crmv, v.crmvUf),
    status: v.status,
    reviewNote: v.reviewNote,
    reviewedAt: v.reviewedAt,
  };
}

/** Valida e normaliza os campos de um registro feito pelo veterinário. */
function stampFields(body: any, partial: boolean) {
  const category = body.category === undefined && partial ? undefined : String(body.category || 'VACCINE').toUpperCase();
  if (category !== undefined && !(RECORD_CATEGORIES as readonly string[]).includes(category)) {
    throw new HttpError(400, 'Tipo de registro inválido');
  }
  const f: any = {
    category,
    vaccineName: str(body.vaccineName, 80, 'Nome'),
    vaccineType: str(body.vaccineType, 80, 'Tipo'),
    manufacturer: str(body.manufacturer, 60, 'Laboratório'),
    batchNumber: str(body.batchNumber, 40, 'Lote'),
    notes: str(body.notes, 500, 'Observações'),
    applicationDate: parseDate(body.applicationDate, 'Data de aplicação'),
    nextDoseDate: parseDate(body.nextDoseDate, 'Data da próxima dose'),
    petWeight:
      body.petWeight === undefined
        ? undefined
        : body.petWeight === null || body.petWeight === ''
          ? null
          : Number(String(body.petWeight).replace(',', '.')),
  };
  if (!partial || f.vaccineName !== undefined) {
    if (!f.vaccineName) throw new HttpError(400, 'Informe o nome da vacina ou do produto');
  }
  if (f.petWeight != null && (!Number.isFinite(f.petWeight) || f.petWeight < 0.05 || f.petWeight > 150)) {
    throw new HttpError(400, 'Peso inválido (kg)');
  }
  const now = Date.now();
  if (f.applicationDate) {
    if (f.applicationDate.getTime() > now + 864e5) throw new HttpError(400, 'A data de aplicação não pode ser no futuro');
    if (f.applicationDate.getTime() < now - 7 * 864e5) {
      throw new HttpError(400, 'O carimbo é para aplicações feitas agora (até 7 dias atrás).');
    }
  }
  return f;
}

function checkNextDose(app: Date, next: Date | null) {
  if (!next) return;
  if (next.getTime() <= app.getTime()) throw new HttpError(400, 'A próxima dose precisa ser depois da aplicação');
  if (next.getTime() > app.getTime() + 3 * 366 * 864e5) throw new HttpError(400, 'Próxima dose muito distante (máx. 3 anos)');
}

// ---------------------------------------------------------------- carteira pública (HTML)

const esc = (s: any) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const dBR = (d: any) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—');
const CAT_LABEL: Record<string, string> = { VACCINE: 'Vacina', DEWORMER: 'Vermífugo', ANTIPARASITIC: 'Antipulgas/carrapatos' };

export function renderPetCardHtml(pet: any, ownerFirstName: string, records: any[], nowMs = Date.now()) {
  const age = pet.birthDate
    ? (() => {
        const m = Math.floor((nowMs - new Date(pet.birthDate).getTime()) / (30.44 * 864e5));
        return m < 12 ? `${Math.max(m, 0)} meses` : `${Math.floor(m / 12)} ano${Math.floor(m / 12) > 1 ? 's' : ''}`;
      })()
    : null;
  const photo = /^https:\/\//.test(String(pet.photo || '')) || /^data:image\/(png|jpe?g|webp);base64,/.test(String(pet.photo || ''))
    ? `<img class="photo" src="${esc(pet.photo)}" alt="">`
    : `<div class="photo ph">🐾</div>`;
  const rows = records.length
    ? records
        .map((r) => {
          const late = r.nextDoseDate && new Date(r.nextDoseDate).getTime() < nowMs;
          return `<tr>
        <td><strong>${esc(r.vaccineName)}</strong><br><span class="muted">${esc(CAT_LABEL[r.category] || 'Vacina')}${r.manufacturer ? ' · ' + esc(r.manufacturer) : ''}${r.batchNumber ? ' · lote ' + esc(r.batchNumber) : ''}</span></td>
        <td>${dBR(r.applicationDate)}${r.nextDoseDate ? `<div class="nextm ${late ? 'late' : ''}">Próxima: ${dBR(r.nextDoseDate)}</div>` : ''}</td>
        <td>${r.nextDoseDate ? `<span class="${late ? 'late' : ''}">${dBR(r.nextDoseDate)}</span>` : '—'}</td>
        <td>${
          r.isVerified
            ? `<span class="seal">✔ Carimbada</span><br><span class="muted">${esc(r.clinicName || '')}<br>${esc(r.veterinarian || '')} · ${esc(r.veterinarianCRMV || '')}</span>`
            : `<span class="muted">Informada pelo tutor</span>`
        }</td></tr>`;
        })
        .join('')
    : `<tr><td colspan="4" class="muted">Nenhum registro ainda.</td></tr>`;
  const verified = records.filter((r) => r.isVerified).length;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Carteira de vacinação · ${esc(pet.name)}</title>
<style>
:root{--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--brand:#7c3aed;--ok:#047857;--okbg:#ecfdf5;--bad:#b91c1c}
*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:var(--ink);font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:16px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:14px}
.top{display:flex;gap:16px;align-items:center}.photo{width:84px;height:84px;border-radius:50%;object-fit:cover;border:3px solid var(--brand);flex:none}
.ph{display:flex;align-items:center;justify-content:center;font-size:34px;background:#f5f3ff}
h1{margin:0;font-size:26px}.muted{color:var(--muted);font-size:13px}.brand{color:var(--brand);font-weight:800;letter-spacing:.06em;font-size:12px}
.summary{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.pill{background:var(--okbg);color:var(--ok);border-radius:999px;padding:3px 10px;font-weight:700;font-size:13px}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:12px;color:var(--muted);font-weight:700;border-bottom:1px solid var(--line);padding:8px 6px}
td{border-bottom:1px solid var(--line);padding:10px 6px;vertical-align:top}.seal{color:var(--ok);font-weight:800}.late{color:var(--bad);font-weight:700}
.foot{font-size:12px;color:var(--muted)}.nextm{display:none;font-size:12px;color:var(--muted);margin-top:4px}button{border:0;background:var(--brand);color:#fff;border-radius:10px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer}
@media (max-width:600px){th:nth-child(3),td:nth-child(3){display:none}.nextm{display:block}.nextm.late{color:var(--bad)}}
@media print{body{background:#fff}.noprint{display:none}.card{border:0;padding:0}}
</style></head><body><div class="wrap">
<div class="card"><div class="brand">LIGA DO BEM · CARTEIRA DE VACINAÇÃO DIGITAL</div>
<div class="top" style="margin-top:10px">${photo}<div><h1>${esc(pet.name)}</h1>
<div class="muted">${[pet.species, pet.breed, pet.gender, age, pet.weight ? `${pet.weight} kg` : null].filter(Boolean).map(esc).join(' · ')}</div>
${pet.microchip ? `<div class="muted">Microchip: ${esc(pet.microchip)}</div>` : ''}
<div class="muted">Tutor(a): ${esc(ownerFirstName)}</div>
<div class="summary"><span class="pill">${verified} registro(s) carimbado(s) por veterinário</span></div></div></div></div>
<div class="card"><table><thead><tr><th>Vacina / produto</th><th>Aplicação</th><th>Próxima</th><th>Responsável</th></tr></thead><tbody>${rows}</tbody></table></div>
<div class="card foot">Documento gerado ao vivo em ${new Date(nowMs).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} a partir dos registros da Liga do Bem.
Registros <strong>✔ Carimbados</strong> foram feitos pelo próprio veterinário parceiro (CRMV conferido pela Liga) no momento da aplicação e não podem ser alterados pelo tutor.
Registros "informados pelo tutor" não foram conferidos por veterinário.
<div class="noprint" style="margin-top:12px"><button onclick="window.print()">Salvar em PDF / imprimir</button></div></div>
</div></body></html>`;
}

// ---------------------------------------------------------------- lembretes da próxima dose

/** Envia lembretes (7 dias antes e no dia). Só das 9h às 20h de Brasília. Idempotente. */
export async function sendDoseReminders(db: any, nowMs = Date.now(), max = 200) {
  await ensurePetHealthSchema(db);
  const brtHour = new Date(nowMs - 3 * 3600e3).getUTCHours();
  if (brtHour < 9 || brtHour >= 20) return { skipped: 'fora do horário', sent: 0 };
  // Só o registro mais recente de cada vacina do pet (se já tomou a dose seguinte, não lembra)
  const base = `FROM vaccinations v JOIN pets p ON p.id = v."petId" JOIN users u ON u.id = p."userId"
    WHERE u."isActive" = true AND v."nextDoseDate" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM vaccinations n WHERE n."petId" = v."petId"
                       AND lower(n."vaccineName") = lower(v."vaccineName") AND n."applicationDate" > v."applicationDate")`;
  const now = new Date(nowMs);
  const due: any[] = await db.$queryRawUnsafe(
    `SELECT v.id, v."vaccineName", v."nextDoseDate", v.category, p.id AS "petId", p.name AS "petName", u.id AS "userId" ${base}
       AND v."reminderDueSentAt" IS NULL AND v."nextDoseDate" <= $1::timestamp + INTERVAL '12 hours'
       AND v."nextDoseDate" >= $1::timestamp - INTERVAL '3 days'
     LIMIT ${max}`,
    now,
  );
  const soon: any[] = await db.$queryRawUnsafe(
    `SELECT v.id, v."vaccineName", v."nextDoseDate", v.category, p.id AS "petId", p.name AS "petName", u.id AS "userId" ${base}
       AND v."reminder7SentAt" IS NULL AND v."reminderDueSentAt" IS NULL
       AND v."nextDoseDate" > $1::timestamp + INTERVAL '12 hours' AND v."nextDoseDate" <= $1::timestamp + INTERVAL '7 days'
     LIMIT ${max}`,
    now,
  );
  let sent = 0;
  const what = (c: string) => (c === 'DEWORMER' ? 'o vermífugo' : c === 'ANTIPARASITIC' ? 'o antipulgas' : 'a vacina');
  for (const r of due) {
    const n = await db.$executeRawUnsafe(
      `UPDATE vaccinations SET "reminderDueSentAt" = NOW() WHERE id = $1 AND "reminderDueSentAt" IS NULL`,
      r.id,
    );
    if (!n) continue;
    await notifyUser(db, r.userId, `💉 Hoje é dia de ${r.vaccineName} de ${r.petName}`, `Está na hora de ${what(r.category)} ${r.vaccineName}. Veja os veterinários parceiros no app.`, {
      screen: 'VaccinationCard',
      petId: String(r.petId),
    });
    sent++;
  }
  for (const r of soon) {
    const n = await db.$executeRawUnsafe(
      `UPDATE vaccinations SET "reminder7SentAt" = NOW() WHERE id = $1 AND "reminder7SentAt" IS NULL`,
      r.id,
    );
    if (!n) continue;
    await notifyUser(
      db,
      r.userId,
      `🗓️ ${r.vaccineName} de ${r.petName} em ${dBR(r.nextDoseDate)}`,
      `Faltam poucos dias para ${what(r.category)} ${r.vaccineName}. Membros têm desconto nos veterinários parceiros.`,
      { screen: 'VaccinationCard', petId: String(r.petId) },
    );
    sent++;
  }
  return { sent, due: due.length, soon: soon.length };
}

// ---------------------------------------------------------------- roteador

export function isPetHealthPath(path: string) {
  return (
    /^\/api\/user\/pets\/[^/]+(\/vaccinations(\/[^/]+(\/photo)?)?|\/stamp-token|\/share)?$/.test(path) ||
    path === '/api/partner/vet' ||
    path.startsWith('/api/partner/pets/') ||
    path === '/api/partner/records' ||
    path.startsWith('/api/partner/records/') ||
    path === '/api/admin/partner-vets' ||
    path.startsWith('/api/admin/partner-vets/') ||
    path.startsWith('/api/public/pet-card/') ||
    path === '/api/cron/vaccine-reminders'
  );
}

export async function handlePetHealth(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db } = ctx;
  if (!isPetHealthPath(path)) return false;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};

  // Rotas do pet que este módulo não cobre (editar/apagar o pet) seguem para o código antigo
  const petM = path.match(/^\/api\/user\/pets\/([^/]+)(?:\/(vaccinations|stamp-token|share)(?:\/([^/]+)(\/photo)?)?)?$/);
  if (petM && !petM[2] && method !== 'GET') return false;

  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }

  try {
    await ensurePetHealthSchema(db);

    // ---------- público: carteira compartilhada
    const shareM = path.match(/^\/api\/public\/pet-card\/([A-Za-z0-9_-]{16,64})$/);
    if (shareM && method === 'GET') {
      const pets: any[] = await db.$queryRawUnsafe(
        `SELECT p.*, u.name AS "ownerName" FROM pets p JOIN users u ON u.id = p."userId" WHERE p."shareToken" = $1`,
        shareM[1],
      );
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (!pets[0]) {
        res.status(404).end('<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">Esta carteira não está mais compartilhada.</p>');
        return true;
      }
      const html = renderPetCardHtml(pets[0], String(pets[0].ownerName || '').split(' ')[0], await petRecords(db, pets[0].id));
      res.status(200).end(html);
      return true;
    }

    // ---------- lembretes (chamado pelo agendador)
    if (path === '/api/cron/vaccine-reminders' && (method === 'GET' || method === 'POST')) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ ok: true, ...(await sendDoseReminders(db)) });
      return true;
    }

    // ---------- admin: aprovação de veterinários
    if (path === '/api/admin/partner-vets' || path.startsWith('/api/admin/partner-vets/')) {
      if (!ctx.isAdmin) throw new HttpError(401, 'Acesso restrito ao administrador');
      let adminId = 'admin';
      try {
        adminId = ctx.authUser().userId;
      } catch {
        /* token de demonstração */
      }
      if (path === '/api/admin/partner-vets' && method === 'GET') {
        const status = ctx.req?.query?.status ? String(ctx.req.query.status).toUpperCase() : null;
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT v.*, p.name AS "partnerName", p.category AS "partnerCategory", u.email, u.name AS "userName",
                  (SELECT COUNT(*)::int FROM vaccinations x WHERE x."stampedByAccountId" = v."accountId") AS stamps
             FROM partner_vets v JOIN partners p ON p.id = v."partnerId"
             JOIN partner_accounts a ON a.id = v."accountId" JOIN users u ON u.id = a."userId"
            WHERE ($1::text IS NULL OR v.status = $1)
            ORDER BY CASE v.status WHEN 'PENDING' THEN 0 ELSE 1 END, v."updatedAt" DESC LIMIT 200`,
          status,
        );
        res.status(200).json({
          vets: rows.map((r) => ({ accountId: r.accountId, partnerId: r.partnerId, partnerName: r.partnerName, partnerCategory: r.partnerCategory, email: r.email, stamps: r.stamps, createdAt: r.createdAt, ...vetView(r) })),
        });
        return true;
      }
      const m = path.match(/^\/api\/admin\/partner-vets\/([^/]+)\/(approve|reject)$/);
      if (m && method === 'POST') {
        const note = String(body.note || '').trim().slice(0, 300) || null;
        if (m[2] === 'reject' && !note) throw new HttpError(400, 'Explique o motivo para o parceiro');
        const rows: any[] = await db.$queryRawUnsafe(
          `UPDATE partner_vets SET status = $2, "reviewNote" = $3, "reviewedAt" = NOW(), "reviewedById" = $4, "updatedAt" = NOW()
            WHERE "accountId" = $1 RETURNING *`,
          m[1],
          m[2] === 'approve' ? 'APPROVED' : 'REJECTED',
          note,
          adminId,
        );
        if (!rows[0]) throw new HttpError(404, 'Cadastro de veterinário não encontrado');
        const u: any[] = await db.$queryRawUnsafe(`SELECT "userId" FROM partner_accounts WHERE id = $1`, m[1]);
        if (u[0]) {
          await notifyUser(
            db,
            u[0].userId,
            m[2] === 'approve' ? 'CRMV aprovado ✅' : 'CRMV não aprovado',
            m[2] === 'approve'
              ? 'Você já pode carimbar as carteiras de vacinação dos pets no App Parceiros.'
              : `Motivo: ${note}. Corrija os dados em Empresa → Veterinário.`,
            { screen: 'VetProfile' },
            true,
          );
        }
        res.status(200).json({ vet: vetView(rows[0]) });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    const { userId } = ctx.authUser();

    // ---------- membro (tutor)
    if (petM) {
      const pet = await ownedPet(db, userId, petM[1]);
      const sub = petM[2];
      const vid = petM[3];

      if (!sub && method === 'GET') {
        const records = await petRecords(db, pet.id);
        res.status(200).json({
          pet: {
            ...petView(pet),
            vaccinations: records,
            share: pet.shareToken ? { url: `${publicBase()}/api/public/pet-card/${pet.shareToken}` } : null,
          },
        });
        return true;
      }

      if (sub === 'stamp-token' && method === 'GET') {
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ ...issuePetToken(petTokenSecret(ctx.jwtSecret), pet.id), petId: pet.id, petName: pet.name });
        return true;
      }

      if (sub === 'share' && method === 'POST') {
        let token = pet.shareToken;
        if (!token) {
          token = crypto.randomBytes(18).toString('base64url');
          await db.$executeRawUnsafe(`UPDATE pets SET "shareToken" = $2 WHERE id = $1`, pet.id, token);
        }
        res.status(200).json({ url: `${publicBase()}/api/public/pet-card/${token}` });
        return true;
      }
      if (sub === 'share' && method === 'DELETE') {
        await db.$executeRawUnsafe(`UPDATE pets SET "shareToken" = NULL WHERE id = $1`, pet.id);
        res.status(200).json({ message: 'O link antigo deixou de funcionar.' });
        return true;
      }

      if (sub === 'vaccinations' && !vid && method === 'GET') {
        res.status(200).json({ vaccinations: await petRecords(db, pet.id) });
        return true;
      }

      if (sub === 'vaccinations' && !vid && method === 'POST') {
        // Registro informado pelo tutor: nunca sai como carimbado
        const vaccineName = str(body.vaccineName, 80, 'Nome');
        if (!vaccineName) throw new HttpError(400, 'Informe o nome da vacina');
        const app = parseDate(body.applicationDate, 'Data de aplicação');
        if (!app) throw new HttpError(400, 'Informe a data de aplicação');
        const next = parseDate(body.nextDoseDate, 'Data da próxima dose') || null;
        checkNextDose(app, next);
        const category = String(body.category || 'VACCINE').toUpperCase();
        if (!(RECORD_CATEGORIES as readonly string[]).includes(category)) throw new HttpError(400, 'Tipo inválido');
        const id = crypto.randomUUID();
        await db.$executeRawUnsafe(
          `INSERT INTO vaccinations (id, "petId", "vaccineName", "vaccineType", "applicationDate", "nextDoseDate", "batchNumber",
             veterinarian, "veterinarianCRMV", "clinicName", notes, "isVerified", category, manufacturer, "createdAt", "updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,$12,$13,NOW(),NOW())`,
          id, pet.id, vaccineName, str(body.vaccineType, 80, 'Tipo') ?? null, app, next,
          str(body.batchNumber, 40, 'Lote') ?? null, str(body.veterinarian, 120, 'Veterinário') ?? null,
          str(body.veterinarianCRMV, 30, 'CRMV') ?? null, str(body.clinicName, 120, 'Clínica') ?? null,
          str(body.notes, 500, 'Observações') ?? null, category, str(body.manufacturer, 60, 'Laboratório') ?? null,
        );
        const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM vaccinations WHERE id = $1`, id);
        res.status(201).json({ vaccination: formatRecord(rows[0]) });
        return true;
      }

      if (sub === 'vaccinations' && vid) {
        const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM vaccinations WHERE id = $1 AND "petId" = $2`, vid, pet.id);
        const v = rows[0];
        if (!v) throw new HttpError(404, 'Registro não encontrado');

        if (petM[4] && method === 'GET') {
          const ph: any[] = await db.$queryRawUnsafe(`SELECT mime, data FROM vaccination_label_photos WHERE "vaccinationId" = $1`, v.id);
          if (!ph[0]) throw new HttpError(404, 'Sem foto do selo');
          res.setHeader('Content-Type', ph[0].mime);
          res.setHeader('Cache-Control', 'private, max-age=86400');
          res.status(200).end(Buffer.from(ph[0].data));
          return true;
        }
        if (!petM[4] && method === 'PUT') {
          if (v.isVerified) {
            throw new HttpError(403, 'Este registro foi carimbado pelo veterinário e não pode ser alterado. Peça a correção à clínica.', 'STAMPED');
          }
          const f: any = {
            vaccineName: str(body.vaccineName, 80, 'Nome'),
            vaccineType: str(body.vaccineType, 80, 'Tipo'),
            batchNumber: str(body.batchNumber, 40, 'Lote'),
            veterinarian: str(body.veterinarian, 120, 'Veterinário'),
            veterinarianCRMV: str(body.veterinarianCRMV, 30, 'CRMV'),
            clinicName: str(body.clinicName, 120, 'Clínica'),
            notes: str(body.notes, 500, 'Observações'),
            manufacturer: str(body.manufacturer, 60, 'Laboratório'),
            applicationDate: parseDate(body.applicationDate, 'Data de aplicação'),
            nextDoseDate: parseDate(body.nextDoseDate, 'Data da próxima dose'),
          };
          if (f.vaccineName === null) throw new HttpError(400, 'Informe o nome da vacina');
          if (f.applicationDate === null) throw new HttpError(400, 'Informe a data de aplicação');
          checkNextDose(f.applicationDate || new Date(v.applicationDate), f.nextDoseDate === undefined ? (v.nextDoseDate ? new Date(v.nextDoseDate) : null) : f.nextDoseDate);
          const sets: string[] = [];
          const params: any[] = [];
          for (const [k, val] of Object.entries(f)) {
            if (val === undefined) continue;
            params.push(val);
            sets.push(`"${k}" = $${params.length}`);
          }
          if (f.nextDoseDate !== undefined) sets.push(`"reminder7SentAt" = NULL, "reminderDueSentAt" = NULL`);
          if (sets.length) {
            params.push(v.id);
            await db.$executeRawUnsafe(`UPDATE vaccinations SET ${sets.join(', ')}, "updatedAt" = NOW() WHERE id = $${params.length}`, ...params);
          }
          const out: any[] = await db.$queryRawUnsafe(`SELECT * FROM vaccinations WHERE id = $1`, v.id);
          res.status(200).json({ vaccination: formatRecord(out[0]) });
          return true;
        }
        if (!petM[4] && method === 'DELETE') {
          if (v.isVerified) await audit(db, { vaccinationId: v.id, petId: pet.id, action: 'OWNER_DELETE', actorUserId: userId, before: formatRecord(v) });
          await db.$executeRawUnsafe(`DELETE FROM vaccinations WHERE id = $1`, v.id);
          res.status(200).json({ message: 'Registro excluído' });
          return true;
        }
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    // ---------- App Parceiros: veterinário
    const acc = await partnerAccount(db, userId);

    if (path === '/api/partner/vet' && method === 'GET') {
      const vet = await vetOf(db, acc.id);
      res.status(200).json({ vet: vetView(vet), canStamp: vet?.status === 'APPROVED' });
      return true;
    }
    if (path === '/api/partner/vet' && (method === 'POST' || method === 'PUT')) {
      const fullName = str(body.fullName, 120, 'Nome');
      const crmv = String(body.crmv || '').replace(/\D/g, '');
      const uf = String(body.crmvUf || '').trim().toUpperCase();
      if (!fullName || fullName.split(/\s+/).length < 2) throw new HttpError(400, 'Informe o nome completo, como está no CRMV');
      if (!/^\d{1,7}$/.test(crmv)) throw new HttpError(400, 'Número do CRMV inválido (só números)');
      if (!UFS.includes(uf)) throw new HttpError(400, 'Escolha o estado (UF) do CRMV');
      const cur = await vetOf(db, acc.id);
      // Mudou nome ou CRMV → volta para análise
      const same = cur && cur.status === 'APPROVED' && cur.crmv === crmv && cur.crmvUf === uf && cur.fullName === fullName;
      if (cur) {
        await db.$executeRawUnsafe(
          `UPDATE partner_vets SET "fullName" = $2, crmv = $3, "crmvUf" = $4, status = $5, "reviewNote" = $6, "updatedAt" = NOW() WHERE "accountId" = $1`,
          acc.id, fullName, crmv, uf, same ? 'APPROVED' : 'PENDING', same ? cur.reviewNote : null,
        );
      } else {
        await db.$executeRawUnsafe(
          `INSERT INTO partner_vets ("accountId", "partnerId", "fullName", crmv, "crmvUf") VALUES ($1, $2, $3, $4, $5)`,
          acc.id, acc.partnerId, fullName, crmv, uf,
        );
      }
      const vet = await vetOf(db, acc.id);
      res.status(200).json({ vet: vetView(vet), canStamp: vet.status === 'APPROVED' });
      return true;
    }

    if (path === '/api/partner/pets/lookup' && method === 'POST') {
      await requireVet(db, acc.id);
      const recent: any[] = await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM pet_visits WHERE "accountId" = $1 AND "createdAt" > NOW() - INTERVAL '1 hour'`,
        acc.id,
      );
      if ((recent[0]?.n || 0) >= LOOKUPS_PER_HOUR) throw new HttpError(429, 'Muitas consultas seguidas. Aguarde alguns minutos.');
      const parsed = parsePetToken(body.code, petTokenSecret(ctx.jwtSecret));
      if (parsed.ok === false) {
        const reason = (parsed as { reason: string }).reason;
        throw new HttpError(400, PET_TOKEN_ERRORS[reason], reason);
      }
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT p.*, u.name AS "ownerName", u."isActive" AS "ownerActive",
                m.status AS "mStatus", m."endDate" AS "mEndDate", m."memberId"
           FROM pets p JOIN users u ON u.id = p."userId"
           LEFT JOIN memberships m ON m."userId" = u.id
          WHERE p.id = $1 LIMIT 1`,
        parsed.petId,
      );
      const p = rows[0];
      if (!p) throw new HttpError(404, 'Pet não encontrado (pode ter sido excluído pelo tutor).');
      const visitId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + VISIT_HOURS * 3600e3);
      await db.$executeRawUnsafe(
        `INSERT INTO pet_visits (id, "accountId", "partnerId", "petId", "expiresAt") VALUES ($1, $2, $3, $4, $5)`,
        visitId, acc.id, acc.partnerId, p.id, expiresAt,
      );
      const memberActive = p.ownerActive !== false && !!p.mStatus && isMembershipCurrentlyActive({ status: p.mStatus, endDate: p.mEndDate });
      const records = (await petRecords(db, p.id)).slice(0, 20).map((r) => ({
        ...r,
        mine: r.clinicId === acc.partnerId && r.isVerified,
        canCorrect: r.clinicId === acc.partnerId && r.isVerified && !!r.correctableUntil && new Date(r.correctableUntil).getTime() > Date.now(),
      }));
      res.status(200).json({
        visitId,
        expiresAt,
        pet: { id: p.id, name: p.name, species: p.species, breed: p.breed, gender: p.gender, birthDate: p.birthDate, weight: p.weight, photo: p.photo, microchip: p.microchip, color: p.color },
        owner: { firstName: String(p.ownerName || '').split(' ')[0] },
        member: { active: memberActive, memberId: memberActive ? p.memberId : null },
        records,
      });
      return true;
    }

    const visitM = path.match(/^\/api\/partner\/pets\/visits\/([^/]+)\/records$/);
    if (visitM && method === 'POST') {
      const vet = await requireVet(db, acc.id);
      const visits: any[] = await db.$queryRawUnsafe(
        `SELECT v.*, p."userId", p.name AS "petName" FROM pet_visits v JOIN pets p ON p.id = v."petId"
          WHERE v.id = $1 AND v."partnerId" = $2`,
        visitM[1],
        acc.partnerId,
      );
      const visit = visits[0];
      if (!visit) throw new HttpError(404, 'Atendimento não encontrado. Leia o QR do pet de novo.');
      if (new Date(visit.expiresAt).getTime() < Date.now()) {
        throw new HttpError(410, 'Este atendimento expirou. Peça para o tutor mostrar o QR do pet de novo.', 'VISIT_EXPIRED');
      }
      const f = stampFields(body, false);
      const app = f.applicationDate || new Date();
      checkNextDose(app, f.nextDoseDate || null);
      if (f.category === 'VACCINE' && !f.batchNumber) throw new HttpError(400, 'Informe o lote da vacina');
      const photo = decodePhoto(body.labelPhoto);
      if (!body.confirmDuplicate) {
        const dup: any[] = await db.$queryRawUnsafe(
          `SELECT id FROM vaccinations WHERE "petId" = $1 AND lower("vaccineName") = lower($2) AND "isVerified" = true
             AND "applicationDate" > $3::timestamp - INTERVAL '20 hours' AND "applicationDate" < $3::timestamp + INTERVAL '20 hours' LIMIT 1`,
          visit.petId,
          f.vaccineName,
          app,
        );
        if (dup.length) throw new HttpError(409, `${f.vaccineName} já foi carimbada para este pet hoje. Confirme se é outra dose.`, 'DUPLICATE');
      }
      const id = crypto.randomUUID();
      const crmvLabel = formatCrmv(vet.crmv, vet.crmvUf);
      await db.$executeRawUnsafe(
        `INSERT INTO vaccinations (id, "petId", "vaccineName", "vaccineType", "applicationDate", "nextDoseDate", "batchNumber",
           veterinarian, "veterinarianCRMV", "clinicName", "clinicId", notes, "isVerified", "verifiedAt", category, manufacturer,
           "petWeight", "stampedByAccountId", "stampedByUserId", "hasLabelPhoto", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,NOW(),$13,$14,$15,$16,$17,$18,NOW(),NOW())`,
        id, visit.petId, f.vaccineName, f.vaccineType ?? null, app, f.nextDoseDate ?? null, f.batchNumber ?? null,
        vet.fullName, crmvLabel, acc.partnerName, acc.partnerId, f.notes ?? null, f.category, f.manufacturer ?? null,
        f.petWeight ?? null, acc.id, userId, !!photo,
      );
      if (photo) {
        await db.$executeRawUnsafe(
          `INSERT INTO vaccination_label_photos ("vaccinationId", mime, data) VALUES ($1, $2, $3)`,
          id, photo.mime, photo.data,
        );
      }
      if (f.petWeight != null) await db.$executeRawUnsafe(`UPDATE pets SET weight = $2, "updatedAt" = NOW() WHERE id = $1`, visit.petId, f.petWeight);
      const out: any[] = await db.$queryRawUnsafe(`SELECT * FROM vaccinations WHERE id = $1`, id);
      const rec = formatRecord(out[0]);
      await audit(db, { vaccinationId: id, petId: visit.petId, action: 'STAMP', actorUserId: userId, partnerId: acc.partnerId, after: rec });
      const label = f.category === 'DEWORMER' ? 'Vermífugo' : f.category === 'ANTIPARASITIC' ? 'Antipulgas' : 'Vacina';
      await notifyUser(
        db,
        visit.userId,
        `✅ ${label} carimbado na carteira de ${visit.petName}`,
        `${f.vaccineName} registrado por ${acc.partnerName} (${crmvLabel}).${f.nextDoseDate ? ` Próxima: ${dBR(f.nextDoseDate)}.` : ''}`,
        { screen: 'VaccinationCard', petId: String(visit.petId) },
      );
      res.status(201).json({ record: { ...rec, mine: true, canCorrect: true } });
      return true;
    }

    const recM = path.match(/^\/api\/partner\/records\/([^/]+)$/);
    if (recM && (method === 'PUT' || method === 'DELETE')) {
      await requireVet(db, acc.id);
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT * FROM vaccinations WHERE id = $1 AND "clinicId" = $2 AND "isVerified" = true`,
        recM[1],
        acc.partnerId,
      );
      const v = rows[0];
      if (!v) throw new HttpError(404, 'Carimbo não encontrado nesta clínica');
      if (new Date(v.verifiedAt).getTime() + CORRECTION_HOURS * 3600e3 < Date.now()) {
        throw new HttpError(403, `Só dá para corrigir até ${CORRECTION_HOURS} horas depois do carimbo. Faça um novo registro, se precisar.`, 'CORRECTION_CLOSED');
      }
      const before = formatRecord(v);
      if (method === 'DELETE') {
        await audit(db, { vaccinationId: v.id, petId: v.petId, action: 'VOID', actorUserId: userId, partnerId: acc.partnerId, before });
        await db.$executeRawUnsafe(`DELETE FROM vaccinations WHERE id = $1`, v.id);
        res.status(200).json({ message: 'Carimbo anulado' });
        return true;
      }
      const f = stampFields(body, true);
      const app = f.applicationDate || new Date(v.applicationDate);
      const next = f.nextDoseDate === undefined ? (v.nextDoseDate ? new Date(v.nextDoseDate) : null) : f.nextDoseDate;
      checkNextDose(app, next);
      const sets: string[] = [];
      const params: any[] = [];
      for (const k of ['category', 'vaccineName', 'vaccineType', 'manufacturer', 'batchNumber', 'notes', 'applicationDate', 'nextDoseDate', 'petWeight']) {
        if (f[k] === undefined) continue;
        params.push(f[k]);
        sets.push(`"${k}" = $${params.length}`);
      }
      if (!sets.length) throw new HttpError(400, 'Nada para corrigir');
      if (f.nextDoseDate !== undefined) sets.push(`"reminder7SentAt" = NULL, "reminderDueSentAt" = NULL`);
      params.push(v.id);
      await db.$executeRawUnsafe(
        `UPDATE vaccinations SET ${sets.join(', ')}, "correctedAt" = NOW(), "updatedAt" = NOW() WHERE id = $${params.length}`,
        ...params,
      );
      const out: any[] = await db.$queryRawUnsafe(`SELECT * FROM vaccinations WHERE id = $1`, v.id);
      const after = formatRecord(out[0]);
      await audit(db, { vaccinationId: v.id, petId: v.petId, action: 'CORRECT', actorUserId: userId, partnerId: acc.partnerId, before, after });
      res.status(200).json({ record: { ...after, mine: true, canCorrect: true } });
      return true;
    }

    if (path === '/api/partner/records' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT v.*, p.name AS "petName", p.species AS "petSpecies" FROM vaccinations v JOIN pets p ON p.id = v."petId"
          WHERE v."clinicId" = $1 AND v."isVerified" = true ORDER BY v."verifiedAt" DESC LIMIT 100`,
        acc.partnerId,
      );
      res.status(200).json({
        records: rows.map((r) => ({
          ...formatRecord(r),
          petName: r.petName,
          petSpecies: r.petSpecies,
          canCorrect: new Date(r.verifiedAt).getTime() + CORRECTION_HOURS * 3600e3 > Date.now(),
        })),
      });
      return true;
    }

    throw new HttpError(404, 'Rota não encontrada');
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : e?.status || 500;
    if (status >= 500) console.error('❌ Carteira de vacinação:', e);
    res.status(status).json({ error: status >= 500 ? 'Erro interno na carteira de vacinação' : e.message, code: e?.code });
    return true;
  }
}
