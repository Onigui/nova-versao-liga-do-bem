/**
 * Textos de cada ONG que aparecem no app e na web, editáveis no painel sem nova versão do app:
 * "Sobre a ONG", termos de uso, política de privacidade e termos de adoção.
 *
 * - Cada publicação vira uma versão nova (nada é apagado): dá para saber qual texto valia quando
 *   alguém aceitou um termo (base para o aceite dos termos de adoção).
 * - Sem texto próprio, vale o modelo padrão, montado com os dados da ONG.
 * - Marcadores trocados na hora de mostrar: {ONG}, {RAZAO_SOCIAL}, {CNPJ}, {CIDADE}, {UF},
 *   {EMAIL}, {EMAIL_PRIVACIDADE}, {WHATSAPP}, {DATA}. Assim o texto acompanha o cadastro da ONG.
 * - Formato: Markdown simples (# título, ## seção, - item, 1. item, **negrito**, [link](https://…)).
 *
 * Rotas
 *   GET  /api/app/org                    dados públicos da ONG de quem pede (nome, contatos, redes)
 *   GET  /api/app/docs/:kind             texto atual (Markdown com os marcadores já trocados)
 *   GET  /api/privacidade | /api/termos | /api/termos-adocao | /api/sobre   página web (?org=slug)
 *   GET  /api/admin/docs                 situação dos 4 textos da ONG do painel
 *   GET  /api/admin/docs/:kind           texto atual (cru, com marcadores), padrão e histórico
 *   PUT  /api/admin/docs/:kind           publica uma versão nova { title, body }
 *
 * A tabela fica fora da separação por ONG do banco (como org_secrets): todo acesso filtra o
 * "orgId" na mão, em modo sistema.
 */
import crypto from 'crypto';
import { currentOrgId, DEFAULT_ORG, runAsSystem } from './tenant';
import { markSchemaApplied, schemaApplied } from './schemaOnce';

