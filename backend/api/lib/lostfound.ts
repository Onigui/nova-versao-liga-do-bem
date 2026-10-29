/**
 * Achados e perdidos com mapa.
 *
 * Qualquer pessoa logada publica na hora (sem fila de aprovação):
 *  - LOST    "Perdi meu pet"   → local aproximado no mapa (protege o endereço de quem perdeu);
 *  - FOUND   "Encontrei"       → local exato, com quem o animal está agora;
 *  - SIGHTED "Vi solto na rua" → local exato.
 * Foto obrigatória (até 3), data/hora, espécie, cor, porte, coleira, ponto de referência.
 * Contato só por WhatsApp de quem publicou (sem chat), visível para quem está logado.
 *
 * Casos: cada aviso é o "caso" de um animal. Quem vê o mesmo animal de novo não cria outro aviso:
 * adiciona um AVISTAMENTO (foto obrigatória, local, hora) ao caso. Isso forma a linha do tempo e o
 * trajeto no mapa. Antes de publicar, o app pergunta "Pode ser um destes?" (POST /api/lostfound/similar).
 *
 * Mural: cada caso tem uma conversa pública (só para quem tem conta): comentários com foto opcional
 * e respostas. Filtro anti-golpe (PIX, links), telefone/e-mail escondidos, limite por pessoa,
 * denúncia (3 escondem até a Liga revisar) e o autor do caso pode ocultar. Quem acompanha o caso
 * (autor, quem comentou, quem registrou avistamento ou tocou em "Acompanhar") é avisado.
 *
 * Unificação: se o mesmo animal ganhou dois casos, qualquer pessoa sugere "é o mesmo animal" (ou o
 * sistema sugere sozinho quando a semelhança é muito alta). Junta quando confirma o tutor do caso
 * "perdido", ou os dois autores (quando não há perdido), ou a Liga. O caso que fica é o "perdido"
 * (ou o mais antigo); o outro vira um registro na linha do tempo e leva avistamentos, conversa e
 * quem acompanha. O link antigo leva ao caso unificado.
 *
 * Alertas: quem ativa recebe push de avisos novos num raio escolhido; quem perdeu um pet
 * recebe aviso automático de "encontrei"/"vi" da mesma espécie perto de onde perdeu.
 * Segurança: denúncia (3 denúncias escondem o aviso até a Liga revisar), limite de avisos,
 * expiração em 30 dias (renovável) e aviso fixo contra golpe do PIX.
 */
import crypto from 'crypto';
import { sendFcmToTokens } from './push';
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

export const LF_TYPES = ['LOST', 'FOUND', 'SIGHTED'] as const;
export const LF_SPECIES = ['DOG', 'CAT', 'OTHER'] as const;
const SIZES = ['PEQUENO', 'MEDIO', 'GRANDE'];
const WITH = ['COMIGO', 'LAR_TEMPORARIO', 'CLINICA', 'SOLTO'];
const ACTIVE_DAYS = 30;
const MAX_ACTIVE_PER_USER = 5;
const MAX_PER_DAY = 8;
const PHOTO_MAX = 800 * 1024;
const MAX_PHOTOS = 3;
const FLAGS_TO_HIDE = 3;
const MATCH_RADIUS_KM = 5;
const LOST_FUZZ_M = 250;
const ALERT_RADII = [1, 3, 5, 10];
const MAX_ALERT_PUSH = 500;
export const SIGHTING_KINDS = ['SEEN', 'WITH_ME', 'CLINIC'] as const;
const SIGHTINGS_PER_DAY = 20;
const SIGHTINGS_PER_CASE_DAY = 5;
const SIMILAR_MIN_SCORE = 40;
const COMMENT_MAX = 1000;
const COMMENTS_PER_DAY = 40;
const COMMENT_GAP_MS = 8 * 1000;
const COMMENT_FLAGS_TO_HIDE = 3;
const PUSH_QUIET_MS = 10 * 60 * 1000;
const MERGE_AUTO_SCORE = 70;
const MERGES_PER_DAY = 10;

let ensuredAt = 0;
export async function ensureLostFoundSchema(db: any) {
  if (Date.now() - ensuredAt < 6 * 60 * 60 * 1000) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS lf_reports (
       id TEXT PRIMARY KEY,
       "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       type TEXT NOT NULL CHECK (type IN ('LOST','FOUND','SIGHTED')),
       status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESOLVED','EXPIRED','REMOVED')),
       hidden BOOLEAN NOT NULL DEFAULT false,
       "hiddenReason" TEXT,
       species TEXT NOT NULL,
       "petName" TEXT,
       sex TEXT,
       size TEXT,
       colors TEXT,
       breed TEXT,
       "hasCollar" BOOLEAN,
       description TEXT,
       "currentlyWith" TEXT,
       lat DOUBLE PRECISION NOT NULL,
       lng DOUBLE PRECISION NOT NULL,
       "publicLat" DOUBLE PRECISION NOT NULL,
       "publicLng" DOUBLE PRECISION NOT NULL,
       "approximate" BOOLEAN NOT NULL DEFAULT false,
       "locationNote" TEXT,
       district TEXT,
       city TEXT,
       "happenedAt" TIMESTAMP(3) NOT NULL,
       whatsapp TEXT,
       "petId" TEXT,
       photos INTEGER NOT NULL DEFAULT 0,
       views INTEGER NOT NULL DEFAULT 0,
       "resolvedAt" TIMESTAMP(3),
       "resolvedNote" TEXT,
       "expiresAt" TIMESTAMP(3) NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS lf_reports_active_idx ON lf_reports(status, hidden, "createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS lf_reports_geo_idx ON lf_reports("publicLat", "publicLng")`,
    `CREATE INDEX IF NOT EXISTS lf_reports_user_idx ON lf_reports("userId", "createdAt" DESC)`,
    `CREATE TABLE IF NOT EXISTS lf_photos (
       "reportId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
       position INTEGER NOT NULL,
       mime TEXT NOT NULL,
       data BYTEA NOT NULL,
       PRIMARY KEY ("reportId", position)
     )`,
    `CREATE TABLE IF NOT EXISTS lf_alert_prefs (
       "userId" TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       enabled BOOLEAN NOT NULL DEFAULT true,
       lat DOUBLE PRECISION NOT NULL,
       lng DOUBLE PRECISION NOT NULL,
       "radiusKm" INTEGER NOT NULL DEFAULT 3,
       species TEXT NOT NULL DEFAULT 'ALL',
       "notifyFound" BOOLEAN NOT NULL DEFAULT true,
       "notifyLost" BOOLEAN NOT NULL DEFAULT true,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE TABLE IF NOT EXISTS lf_alerts_sent (
       "reportId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
       "userId" TEXT NOT NULL,
       reason TEXT NOT NULL,
       "sentAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       PRIMARY KEY ("reportId", "userId")
     )`,
    `ALTER TABLE lf_reports ADD COLUMN IF NOT EXISTS "lastLat" DOUBLE PRECISION`,
    `ALTER TABLE lf_reports ADD COLUMN IF NOT EXISTS "lastLng" DOUBLE PRECISION`,
    `ALTER TABLE lf_reports ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3)`,
    `ALTER TABLE lf_reports ADD COLUMN IF NOT EXISTS "lastKind" TEXT`,
    `ALTER TABLE lf_reports ADD COLUMN IF NOT EXISTS sightings INTEGER NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS lf_sightings (
       id TEXT PRIMARY KEY,
       "reportId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
       "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       kind TEXT NOT NULL CHECK (kind IN ('SEEN','WITH_ME','CLINIC')),
       lat DOUBLE PRECISION NOT NULL,
       lng DOUBLE PRECISION NOT NULL,
       "publicLat" DOUBLE PRECISION NOT NULL,
       "publicLng" DOUBLE PRECISION NOT NULL,
       "approximate" BOOLEAN NOT NULL DEFAULT false,
       "locationNote" TEXT,
       district TEXT,
       note TEXT,
       "happenedAt" TIMESTAMP(3) NOT NULL,
       mime TEXT NOT NULL,
       photo BYTEA NOT NULL,
       hidden BOOLEAN NOT NULL DEFAULT false,
       "hiddenBy" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS lf_sightings_report_idx ON lf_sightings("reportId", "happenedAt")`,
    `CREATE INDEX IF NOT EXISTS lf_sightings_user_idx ON lf_sightings("userId", "createdAt" DESC)`,
    `CREATE TABLE IF NOT EXISTS lf_comments (
       id TEXT PRIMARY KEY,
       "reportId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
       "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       "parentId" TEXT,
       body TEXT NOT NULL,
       mime TEXT,
       photo BYTEA,
       hidden BOOLEAN NOT NULL DEFAULT false,
       "hiddenBy" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS lf_comments_report_idx ON lf_comments("reportId", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS lf_comments_user_idx ON lf_comments("userId", "createdAt" DESC)`,
    `CREATE TABLE IF NOT EXISTS lf_comment_flags (
       "commentId" TEXT NOT NULL REFERENCES lf_comments(id) ON DELETE CASCADE,
       "userId" TEXT NOT NULL,
       reason TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       PRIMARY KEY ("commentId", "userId")
     )`,
    `CREATE TABLE IF NOT EXISTS lf_follows (
       "reportId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
       "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       active BOOLEAN NOT NULL DEFAULT true,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       PRIMARY KEY ("reportId", "userId")
     )`,
    `ALTER TABLE lf_reports ADD COLUMN IF NOT EXISTS "mergedInto" TEXT`,
    `ALTER TABLE lf_reports DROP CONSTRAINT IF EXISTS lf_reports_status_check`,
    `ALTER TABLE lf_reports ADD CONSTRAINT lf_reports_status_check CHECK (status IN ('ACTIVE','RESOLVED','EXPIRED','REMOVED','MERGED'))`,
    `CREATE TABLE IF NOT EXISTS lf_merges (
       id TEXT PRIMARY KEY,
       "sourceId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
       "targetId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
       "suggestedBy" TEXT,
       auto BOOLEAN NOT NULL DEFAULT false,
       note TEXT,
       needs TEXT NOT NULL CHECK (needs IN ('TUTOR','BOTH')),
       "sourceOk" BOOLEAN NOT NULL DEFAULT false,
       "targetOk" BOOLEAN NOT NULL DEFAULT false,
       status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','REJECTED','CANCELLED')),
       "decidedBy" TEXT,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       "decidedAt" TIMESTAMP(3)
     )`,
    `CREATE INDEX IF NOT EXISTS lf_merges_source_idx ON lf_merges("sourceId", status)`,
    `CREATE INDEX IF NOT EXISTS lf_merges_target_idx ON lf_merges("targetId", status)`,
    `CREATE TABLE IF NOT EXISTS lf_flags (
       "reportId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
       "userId" TEXT NOT NULL,
       reason TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       PRIMARY KEY ("reportId", "userId")
     )`,
  ];
  const fp = schemaFingerprint(statements);
  if (!(await schemaApplied(db, 'lostfound', fp))) {
    for (const sql of statements) await db.$executeRawUnsafe(sql);
    await markSchemaApplied(db, 'lostfound', fp);
  }
  ensuredAt = Date.now();
}

// ---------------------------------------------------------------- helpers

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** SQL de distância (km) entre a coluna e um ponto $lat/$lng (haversine). */
const distSql = (latCol: string, lngCol: string, pLat: string, pLng: string) =>
  `(6371 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(${latCol} - ${pLat}) / 2), 2) + COS(RADIANS(${pLat})) * COS(RADIANS(${latCol})) * POWER(SIN(RADIANS(${lngCol} - ${pLng}) / 2), 2))))`;

/** Desloca o ponto de "perdi" até ~250 m (fixo por aviso) para não expor a casa de quem perdeu. */
export function fuzzPoint(id: string, lat: number, lng: number, meters = LOST_FUZZ_M) {
  const h = crypto.createHash('sha256').update(`lf-fuzz:${id}`).digest();
  const angle = (h.readUInt16BE(0) / 65535) * 2 * Math.PI;
  const dist = meters * (0.4 + 0.6 * (h.readUInt16BE(2) / 65535));
  const dLat = (dist * Math.cos(angle)) / 111320;
  const dLng = (dist * Math.sin(angle)) / (111320 * Math.cos((lat * Math.PI) / 180));
  return { lat: Math.round((lat + dLat) * 1e5) / 1e5, lng: Math.round((lng + dLng) * 1e5) / 1e5 };
}

function decodePhoto(input: any) {
  const raw = String(input || '');
  const m = raw.match(/^data:([^;]+);base64,(.*)$/);
  const data = Buffer.from((m ? m[2] : raw).replace(/\s/g, ''), 'base64');
  if (!data.length || data.length > PHOTO_MAX) throw new HttpError(400, 'Foto inválida ou muito grande (máx. 800 KB)');
  const hex = data.subarray(0, 4).toString('hex');
  const mime = hex.startsWith('ffd8ff') ? 'image/jpeg' : hex.startsWith('89504e47') ? 'image/png' : null;
  if (!mime) throw new HttpError(400, 'Envie fotos em JPG ou PNG');
  return { mime, data };
}

export function normalizeWhatsapp(raw: any): string | null {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  return `55${d}`;
}

const words = (s: string) =>
  new Set(
    String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3 && !['com', 'sem', 'and', 'uma', 'tem'].includes(w)),
  );

