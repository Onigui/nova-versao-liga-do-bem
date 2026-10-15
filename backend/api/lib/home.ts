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

async function tableExists(db: any, name: string) {
  const r: any[] = await db.$queryRawUnsafe(`SELECT to_regclass($1) IS NOT NULL AS ok`, `public.${name}`);
  return !!r[0]?.ok;
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

export async function buildHome(db: any, userId: string | null, where: { lat: number; lng: number } | null, now = Date.now()) {
  const out: any = { user: null, membership: null, counters: {}, forYou: [], pets: [], promos: [], nextEvent: null, adoption: null, plan: null };

  if (userId) {
    const users: any[] = await safe(() => db.$queryRawUnsafe(`SELECT id, name, role FROM users WHERE id = $1`, userId), []);
    if (users[0]) out.user = { firstName: String(users[0].name || '').split(' ')[0], role: users[0].role };

    out.membership = await safe(async () => {
      const m: any[] = await db.$queryRawUnsafe(`SELECT "memberId", status, "endDate", "planCode", "planMonths" FROM memberships WHERE "userId" = $1`, userId);
      if (!m[0]) return { active: false };
      const active = isMembershipCurrentlyActive({ status: m[0].status, endDate: m[0].endDate });
      const year = new Date(now).getFullYear();
      const uses: any[] = await db.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM partner_validations WHERE "userId" = $1 AND "validatedAt" >= $2`,
        userId,
        new Date(year, 0, 1),
      );
      return {
        active,
        status: m[0].status,
        endDate: m[0].endDate,
        planCode: m[0].planCode,
        planMonths: m[0].planMonths,
        memberIdMasked: m[0].memberId ? `MEM•••${String(m[0].memberId).slice(-4)}` : null,
        usesThisYear: uses[0]?.n || 0,
      };
    }, { active: false });

    out.counters.unreadNotifications = await safe(async () => {
      const r: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM notifications WHERE "userId" = $1 AND "isRead" = false`, userId);
      return r[0]?.n || 0;
    }, 0);

    out.pets = await safe(async () => {
      const pets: any[] = await db.$queryRawUnsafe(`SELECT id, name, species, breed, photo, "birthDate" FROM pets WHERE "userId" = $1 ORDER BY "createdAt" LIMIT 6`, userId);
      if (!pets.length) return [];
      const vaccs: any[] = await db.$queryRawUnsafe(
        `SELECT "petId", "vaccineName", "applicationDate", "nextDoseDate" FROM vaccinations WHERE "petId" = ANY($1::text[])`,
        pets.map((p) => p.id),
      );
      return pets.map((p) => ({ id: p.id, name: p.name, species: p.species, breed: p.breed, photo: p.photo || null, vaccine: petVaccineStatus(vaccs.filter((v) => v.petId === p.id), now) }));
    }, []);

    // "Para você": só o que pede ação, em ordem de urgência
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
    if (await safe(() => tableExists(db, 'partner_reviews'), false)) {
      const pend = await safe(async () => {
        const r: any[] = await db.$queryRawUnsafe(
          `SELECT v."partnerId", p.name FROM partner_validations v JOIN partners p ON p.id = v."partnerId" AND p."isActive" = true
            WHERE v."userId" = $1 AND v."validatedAt" > NOW() - INTERVAL '60 days'
              AND NOT EXISTS (SELECT 1 FROM partner_reviews r WHERE r."userId" = $1 AND r."partnerId" = v."partnerId")
            ORDER BY v."validatedAt" DESC LIMIT 1`,
          userId,
        );
        return r[0] || null;
      }, null);
      if (pend) out.forYou.push({ kind: 'REVIEW', title: `Como foi na ${pend.name}?`, subtitle: 'Avalie em 10 segundos', action: { screen: 'ReviewForm', params: { partnerId: pend.partnerId, partnerName: pend.name } } });
    }
    if (await safe(() => tableExists(db, 'quote_requests'), false)) {
      const q = await safe(async () => {
        const r: any[] = await db.$queryRawUnsafe(
          `SELECT q.id, (SELECT COUNT(*)::int FROM quote_responses x WHERE x."requestId" = q.id AND x.status = 'SUBMITTED') AS quotes
             FROM quote_requests q WHERE q."userId" = $1 AND q.status = 'OPEN' AND q."expiresAt" > NOW() ORDER BY q."createdAt" DESC LIMIT 1`,
          userId,
        );
        return r[0] || null;
      }, null);
      if (q) out.forYou.push({ kind: 'QUOTE', title: q.quotes ? `${q.quotes} ${q.quotes === 1 ? 'proposta chegou' : 'propostas chegaram'}` : 'Orçamento aberto', subtitle: 'Compare e escolha onde comprar', action: { screen: 'QuoteDetail', params: { id: q.id } } });
    }
    if (await safe(() => tableExists(db, 'lf_reports'), false)) {
      const lost = await safe(async () => {
        const r: any[] = await db.$queryRawUnsafe(
          `SELECT id, "petName" FROM lf_reports WHERE "userId" = $1 AND type = 'LOST' AND status = 'ACTIVE' AND "expiresAt" > NOW() ORDER BY "createdAt" DESC LIMIT 1`,
          userId,
        );
        return r[0] || null;
      }, null);
      if (lost) out.forYou.push({ kind: 'LOST', urgent: true, title: `Procurando ${lost.petName || 'seu pet'}`, subtitle: 'Veja os avisos parecidos por perto', action: { screen: 'LostFoundDetail', params: { id: lost.id } } });
    }
    if (await safe(() => tableExists(db, 'nfp_supporters'), false)) {
      const nfp = await safe(async () => {
        const s: any[] = await db.$queryRawUnsafe(`SELECT status FROM nfp_supporters WHERE "userId" = $1`, userId);
        const cfg: any[] = await db.$queryRawUnsafe(`SELECT key, value FROM nfp_settings WHERE key IN ('cnpj','enabled')`);
        const m = Object.fromEntries(cfg.map((c) => [c.key, c.value]));
        return { status: s[0]?.status || 'NONE', on: !!m.cnpj && m.enabled !== 'false' };
      }, { status: 'NONE', on: false });
      out.counters.nfpStatus = nfp.status;
      if (nfp.on && (nfp.status === 'NONE' || nfp.status === 'LAPSED')) {
        out.forYou.push({ kind: 'NFP', title: 'Sua nota fiscal ajuda os animais', subtitle: 'Doação automática em 2 minutos', action: { screen: 'NotaFiscal' } });
      }
    }
    out.forYou.sort((a: any, b: any) => Number(!!b.urgent) - Number(!!a.urgent));
  }

  // Achados e perdidos perto (para o contador do atalho)
  if (where && (await safe(() => tableExists(db, 'lf_reports'), false))) {
    out.counters.lostFoundNearby = await safe(async () => {
      const r: any[] = await db.$queryRawUnsafe(
        `SELECT "publicLat" AS lat, "publicLng" AS lng FROM lf_reports WHERE status = 'ACTIVE' AND hidden = false AND "expiresAt" > NOW() AND "createdAt" > NOW() - INTERVAL '30 days'`,
      );
      return r.filter((x) => km(where.lat, where.lng, Number(x.lat), Number(x.lng)) <= 5).length;
    }, 0);
  }

  // Promoções perto (ou as mais novas, sem localização)
  out.promos = await safe(async () => {
    await ensurePartnerPortalSchema(db);
    const partners: any[] = await db.$queryRawUnsafe(`SELECT id, name, category, logo, latitude, longitude, hours, address FROM partners WHERE "isActive" = true`);
    const discounts = await listCurrentDiscounts(db, partners.map((p) => p.id));
    const byPartner = new Map<string, any[]>();
    for (const d of discounts) byPartner.set(d.partnerId, [...(byPartner.get(d.partnerId) || []), d]);
    const list = partners
      .filter((p) => byPartner.get(p.id)?.length)
      .map((p) => {
        const dist = where && p.latitude != null && p.longitude != null ? km(where.lat, where.lng, Number(p.latitude), Number(p.longitude)) : null;
        return {
          id: p.id, name: p.name, category: p.category, logo: p.logo || null, hours: p.hours || null, address: p.address,
          latitude: p.latitude != null ? Number(p.latitude) : null, longitude: p.longitude != null ? Number(p.longitude) : null,
          distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
          badge: byPartner.get(p.id)![0].badge,
          discounts: byPartner.get(p.id),
        };
      });
    list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    return list.slice(0, 3);
  }, []);

  out.nextEvent = await safe(async () => {
    const r: any[] = await db.$queryRawUnsafe(
      `SELECT id, title, "startDate", location FROM events WHERE "isActive" = true AND "startDate" >= NOW() ORDER BY "startDate" LIMIT 1`,
    );
    return r[0] ? { id: r[0].id, title: r[0].title, startDate: r[0].startDate, location: r[0].location } : null;
  }, null);

  out.adoption = await safe(async () => {
    const r: any[] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM animals WHERE "isActive" = true AND "isAdopted" = false`);
    return { available: r[0]?.n || 0 };
  }, null);

  if (!out.membership?.active) {
    out.plan = await safe(async () => {
      const plans = await listMembershipPlans(db);
      const monthly = plans.map((p: any) => ({ ...p, perMonth: Math.round((p.amount / Math.max(1, p.months)) * 100) / 100 }));
      monthly.sort((a: any, b: any) => a.perMonth - b.perMonth);
      return monthly[0] ? { fromPerMonth: monthly[0].perMonth, partners: (await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n FROM partners WHERE "isActive" = true`))[0]?.n || 0 } : null;
    }, null);
  }
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