export const DOC_KINDS = ['about', 'terms', 'privacy', 'adoption'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export const DOC_LABELS: Record<DocKind, string> = {
  about: 'Sobre a ONG',
  terms: 'Termos de uso',
  privacy: 'Política de privacidade',
  adoption: 'Termos de adoção',
};
const WEB_PATHS: Record<string, DocKind> = {
  '/api/sobre': 'about',
  '/api/termos': 'terms',
  '/api/privacidade': 'privacy',
  '/api/termos-adocao': 'adoption',
};
const MAX_BODY = 60000;

type Ctx = {
  req: any;
  res: any;
  path: string;
  method: string;
  body: any;
  db: any;
  isAdmin: boolean;
  /** Token decodificado (membro, parceiro ou admin), ou null. */
  auth: () => any | null;
  /** ONG que o painel está editando (respeita a troca de ONG da equipe da plataforma). */
  adminOrgId: () => string;
};

export function isOrgDocsPath(path: string) {
  return path === '/api/app/org' || path.startsWith('/api/app/docs/') || path === '/api/admin/docs' || path.startsWith('/api/admin/docs/') || !!WEB_PATHS[path];
}

// ---------------------------------------------------------------- banco

let ready = false;
async function ensureSchema(db: any) {
  if (ready) return;
  if (await schemaApplied(db, 'org_documents', 'v1')) {
    ready = true;
    return;
  }
  await runAsSystem(async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS org_documents (
      id TEXT PRIMARY KEY,
      "orgId" TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      version INTEGER NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "createdBy" TEXT,
      UNIQUE ("orgId", kind, version)
    )`);
  });
  await markSchemaApplied(db, 'org_documents', 'v1');
  ready = true;
}

async function loadOrg(db: any, ref: string) {
  const rows: any[] = await runAsSystem(() =>
    db.$queryRawUnsafe(
      `SELECT id, slug, name, "legalName", cnpj, city, state, branding, contacts, settings, "contactEmail"
         FROM organizations WHERE id = $1 OR slug = $1 LIMIT 1`,
      ref,
    ),
  ).catch(() => []);
  return rows[0] || null;
}

async function latest(db: any, orgId: string, kind: DocKind) {
  const rows: any[] = await runAsSystem(() =>
    db.$queryRawUnsafe(
      `SELECT title, body, version, "createdAt", "createdBy" FROM org_documents
        WHERE "orgId" = $1 AND kind = $2 ORDER BY version DESC LIMIT 1`,
      orgId,
      kind,
    ),
  );
  return rows[0] || null;
}

// ---------------------------------------------------------------- dados da ONG

const fmtCnpj = (c: any) => {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d;
};
const fmtPhone = (p: any) => {
  const d = String(p || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return d.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return d;
};

/** Dados públicos da ONG para o app (tela Sobre, rodapés, carteirinha). */
export function publicOrgInfo(o: any) {
  const c = o?.contacts || {};
  const s = o?.settings || {};
  return {
    id: o?.id || DEFAULT_ORG,
    slug: o?.slug || 'liga-do-bem',
    name: o?.name || 'sua ONG',
    legalName: o?.legalName || o?.name || 'sua ONG',
    cnpj: fmtCnpj(o?.cnpj),
    city: o?.city || null,
    state: o?.state || null,
    about: s.about || null,
    branding: o?.branding || {},
    contacts: {
      whatsapp: c.whatsapp || null,
      phone: c.phone || null,
      email: c.email || o?.contactEmail || null,
      privacyEmail: c.privacyEmail || c.email || o?.contactEmail || null,
      website: c.website || null,
      instagram: c.instagram || null,
      facebook: c.facebook || null,
      address: c.address || null,
    },
  };
}

function placeholders(o: any, publishedAt?: Date | string | null) {
  const p = publicOrgInfo(o);
  const date = publishedAt ? new Date(publishedAt) : new Date();
  return {
    ONG: p.name,
    RAZAO_SOCIAL: p.legalName,
    CNPJ: p.cnpj || '(CNPJ não informado)',
    CIDADE: p.city || '',
    UF: p.state || '',
    EMAIL: p.contacts.email || '(e-mail não informado)',
    EMAIL_PRIVACIDADE: p.contacts.privacyEmail || p.contacts.email || '(e-mail não informado)',
    WHATSAPP: fmtPhone(p.contacts.whatsapp) || '(WhatsApp não informado)',
    DATA: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }),
  } as Record<string, string>;
}

export function fillPlaceholders(text: string, o: any, publishedAt?: Date | string | null) {
  const map = placeholders(o, publishedAt);
  return String(text || '').replace(/\{([A-Z_]+)\}/g, (all, k) => (k in map ? map[k] : all));
}

// ---------------------------------------------------------------- modelos padrão

export function defaultDoc(kind: DocKind, o: any): { title: string; body: string } {
  const quem = String(o?.settings?.about || '').trim();
  if (kind === 'about') {
    return {
      title: 'Sobre a {ONG}',
      body: `${quem || 'A {ONG} é uma organização sem fins lucrativos de {CIDADE}/{UF} que resgata e cuida de animais, promove adoções responsáveis e conscientiza a comunidade.'}

## Nossa missão
Promover o bem-estar animal por meio de adoções responsáveis, cuidados veterinários e conscientização, para que todo animal tenha uma vida digna e um lar com amor.

## Nossos valores
- Amor pelos animais
- Responsabilidade
- Comunidade
- Transparência

## Como ajudar
- **Seja sócio:** a mensalidade mantém o trabalho da ONG e ainda dá descontos nos parceiros.
- **Doe:** pelo app, por PIX, boleto ou cartão.
- **Adote:** veja os animais esperando um lar na aba Adoção.`,
    };
  }
  if (kind === 'terms') {
    return {
      title: 'Termos de uso',
      body: `Estes termos valem para quem usa o aplicativo SóciONG como sócio, apoiador ou parceiro da **{RAZAO_SOCIAL}** (CNPJ {CNPJ}, {CIDADE}/{UF}). Última atualização: {DATA}.

## O aplicativo
O SóciONG é a plataforma que a {ONG} usa para sócios, doações, parceiros, adoções e achados e perdidos. A {ONG} é responsável pelo atendimento, pelas regras de adoção e pelo uso do dinheiro arrecadado.

## Sua conta
- Use dados verdadeiros. O CPF é obrigatório e vale uma conta por pessoa.
- Guarde sua senha: você responde pelo que for feito na sua conta.
- A conta pode ser suspensa em caso de fraude, uso de dados de terceiros ou desrespeito a outras pessoas.

## Carteirinha e descontos
- A carteirinha digital e os descontos valem só para sócios com a mensalidade em dia.
- O QR Code muda a cada poucos minutos e é pessoal. Mostrar a carteirinha de outra pessoa pode suspender as duas contas.
- Os descontos são oferecidos pelos parceiros, que podem mudar as condições. A {ONG} intermedeia, mas não responde pelo produto ou serviço do parceiro.

## Pagamentos
- Mensalidades e doações são processadas pelo Asaas, direto para a conta da {ONG}.
- Planos de 3, 6 ou 12 meses são pagos de uma vez e não renovam sozinhos.
- Pedidos de reembolso: fale com a {ONG} em {EMAIL}.

## Achados e perdidos e conteúdo publicado
- Publique só fotos e informações verdadeiras sobre animais.
- Pedir dinheiro para devolver um animal, ou publicar golpes, leva à exclusão da conta.

## Adoções, eventos e voluntariado
Pedidos de adoção, inscrições em eventos e cadastro de voluntários passam pela análise da {ONG}, que pode recusá-los.

## Contato
{RAZAO_SOCIAL} — {EMAIL} — WhatsApp {WHATSAPP}.`,
    };
  }
  if (kind === 'privacy') {
    return {
      title: 'Política de privacidade',
      body: `Esta política explica como a **{RAZAO_SOCIAL}** (CNPJ {CNPJ}, {CIDADE}/{UF}) trata os dados pessoais de quem usa o aplicativo SóciONG e o aplicativo SóciONG Parceiros, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Última atualização: {DATA}.

## Quem trata os dados
A {ONG} é a controladora dos dados dos seus sócios, doadores e parceiros. A SóciONG fornece a tecnologia do aplicativo e trata os dados em nome da {ONG}, só para fazer o app funcionar.

## Dados que coletamos
- **Cadastro:** nome, e-mail, telefone, CPF e senha (guardada criptografada). O CPF garante uma conta por pessoa e valida a carteirinha.
- **Localização:** com a sua permissão, para mostrar parceiros e animais perdidos perto de você e marcar avisos no mapa. Quando o animal está na sua casa, o mapa público mostra só a região aproximada.
- **Fotos e câmera:** fotos que você escolhe enviar (perfil, pets, avisos, receitas para orçamento).
- **Pets:** nome, espécie, vacinas e histórico de saúde que você ou o veterinário parceiro registram.
- **Pagamentos:** valores, datas e situação de mensalidades e doações. Os dados do cartão são digitados na página segura do Asaas; nem a {ONG} nem a SóciONG veem o número do cartão.
- **Uso de benefícios:** quando a carteirinha é validada em um parceiro.
- **Notificações:** o identificador do aparelho para enviar avisos.

## Para que usamos
- Criar e proteger sua conta e emitir a carteirinha;
- Liberar descontos nos parceiros para sócios em dia;
- Processar mensalidades e doações e prestar contas;
- Avisar sobre adoções, eventos, campanhas e animais perdidos perto de você;
- Combater fraudes e abusos.

Não vendemos seus dados e não os usamos para publicidade de terceiros.

## Com quem compartilhamos
- **Parceiros:** ao validar a carteirinha, o parceiro vê seu nome e se você é sócio em dia; em orçamentos, vê só o que você enviar.
- **Outros usuários:** avisos de achados e perdidos, avistamentos e comentários que você publica.
- **Prestadores de serviço:** Asaas (pagamentos), Supabase (banco de dados), Vercel (servidor), Google Firebase (notificações) e Resend (e-mails).
- Autoridades, quando a lei exigir.

## Por quanto tempo guardamos
Enquanto sua conta existir. Ao excluir a conta, apagamos os dados pessoais e o conteúdo; registros de pagamentos e doações ficam guardados sem identificação, pelo prazo exigido para a prestação de contas da associação.

## Seus direitos
Você pode ver e corrigir seus dados no app (Perfil), revogar permissões de localização, câmera e notificações no celular e excluir sua conta a qualquer momento em Perfil → Excluir minha conta. Dúvidas ou pedidos: {EMAIL_PRIVACIDADE}.

## Segurança
Conexões criptografadas (HTTPS), senhas com hash, dados de cada ONG separados, acesso restrito à administração e QR Code da carteirinha que muda a cada poucos minutos.

## Crianças
O aplicativo é destinado a maiores de 18 anos.`,
    };
  }
  return {
    title: 'Termos de adoção',
    body: `Ao adotar um animal da **{RAZAO_SOCIAL}** (CNPJ {CNPJ}, {CIDADE}/{UF}), a pessoa adotante declara que leu e concorda com os compromissos abaixo. Última atualização: {DATA}.

## Compromissos de quem adota
1. Dar alimentação adequada, água limpa e abrigo protegido do sol, da chuva e do frio.
2. Manter as vacinas e a vermifugação em dia e levar ao veterinário sempre que preciso.
3. Castrar o animal no prazo combinado com a {ONG}, se ele ainda não for castrado.
4. Nunca abandonar, maltratar, prender em corrente curta ou deixar o animal solto na rua.
5. Não vender, doar ou repassar o animal a outra pessoa sem falar antes com a {ONG}.
6. Se não puder mais ficar com o animal, avisar a {ONG} para que ela ajude a encontrar um novo lar.
7. Aceitar o acompanhamento da {ONG} (mensagens, fotos ou visitas combinadas) depois da adoção.
8. Avisar a {ONG} em caso de mudança de endereço, fuga ou morte do animal.

## Da ONG
- Entregar o animal com as informações de saúde que tiver (vacinas, castração, tratamentos).
- Orientar a pessoa adotante nas primeiras semanas.

## Descumprimento
Em caso de maus-tratos ou descumprimento grave, a {ONG} pode pedir a devolução do animal e comunicar as autoridades, conforme a Lei 9.605/1998 (crimes ambientais).

Dúvidas: {EMAIL} — WhatsApp {WHATSAPP}.`,
  };
}

// ---------------------------------------------------------------- Markdown → HTML (páginas web)

const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
    .replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.-]+)/g, '$1<a href="mailto:$2">$2</a>');
}
export function markdownToHtml(md: string) {
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of String(md || '').split(/\r?\n/)) {
    const line = raw.trim();
    let m: RegExpMatchArray | null;
    if (!line) {
      flushPara();
      closeList();
    } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushPara();
      closeList();
      const lvl = m[1].length === 3 ? 3 : 2;
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
    } else if ((m = line.match(/^[-*]\s+(.*)$/)) || (m = line.match(/^\d+[.)]\s+(.*)$/))) {
      flushPara();
      const kind = /^\d/.test(line) ? 'ol' : 'ul';
      if (list !== kind) {
        closeList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      closeList();
      para.push(line);
    }
  }
  flushPara();
  closeList();
  return out.join('\n');
}

function page(o: any, title: string, inner: string, color?: string) {
  const p = publicOrgInfo(o);
  const brand = /^#[0-9a-fA-F]{6}$/.test(String(color || p.branding?.primary || '')) ? String(color || p.branding.primary) : '#0E7C66';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(p.name)}</title>
<style>
:root{--bg:#F6F3EC;--card:#fff;--ink:#10231F;--muted:#3D4F4A;--brand:${brand};--line:#E5E1D8}
@media (prefers-color-scheme:dark){:root{--bg:#0F1614;--card:#17201D;--ink:#EEF2F0;--muted:#C2CCC8;--line:#26312D}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{background:var(--brand);color:#fff;padding:28px 16px;text-align:center}header h1{margin:0;font-size:24px}header p{margin:4px 0 0;opacity:.9}
main{max-width:760px;margin:0 auto;padding:20px 16px 48px}article{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px 22px}
h2{font-size:19px;margin:22px 0 6px}h3{font-size:16px;margin:18px 0 4px}p,li{color:var(--muted)}ul,ol{padding-left:22px}a{color:var(--brand)}
footer{max-width:760px;margin:0 auto;padding:0 16px 32px;color:var(--muted);font-size:13px;text-align:center}
</style></head><body><header><h1>${esc(title)}</h1><p>${esc(p.legalName)}</p></header><main><article>${inner}</article></main>
<footer>${esc(p.legalName)}${p.cnpj ? ` · CNPJ ${esc(p.cnpj)}` : ''} · aplicativo SóciONG</footer></body></html>`;
}

// ---------------------------------------------------------------- leitura pública

/** Texto atual de uma ONG, com os marcadores trocados. */
export async function currentDoc(db: any, o: any, kind: DocKind) {
  await ensureSchema(db);
  const row = await latest(db, o.id, kind);
  const base = row ? { title: row.title, body: row.body } : defaultDoc(kind, o);
  return {
    kind,
    label: DOC_LABELS[kind],
    title: fillPlaceholders(base.title, o, row?.createdAt),
    body: fillPlaceholders(base.body, o, row?.createdAt),
    version: row?.version || 0,
    isDefault: !row,
    publishedAt: row?.createdAt || null,
  };
}

/** ONG de quem pede: token > ?org= / X-Org > ONG da requisição > Liga. */
function requestOrgRef(ctx: Ctx) {
  let auth: any = null;
  try {
    auth = ctx.auth();
  } catch {
    auth = null;
  }
  const q = ctx.req?.query || {};
  const asked = String(q.org || ctx.req?.headers?.['x-org'] || ctx.req?.headers?.['x-org-id'] || '').trim().toLowerCase();
  return String(auth?.orgId || '') || (/^[a-z0-9_-]{1,64}$/.test(asked) ? asked : '') || currentOrgId() || DEFAULT_ORG;
}

const send = (res: any, status: number, data: any) => res.status(status).json(data);

export async function handleOrgDocs(ctx: Ctx): Promise<boolean> {
  const { res, path, method, db } = ctx;
  if (!isOrgDocsPath(path)) return false;
  if (!db) return send(res, 503, { error: 'Banco indisponível' }), true;
  await ensureSchema(db);

  // ----- público: app e web
  if (path === '/api/app/org' && method === 'GET') {
    const o = (await loadOrg(db, requestOrgRef(ctx))) || (await loadOrg(db, DEFAULT_ORG));
    res.setHeader?.('Cache-Control', 'public, max-age=120');
    return send(res, 200, { org: publicOrgInfo(o) }), true;
  }
  const appDoc = path.match(/^\/api\/app\/docs\/([a-z]+)$/);
  if (appDoc && method === 'GET') {
    const kind = appDoc[1] as DocKind;
    if (!DOC_KINDS.includes(kind)) return send(res, 404, { error: 'Texto não encontrado' }), true;
    const o = (await loadOrg(db, requestOrgRef(ctx))) || (await loadOrg(db, DEFAULT_ORG));
    const doc = await currentDoc(db, o, kind);
    res.setHeader?.('Cache-Control', 'public, max-age=120');
    return send(res, 200, { ...doc, org: publicOrgInfo(o), webUrl: `/api${Object.keys(WEB_PATHS).find((p) => WEB_PATHS[p] === kind)!.slice(4)}?org=${encodeURIComponent(o.slug)}` }), true;
  }
  if (WEB_PATHS[path] && method === 'GET') {
    const o = (await loadOrg(db, requestOrgRef(ctx))) || (await loadOrg(db, DEFAULT_ORG));
    const doc = await currentDoc(db, o, WEB_PATHS[path]);
    // O título vira o cabeçalho da página; um "# título" no começo do texto não se repete
    const body = doc.body.replace(/^#\s+.*\n+/, '');
    const extra = WEB_PATHS[path] === 'privacy' ? `<p><a href="/api/excluir-conta">Como excluir minha conta</a></p>` : '';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).send(page(o, doc.title, markdownToHtml(body) + extra));
    return true;
  }

  // ----- painel
  if (!ctx.isAdmin) return send(res, 401, { error: 'Não autorizado' }), true;
  const orgId = ctx.adminOrgId();
  const o = await loadOrg(db, orgId);
  if (!o) return send(res, 404, { error: 'ONG não encontrada' }), true;

  if (path === '/api/admin/docs' && method === 'GET') {
    const items = [];
    for (const kind of DOC_KINDS) {
      const row = await latest(db, o.id, kind);
      items.push({ kind, label: DOC_LABELS[kind], version: row?.version || 0, isDefault: !row, publishedAt: row?.createdAt || null, publishedBy: row?.createdBy || null });
    }
    return send(res, 200, { org: publicOrgInfo(o), docs: items }), true;
  }
  const adm = path.match(/^\/api\/admin\/docs\/([a-z]+)$/);
  const kind = adm?.[1] as DocKind;
  if (!adm || !DOC_KINDS.includes(kind)) return send(res, 404, { error: 'Texto não encontrado' }), true;

  if (method === 'GET') {
    const row = await latest(db, o.id, kind);
    const def = defaultDoc(kind, o);
    const history: any[] = await runAsSystem(() =>
      db.$queryRawUnsafe(
        `SELECT version, title, "createdAt", "createdBy" FROM org_documents WHERE "orgId" = $1 AND kind = $2 ORDER BY version DESC LIMIT 30`,
        o.id,
        kind,
      ),
    );
    return send(res, 200, {
      kind,
      label: DOC_LABELS[kind],
      title: row?.title || def.title,
      body: row?.body || def.body,
      version: row?.version || 0,
      isDefault: !row,
      defaultTitle: def.title,
      defaultBody: def.body,
      history,
      placeholders: placeholders(o),
    }), true;
  }
  if (method === 'PUT') {
    const b = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};
    const title = String(b.title || '').trim().slice(0, 160);
    const body = String(b.body || '').replace(/\r\n/g, '\n').trim();
    if (title.length < 2) return send(res, 400, { error: 'Dê um título ao texto', field: 'title' }), true;
    if (body.length < 20) return send(res, 400, { error: 'O texto está curto demais', field: 'body' }), true;
    if (body.length > MAX_BODY) return send(res, 400, { error: `Texto longo demais (até ${MAX_BODY} caracteres)`, field: 'body' }), true;
    let who: string | null = null;
    try {
      who = ctx.auth()?.email || null;
    } catch {
      who = null;
    }
    const row = await latest(db, o.id, kind);
    if (row && row.title === title && row.body === body) return send(res, 200, { ok: true, version: row.version, unchanged: true }), true;
    const version = (row?.version || 0) + 1;
    await runAsSystem(() =>
      db.$executeRawUnsafe(
        `INSERT INTO org_documents (id, "orgId", kind, title, body, version, "createdBy") VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        crypto.randomUUID(),
        o.id,
        kind,
        title,
        body,
        version,
        who,
      ),
    );
    console.log(`📝 ${DOC_LABELS[kind]} v${version} publicado para ${o.id}`);
    return send(res, 200, { ok: true, version }), true;
  }
  return send(res, 405, { error: 'Método não permitido' }), true;
}