/** Nota de semelhança entre dois avisos (0–100): distância, tempo, porte, cores. */
export function matchScore(a: any, b: any) {
  if (a.species !== b.species) return 0;
  const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
  if (km > MATCH_RADIUS_KM) return 0;
  let score = 40 * (1 - km / MATCH_RADIUS_KM);
  const days = Math.abs(new Date(a.happenedAt).getTime() - new Date(b.happenedAt).getTime()) / 864e5;
  score += days <= 3 ? 20 : days <= 10 ? 12 : days <= 30 ? 5 : 0;
  if (a.size && b.size) score += a.size === b.size ? 15 : -10;
  if (a.sex && b.sex && a.sex !== 'NAO_SEI' && b.sex !== 'NAO_SEI') score += a.sex === b.sex ? 5 : -15;
  const ca = words(`${a.colors} ${a.breed || ''}`);
  const cb = words(`${b.colors} ${b.breed || ''}`);
  const common = [...ca].filter((w) => cb.has(w)).length;
  score += Math.min(20, common * 10);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Semelhança considerando onde o caso começou e onde o animal foi visto por último. */
export function caseScore(c: any, probe: any) {
  const a = matchScore({ ...c, lat: c.publicLat, lng: c.publicLng }, probe);
  if (c.lastLat == null || c.lastLng == null) return a;
  const b = matchScore({ ...c, lat: c.lastLat, lng: c.lastLng, happenedAt: c.lastSeenAt || c.happenedAt }, probe);
  return Math.max(a, b);
}

function photoUrls(r: any) {
  return Array.from({ length: r.photos || 0 }, (_, i) => `/api/lostfound/${r.id}/photos/${i}`);
}

function publicView(r: any, opts: { viewerId?: string | null; from?: { lat: number; lng: number } | null; withContact?: boolean } = {}) {
  const now = Date.now();
  const status = r.status === 'ACTIVE' && new Date(r.expiresAt).getTime() < now ? 'EXPIRED' : r.status;
  const mine = !!opts.viewerId && opts.viewerId === r.userId;
  return {
    id: r.id,
    type: r.type,
    status,
    species: r.species,
    petName: r.petName,
    sex: r.sex,
    size: r.size,
    colors: r.colors,
    breed: r.breed,
    hasCollar: r.hasCollar,
    description: r.description,
    currentlyWith: r.currentlyWith,
    lat: mine ? r.lat : r.publicLat,
    lng: mine ? r.lng : r.publicLng,
    approximate: mine ? false : r.approximate,
    locationNote: r.locationNote,
    district: r.district,
    city: r.city,
    happenedAt: r.happenedAt,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    resolvedAt: r.resolvedAt,
    photos: photoUrls(r),
    distanceKm: opts.from
      ? Math.round(haversineKm(opts.from.lat, opts.from.lng, r.lastLat ?? r.publicLat, r.lastLng ?? r.publicLng) * 10) / 10
      : undefined,
    author: r.userName ? String(r.userName).split(' ')[0] : undefined,
    whatsapp: opts.withContact && r.whatsapp ? r.whatsapp : undefined,
    hasWhatsapp: !!r.whatsapp,
    mine,
    views: mine ? r.views : undefined,
    sightings: Number(r.sightings || 0),
    lastSeen:
      r.lastLat != null && r.lastLng != null
        ? { lat: r.lastLat, lng: r.lastLng, at: r.lastSeenAt, kind: r.lastKind || 'SEEN' }
        : null,
  };
}

function sightingView(s: any, viewerId: string | null, caseOwnerId: string) {
  return {
    id: s.id,
    kind: s.kind,
    author: s.userName ? String(s.userName).split(' ')[0] : undefined,
    happenedAt: s.happenedAt,
    createdAt: s.createdAt,
    lat: s.userId === viewerId ? s.lat : s.publicLat,
    lng: s.userId === viewerId ? s.lng : s.publicLng,
    approximate: s.userId === viewerId ? false : s.approximate,
    locationNote: s.locationNote,
    district: s.district,
    note: s.note,
    photo: `/api/lostfound/${s.reportId}/sightings/${s.id}/photo`,
    mine: !!viewerId && s.userId === viewerId,
    canRemove: !!viewerId && (s.userId === viewerId || caseOwnerId === viewerId),
  };
}

/** Quem acompanha o caso: autor (a menos que tenha deixado de acompanhar) + quem segue. */
export async function caseFollowers(db: any, r: { id: string; userId: string }) {
  const rows: any[] = await db.$queryRawUnsafe(`SELECT "userId", active FROM lf_follows WHERE "reportId" = $1`, r.id);
  const out = new Set<string>(rows.filter((x) => x.active).map((x) => String(x.userId)));
  if (!rows.some((x) => x.userId === r.userId && !x.active)) out.add(r.userId);
  return out;
}

/** Comentou ou registrou avistamento: passa a acompanhar (se não tinha saído antes). */
async function autoFollow(db: any, reportId: string, userId: string) {
  await db.$executeRawUnsafe(
    `INSERT INTO lf_follows ("reportId", "userId", active) VALUES ($1, $2, true) ON CONFLICT DO NOTHING`,
    reportId,
    userId,
  );
}

/** Push para quem acompanha, sem repetir para a mesma pessoa no mesmo caso em menos de 10 min. */
async function pushFollowers(db: any, reportId: string, userIds: string[], title: string, message: string, data: Record<string, string>) {
  if (!userIds.length) return 0;
  const recent: any[] = await db.$queryRawUnsafe(
    `SELECT DISTINCT "userId" FROM notifications
      WHERE "userId" = ANY($1::text[]) AND data->>'caseId' = $2 AND "sentAt" > NOW() - ($3 || ' milliseconds')::interval`,
    userIds,
    reportId,
    String(PUSH_QUIET_MS),
  );
  const quiet = new Set(recent.map((x) => String(x.userId)));
  const to = userIds.filter((u) => !quiet.has(u));
  await push(db, to, title, message, { ...data, caseId: reportId });
  return to.length;
}

const SCAM_RE =
  /\b(pix|chave\s*pix|transfer[eê]ncia|transferir|dep[oó]sito|depositar|boleto|pagar\s+(?:a|uma)\s+taxa|taxa\s+de\s+(?:resgate|entrega|devolu[cç][aã]o)|recompensa\s+adiantad|adiantad[oa]\s+(?:o|a)\s+recompensa|cart[aã]o\s+de\s+cr[eé]dito)\b/i;
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|br|io|me|ly|app|xyz|site|link)(?:\/|\b))/i;

/** Confere o texto do comentário: bloqueia golpe/links e esconde telefone e e-mail. */
export function cleanComment(raw: any): { text?: string; error?: string; code?: string; masked?: boolean } {
  const text = String(raw || '').replace(/\s+\n/g, '\n').trim();
  if (text.length < 2) return { error: 'Escreva o comentário' };
  if (text.length > COMMENT_MAX) return { error: `Máximo de ${COMMENT_MAX} caracteres` };
  if (SCAM_RE.test(text)) {
    return {
      error: 'Por segurança, não é permitido falar de PIX, depósito, taxa ou recompensa adiantada. Nunca pague para "liberar" um animal.',
      code: 'SCAM_BLOCKED',
    };
  }
  let masked = false;
  const noEmail = text.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, () => {
    masked = true;
    return '[e-mail escondido]';
  });
  if (LINK_RE.test(noEmail)) return { error: 'Links não são permitidos no mural.', code: 'LINK_BLOCKED' };
  const out = noEmail
    .replace(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[\s.-]?\d{4}/g, (m) => {
      if (m.replace(/\D/g, '').length < 8) return m;
      masked = true;
      return '[telefone escondido]';
    });
  return { text: out, masked };
}

function commentView(c: any, viewerId: string | null, caseOwnerId: string) {
  const mine = !!viewerId && c.userId === viewerId;
  return {
    id: c.id,
    parentId: c.parentId || null,
    author: c.userName ? String(c.userName).split(' ')[0] : 'Alguém',
    isCaseAuthor: c.userId === caseOwnerId,
    body: c.body,
    photo: c.mime ? `/api/lostfound/${c.reportId}/comments/${c.id}/photo` : null,
    createdAt: c.createdAt,
    mine,
    canHide: !mine && !!viewerId && viewerId === caseOwnerId,
    canDelete: mine,
  };
}

// ---------------------------------------------------------------- unificação

/** Qual caso fica: o "perdido" (é do tutor) ou, sem perdido, o mais antigo. */
export function pickSurvivor(a: any, b: any) {
  if (a.type === 'LOST' && b.type !== 'LOST') return { target: a, source: b };
  if (b.type === 'LOST' && a.type !== 'LOST') return { target: b, source: a };
  return new Date(a.createdAt).getTime() <= new Date(b.createdAt).getTime() ? { target: a, source: b } : { target: b, source: a };
}

/** Quem precisa confirmar: só o tutor (quando um dos casos é "perdido") ou os dois autores. */
export function mergeRule(source: any, target: any) {
  const lost = [source, target].filter((x) => x.type === 'LOST');
  if (lost.length === 1) return { needs: 'TUTOR' as const, tutorId: lost[0].userId as string };
  return { needs: 'BOTH' as const, tutorId: null as string | null };
}

function mergeReady(m: any, source: any, target: any) {
  if (m.needs === 'TUTOR') return target.type === 'LOST' ? m.targetOk : m.sourceOk;
  if (source.userId === target.userId) return m.sourceOk || m.targetOk;
  return m.sourceOk && m.targetOk;
}

/** Marca a confirmação de quem é autor de um dos casos (o tutor, na regra TUTOR). */
function applyConfirm(m: any, source: any, target: any, userId: string) {
  const out = { sourceOk: !!m.sourceOk, targetOk: !!m.targetOk, counted: false };
  if (m.needs === 'TUTOR') {
    const lost = target.type === 'LOST' ? target : source;
    if (lost.userId !== userId) return out;
    if (lost === target) out.targetOk = true;
    else out.sourceOk = true;
    out.counted = true;
    return out;
  }
  if (source.userId === userId) {
    out.sourceOk = true;
    out.counted = true;
  }
  if (target.userId === userId) {
    out.targetOk = true;
    out.counted = true;
  }
  return out;
}

