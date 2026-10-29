/**
 * Tela inicial do app em uma chamada só (estilo app de banco): carteirinha, atalhos com contadores,
 * "Para você", meus pets, promoções perto, próximo evento e adoção.
 * Cada bloco é independente: se um falhar, os outros continuam (a tela nunca quebra).
 */
import { isMembershipCurrentlyActive, listMembershipPlans } from './membershipBilling';
import { ensurePartnerPortalSchema, listCurrentDiscounts } from './partnerPortal';

type Ctx = { req: any; res: any; path: string; method: string; db: any; authUser: () => { userId: string } };

const R = 6371;
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    console.warn('⚠️ Início: bloco falhou:', e?.message);
    return fallback;
  }
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

const DAY = 864e5;

/** Situação das vacinas de um pet: a dose mais próxima que vence (ou venceu). */
export function petVaccineStatus(vaccs: any[], now = Date.now()) {
  const latestByName = new Map<string, any>();
  for (const v of vaccs) {
    const k = String(v.vaccineName || '').trim().toLowerCase();
    const prev = latestByName.get(k);
    if (!prev || new Date(v.applicationDate) > new Date(prev.applicationDate)) latestByName.set(k, v);
  }
  const next = [...latestByName.values()]
    .filter((v) => v.nextDoseDate)
    .sort((a, b) => new Date(a.nextDoseDate).getTime() - new Date(b.nextDoseDate).getTime())[0];
  if (!vaccs.length) return { status: 'NONE', label: 'Sem vacinas registradas' };
  if (!next) return { status: 'OK', label: 'Vacinas em dia' };
  const days = Math.ceil((new Date(next.nextDoseDate).getTime() - now) / DAY);
  if (days < 0) return { status: 'LATE', label: `${next.vaccineName} atrasada`, vaccine: next.vaccineName, date: next.nextDoseDate, days };
  if (days <= 30) return { status: 'SOON', label: days === 0 ? `${next.vaccineName} hoje` : `${next.vaccineName} em ${days} ${days === 1 ? 'dia' : 'dias'}`, vaccine: next.vaccineName, date: next.nextDoseDate, days };
  return { status: 'OK', label: 'Vacinas em dia', vaccine: next.vaccineName, date: next.nextDoseDate, days };
}

// Partes iguais para todo mundo: guardadas por 60 s em cada instância (a tela abre mais rápido)
const SHARED_TTL = 60 * 1000;
let shared: { at: number; data: any } | null = null;
export function clearHomeCache() {
  shared = null;
}

