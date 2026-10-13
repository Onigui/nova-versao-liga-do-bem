/**
 * Coordenadas da empresa a partir do endereço (OpenStreetMap / Nominatim, gratuito).
 * Usado quando o admin ou o parceiro salva um endereço sem latitude/longitude, e para
 * preencher aos poucos as empresas antigas que ficaram sem coordenadas.
 */

type Addr = { address?: string | null; city?: string | null; state?: string | null; zipCode?: string | null };

const UA = 'LigaDoBem/1.0 (+https://nova-versao-liga-do-bem.vercel.app)';

async function search(params: Record<string, string>, timeoutMs: number) {
  const qs = new URLSearchParams({ format: 'json', limit: '1', countrycodes: 'br', ...params }).toString();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR' },
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    const lat = Number(j?.[0]?.lat);
    const lng = Number(j?.[0]?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Tenta do mais preciso para o menos preciso: endereço completo → rua e número → CEP. */
export async function geocodeAddress(a: Addr, timeoutMs = 4000) {
  const address = String(a.address || '').trim();
  const city = String(a.city || '').trim();
  const state = String(a.state || '').trim();
  const cep = String(a.zipCode || '').replace(/\D/g, '');
  if (!city && !cep) return null;
  // "Rua X, 12 - Bairro" → "Rua X, 12" (o bairro às vezes atrapalha a busca)
  const streetOnly = address.split(' - ')[0].trim();
  const attempts: Record<string, string>[] = [];
  if (address) attempts.push({ q: `${address}, ${city} - ${state}, Brasil` });
  if (streetOnly && streetOnly !== address) attempts.push({ street: streetOnly, city, state, country: 'Brasil' });
  if (cep.length === 8) attempts.push({ postalcode: `${cep.slice(0, 5)}-${cep.slice(5)}`, country: 'Brasil' });
  for (const p of attempts) {
    const r = await search(p, timeoutMs);
    if (r) return r;
  }
  return null;
}

/** Preenche as coordenadas de até `max` empresas sem localização (uma tentativa por dia cada). */
export async function backfillPartnerCoords(db: any, max = 2): Promise<number> {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT id, address, city, state, "zipCode" FROM partners
      WHERE "isActive" = true AND (latitude IS NULL OR longitude IS NULL)
        AND ("geocodeTriedAt" IS NULL OR "geocodeTriedAt" < NOW() - INTERVAL '1 day')
      ORDER BY "updatedAt" DESC NULLS LAST LIMIT ${Math.max(1, Math.min(5, max))}`,
  );
  let filled = 0;
  for (const p of rows) {
    const c = await geocodeAddress(p, 3500);
    if (c) {
      await db.$executeRawUnsafe(
        `UPDATE partners SET latitude = $1, longitude = $2, "geocodeTriedAt" = NOW() WHERE id = $3`,
        c.latitude,
        c.longitude,
        p.id,
      );
      filled++;
    } else {
      await db.$executeRawUnsafe(`UPDATE partners SET "geocodeTriedAt" = NOW() WHERE id = $1`, p.id);
    }
  }
  return filled;
}

/**
 * Depois de salvar uma empresa: se o endereço mudou sem coordenadas novas (ou se ela não tem
 * coordenadas), busca a localização. Sem resultado, zera as coordenadas antigas (que seriam de
 * outro endereço) e deixa para a próxima tentativa automática.
 */
export async function refreshPartnerCoords(
  db: any,
  partnerId: string,
  opts: { addressChanged: boolean; coordsGiven: boolean },
): Promise<void> {
  if (opts.coordsGiven) return;
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT id, address, city, state, "zipCode", latitude, longitude FROM partners WHERE id = $1`,
    partnerId,
  );
  const p = rows?.[0];
  if (!p) return;
  const missing = p.latitude == null || p.longitude == null;
  if (!opts.addressChanged && !missing) return;
  const c = await geocodeAddress(p, 3500);
  if (c) {
    await db.$executeRawUnsafe(
      `UPDATE partners SET latitude = $1, longitude = $2, "geocodeTriedAt" = NOW() WHERE id = $3`,
      c.latitude,
      c.longitude,
      partnerId,
    );
  } else if (opts.addressChanged) {
    await db.$executeRawUnsafe(
      `UPDATE partners SET latitude = NULL, longitude = NULL, "geocodeTriedAt" = NULL WHERE id = $1`,
      partnerId,
    );
  }
}