/** Junta o caso source no target: vira registro na linha do tempo e leva tudo junto. */
async function doMerge(db: any, mergeId: string, source: any, target: any, decidedBy: string) {
  const ph: any[] = await db.$queryRawUnsafe(`SELECT mime, data FROM lf_photos WHERE "reportId" = $1 ORDER BY position LIMIT 1`, source.id);
  if (ph[0]) {
    const kind = source.type === 'FOUND' ? (source.currentlyWith === 'CLINICA' ? 'CLINIC' : source.currentlyWith === 'SOLTO' ? 'SEEN' : 'WITH_ME') : 'SEEN';
    await db.$executeRawUnsafe(
      `INSERT INTO lf_sightings (id, "reportId", "userId", kind, lat, lng, "publicLat", "publicLng", "approximate", "locationNote", district, note, "happenedAt", mime, photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      crypto.randomUUID(), target.id, source.userId, kind, source.lat, source.lng, source.publicLat, source.publicLng, !!source.approximate,
      source.locationNote, source.district, String(source.description || '').slice(0, 300) || null, source.happenedAt, ph[0].mime, ph[0].data,
    );
  }
  await db.$executeRawUnsafe(`UPDATE lf_sightings SET "reportId" = $2 WHERE "reportId" = $1`, source.id, target.id);
  await db.$executeRawUnsafe(`UPDATE lf_comments SET "reportId" = $2 WHERE "reportId" = $1`, source.id, target.id);
  await db.$executeRawUnsafe(
    `INSERT INTO lf_follows ("reportId", "userId", active)
     SELECT $2, "userId", active FROM lf_follows WHERE "reportId" = $1 ON CONFLICT DO NOTHING`,
    source.id, target.id,
  );
  await autoFollow(db, target.id, source.userId);
  await db.$executeRawUnsafe(
    `UPDATE lf_reports SET status = 'MERGED', "mergedInto" = $2, "updatedAt" = NOW() WHERE id = $1`,
    source.id, target.id,
  );
  // Links e sugestões antigas que apontavam para o caso que saiu passam a apontar para o que ficou
  await db.$executeRawUnsafe(`UPDATE lf_reports SET "mergedInto" = $2 WHERE "mergedInto" = $1`, source.id, target.id);
  await db.$executeRawUnsafe(
    `UPDATE lf_merges SET status = 'CANCELLED', "decidedAt" = NOW() WHERE status = 'PENDING' AND id <> $1 AND ("sourceId" = $2 OR "targetId" = $2)`,
    mergeId, source.id,
  );
  await db.$executeRawUnsafe(
    `UPDATE lf_merges SET status = 'CONFIRMED', "decidedBy" = $2, "decidedAt" = NOW(), "sourceOk" = true, "targetOk" = true WHERE id = $1`,
    mergeId, decidedBy,
  );
  await refreshCaseLast(db, target.id);
  await db.$executeRawUnsafe(
    `UPDATE lf_reports SET "expiresAt" = GREATEST("expiresAt", NOW() + INTERVAL '${ACTIVE_DAYS} days') WHERE id = $1`,
    target.id,
  );
  const name = target.type === 'LOST' && target.petName ? target.petName : `o ${SPECIES_LABEL[target.species].toLowerCase()} ${target.colors}`;
  const to = [...(await caseFollowers(db, target))].filter((u) => u !== decidedBy);
  await push(db, to, `🔗 Casos unificados`, `Tudo sobre ${name} agora está num lugar só: fotos, trajeto e conversa.`, {
    screen: 'LostFoundDetail', id: String(target.id), caseId: String(target.id),
  });
}

async function loadCase(db: any, id: string) {
  const rows: any[] = await db.$queryRawUnsafe(`SELECT r.*, u.name AS "userName" FROM lf_reports r JOIN users u ON u.id = r."userId" WHERE r.id = $1`, id);
  return rows[0] || null;
}

/** Cria a sugestão (ou devolve a que já existe) e avisa quem precisa confirmar. */
export async function suggestMerge(db: any, a: any, b: any, opts: { suggestedBy: string | null; auto?: boolean; note?: string | null }) {
  const { target, source } = pickSurvivor(a, b);
  const rule = mergeRule(source, target);
  const dup: any[] = await db.$queryRawUnsafe(
    `SELECT * FROM lf_merges WHERE status IN ('PENDING','REJECTED') AND (("sourceId" = $1 AND "targetId" = $2) OR ("sourceId" = $2 AND "targetId" = $1))
      ORDER BY "createdAt" DESC LIMIT 1`,
    source.id, target.id,
  );
  if (dup[0]) return { merge: dup[0], source, target, existed: true };
  const id = crypto.randomUUID();
  await db.$executeRawUnsafe(
    `INSERT INTO lf_merges (id, "sourceId", "targetId", "suggestedBy", auto, note, needs) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    id, source.id, target.id, opts.suggestedBy, !!opts.auto, opts.note || null, rule.needs,
  );
  const m: any[] = await db.$queryRawUnsafe(`SELECT * FROM lf_merges WHERE id = $1`, id);
  const confirmers = rule.needs === 'TUTOR' ? [rule.tutorId!] : [...new Set([source.userId, target.userId])];
  let to = confirmers.filter((u) => u && u !== opts.suggestedBy);
  if (opts.auto) {
    // Quem já recebeu "Pode ser o seu pet?" deste aviso não recebe outro push: o pedido aparece no caso
    const got: any[] = await db.$queryRawUnsafe(
      `SELECT DISTINCT "userId" FROM lf_alerts_sent WHERE "reportId" = ANY($1::text[]) AND reason = 'MATCH'`,
      [source.id, target.id],
    );
    const already = new Set(got.map((g) => String(g.userId)));
    to = to.filter((u) => !already.has(u));
  }
  const name = target.type === 'LOST' && target.petName ? target.petName : `${SPECIES_LABEL[target.species].toLowerCase()} ${target.colors}`;
  await push(db, to, '🔗 Pode ser o mesmo animal?', `${opts.auto ? 'Achamos' : 'Alguém achou'} outro aviso muito parecido com o de ${name}. Confira as fotos e confirme.`, {
    screen: 'LostFoundDetail', id: String(target.id),
  });
  return { merge: m[0], source, target, existed: false };
}

function mergeView(m: any, source: any, target: any, viewerId: string | null, isAdmin = false) {
  const can = isAdmin || (!!viewerId && applyConfirm(m, source, target, viewerId).counted);
  const waitingFor =
    m.needs === 'TUTOR'
      ? 'o tutor do animal perdido'
      : source.userId === target.userId
      ? 'quem publicou'
      : !m.sourceOk && !m.targetOk
      ? 'os dois autores'
      : 'o outro autor';
  return {
    id: m.id,
    status: m.status,
    auto: m.auto,
    note: m.note,
    needs: m.needs,
    createdAt: m.createdAt,
    canConfirm: can && m.status === 'PENDING',
    waitingFor,
    source: publicView(source, { viewerId }),
    target: publicView(target, { viewerId }),
  };
}

/** Recalcula "visto por último" e o total de avistamentos visíveis do caso. */
async function refreshCaseLast(db: any, reportId: string) {
  await db.$executeRawUnsafe(
    `UPDATE lf_reports r SET
        sightings = (SELECT COUNT(*)::int FROM lf_sightings s WHERE s."reportId" = r.id AND s.hidden = false),
        "lastLat" = l."publicLat", "lastLng" = l."publicLng", "lastSeenAt" = l."happenedAt", "lastKind" = l.kind,
        "updatedAt" = NOW()
       FROM (SELECT $1::text AS rid) x
       LEFT JOIN LATERAL (
         SELECT "publicLat", "publicLng", "happenedAt", kind FROM lf_sightings
          WHERE "reportId" = x.rid AND hidden = false ORDER BY "happenedAt" DESC, "createdAt" DESC LIMIT 1
       ) l ON true
      WHERE r.id = x.rid`,
    reportId,
  );
}

function parseFields(body: any, partial = false) {
  const out: any = {};
  const has = (k: string) => body[k] !== undefined;
  if (!partial || has('type')) {
    const type = String(body.type || '').toUpperCase();
    if (!(LF_TYPES as readonly string[]).includes(type)) throw new HttpError(400, 'Escolha: perdi, encontrei ou vi solto');
    out.type = type;
  }
  if (!partial || has('species')) {
    const sp = String(body.species || '').toUpperCase();
    if (!(LF_SPECIES as readonly string[]).includes(sp)) throw new HttpError(400, 'Escolha a espécie');
    out.species = sp;
  }
  if (!partial || has('lat') || has('lng')) {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
      throw new HttpError(400, 'Marque no mapa o local exato', 'LOCATION_REQUIRED');
    }
    out.lat = Math.round(lat * 1e6) / 1e6;
    out.lng = Math.round(lng * 1e6) / 1e6;
  }
  if (!partial || has('happenedAt')) {
    const d = body.happenedAt ? new Date(body.happenedAt) : new Date();
    if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Data inválida');
    if (d.getTime() > Date.now() + 10 * 60e3) throw new HttpError(400, 'A data não pode ser no futuro');
    if (d.getTime() < Date.now() - 180 * 864e5) throw new HttpError(400, 'Avisos de até 6 meses atrás');
    out.happenedAt = d;
  }
  if (!partial || has('colors')) {
    const c = String(body.colors || '').trim().slice(0, 60);
    if (c.length < 3) throw new HttpError(400, 'Informe a(s) cor(es) do animal');
    out.colors = c;
  }
  const txt = (k: string, max: number) => {
    if (!partial || has(k)) out[k] = String(body[k] || '').trim().slice(0, max) || null;
  };
  txt('petName', 40);
  txt('breed', 40);
  txt('description', 600);
  txt('locationNote', 120);
  txt('district', 60);
  txt('city', 60);
  if (!partial || has('sex')) out.sex = ['MACHO', 'FEMEA', 'NAO_SEI'].includes(String(body.sex || '').toUpperCase()) ? String(body.sex).toUpperCase() : 'NAO_SEI';
  if (!partial || has('size')) out.size = SIZES.includes(String(body.size || '').toUpperCase()) ? String(body.size).toUpperCase() : null;
  if (!partial || has('hasCollar')) out.hasCollar = body.hasCollar === undefined || body.hasCollar === null ? null : !!body.hasCollar;
  if (!partial || has('currentlyWith')) out.currentlyWith = WITH.includes(String(body.currentlyWith || '').toUpperCase()) ? String(body.currentlyWith).toUpperCase() : null;
  return out;
}

async function push(db: any, userIds: string[], title: string, message: string, data: Record<string, string>) {
  if (!userIds.length) return;
  try {
    for (const uid of userIds) {
      await db.$executeRawUnsafe(
        `INSERT INTO notifications (id, "userId", title, message, type, data, "isRead", "sentAt")
         VALUES ($1, $2, $3, $4, 'GENERAL'::"NotificationType", $5::jsonb, false, NOW())`,
        crypto.randomUUID(), uid, title, message, JSON.stringify(data),
      );
    }
    const tokens: any[] = await db.$queryRawUnsafe(
      `SELECT token FROM device_tokens WHERE "userId" = ANY($1::text[]) AND "isActive" = true AND platform <> 'android-partner'`,
      userIds,
    );
    if (tokens.length) await sendFcmToTokens(tokens.map((t) => t.token), { title, body: message, data });
  } catch (e: any) {
    console.warn('⚠️ Alerta de achados e perdidos falhou:', e?.message);
  }
}

