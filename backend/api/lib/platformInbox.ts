/**
 * Central de pendências da plataforma SóciONG: o que precisa ser feito em CADA ONG, numa lista só.
 *
 * - Por ONG ativa: os mesmos itens do "precisa da sua atenção" do painel (lib/adminOverview.ts),
 *   calculados dentro da ONG (com a separação ligada cada uma vê só os próprios dados),
 *   mais há quanto tempo o item mais antigo está esperando.
 * - Da plataforma: checklist de entrada recebido para conferir, ONG ativa sem PagBank,
 *   itens sugeridos para o catálogo (que é um só para todas as ONGs).
 * - Resumo diário por e-mail para a equipe da plataforma, só quando há algo pendente.
 */
import { buildOverview } from './adminOverview';
import { escapeHtml, sendEmail } from './email';
import { getOrgSecret, platformAdminEmails } from './orgs';
import { DEFAULT_ORG, isolationOn, runAsSystem, runWithOrg } from './tenant';
import { listInvoices, syncFeeInvoices } from './platformFees';

type Item = {
  key: string;
  label: string;
  count: number;
  section: string;
  sub: string | null;
  tone: string;
  oldestAt: string | null;
};

const num = (v: any) => Number(v || 0);

/** Quando entrou o item mais antigo de cada tipo (as tabelas que não existirem são ignoradas). */
const AGE_SQL: Record<string, string> = {
  pixDonations: `SELECT MIN("createdAt") AS t FROM donations WHERE status = 'PENDING' AND method = 'PIX' AND "transactionId" LIKE 'PIX_CLAIMED_%'`,
  crmvPending: `SELECT MIN("createdAt") AS t FROM partner_vets WHERE status = 'PENDING'`,
  reviewReports: `SELECT MIN("createdAt") AS t FROM partner_review_reports WHERE status = 'OPEN'`,
  lostFoundHidden: `SELECT MIN("updatedAt") AS t FROM lf_reports WHERE hidden AND status = 'ACTIVE'`,
  lostFoundComments: `SELECT MIN("createdAt") AS t FROM lf_comments WHERE hidden AND "hiddenBy" = 'FLAGS'`,
  lostFoundMerges: `SELECT MIN("createdAt") AS t FROM lf_merges WHERE status = 'PENDING'`,
  nfpDeclared: `SELECT MIN("declaredAt") AS t FROM nfp_supporters WHERE status = 'DECLARED'`,
  adoptionsPending: `SELECT MIN("createdAt") AS t FROM adoptions WHERE status = 'PENDING'`,
  partnerRequests: `SELECT MIN("createdAt") AS t FROM partner_requests WHERE status = 'NEW'`,
};

async function oldest(db: any, keys: string[]) {
  const out: Record<string, string | null> = {};
  for (const k of keys) {
    const sql = AGE_SQL[k];
    if (!sql) continue;
    try {
      const r: any[] = await db.$queryRawUnsafe(sql);
      out[k] = r?.[0]?.t ? new Date(r[0].t).toISOString() : null;
    } catch {
      out[k] = null;
    }
  }
  return out;
}

export async function buildInbox(db: any, now = new Date()) {
  const iso = isolationOn();
  const orgs: any[] = await runAsSystem(() =>
    db.$queryRawUnsafe(
      `SELECT id, slug, name, status, branding,
              (SELECT COUNT(*)::int FROM org_onboarding b WHERE b."orgId" = o.id AND b.status = 'RECEIVED') AS received
         FROM organizations o ORDER BY (o.id = $1) DESC, o.name`,
      DEFAULT_ORG,
    ),
  );
  // Taxa de 10%: os meses fechados viram cobrança; as que faltam receber entram na central
  let pendingFees: any[] = [];
  try {
    await syncFeeInvoices(db, now);
    pendingFees = (await listInvoices(db)).filter((f) => f.status === 'PENDING' && f.feeCents > 0);
  } catch {
    pendingFees = [];
  }
  const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const result: any[] = [];
  for (const o of orgs) {
    const items: Item[] = [];
    let blocked: string | null = null;
    if (o.status === 'ACTIVE') {
      if (iso || o.id === DEFAULT_ORG) {
        const ov: any = await runWithOrg(o.id, () => buildOverview(db, now));
        const list = (ov.attention || []).filter((a: any) => a.key !== 'catalogSuggested');
        const ages = await runWithOrg(o.id, () => oldest(db, list.map((a: any) => a.key)));
        for (const a of list) items.push({ key: a.key, label: a.label, count: num(a.count), section: a.section, sub: a.sub ?? null, tone: a.tone, oldestAt: ages[a.key] ?? null });
      } else {
        blocked = 'Separação de dados desligada: os dados desta ONG só aparecem com MULTI_ORG_ISOLATION=on';
      }
      const hasPagbank =
        o.id === DEFAULT_ORG
          ? !!String(process.env.PAGBANK_TOKEN || process.env.PAGSEGURO_TOKEN || '').trim()
          : !!(await getOrgSecret(db, o.id, 'PAGBANK_TOKEN'));
      if (!hasPagbank) {
        items.push({ key: 'pagbankMissing', label: 'PagBank não conectado: a ONG não consegue cobrar mensalidades', count: 1, section: 'platform', sub: null, tone: 'danger', oldestAt: null });
      }
    }
    const fees = pendingFees.filter((f) => f.orgId === o.id);
    if (fees.length) {
      const total = fees.reduce((a, f) => a + f.feeCents, 0);
      items.push({ key: 'feeDue', label: `Taxa SóciONG a receber: ${brl(total)} (${fees.map((f) => f.month.split('-').reverse().join('/')).join(', ')})`, count: fees.length, section: 'platform', sub: 'taxas', tone: 'warn', oldestAt: null });
    }
    if (num(o.received) > 0) {
      items.push({ key: 'onboardingReceived', label: 'Documentos do protocolo de entrada recebidos para conferir', count: num(o.received), section: 'platform', sub: null, tone: 'warn', oldestAt: null });
    }
    result.push({
      org: { id: o.id, slug: o.slug, name: o.name, status: o.status, color: o.branding?.primary || null },
      items,
      total: items.reduce((s, i) => s + i.count, 0),
      blocked,
    });
  }

  // Itens que são da plataforma inteira
  const platform: Item[] = [];
  try {
    const r: any[] = await runAsSystem(() =>
      db.$queryRawUnsafe(`SELECT COUNT(*)::int AS n, MIN("createdAt") AS t FROM catalog_items WHERE "partnerId" IS NOT NULL AND "isActive"`),
    );
    if (num(r?.[0]?.n) > 0) {
      platform.push({ key: 'catalogSuggested', label: 'Itens sugeridos por parceiros para o catálogo (vale para todas as ONGs)', count: num(r[0].n), section: 'discounts', sub: 'catalogo', tone: 'info', oldestAt: r[0].t ? new Date(r[0].t).toISOString() : null });
    }
  } catch {
    /* catálogo ainda não criado */
  }

  const total = result.reduce((s, r) => s + r.total, 0) + platform.reduce((s, i) => s + i.count, 0);
  return { generatedAt: now.toISOString(), isolation: iso, total, orgs: result, platform };
}

