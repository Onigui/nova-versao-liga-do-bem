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
 * Alertas: quem ativa recebe push de avisos novos num raio escolhido; quem perdeu um pet
 * recebe aviso automático de "encontrei"/"vi" da mesma espécie perto de onde perdeu.
 * Segurança: denúncia (3 denúncias escondem o aviso até a Liga revisar), limite de avisos,
 * expiração em 30 dias (renovável) e aviso fixo contra golpe do PIX.
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
    `CREATE TABLE IF NOT EXISTS lf_flags (
       "reportId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
       "userId" TEXT NOT NULL,
       reason TEXT NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
       PRIMARY KEY ("reportId", "userId")
     )`,
  ];
  for (const sql of statements) await db.$executeRawUnsafe(sql);
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
    distanceKm: opts.from ? Math.round(haversineKm(opts.from.lat, opts.from.lng, r.publicLat, r.publicLng) * 10) / 10 : undefined,
    author: r.userName ? String(r.userName).split(' ')[0] : undefined,
    whatsapp: opts.withContact && r.whatsapp ? r.whatsapp : undefined,
    hasWhatsapp: !!r.whatsapp,
    mine,
    views: mine ? r.views : undefined,
  };
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
      const rows: any[] = await db.$queryRawUnsafe(`SELECT * FROM lf_reports WHERE id = $1 AND hidden = false AND status <> 'REMOVED'`, sm[1]);
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
        where.push(`${distSql('r."publicLat"', 'r."publicLng"', `$${params.length - 1}`, `$${params.length}`)} <= ${radius}`);
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
      if (viewer !== r.userId) await db.$executeRawUnsafe(`UPDATE lf_reports SET views = views + 1 WHERE id = $1`, r.id);
      const lat = Number(q.lat);
      const lng = Number(q.lng);
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json({
        report: {
          ...publicView(r, { viewerId: viewer, withContact: !!viewer, from: Number.isFinite(lat) && Number.isFinite(lng) && lat ? { lat, lng } : null }),
          hidden: r.userId === viewer ? r.hidden : undefined,
        },
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
      const alerts = await sendNearbyAlerts(db, rows[0]);
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