const SPECIES_LABEL: Record<string, string> = { DOG: 'Cachorro', CAT: 'Gato', OTHER: 'Animal' };
const TYPE_LABEL: Record<string, string> = { LOST: 'perdido', FOUND: 'encontrado', SIGHTED: 'visto solto' };

/** Avisa quem está perto (preferências) e os donos de "perdi" com aviso parecido por perto. */
export async function sendNearbyAlerts(db: any, r: any) {
  const pLat = Number(r.publicLat);
  const pLng = Number(r.publicLng);
  const sent = new Set<string>([r.userId]);
  // 1) Donos de "perdi" ativos, mesma espécie, perto (para avisos de encontrado/visto)
  if (r.type !== 'LOST') {
    const lost: any[] = await db.$queryRawUnsafe(
      `SELECT * FROM lf_reports WHERE type = 'LOST' AND status = 'ACTIVE' AND hidden = false AND "expiresAt" > NOW()
         AND species = $1 AND "userId" <> $2 AND ${distSql('lat', 'lng', '$3', '$4')} <= ${MATCH_RADIUS_KM}`,
      r.species, r.userId, pLat, pLng,
    );
    for (const l of lost) {
      const score = matchScore(l, { ...r, lat: pLat, lng: pLng });
      if (score < 35 || sent.has(l.userId)) continue;
      sent.add(l.userId);
      await db.$executeRawUnsafe(`INSERT INTO lf_alerts_sent ("reportId", "userId", reason) VALUES ($1, $2, 'MATCH') ON CONFLICT DO NOTHING`, r.id, l.userId);
      await push(
        db,
        [l.userId],
        `🐾 Pode ser ${l.petName || 'o seu pet'}?`,
        `${SPECIES_LABEL[r.species]} ${TYPE_LABEL[r.type]} a ${haversineKm(l.lat, l.lng, pLat, pLng).toFixed(1).replace('.', ',')} km de onde você perdeu. Veja a foto.`,
        { screen: 'LostFoundDetail', id: String(r.id) },
      );
    }
  }
  // 2) Quem ativou alertas por perto
  const prefCol = r.type === 'LOST' ? '"notifyLost"' : '"notifyFound"';
  const prefs: any[] = await db.$queryRawUnsafe(
    `SELECT "userId" FROM lf_alert_prefs
      WHERE enabled = true AND ${prefCol} = true AND (species = 'ALL' OR species = $1) AND "userId" <> $2
        AND ${distSql('lat', 'lng', '$3', '$4')} <= "radiusKm"
      LIMIT ${MAX_ALERT_PUSH}`,
    r.species, r.userId, pLat, pLng,
  );
  const ids = prefs.map((p) => p.userId).filter((u) => !sent.has(u));
  for (const u of ids) {
    await db.$executeRawUnsafe(`INSERT INTO lf_alerts_sent ("reportId", "userId", reason) VALUES ($1, $2, 'NEARBY') ON CONFLICT DO NOTHING`, r.id, u);
  }
  const place = r.district || r.locationNote || 'perto de você';
  await push(
    db,
    ids,
    r.type === 'LOST' ? `🔎 ${SPECIES_LABEL[r.species]} perdido perto de você` : `📍 ${SPECIES_LABEL[r.species]} ${TYPE_LABEL[r.type]} perto de você`,
    `${r.colors}${r.size ? `, porte ${String(r.size).toLowerCase().replace('medio', 'médio')}` : ''} · ${place}. Toque para ver no mapa.`,
    { screen: 'LostFoundDetail', id: String(r.id) },
  );
  return { matched: sent.size - 1, nearby: ids.length };
}

function optionalUser(ctx: Ctx): string | null {
  const h = ctx.req?.headers?.authorization || ctx.req?.headers?.Authorization;
  if (!h) return null;
  try {
    return ctx.authUser().userId;
  } catch {
    return null;
  }
}

function esc(s: any) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
}

export function renderSharePage(r: any, base: string) {
  const v = publicView(r);
  const title = `${v.type === 'LOST' ? 'PERDIDO' : v.type === 'FOUND' ? 'ENCONTRADO' : 'VISTO SOLTO'}: ${SPECIES_LABEL[v.species]}${v.petName ? ` ${v.petName}` : ''} · ${v.colors}`;
  const when = new Date(v.happenedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const img = v.photos[0] ? `${base}${v.photos[0]}` : '';
  const map = `https://www.openstreetmap.org/?mlat=${v.lat}&mlon=${v.lng}#map=17/${v.lat}/${v.lng}`;
  const closed = v.status !== 'ACTIVE';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(`${when} · ${v.district || v.locationNote || v.city || ''} · Liga do Bem`)}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ''}