// ---------------------------------------------------------------- resumo diário por e-mail

const ADMIN_URL = () => process.env.ADMIN_URL || 'https://nova-versao-liga-do-bem-pufx.vercel.app';

function daysAgo(iso: string | null, now: Date) {
  if (!iso) return '';
  const d = Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? ' (desde hoje)' : d === 1 ? ' (há 1 dia)' : ` (há ${d} dias)`;
}

export function digestContent(inbox: any, now = new Date()) {
  const blocks = inbox.orgs.filter((o: any) => o.total > 0);
  const lines: string[] = [];
  const html: string[] = [];
  for (const o of blocks) {
    lines.push(`${o.org.name}:`);
    html.push(`<h3 style="margin:18px 0 6px;font-size:16px;color:#10231F">${escapeHtml(o.org.name)}</h3><ul style="margin:0;padding-left:18px">`);
    for (const i of o.items) {
      lines.push(`  - ${i.count} · ${i.label}${daysAgo(i.oldestAt, now)}`);
      html.push(`<li style="margin:4px 0"><strong>${i.count}</strong> · ${escapeHtml(i.label)}<span style="color:#4B5E59">${escapeHtml(daysAgo(i.oldestAt, now))}</span></li>`);
    }
    html.push('</ul>');
  }
  if (inbox.platform.length) {
    lines.push('Plataforma:');
    html.push(`<h3 style="margin:18px 0 6px;font-size:16px;color:#10231F">Plataforma</h3><ul style="margin:0;padding-left:18px">`);
    for (const i of inbox.platform) {
      lines.push(`  - ${i.count} · ${i.label}${daysAgo(i.oldestAt, now)}`);
      html.push(`<li style="margin:4px 0"><strong>${i.count}</strong> · ${escapeHtml(i.label)}</li>`);
    }
    html.push('</ul>');
  }
  const url = `${ADMIN_URL()}/#central`;
  return {
    subject: `SóciONG: ${inbox.total} ${inbox.total === 1 ? 'pendência' : 'pendências'} nas ONGs`,
    text: `Bom dia! Pendências nas ONGs da plataforma:\n\n${lines.join('\n')}\n\nAbrir a central: ${url}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#10231F">
<p style="font-size:15px">Bom dia! Pendências nas ONGs da plataforma:</p>${html.join('')}
<p style="margin-top:22px"><a href="${url}" style="background:#0E7C66;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Abrir a central</a></p>
<p style="font-size:12px;color:#4B5E59">Resumo enviado uma vez por dia, só quando há algo pendente.</p></div>`,
  };
}

/** Uma vez por dia, a partir das 8h (horário de Brasília). Chamado pelo agendador a cada 10 minutos. */
export async function runDailyDigest(db: any, now = new Date(), opts: { force?: boolean } = {}) {
  const br = new Date(now.getTime() - 3 * 3600 * 1000);
  const day = br.toISOString().slice(0, 10);
  if (!opts.force && br.getUTCHours() < 8) return { sent: false, reason: 'antes das 8h' };
  return runAsSystem(async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS platform_kv (key TEXT PRIMARY KEY, value TEXT, "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW())`);
    // Marca o dia antes de enviar: duas chamadas ao mesmo tempo não mandam dois e-mails
    const claimed: any[] = await db.$queryRawUnsafe(
      `INSERT INTO platform_kv (key, value) VALUES ('digest:last', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = NOW()
       WHERE platform_kv.value IS DISTINCT FROM EXCLUDED.value
       RETURNING key`,
      day,
    );
    if (!opts.force && !claimed.length) return { sent: false, reason: 'já enviado hoje' };
    const inbox = await buildInbox(db, now);
    if (inbox.total === 0) return { sent: false, reason: 'nada pendente', total: 0 };
    const to = await platformAdminEmails(db);
    if (!to.length) return { sent: false, reason: 'sem destinatários' };
    const mail = digestContent(inbox, now);
    const results = [];
    for (const addr of to) results.push((await sendEmail({ to: addr, ...mail })).ok);
    return { sent: results.some(Boolean), total: inbox.total, recipients: to.length };
  });
}