async function sharedBlocks(db: any) {
  if (shared && Date.now() - shared.at < SHARED_TTL) return shared.data;
  const [tables, partners, nextEvent, adoption, plan] = await Promise.all([
    safe(async () => {
      const r: any[] = await db.$queryRawUnsafe(
        `SELECT t AS name FROM unnest($1::text[]) t WHERE to_regclass('public.' || t) IS NOT NULL`,
        ['partner_reviews', 'quote_requests', 'lf_reports', 'nfp_supporters', 'nfp_settings'],
      );
      return new Set<string>(r.map((x) => x.name));
    }, new Set<string>()),
    safe(async () => {
      await ensurePartnerPortalSchema(db);
      const rows: any[] = await db.$queryRawUnsafe(`SELECT id, name, category, logo, latitude, longitude, hours, address FROM partners WHERE "isActive" = true`);
      const discounts = await listCurrentDiscounts(db, rows.map((p) => p.id));
      const byPartner = new Map<string, any[]>();
      for (const d of discounts) byPartner.set(d.partnerId, [...(byPartner.get(d.partnerId) || []), d]);
      return { count: rows.length, withPromo: rows.filter((p) => byPartner.get(p.id)?.length).map((p) => ({ ...p, discounts: byPartner.get(p.id) })) };
    }, { count: 0, withPromo: [] as any[] }),
    safe(async () => {
      const r: any[] = await db.$queryRawUnsafe(
        `SELECT id, title, "startDate", location FROM events WHERE "isActive" = true AND "startDate" >= NOW() ORDER BY "startDate" LIMIT 1`,
      );
      return r[0] ? { id: r[0].id, title: r[0].title, startDate: r[0].startDate, location: r[0].location } : null;
    }, null),
    safe(async () => {
      const r: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM animals WHERE "isActive" = true AND "isAdopted" = false`);
      return { available: r[0]?.n || 0 };
    }, null),
    safe(async () => {
      const plans = await listMembershipPlans(db);
      const monthly = plans.map((p: any) => ({ ...p, perMonth: Math.round((p.amount / Math.max(1, p.months)) * 100) / 100 }));
      monthly.sort((x: any, y: any) => x.perMonth - y.perMonth);
      return monthly[0] ? { fromPerMonth: monthly[0].perMonth } : null;
    }, null),
  ]);
  const data = { tables, partners, nextEvent, adoption, plan };
  shared = { at: Date.now(), data };
  return data;
}

/** Balão do atalho "Achados e perdidos" no Início: avisos ativos a até 1 km de onde o celular está. */
export const LOST_BADGE_KM = 1;

export async function buildHome(db: any, userId: string | null, where: { lat: number; lng: number } | null, now = Date.now()) {
  const out: any = { user: null, membership: null, counters: {}, forYou: [], pets: [], promos: [], nextEvent: null, adoption: null, plan: null };
  const S = await sharedBlocks(db);
  const has = (t: string) => S.tables.has(t);
  out.nextEvent = S.nextEvent;
  out.adoption = S.adoption;

  // Promoções perto (ou as mais novas, sem localização)
  out.promos = S.partners.withPromo
    .map((p: any) => {
      const dist = where && p.latitude != null && p.longitude != null ? km(where.lat, where.lng, Number(p.latitude), Number(p.longitude)) : null;
      return {
        id: p.id, name: p.name, category: p.category, logo: p.logo || null, hours: p.hours || null, address: p.address,
        latitude: p.latitude != null ? Number(p.latitude) : null, longitude: p.longitude != null ? Number(p.longitude) : null,
        distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
        badge: p.discounts[0].badge,
        discounts: p.discounts,
      };
    })
    .sort((a: any, b: any) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, 3);

  const one = async (sql: string, ...params: any[]) => ((await db.$queryRawUnsafe(sql, ...params)) as any[])[0] || null;

  const [user, membership, unread, pets, review, quote, lost, nfp, lostNearby] = await Promise.all([
    userId ? safe(() => one(`SELECT id, name, role FROM users WHERE id = $1`, userId), null) : null,
    userId
      ? safe(async () => {
          const m = await one(
            `SELECT m."memberId", m.status, m."endDate", m."planCode", m."planMonths",
                    (SELECT COUNT(*)::int FROM partner_validations v WHERE v."userId" = m."userId" AND v."validatedAt" >= $2) AS uses
               FROM memberships m WHERE m."userId" = $1`,
            userId,
            new Date(new Date(now).getFullYear(), 0, 1),
          );
          if (!m) return { active: false };
          return {
            active: isMembershipCurrentlyActive({ status: m.status, endDate: m.endDate }),
            status: m.status,
            endDate: m.endDate,
            planCode: m.planCode,
            planMonths: m.planMonths,
            memberIdMasked: m.memberId ? `MEM•••${String(m.memberId).slice(-4)}` : null,
            usesThisYear: m.uses || 0,
          };
        }, { active: false })
      : null,
    userId ? safe(async () => (await one(`SELECT COUNT(*)::int AS n FROM notifications WHERE "userId" = $1 AND "isRead" = false AND COALESCE(data->>'audience', 'member') <> 'partner'`, userId))?.n || 0, 0) : 0,
    userId
      ? safe(async () => {
          const rows: any[] = await db.$queryRawUnsafe(
            `SELECT p.id, p.name, p.species, p.breed, p.photo,
                    COALESCE(json_agg(json_build_object('vaccineName', v."vaccineName", 'applicationDate', v."applicationDate", 'nextDoseDate', v."nextDoseDate"))
                      FILTER (WHERE v.id IS NOT NULL), '[]') AS vaccs
               FROM (SELECT * FROM pets WHERE "userId" = $1 ORDER BY "createdAt" LIMIT 6) p
               LEFT JOIN vaccinations v ON v."petId" = p.id
              GROUP BY p.id, p.name, p.species, p.breed, p.photo, p."createdAt" ORDER BY p."createdAt"`,
            userId,
          );
          return rows.map((p) => ({ id: p.id, name: p.name, species: p.species, breed: p.breed, photo: p.photo || null, vaccine: petVaccineStatus(p.vaccs || [], now) }));
        }, [])
      : [],
    userId && has('partner_reviews')
      ? safe(
          () =>
            one(
              `SELECT v."partnerId", p.name FROM partner_validations v JOIN partners p ON p.id = v."partnerId" AND p."isActive" = true
                WHERE v."userId" = $1 AND v."validatedAt" > NOW() - INTERVAL '60 days'
                  AND NOT EXISTS (SELECT 1 FROM partner_reviews r WHERE r."userId" = $1 AND r."partnerId" = v."partnerId")
                ORDER BY v."validatedAt" DESC LIMIT 1`,
              userId,
            ),
          null,
        )
      : null,
    userId && has('quote_requests')
      ? safe(
          () =>
            one(
              `SELECT q.id, (SELECT COUNT(*)::int FROM quote_responses x WHERE x."requestId" = q.id AND x.status = 'SUBMITTED') AS quotes
                 FROM quote_requests q WHERE q."userId" = $1 AND q.status = 'OPEN' AND q."expiresAt" > NOW() ORDER BY q."createdAt" DESC LIMIT 1`,
              userId,
            ),
          null,
        )
      : null,
    userId && has('lf_reports')
      ? safe(
          () =>
            one(
              `SELECT id, "petName" FROM lf_reports WHERE "userId" = $1 AND type = 'LOST' AND status = 'ACTIVE' AND "expiresAt" > NOW() ORDER BY "createdAt" DESC LIMIT 1`,
              userId,
            ),
          null,
        )
      : null,
    userId && has('nfp_supporters') && has('nfp_settings')
      ? safe(async () => {
          const st = await one(`SELECT status FROM nfp_supporters WHERE "userId" = $1`, userId);
          const cfg: any[] = await db.$queryRawUnsafe(`SELECT key, value FROM nfp_settings WHERE key IN ('cnpj','enabled')`);
          const m = Object.fromEntries(cfg.map((c) => [c.key, c.value]));
          return { status: st?.status || 'NONE', on: !!m.cnpj && m.enabled !== 'false' };
        }, { status: 'NONE', on: false })
      : null,
    where && has('lf_reports')
      ? safe(async () => {
          // caixa de ~1 km no próprio banco; o círculo exato é conferido aqui
          const d = LOST_BADGE_KM / 111;
          const r: any[] = await db.$queryRawUnsafe(
            `SELECT COALESCE("lastLat", "publicLat") AS lat, COALESCE("lastLng", "publicLng") AS lng FROM lf_reports
              WHERE status = 'ACTIVE' AND hidden = false AND "expiresAt" > NOW() AND "createdAt" > NOW() - INTERVAL '30 days'
                AND COALESCE("lastLat", "publicLat") BETWEEN $1 AND $2 AND COALESCE("lastLng", "publicLng") BETWEEN $3 AND $4`,
            where.lat - d, where.lat + d, where.lng - d * 1.2, where.lng + d * 1.2,
          );
          return r.filter((x) => km(where.lat, where.lng, Number(x.lat), Number(x.lng)) <= LOST_BADGE_KM).length;
        }, 0)
      : undefined,
  ]);

  if (user) out.user = { firstName: String(user.name || '').split(' ')[0], role: user.role };
  out.membership = membership;
  if (userId) out.counters.unreadNotifications = unread;
  if (lostNearby !== undefined) out.counters.lostFoundNearby = lostNearby;
  out.pets = pets || [];

  // "Para você": só o que pede ação, urgentes primeiro
  for (const p of out.pets) {
    if (p.vaccine.status === 'LATE' || p.vaccine.status === 'SOON') {
      out.forYou.push({
        kind: 'VACCINE',
        urgent: p.vaccine.status === 'LATE',
        title: p.vaccine.status === 'LATE' ? `Vacina de ${p.name} atrasada` : `Vacina de ${p.name} ${p.vaccine.days === 0 ? 'hoje' : `em ${p.vaccine.days} ${p.vaccine.days === 1 ? 'dia' : 'dias'}`}`,
        subtitle: p.vaccine.vaccine,
        action: { screen: 'VaccinationCard', params: { petId: p.id } },
      });
    }
  }
  if (review) out.forYou.push({ kind: 'REVIEW', title: `Como foi na ${review.name}?`, subtitle: 'Avalie em 10 segundos', action: { screen: 'ReviewForm', params: { partnerId: review.partnerId, partnerName: review.name } } });
  if (quote) out.forYou.push({ kind: 'QUOTE', title: quote.quotes ? `${quote.quotes} ${quote.quotes === 1 ? 'proposta chegou' : 'propostas chegaram'}` : 'Orçamento aberto', subtitle: 'Compare e escolha onde comprar', action: { screen: 'QuoteDetail', params: { id: quote.id } } });
  if (lost) out.forYou.push({ kind: 'LOST', urgent: true, title: `Procurando ${lost.petName || 'seu pet'}`, subtitle: 'Veja os avisos parecidos por perto', action: { screen: 'LostFoundDetail', params: { id: lost.id } } });
  if (nfp) {
    out.counters.nfpStatus = nfp.status;
    if (nfp.on && (nfp.status === 'NONE' || nfp.status === 'LAPSED')) {
      out.forYou.push({ kind: 'NFP', title: 'Sua nota fiscal ajuda os animais', subtitle: 'Doação automática em 2 minutos', action: { screen: 'NotaFiscal' } });
    }
  }
  out.forYou.sort((a: any, b: any) => Number(!!b.urgent) - Number(!!a.urgent));

  if (!out.membership?.active && S.plan) out.plan = { ...S.plan, partners: S.partners.count };
  return out;
}

export async function handleHome(ctx: Ctx): Promise<boolean> {
  if (ctx.path !== '/api/home' || ctx.method !== 'GET') return false;
  const { res, db } = ctx;
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }
  const q = ctx.req?.query || {};
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  const where = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0) ? { lat, lng } : null;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(await buildHome(db, optionalUser(ctx), where));
  return true;
}