<style>body{font-family:system-ui,sans-serif;margin:0;background:#F9FAFB;color:#1F2937}main{max-width:560px;margin:0 auto;padding:16px}
img{width:100%;border-radius:16px;max-height:420px;object-fit:cover;background:#E5E7EB}.tag{display:inline-block;padding:4px 10px;border-radius:999px;font-weight:800;font-size:13px;color:#fff;background:${v.type === 'LOST' ? '#DC2626' : v.type === 'FOUND' ? '#059669' : '#D97706'}}
h1{font-size:22px;margin:12px 0 4px}p{line-height:1.5}a.btn{display:block;text-align:center;background:#7C3AED;color:#fff;padding:14px;border-radius:12px;text-decoration:none;font-weight:700;margin-top:12px}
.warn{background:#FEF3C7;border-radius:12px;padding:10px;font-size:14px}.closed{background:#DCFCE7;border-radius:12px;padding:10px;font-weight:700}</style></head>
<body><main>${img ? `<img src="${esc(img)}" alt="Foto do animal">` : ''}
<p><span class="tag">${v.type === 'LOST' ? 'PERDIDO' : v.type === 'FOUND' ? 'ENCONTRADO' : 'VISTO SOLTO'}</span></p>
${closed ? `<p class="closed">${v.status === 'RESOLVED' ? '✅ Este animal já voltou para casa!' : 'Este aviso não está mais ativo.'}</p>` : ''}
<h1>${esc(SPECIES_LABEL[v.species])}${v.petName ? ` · ${esc(v.petName)}` : ''}</h1>
<p><b>Cor:</b> ${esc(v.colors)}${v.size ? ` · <b>Porte:</b> ${esc(v.size.toLowerCase())}` : ''}${v.breed ? ` · <b>Raça:</b> ${esc(v.breed)}` : ''}${v.hasCollar ? ' · com coleira' : ''}</p>
<p><b>Quando:</b> ${esc(when)}<br><b>Onde:</b> ${esc([v.locationNote, v.district, v.city].filter(Boolean).join(' · ') || 'veja no mapa')}${v.approximate ? ' (região aproximada)' : ''}</p>
${v.description ? `<p>${esc(v.description)}</p>` : ''}
<a class="btn" href="${esc(map)}">Ver no mapa</a>
<p class="warn">⚠️ Nunca faça PIX ou pagamento para "liberar" ou "devolver" um animal. Desconfie de quem pede dinheiro.</p>
<p style="font-size:13px;color:#6B7280">Publicado no app Liga do Bem, achados e perdidos. Baixe o app para ver o contato e receber alertas de animais perto de você.</p>
</main></body></html>`;
}

// ---------------------------------------------------------------- roteador

export function isLostFoundPath(path: string) {
  return (
    path === '/api/lostfound' ||
    path.startsWith('/api/lostfound/') ||
    path.startsWith('/api/public/lostfound/') ||
    path === '/api/admin/lostfound' ||
    path.startsWith('/api/admin/lostfound/') ||
    path === '/api/cron/lostfound'
  );
}

export async function handleLostFound(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db } = ctx;
  if (!isLostFoundPath(path)) return false;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
  const q = ctx.req?.query || {};
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }
  try {
    await ensureLostFoundSchema(db);

    if (path === '/api/cron/lostfound' && (method === 'GET' || method === 'POST')) {
      const n = await db.$executeRawUnsafe(`UPDATE lf_reports SET status = 'EXPIRED', "updatedAt" = NOW() WHERE status = 'ACTIVE' AND "expiresAt" < NOW()`);
      res.status(200).json({ expired: n });
      return true;
    }

    // ---------- página pública para compartilhar (Facebook/WhatsApp)
    const sm = path.match(/^\/api\/public\/lostfound\/([^/]+)$/);
    if (sm && method === 'GET') {
      let rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM lf_reports WHERE id = $1 AND hidden = false AND status <> 'REMOVED'`, sm[1]);
      if (rows[0]?.status === 'MERGED' && rows[0].mergedInto) {
        rows = await db.$queryRawUnsafe(`SELECT * FROM lf_reports WHERE id = $1 AND hidden = false AND status <> 'REMOVED'`, rows[0].mergedInto);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=120');
      if (!rows[0]) {
        res.status(404).end('<!doctype html><meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">Aviso não encontrado.</p>');
        return true;
      }
      const host = ctx.req?.headers?.host;
      const base = process.env.PUBLIC_API_URL || (host ? `https://${host}` : 'https://nova-versao-liga-do-bem.vercel.app');
      res.status(200).end(renderSharePage(rows[0], base.replace(/\/$/, '')));
      return true;
    }

    // ---------- fotos (públicas)
    const ph = path.match(/^\/api\/lostfound\/([^/]+)\/photos\/(\d)$/);
    if (ph && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT p.mime, p.data FROM lf_photos p JOIN lf_reports r ON r.id = p."reportId"
          WHERE p."reportId" = $1 AND p.position = $2 AND r.hidden = false AND r.status <> 'REMOVED'`,
        ph[1],
        Number(ph[2]),
      );
      if (!rows[0]) throw new HttpError(404, 'Foto não encontrada');
      res.setHeader('Content-Type', rows[0].mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).end(Buffer.from(rows[0].data));
      return true;
    }

    // ---------- foto de um avistamento (pública, como as do aviso)
    const sp = path.match(/^\/api\/lostfound\/([^/]+)\/sightings\/([^/]+)\/photo$/);
    if (sp && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT s.mime, s.photo FROM lf_sightings s JOIN lf_reports r ON r.id = s."reportId"
          WHERE s.id = $2 AND s."reportId" = $1 AND s.hidden = false AND r.hidden = false AND r.status <> 'REMOVED'`,
        sp[1],
        sp[2],
      );
      if (!rows[0]) throw new HttpError(404, 'Foto não encontrada');
      res.setHeader('Content-Type', rows[0].mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).end(Buffer.from(rows[0].photo));
      return true;
    }

    // ---------- foto de um comentário
    const cp = path.match(/^\/api\/lostfound\/([^/]+)\/comments\/([^/]+)\/photo$/);
    if (cp && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT c.mime, c.photo FROM lf_comments c JOIN lf_reports r ON r.id = c."reportId"
          WHERE c.id = $2 AND c."reportId" = $1 AND c.hidden = false AND c.photo IS NOT NULL AND r.hidden = false AND r.status <> 'REMOVED'`,
        cp[1],
        cp[2],
      );
      if (!rows[0]) throw new HttpError(404, 'Foto não encontrada');
      res.setHeader('Content-Type', rows[0].mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.status(200).end(Buffer.from(rows[0].photo));
      return true;
    }

    // ---------- lista / mapa (público; contato só logado)
    if (path === '/api/lostfound' && method === 'GET') {
      const viewer = optionalUser(ctx);
      const lat = Number(q.lat);
      const lng = Number(q.lng);
      const from = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) ? { lat, lng } : null;
      const radius = Math.min(50, Math.max(0.5, Number(q.radiusKm) || 15));
      const days = Math.min(180, Math.max(1, Number(q.days) || 30));
      const where = [`r.status = 'ACTIVE'`, `r.hidden = false`, `r."expiresAt" > NOW()`, `r."createdAt" > NOW() - ($1 || ' days')::interval`];
      const params: any[] = [String(days)];
      const type = String(q.type || '').toUpperCase();
      if ((LF_TYPES as readonly string[]).includes(type)) {
        params.push(type);
        where.push(`r.type = $${params.length}`);
      }
      const species = String(q.species || '').toUpperCase();
      if ((LF_SPECIES as readonly string[]).includes(species)) {
        params.push(species);
        where.push(`r.species = $${params.length}`);
      }
      if (from) {
        params.push(from.lat, from.lng);
        const pa = `$${params.length - 1}`;
        const pb = `$${params.length}`;
        where.push(
          `(${distSql('r."publicLat"', 'r."publicLng"', pa, pb)} <= ${radius} OR (r."lastLat" IS NOT NULL AND ${distSql('r."lastLat"', 'r."lastLng"', pa, pb)} <= ${radius}))`,
        );
      }
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT r.*, u.name AS "userName" FROM lf_reports r JOIN users u ON u.id = r."userId" WHERE ${where.join(' AND ')}
          ORDER BY r."createdAt" DESC LIMIT 300`,
        ...params,
      );
      const list = rows.map((r) => publicView(r, { viewerId: viewer, from }));
      if (from) list.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
      const counts = { LOST: 0, FOUND: 0, SIGHTED: 0 } as Record<string, number>;
      for (const r of list) counts[r.type]++;
      const resolved: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM lf_reports WHERE status = 'RESOLVED'`);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({ reports: list, counts, reunited: resolved[0]?.n || 0, radiusKm: from ? radius : null });
      return true;
    }

    // ---------- admin
    if (path === '/api/admin/lostfound' || path.startsWith('/api/admin/lostfound/')) {
      if (!ctx.isAdmin) throw new HttpError(403, 'Acesso restrito');
      if (path === '/api/admin/lostfound' && method === 'GET') {
        const flagged = q.flagged === '1';
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT r.*, u.name AS "userName", u.email AS "userEmail",
                  (SELECT COUNT(*)::int FROM lf_flags f WHERE f."reportId" = r.id) AS flags,
                  (SELECT string_agg(f.reason, ' | ') FROM lf_flags f WHERE f."reportId" = r.id) AS "flagReasons"
             FROM lf_reports r JOIN users u ON u.id = r."userId"
            ${flagged ? `WHERE r.hidden = true OR EXISTS (SELECT 1 FROM lf_flags f WHERE f."reportId" = r.id)` : ''}
            ORDER BY r.hidden DESC, r."createdAt" DESC LIMIT 200`,
        );
        const stats: any[] = await db.$queryRawUnsafe(
          `SELECT type, status, COUNT(*)::int AS n FROM lf_reports GROUP BY type, status`,
        );
        res.status(200).json({
          reports: rows.map((r) => ({ ...publicView(r, { withContact: true }), hidden: r.hidden, hiddenReason: r.hiddenReason, flags: r.flags, flagReasons: r.flagReasons, userEmail: r.userEmail, author: r.userName })),
          stats,
        });
        return true;
      }
      if (path === '/api/admin/lostfound/comments' && method === 'GET') {
        const rows: any[] = await db.$queryRawUnsafe(
          `SELECT c.id, c."reportId", c."userId", c."parentId", c.body, c.mime, c.hidden, c."hiddenBy", c."createdAt",
                  u.name AS "userName", u.email AS "userEmail", r."petName", r.species, r.colors, r.type,
                  (SELECT COUNT(*)::int FROM lf_comment_flags f WHERE f."commentId" = c.id) AS flags,
                  (SELECT string_agg(f.reason, ' | ') FROM lf_comment_flags f WHERE f."commentId" = c.id) AS "flagReasons"
             FROM lf_comments c JOIN users u ON u.id = c."userId" JOIN lf_reports r ON r.id = c."reportId"
            WHERE EXISTS (SELECT 1 FROM lf_comment_flags f WHERE f."commentId" = c.id) OR c."hiddenBy" = 'FLAGS'
            ORDER BY c.hidden DESC, c."createdAt" DESC LIMIT 200`,
        );
        res.status(200).json({
          comments: rows.map((c) => ({
            id: c.id, reportId: c.reportId, body: c.body, hasPhoto: !!c.mime, hidden: c.hidden, hiddenBy: c.hiddenBy, createdAt: c.createdAt,
            author: c.userName, userEmail: c.userEmail, flags: c.flags, flagReasons: c.flagReasons,
            caseTitle: `${SPECIES_LABEL[c.species] || 'Animal'}${c.petName ? ` ${c.petName}` : ''} · ${c.colors}`, caseType: c.type,
          })),
        });
        return true;
      }
      const acm = path.match(/^\/api\/admin\/lostfound\/comments\/([^/]+)\/(hide|show)$/);
      if (acm && method === 'POST') {
        const hide = acm[2] === 'hide';
        const n = await db.$executeRawUnsafe(`UPDATE lf_comments SET hidden = $2, "hiddenBy" = $3 WHERE id = $1`, acm[1], hide, hide ? 'ADMIN' : null);
        if (!n) throw new HttpError(404, 'Comentário não encontrado');
        if (!hide) await db.$executeRawUnsafe(`DELETE FROM lf_comment_flags WHERE "commentId" = $1`, acm[1]);
        res.status(200).json({ message: hide ? 'Comentário escondido' : 'Comentário visível de novo' });
        return true;
      }
      if (path === '/api/admin/lostfound/merges' && method === 'GET') {
        const ms: any[] = await db.$queryRawUnsafe(`SELECT * FROM lf_merges WHERE status = 'PENDING' ORDER BY "createdAt" DESC LIMIT 100`);
        const out = [];
        for (const m of ms) {
          const source = await loadCase(db, m.sourceId);
          const target = await loadCase(db, m.targetId);
          if (source && target) out.push({ ...mergeView(m, source, target, null, true), sourceAuthor: source.userName, targetAuthor: target.userName });
        }
        res.status(200).json({ merges: out });
        return true;
      }
      const amm = path.match(/^\/api\/admin\/lostfound\/merges\/([^/]+)\/(confirm|reject)$/);
      if (amm && method === 'POST') {
        const ms: any[] = await db.$queryRawUnsafe(`SELECT * FROM lf_merges WHERE id = $1`, amm[1]);
        const m = ms[0];
        if (!m || m.status !== 'PENDING') throw new HttpError(404, 'Sugestão não encontrada ou já decidida');
        const source = await loadCase(db, m.sourceId);
        const target = await loadCase(db, m.targetId);
        if (!source || !target) throw new HttpError(404, 'Caso não encontrado');
        let adminId = 'admin';
        try {
          adminId = ctx.authUser().userId;
        } catch {
          /* token do admin sem userId */
        }
        if (amm[2] === 'reject') {
          await db.$executeRawUnsafe(`UPDATE lf_merges SET status = 'REJECTED', "decidedBy" = $2, "decidedAt" = NOW() WHERE id = $1`, m.id, adminId);
          res.status(200).json({ message: 'Sugestão recusada' });
          return true;
        }
        if (source.status !== 'ACTIVE' || target.status !== 'ACTIVE') throw new HttpError(409, 'Um dos casos não está mais ativo');
        await doMerge(db, m.id, source, target, adminId);
        res.status(200).json({ message: 'Casos unificados', targetId: target.id });
        return true;
      }
      const am = path.match(/^\/api\/admin\/lostfound\/([^/]+)\/(hide|show)$/);
      if (am && method === 'POST') {
        const hide = am[2] === 'hide';
        const n = await db.$executeRawUnsafe(
          `UPDATE lf_reports SET hidden = $2, "hiddenReason" = $3, "updatedAt" = NOW() WHERE id = $1`,
          am[1], hide, hide ? String(body.reason || 'Removido pela Liga').slice(0, 200) : null,
        );
        if (!n) throw new HttpError(404, 'Aviso não encontrado');
        if (!hide) await db.$executeRawUnsafe(`DELETE FROM lf_flags WHERE "reportId" = $1`, am[1]);
        res.status(200).json({ message: hide ? 'Aviso escondido' : 'Aviso visível de novo' });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    // ---------- detalhe (público; contato só logado)
    const dm = path.match(/^\/api\/lostfound\/([^/]+)$/);
    if (dm && method === 'GET' && !['mine', 'alerts'].includes(dm[1])) {
      const viewer = optionalUser(ctx);
      const rows: any[] = await db.$queryRawUnsafe(`SELECT r.*, u.name AS "userName" FROM lf_reports r JOIN users u ON u.id = r."userId" WHERE r.id = $1`, dm[1]);
      const r = rows[0];
      if (!r || ((r.hidden || r.status === 'REMOVED') && r.userId !== viewer)) throw new HttpError(404, 'Aviso não encontrado');
      if (r.status === 'MERGED' && r.mergedInto) {
        // Caso unificado: o app abre o caso que ficou
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ redirectTo: r.mergedInto, merged: true });
        return true;
      }
      if (viewer !== r.userId) await db.$executeRawUnsafe(`UPDATE lf_reports SET views = views + 1 WHERE id = $1`, r.id);
      const lat = Number(q.lat);
      const lng = Number(q.lng);
      const sights: any[] = await db.$queryRawUnsafe(
        `SELECT s.id, s."reportId", s."userId", s.kind, s.lat, s.lng, s."publicLat", s."publicLng", s."approximate", s."locationNote",
                s.district, s.note, s."happenedAt", s."createdAt", u.name AS "userName"
           FROM lf_sightings s JOIN users u ON u.id = s."userId"
          WHERE s."reportId" = $1 AND s.hidden = false ORDER BY s."happenedAt" ASC, s."createdAt" ASC LIMIT 200`,
        r.id,
      );
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        report: {
          ...publicView(r, { viewerId: viewer, withContact: !!viewer, from: Number.isFinite(lat) && Number.isFinite(lng) && lat ? { lat, lng } : null }),
          hidden: r.userId === viewer ? r.hidden : undefined,
        },
        timeline: sights.map((x) => sightingView(x, viewer, r.userId)),
        commentsCount: Number(
          ((await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM lf_comments WHERE "reportId" = $1 AND hidden = false`, r.id)) as any[])[0]?.n || 0,
        ),
        following: viewer ? (await caseFollowers(db, r)).has(viewer) : false,
        pendingMerges: Number(
          ((await db.$queryRawUnsafe(
            `SELECT COUNT(*)::int AS n FROM lf_merges WHERE status = 'PENDING' AND ("sourceId" = $1 OR "targetId" = $1)`,
            r.id,
          )) as any[])[0]?.n || 0,
        ),
        needsLoginForContact: !viewer && !!r.whatsapp,
      });
      return true;
    }

    // ---------- daqui para baixo: logado
    const { userId } = ctx.authUser();

    if (path === '/api/lostfound/alerts') {
      if (method === 'GET') {
        const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM lf_alert_prefs WHERE "userId" = $1`, userId);
        res.status(200).json({ alerts: rows[0] || null, radii: ALERT_RADII });
        return true;
      }
      if (method === 'PUT') {
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) throw new HttpError(400, 'Precisamos da sua região (localização) para avisar o que acontece perto', 'LOCATION_REQUIRED');
        const radius = ALERT_RADII.includes(Number(body.radiusKm)) ? Number(body.radiusKm) : 3;
        const species = ['ALL', 'DOG', 'CAT'].includes(String(body.species || 'ALL').toUpperCase()) ? String(body.species || 'ALL').toUpperCase() : 'ALL';
        // Guardamos só a região (≈1 km), não o ponto exato de casa
        const rLat = Math.round(lat * 100) / 100;
        const rLng = Math.round(lng * 100) / 100;
        await db.$executeRawUnsafe(
          `INSERT INTO lf_alert_prefs ("userId", enabled, lat, lng, "radiusKm", species, "notifyFound", "notifyLost")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT ("userId") DO UPDATE SET enabled = EXCLUDED.enabled, lat = EXCLUDED.lat, lng = EXCLUDED.lng, "radiusKm" = EXCLUDED."radiusKm",
             species = EXCLUDED.species, "notifyFound" = EXCLUDED."notifyFound", "notifyLost" = EXCLUDED."notifyLost", "updatedAt" = NOW()`,
          userId, body.enabled !== false, rLat, rLng, radius, species, body.notifyFound !== false, body.notifyLost !== false,
        );
        const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM lf_alert_prefs WHERE "userId" = $1`, userId);
        res.status(200).json({ alerts: rows[0] });
        return true;
      }
      if (method === 'DELETE') {
        await db.$executeRawUnsafe(`DELETE FROM lf_alert_prefs WHERE "userId" = $1`, userId);
        res.status(200).json({ alerts: null });
        return true;
      }
    }

    if (path === '/api/lostfound/mine' && method === 'GET') {
      const rows: any[] = await db.$queryRawUnsafe(
        `SELECT r.*, u.name AS "userName" FROM lf_reports r JOIN users u ON u.id = r."userId" WHERE r."userId" = $1 AND r.status <> 'REMOVED' ORDER BY r."createdAt" DESC LIMIT 50`,
        userId,
      );
      res.status(200).json({ reports: rows.map((r) => ({ ...publicView(r, { viewerId: userId, withContact: true }), hidden: r.hidden })) });
      return true;
    }

    // ---------- unificação: sugerir, ver sugestões, confirmar ou recusar
    const mr = path.match(/^\/api\/lostfound\/merges\/([^/]+)\/(confirm|reject)$/);
    if (mr && method === 'POST') {
      const ms: any[] = await db.$queryRawUnsafe(`SELECT * FROM lf_merges WHERE id = $1`, mr[1]);
      const m = ms[0];
      if (!m) throw new HttpError(404, 'Sugestão não encontrada');
      if (m.status !== 'PENDING') throw new HttpError(409, 'Esta sugestão já foi decidida', 'DECIDED');
      const source = await loadCase(db, m.sourceId);
      const target = await loadCase(db, m.targetId);
      if (!source || !target) throw new HttpError(404, 'Caso não encontrado');
      const conf = applyConfirm(m, source, target, userId);
      if (!conf.counted && !ctx.isAdmin) {
        throw new HttpError(403, m.needs === 'TUTOR' ? 'Quem confirma é o tutor do animal perdido (ou a Liga)' : 'Quem confirma são os autores dos dois avisos (ou a Liga)');
      }
      if (mr[2] === 'reject') {
        await db.$executeRawUnsafe(`UPDATE lf_merges SET status = 'REJECTED', "decidedBy" = $2, "decidedAt" = NOW() WHERE id = $1`, m.id, userId);
        res.status(200).json({ message: 'Certo, os casos continuam separados.', status: 'REJECTED' });
        return true;
      }
      if (source.status !== 'ACTIVE' || target.status !== 'ACTIVE') throw new HttpError(409, 'Um dos casos não está mais ativo', 'CLOSED');
      const next = { ...m, sourceOk: conf.sourceOk, targetOk: conf.targetOk };
      if (ctx.isAdmin || mergeReady(next, source, target)) {
        await doMerge(db, m.id, source, target, userId);
        res.status(200).json({ message: 'Pronto! Os casos foram unificados.', status: 'CONFIRMED', targetId: target.id });
        return true;
      }
      await db.$executeRawUnsafe(`UPDATE lf_merges SET "sourceOk" = $2, "targetOk" = $3 WHERE id = $1`, m.id, conf.sourceOk, conf.targetOk);
      const other = conf.sourceOk ? target.userId : source.userId;
      await push(db, [other], '🔗 Falta você confirmar', 'O outro autor confirmou que é o mesmo animal. Confira as fotos.', { screen: 'LostFoundDetail', id: String(target.id) });
      res.status(200).json({ message: 'Confirmado! Falta o outro autor confirmar.', status: 'PENDING' });
      return true;
    }

    const mg = path.match(/^\/api\/lostfound\/([^/]+)\/(merge|merges)$/);
    if (mg) {
      const r = await loadCase(db, mg[1]);
      if (!r || r.status === 'REMOVED' || r.hidden) throw new HttpError(404, 'Aviso não encontrado');

      if (mg[2] === 'merges' && method === 'GET') {
        const ms: any[] = await db.$queryRawUnsafe(
          `SELECT * FROM lf_merges WHERE status = 'PENDING' AND ("sourceId" = $1 OR "targetId" = $1) ORDER BY "createdAt" DESC LIMIT 10`,
          r.id,
        );
        const out = [];
        for (const m of ms) {
          const source = m.sourceId === r.id ? r : await loadCase(db, m.sourceId);
          const target = m.targetId === r.id ? r : await loadCase(db, m.targetId);
          if (source && target) out.push(mergeView(m, source, target, userId, ctx.isAdmin));
        }
        res.status(200).json({ merges: out });
        return true;
      }

      if (mg[2] === 'merge' && method === 'POST') {
        const other = await loadCase(db, String(body.otherId || ''));
        if (!other || other.status === 'REMOVED' || other.hidden || other.id === r.id) throw new HttpError(404, 'Escolha o outro aviso');
        if (r.status !== 'ACTIVE' || other.status !== 'ACTIVE') throw new HttpError(409, 'Os dois avisos precisam estar ativos', 'CLOSED');
        if (r.species !== other.species) throw new HttpError(400, 'Os avisos são de espécies diferentes');
        const lim: any[] = await db.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS n FROM lf_merges WHERE "suggestedBy" = $1 AND "createdAt" > NOW() - INTERVAL '1 day'`,
          userId,
        );
        if ((lim[0]?.n || 0) >= MERGES_PER_DAY) throw new HttpError(429, 'Limite de sugestões por dia atingido.', 'TOO_MANY');
        const out = await suggestMerge(db, r, other, { suggestedBy: userId, note: String(body.note || '').trim().slice(0, 200) || null });
        if (out.existed && out.merge.status === 'REJECTED') {
          throw new HttpError(409, 'Quem conhece o animal já disse que não é o mesmo.', 'ALREADY_REJECTED');
        }
        // Quem sugeriu é o tutor (ou autor): já conta como confirmação
        const conf = applyConfirm(out.merge, out.source, out.target, userId);
        if (conf.counted && out.merge.status === 'PENDING') {
          const next = { ...out.merge, sourceOk: conf.sourceOk, targetOk: conf.targetOk };
          if (mergeReady(next, out.source, out.target)) {
            await doMerge(db, out.merge.id, out.source, out.target, userId);
            res.status(200).json({ message: 'Pronto! Os casos foram unificados.', status: 'CONFIRMED', targetId: out.target.id });
            return true;
          }
          await db.$executeRawUnsafe(`UPDATE lf_merges SET "sourceOk" = $2, "targetOk" = $3 WHERE id = $1`, out.merge.id, conf.sourceOk, conf.targetOk);
        }
        res.status(out.existed ? 200 : 201).json({
          message: out.existed
            ? 'Essa sugestão já foi feita e está esperando confirmação.'
            : out.merge.needs === 'TUTOR'
            ? 'Obrigado! Vamos pedir para o tutor do animal confirmar.'
            : 'Obrigado! Vamos pedir para quem publicou os avisos confirmar.',
          status: 'PENDING',
          mergeId: out.merge.id,
        });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    // ---------- acompanhar um caso / mural de conversa
    const cm = path.match(/^\/api\/lostfound\/([^/]+)\/(follow|comments)(?:\/([^/]+))?(\/flag)?$/);
    if (cm) {
      const rows: any[] = await db.$queryRawUnsafe(`SELECT r.*, u.name AS "userName" FROM lf_reports r JOIN users u ON u.id = r."userId" WHERE r.id = $1`, cm[1]);
      const r = rows[0];
      if (!r || r.status === 'REMOVED' || (r.hidden && r.userId !== userId)) throw new HttpError(404, 'Aviso não encontrado');

      if (cm[2] === 'follow' && !cm[3]) {
        if (method === 'POST' || method === 'DELETE') {
          const on = method === 'POST';
          await db.$executeRawUnsafe(
            `INSERT INTO lf_follows ("reportId", "userId", active) VALUES ($1, $2, $3)
             ON CONFLICT ("reportId", "userId") DO UPDATE SET active = EXCLUDED.active`,
            r.id, userId, on,
          );
          res.status(200).json({ following: on, message: on ? 'Você vai receber as novidades deste caso.' : 'Você não vai mais receber avisos deste caso.' });
          return true;
        }
      }

      if (cm[2] === 'comments' && !cm[3] && method === 'GET') {
        const list: any[] = await db.$queryRawUnsafe(
          `SELECT c.id, c."reportId", c."userId", c."parentId", c.body, c.mime, c."createdAt", u.name AS "userName"
             FROM lf_comments c JOIN users u ON u.id = c."userId"
            WHERE c."reportId" = $1 AND c.hidden = false ORDER BY c."createdAt" ASC LIMIT 500`,
          r.id,
        );
        const views = list.map((c) => commentView(c, userId, r.userId));
        const tops = views.filter((c) => !c.parentId || !views.some((p) => p.id === c.parentId && !p.parentId));
        // Mais recentes no topo; respostas em ordem, embaixo de cada comentário
        const threads = tops
          .map((t) => ({ ...t, parentId: null, replies: views.filter((x) => x.parentId === t.id) }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        res.status(200).json({ comments: threads, total: views.length, following: (await caseFollowers(db, r)).has(userId), closed: r.status !== 'ACTIVE' });
        return true;
      }

      if (cm[2] === 'comments' && !cm[3] && method === 'POST') {
        if (r.status === 'MERGED') throw new HttpError(409, 'Este caso foi unificado com outro. Abra o caso atualizado.', 'MERGED');
        const chk = cleanComment(body.body);
        if (chk.error) throw new HttpError(400, chk.error, chk.code);
        let parentId: string | null = null;
        let parentAuthor: string | null = null;
        if (body.parentId) {
          const ps: any[] = await db.$queryRawUnsafe(
            `SELECT id, "parentId", "userId" FROM lf_comments WHERE id = $1 AND "reportId" = $2 AND hidden = false`,
            String(body.parentId), r.id,
          );
          if (!ps[0]) throw new HttpError(404, 'Comentário não encontrado');
          // Respostas ficam num nível só (responder a uma resposta vai para o mesmo comentário)
          parentId = ps[0].parentId || ps[0].id;
          parentAuthor = ps[0].userId;
        }
        const photo = body.photo ? decodePhoto(body.photo) : null;
        const lim: any[] = await db.$queryRawUnsafe(
          `SELECT COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '1 day')::int AS today, MAX("createdAt") AS last
             FROM lf_comments WHERE "userId" = $1`,
          userId,
        );
        if ((lim[0]?.today || 0) >= COMMENTS_PER_DAY) throw new HttpError(429, 'Limite de comentários por dia atingido. Tente amanhã.', 'TOO_MANY');
        if (lim[0]?.last && Date.now() - new Date(lim[0].last).getTime() < COMMENT_GAP_MS) {
          throw new HttpError(429, 'Calma! Espere alguns segundos para comentar de novo.', 'TOO_FAST');
        }
        const id = crypto.randomUUID();
        await db.$executeRawUnsafe(
          `INSERT INTO lf_comments (id, "reportId", "userId", "parentId", body, mime, photo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          id, r.id, userId, parentId, chk.text, photo?.mime || null, photo?.data || null,
        );
        await autoFollow(db, r.id, userId);
        const me: any[] = await db.$queryRawUnsafe(`SELECT name FROM users WHERE id = $1`, userId);
        const who = String(me[0]?.name || 'Alguém').split(' ')[0];
        const name = r.type === 'LOST' && r.petName ? r.petName : `${SPECIES_LABEL[r.species].toLowerCase()} ${r.colors}`;
        const preview = chk.text!.length > 90 ? `${chk.text!.slice(0, 87)}…` : chk.text!;
        const data = { screen: 'LostFoundComments', id: String(r.id) };
        let notified = 0;
        if (parentAuthor && parentAuthor !== userId) {
          notified += await pushFollowers(db, r.id, [parentAuthor], `↩️ ${who} respondeu você no caso de ${name}`, preview, data);
        }
        const followers = [...(await caseFollowers(db, r))].filter((u) => u !== userId && u !== parentAuthor);
        notified += await pushFollowers(db, r.id, followers, `💬 ${who} comentou no caso de ${name}`, preview, data);
        const out: any[] = await db.$queryRawUnsafe(
          `SELECT c.id, c."reportId", c."userId", c."parentId", c.body, c.mime, c."createdAt", u.name AS "userName"
             FROM lf_comments c JOIN users u ON u.id = c."userId" WHERE c.id = $1`,
          id,
        );
        res.status(201).json({
          comment: commentView(out[0], userId, r.userId),
          notified,
          masked: !!chk.masked,
          message: chk.masked ? 'Publicado. Telefone/e-mail foram escondidos: para contato, use o WhatsApp do aviso.' : undefined,
        });
        return true;
      }

      if (cm[2] === 'comments' && cm[3]) {
        const cs: any[] = await db.$queryRawUnsafe(`SELECT * FROM lf_comments WHERE id = $1 AND "reportId" = $2 AND hidden = false`, cm[3], r.id);
        const c = cs[0];
        if (!c) throw new HttpError(404, 'Comentário não encontrado');
        if (cm[4] === '/flag' && method === 'POST') {
          if (c.userId === userId) throw new HttpError(400, 'Este comentário é seu');
          const reason = String(body.reason || '').trim().slice(0, 200);
          if (reason.length < 5) throw new HttpError(400, 'Conte o motivo da denúncia');
          await db.$executeRawUnsafe(`INSERT INTO lf_comment_flags ("commentId", "userId", reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, c.id, userId, reason);
          const n: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM lf_comment_flags WHERE "commentId" = $1`, c.id);
          if ((n[0]?.n || 0) >= COMMENT_FLAGS_TO_HIDE) {
            await db.$executeRawUnsafe(`UPDATE lf_comments SET hidden = true, "hiddenBy" = 'FLAGS' WHERE id = $1`, c.id);
          }
          res.status(201).json({ message: 'Obrigado! A Liga vai revisar este comentário.' });
          return true;
        }
        if (!cm[4] && method === 'DELETE') {
          const mine = c.userId === userId;
          if (!mine && r.userId !== userId) throw new HttpError(403, 'Só quem escreveu ou o autor do caso pode tirar');
          await db.$executeRawUnsafe(`UPDATE lf_comments SET hidden = true, "hiddenBy" = $2 WHERE id = $1 OR "parentId" = $1`, c.id, mine ? 'DELETED' : 'AUTHOR');
          res.status(200).json({ message: mine ? 'Comentário apagado' : 'Comentário ocultado' });
          return true;
        }
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    // ---------- antes de publicar: "Pode ser um destes?"
    if (path === '/api/lostfound/similar' && method === 'POST') {
      const sp = String(body.species || '').toUpperCase();
      const lat = Number(body.lat);
      const lng = Number(body.lng);
      if (!(LF_SPECIES as readonly string[]).includes(sp) || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
        res.status(200).json({ similar: [] });
        return true;
      }
      const probe = {
        species: sp,
        lat,
        lng,
        happenedAt: body.happenedAt ? new Date(body.happenedAt) : new Date(),
        size: SIZES.includes(String(body.size || '').toUpperCase()) ? String(body.size).toUpperCase() : null,
        sex: String(body.sex || '').toUpperCase() || null,
        colors: String(body.colors || ''),
        breed: String(body.breed || ''),
      };
      const cands: any[] = await db.$queryRawUnsafe(
        `SELECT c.*, u.name AS "userName" FROM lf_reports c JOIN users u ON u.id = c."userId"
          WHERE c.status = 'ACTIVE' AND c.hidden = false AND c."expiresAt" > NOW() AND c.species = $1
            AND (${distSql('c."publicLat"', 'c."publicLng"', '$2', '$3')} <= ${MATCH_RADIUS_KM}
              OR (c."lastLat" IS NOT NULL AND ${distSql('c."lastLat"', 'c."lastLng"', '$2', '$3')} <= ${MATCH_RADIUS_KM}))
          ORDER BY c."createdAt" DESC LIMIT 200`,
        sp, lat, lng,
      );
      const list = cands
        .map((c) => ({ c, score: caseScore(c, probe) }))
        .filter((x) => x.score >= SIMILAR_MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map((x) => ({ ...publicView(x.c, { viewerId: userId, from: { lat, lng } }), score: x.score }));
      res.status(200).json({ similar: list });
      return true;
    }

    // ---------- avistamentos de um caso
    const sg = path.match(/^\/api\/lostfound\/([^/]+)\/sightings(?:\/([^/]+))?$/);
    if (sg) {
      const rows: any[] = await db.$queryRawUnsafe(`SELECT r.*, u.name AS "userName" FROM lf_reports r JOIN users u ON u.id = r."userId" WHERE r.id = $1`, sg[1]);
      const r = rows[0];
      if (!r || r.status === 'REMOVED' || r.hidden) throw new HttpError(404, 'Aviso não encontrado');

      if (!sg[2] && method === 'POST') {
        if (r.status === 'MERGED') throw new HttpError(409, 'Este caso foi unificado com outro. Abra o caso atualizado.', 'MERGED');
        if (r.status !== 'ACTIVE') throw new HttpError(409, 'Este caso já foi encerrado', 'CLOSED');
        const kind = String(body.kind || 'SEEN').toUpperCase();
        if (!(SIGHTING_KINDS as readonly string[]).includes(kind)) throw new HttpError(400, 'Escolha: vi de novo, está comigo ou levei para a clínica');
        if (!body.photo) throw new HttpError(400, 'A foto é obrigatória: é ela que confirma que é o mesmo animal', 'PHOTO_REQUIRED');
        const photo = decodePhoto(body.photo);
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
          throw new HttpError(400, 'Marque no mapa onde você viu o animal', 'LOCATION_REQUIRED');
        }
        const when = body.happenedAt ? new Date(body.happenedAt) : new Date();
        if (Number.isNaN(when.getTime())) throw new HttpError(400, 'Data inválida');
        if (when.getTime() > Date.now() + 10 * 60e3) throw new HttpError(400, 'A data não pode ser no futuro');
        if (when.getTime() < Date.now() - 30 * 864e5) throw new HttpError(400, 'Avistamentos de até 30 dias atrás');
        const lim: any[] = await db.$queryRawUnsafe(
          `SELECT COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '1 day')::int AS today,
                  COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '1 day' AND "reportId" = $2)::int AS here
             FROM lf_sightings WHERE "userId" = $1`,
          userId, r.id,
        );
        if ((lim[0]?.today || 0) >= SIGHTINGS_PER_DAY) throw new HttpError(429, 'Limite de avistamentos por dia atingido. Tente amanhã.', 'TOO_MANY');
        if ((lim[0]?.here || 0) >= SIGHTINGS_PER_CASE_DAY) throw new HttpError(429, 'Você já registrou vários avistamentos deste animal hoje.', 'TOO_MANY');
        const id = crypto.randomUUID();
        const la = Math.round(lat * 1e6) / 1e6;
        const ln = Math.round(lng * 1e6) / 1e6;
        // "Está comigo" é a casa de quem acolheu: no mapa vai só a região aproximada
        const approximate = kind === 'WITH_ME';
        const pub = approximate ? fuzzPoint(id, la, ln) : { lat: la, lng: ln };
        const txt = (v: any, max: number) => String(v || '').trim().slice(0, max) || null;
        await db.$executeRawUnsafe(
          `INSERT INTO lf_sightings (id, "reportId", "userId", kind, lat, lng, "publicLat", "publicLng", "approximate", "locationNote", district, note, "happenedAt", mime, photo)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          id, r.id, userId, kind, la, ln, pub.lat, pub.lng, approximate, txt(body.locationNote, 120), txt(body.district, 60), txt(body.note, 300), when,
          photo.mime, photo.data,
        );
        await refreshCaseLast(db, r.id);
        // Caso com movimento continua no mapa
        await db.$executeRawUnsafe(
          `UPDATE lf_reports SET "expiresAt" = GREATEST("expiresAt", NOW() + INTERVAL '${ACTIVE_DAYS} days') WHERE id = $1`,
          r.id,
        );
        // Avisa quem acompanha o caso (autor, quem já ajudou, quem tocou em "Acompanhar")
        const helpers: any[] = await db.$queryRawUnsafe(
          `SELECT DISTINCT "userId" FROM lf_sightings WHERE "reportId" = $1 AND hidden = false AND "userId" <> $2 LIMIT 50`,
          r.id, userId,
        );
        for (const h of helpers) await autoFollow(db, r.id, h.userId);
        await autoFollow(db, r.id, userId);
        const to = [...(await caseFollowers(db, r))].filter((u) => u !== userId);
        const name = r.type === 'LOST' && r.petName ? r.petName : `o ${SPECIES_LABEL[r.species].toLowerCase()} ${r.colors}`;
        const place = txt(body.locationNote, 60) || txt(body.district, 40) || 'veja no mapa';
        const title =
          kind === 'WITH_ME' ? `🏠 Alguém está com ${name}` : kind === 'CLINIC' ? `🏥 ${name} foi levado para uma clínica` : `📍 ${name} foi visto de novo`;
        await push(db, to, title, `${place} · toque para ver a foto e o trajeto.`, { screen: 'LostFoundDetail', id: String(r.id), caseId: String(r.id) });
        const out: any[] = await db.$queryRawUnsafe(
          `SELECT s.*, u.name AS "userName" FROM lf_sightings s JOIN users u ON u.id = s."userId" WHERE s.id = $1`,
          id,
        );
        res.status(201).json({ sighting: sightingView(out[0], userId, r.userId), notified: to.length, message: 'Obrigado! O avistamento entrou na linha do tempo.' });
        return true;
      }

      if (sg[2] && method === 'DELETE') {
        const ss: any[] = await db.$queryRawUnsafe(`SELECT * FROM lf_sightings WHERE id = $1 AND "reportId" = $2 AND hidden = false`, sg[2], r.id);
        if (!ss[0]) throw new HttpError(404, 'Avistamento não encontrado');
        if (ss[0].userId !== userId && r.userId !== userId) throw new HttpError(403, 'Só quem registrou ou o autor do caso pode tirar');
        await db.$executeRawUnsafe(`UPDATE lf_sightings SET hidden = true, "hiddenBy" = $2 WHERE id = $1`, sg[2], userId);
        await refreshCaseLast(db, r.id);
        res.status(200).json({ message: 'Avistamento retirado da linha do tempo' });
        return true;
      }
      throw new HttpError(404, 'Rota não encontrada');
    }

    if (path === '/api/lostfound' && method === 'POST') {
      const active: any[] = await db.$queryRawUnsafe(
        `SELECT COUNT(*) FILTER (WHERE status = 'ACTIVE' AND "expiresAt" > NOW())::int AS active,
                COUNT(*) FILTER (WHERE "createdAt" > NOW() - INTERVAL '1 day')::int AS today
           FROM lf_reports WHERE "userId" = $1`,
        userId,
      );
      if ((active[0]?.active || 0) >= MAX_ACTIVE_PER_USER) throw new HttpError(429, `Você já tem ${MAX_ACTIVE_PER_USER} avisos ativos. Encerre um antes.`, 'TOO_MANY');
      if ((active[0]?.today || 0) >= MAX_PER_DAY) throw new HttpError(429, 'Limite de avisos por dia atingido. Tente amanhã.', 'TOO_MANY');
      const f = parseFields(body);
      const photosIn = Array.isArray(body.photos) ? body.photos.slice(0, MAX_PHOTOS) : [];
      if (!photosIn.length) throw new HttpError(400, 'Envie pelo menos uma foto do animal', 'PHOTO_REQUIRED');
      const photos = photosIn.map(decodePhoto);
      const users: any[] = await db.$queryRawUnsafe(`SELECT name, phone FROM users WHERE id = $1`, userId);
      const whatsapp = body.showWhatsapp === false ? null : normalizeWhatsapp(body.whatsapp || users[0]?.phone);
      if (body.showWhatsapp !== false && !whatsapp) {
        throw new HttpError(400, 'Informe um WhatsApp com DDD para quem achar entrar em contato', 'WHATSAPP_REQUIRED');
      }
      let petId: string | null = null;
      if (body.petId) {
        const pets: any[] = await db.$queryRawUnsafe(`SELECT id FROM pets WHERE id = $1 AND "userId" = $2`, String(body.petId), userId);
        if (!pets[0]) throw new HttpError(404, 'Pet não encontrado');
        petId = pets[0].id;
      }
      const id = crypto.randomUUID();
      const approximate = f.type === 'LOST';
      const pub = approximate ? fuzzPoint(id, f.lat, f.lng) : { lat: f.lat, lng: f.lng };
      await db.$executeRawUnsafe(
        `INSERT INTO lf_reports (id, "userId", type, species, "petName", sex, size, colors, breed, "hasCollar", description, "currentlyWith",
            lat, lng, "publicLat", "publicLng", "approximate", "locationNote", district, city, "happenedAt", whatsapp, "petId", photos, "expiresAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24, NOW() + INTERVAL '${ACTIVE_DAYS} days')`,
        id, userId, f.type, f.species, f.type === 'LOST' ? f.petName : null, f.sex, f.size, f.colors, f.breed, f.hasCollar, f.description,
        f.type === 'FOUND' ? f.currentlyWith : null, f.lat, f.lng, pub.lat, pub.lng, approximate, f.locationNote, f.district, f.city, f.happenedAt,
        whatsapp, petId, photos.length,
      );
      for (let i = 0; i < photos.length; i++) {
        await db.$executeRawUnsafe(`INSERT INTO lf_photos ("reportId", position, mime, data) VALUES ($1, $2, $3, $4)`, id, i, photos[i].mime, photos[i].data);
      }
      const rows: any[] = await db.$queryRawUnsafe(`SELECT r.*, u.name AS "userName" FROM lf_reports r JOIN users u ON u.id = r."userId" WHERE r.id = $1`, id);
      await autoFollow(db, id, userId);
      const alerts = await sendNearbyAlerts(db, rows[0]);
      // Muito parecido com um caso de outra pessoa: sugere unificar (quem conhece o animal confirma)
      try {
        const me = rows[0];
        const near: any[] = await db.$queryRawUnsafe(
          `SELECT c.*, u.name AS "userName" FROM lf_reports c JOIN users u ON u.id = c."userId"
            WHERE c.id <> $1 AND c."userId" <> $2 AND c.status = 'ACTIVE' AND c.hidden = false AND c."expiresAt" > NOW() AND c.species = $3
              AND (${distSql('c."publicLat"', 'c."publicLng"', '$4', '$5')} <= ${MATCH_RADIUS_KM}
                OR (c."lastLat" IS NOT NULL AND ${distSql('c."lastLat"', 'c."lastLng"', '$4', '$5')} <= ${MATCH_RADIUS_KM}))
            ORDER BY c."createdAt" DESC LIMIT 100`,
          id, userId, me.species, me.publicLat, me.publicLng,
        );
        const best = near
          .map((c) => ({ c, score: caseScore(c, { ...me, lat: me.publicLat, lng: me.publicLng }) }))
          .filter((x) => x.score >= MERGE_AUTO_SCORE)
          .sort((a, b) => b.score - a.score)
          .slice(0, 2);
        for (const b of best) await suggestMerge(db, me, b.c, { suggestedBy: null, auto: true });
      } catch (e: any) {
        console.warn('⚠️ Sugestão automática de unificação falhou:', e?.message);
      }
      res.status(201).json({ report: publicView(rows[0], { viewerId: userId, withContact: true }), alerts });
      return true;
    }

    const om = path.match(/^\/api\/lostfound\/([^/]+)(\/resolve|\/renew|\/flag|\/matches)?$/);
    if (om) {
      const rows: any[] = await db.$queryRawUnsafe(`SELECT r.*, u.name AS "userName" FROM lf_reports r JOIN users u ON u.id = r."userId" WHERE r.id = $1`, om[1]);
      const r = rows[0];
      if (!r || r.status === 'REMOVED') throw new HttpError(404, 'Aviso não encontrado');
      const mine = r.userId === userId;

      if (om[2] === '/flag' && method === 'POST') {
        if (mine) throw new HttpError(400, 'Este aviso é seu');
        const reason = String(body.reason || '').trim().slice(0, 200);
        if (reason.length < 5) throw new HttpError(400, 'Conte o motivo da denúncia');
        await db.$executeRawUnsafe(`INSERT INTO lf_flags ("reportId", "userId", reason) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, r.id, userId, reason);
        const n: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM lf_flags WHERE "reportId" = $1`, r.id);
        if ((n[0]?.n || 0) >= FLAGS_TO_HIDE && !r.hidden) {
          await db.$executeRawUnsafe(`UPDATE lf_reports SET hidden = true, "hiddenReason" = 'Denúncias: aguardando revisão da Liga' WHERE id = $1`, r.id);
        }
        res.status(201).json({ message: 'Obrigado! A Liga vai revisar este aviso.' });
        return true;
      }

      if (om[2] === '/matches' && method === 'GET') {
        if (!mine) throw new HttpError(403, 'Só quem publicou vê as sugestões');
        const wanted = r.type === 'LOST' ? ['FOUND', 'SIGHTED'] : ['LOST'];
        const cands: any[] = await db.$queryRawUnsafe(
          `SELECT c.*, u.name AS "userName" FROM lf_reports c JOIN users u ON u.id = c."userId"
            WHERE c.type = ANY($1::text[]) AND c.status = 'ACTIVE' AND c.hidden = false AND c."expiresAt" > NOW() AND c.species = $2 AND c."userId" <> $3
              AND ${distSql('c."publicLat"', 'c."publicLng"', '$4', '$5')} <= ${MATCH_RADIUS_KM}
            ORDER BY c."createdAt" DESC LIMIT 100`,
          wanted, r.species, userId, r.lat, r.lng,
        );
        const list = cands
          .map((c) => ({ c, score: matchScore({ ...r }, { ...c, lat: c.publicLat, lng: c.publicLng }) }))
          .filter((x) => x.score >= 30)
          .sort((a, b) => b.score - a.score)
          .slice(0, 20)
          .map((x) => ({ ...publicView(x.c, { viewerId: userId, withContact: true, from: { lat: r.lat, lng: r.lng } }), score: x.score }));
        res.status(200).json({ matches: list });
        return true;
      }

      if (!mine) throw new HttpError(403, 'Só quem publicou pode alterar o aviso');

      if (om[2] === '/resolve' && method === 'POST') {
        await db.$executeRawUnsafe(
          `UPDATE lf_reports SET status = 'RESOLVED', "resolvedAt" = NOW(), "resolvedNote" = $2, "updatedAt" = NOW() WHERE id = $1`,
          r.id, String(body.note || '').trim().slice(0, 300) || null,
        );
        // Quem recebeu o alerta deste aviso fica sabendo do final feliz
        if (r.type === 'LOST') {
          const got: any[] = await db.$queryRawUnsafe(`SELECT "userId" FROM lf_alerts_sent WHERE "reportId" = $1 LIMIT ${MAX_ALERT_PUSH}`, r.id);
          await push(db, got.map((g) => g.userId), '💚 Voltou para casa!', `${r.petName || 'O pet'} que estava perdido perto de você foi encontrado. Obrigado por ajudar!`, { screen: 'LostFoundDetail', id: String(r.id) });
        }
        res.status(200).json({ message: 'Que notícia boa! Aviso encerrado.' });
        return true;
      }
      if (om[2] === '/renew' && method === 'POST') {
        await db.$executeRawUnsafe(
          `UPDATE lf_reports SET status = 'ACTIVE', "expiresAt" = NOW() + INTERVAL '${ACTIVE_DAYS} days', "updatedAt" = NOW() WHERE id = $1 AND status IN ('ACTIVE','EXPIRED')`,
          r.id,
        );
        res.status(200).json({ message: `Aviso renovado por mais ${ACTIVE_DAYS} dias` });
        return true;
      }
      if (!om[2] && method === 'PUT') {
        const f = parseFields(body, true);
        delete f.type;
        const sets: string[] = [];
        const params: any[] = [r.id];
        for (const [k, v] of Object.entries(f)) {
          if (k === 'lat' || k === 'lng') continue;
          params.push(v);
          sets.push(`"${k}" = $${params.length}`);
        }
        if (f.lat !== undefined) {
          const pub = r.approximate ? fuzzPoint(r.id, f.lat, f.lng) : { lat: f.lat, lng: f.lng };
          for (const [k, v] of [['lat', f.lat], ['lng', f.lng], ['publicLat', pub.lat], ['publicLng', pub.lng]] as const) {
            params.push(v);
            sets.push(`"${k}" = $${params.length}`);
          }
        }
        if (body.whatsapp !== undefined || body.showWhatsapp !== undefined) {
          const w = body.showWhatsapp === false ? null : normalizeWhatsapp(body.whatsapp ?? r.whatsapp);
          if (body.showWhatsapp !== false && !w) throw new HttpError(400, 'WhatsApp inválido (com DDD)');
          params.push(w);
          sets.push(`whatsapp = $${params.length}`);
        }
        if (sets.length) await db.$executeRawUnsafe(`UPDATE lf_reports SET ${sets.join(', ')}, "updatedAt" = NOW() WHERE id = $1`, ...params);
        const out: any[] = await db.$queryRawUnsafe(`SELECT r.*, u.name AS "userName" FROM lf_reports r JOIN users u ON u.id = r."userId" WHERE r.id = $1`, r.id);
        res.status(200).json({ report: publicView(out[0], { viewerId: userId, withContact: true }) });
        return true;
      }
      if (!om[2] && method === 'DELETE') {
        await db.$executeRawUnsafe(`UPDATE lf_reports SET status = 'REMOVED', "updatedAt" = NOW() WHERE id = $1`, r.id);
        await db.$executeRawUnsafe(`DELETE FROM lf_photos WHERE "reportId" = $1`, r.id);
        res.status(200).json({ message: 'Aviso apagado' });
        return true;
      }
    }

    throw new HttpError(404, 'Rota não encontrada');
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : e?.status || 500;
    if (status >= 500) console.error('❌ Achados e perdidos:', e);
    res.status(status).json({ error: status >= 500 ? 'Erro interno' : e.message, code: e?.code });
    return true;
  }
}
