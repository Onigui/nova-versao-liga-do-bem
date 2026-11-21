/**
 * Ensaio pelas rotas de verdade (api/index.ts), num Postgres limpo, com a separação de ONGs ligada:
 *  1. Limite de uso das promoções (1 por associado, quantidade, total disponível, corrida entre caixas).
 *  2. Vaquinhas (criar, publicar, arrecadado, meta, encerramento, rascunho escondido, separação por ONG).
 *  3. Aviso de vencimento da carteirinha no Início.
 *
 *   DATABASE_URL=… JWT_SECRET=… npx tsx scripts/promo-campaign-smoke.ts
 */
process.env.MULTI_ORG_ISOLATION = 'on';

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { runAsSystem, runWithOrg } from '../api/lib/tenant';
import { clearTenantCaches } from '../api/lib/tenantRequest';
import { cardTokenSecret, issueCardToken } from '../api/lib/cardToken';
import { campaignForDonation, donorDisplayName, effectiveStatus } from '../api/lib/campaigns';
import { daysUntil } from '../api/lib/home';

const JWT_SECRET = process.env.JWT_SECRET || '';
const failures: string[] = [];
let passed = 0;
function check(name: string, ok: boolean, detail?: any) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail !== undefined ? ` → ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
  }
}

type Res = { status: number; body: any };
async function call(handler: any, method: string, url: string, opts: { token?: string; org?: string; body?: any } = {}): Promise<Res> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.org) headers['x-org'] = opts.org;
  const [p, qs] = url.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const req: any = { method, url, headers, body: opts.body ?? (method === 'GET' ? undefined : {}), query };
  void p;
  return new Promise((resolve) => {
    let status = 200;
    const res: any = {
      statusCode: 200,
      setHeader() { return res; },
      getHeader() { return undefined; },
      status(c: number) { status = c; res.statusCode = c; return res; },
      json(b: any) { resolve({ status, body: b }); return res; },
      send(b: any) { resolve({ status, body: b }); return res; },
      end(b?: any) { resolve({ status, body: b ?? null }); return res; },
      writeHead(c: number) { status = c; return res; },
      redirect(c: number) { status = c; resolve({ status, body: null }); return res; },
    };
    Promise.resolve(handler(req, res)).catch((e: any) => resolve({ status: 599, body: String(e?.message || e) }));
  });
}

const tok = (p: { userId: string; email: string; role: string; orgId: string }) => jwt.sign(p, JWT_SECRET, { expiresIn: '1h' });

async function main() {
  if (!process.env.DATABASE_URL || !JWT_SECRET) {
    console.log('DATABASE_URL e JWT_SECRET são obrigatórios');
    process.exit(1);
  }
  const handler = (await import('../api/index')).default;
  const db = new PrismaClient();
  const secret = cardTokenSecret(JWT_SECRET);

  const warm = await call(handler, 'GET', '/api/health');
  check('servidor sobe', warm.status < 500, warm);
  await call(handler, 'GET', '/api/partners', { org: 'liga-do-bem' }); // cria as tabelas do portal
  await call(handler, 'GET', '/api/campaigns', { org: 'liga-do-bem' }); // cria as tabelas das vaquinhas

  const n = Date.now();
  const id = (s: string) => `${s}_${n}`;
  const U = {
    owner: id('u_dono'), caixa2: id('u_caixa2'), ana: id('u_ana'), bia: id('u_bia'), caio: id('u_caio'),
    admin: id('u_admin'), testeAdmin: id('u_teste_admin'), conteudo: id('u_conteudo'),
  };
  const partnerId = id('p_pet');
  const end30 = new Date(Date.now() + 30 * 86400000);
  const end3 = new Date(Date.now() + 3 * 86400000);

  await runAsSystem(async () => {
    await db.$executeRawUnsafe(
      `INSERT INTO organizations (id, slug, name, status, city, state, "createdAt", "updatedAt")
       VALUES ('org_teste', 'ong-teste', 'ONG Teste', 'ACTIVE', 'Botucatu', 'SP', NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
    );
    const users: [string, string, string, string, string | null][] = [
      [U.owner, `dono${n}@pet.test`, 'PARTNER', 'org_liga', null],
      [U.caixa2, `caixa${n}@pet.test`, 'PARTNER', 'org_liga', null],
      [U.ana, `ana${n}@liga.test`, 'MEMBER', 'org_liga', null],
      [U.bia, `bia${n}@liga.test`, 'MEMBER', 'org_liga', null],
      [U.caio, `caio${n}@liga.test`, 'MEMBER', 'org_liga', null],
      [U.admin, `admin${n}@liga.test`, 'ADMIN', 'org_liga', 'GESTOR'],
      [U.conteudo, `conteudo${n}@liga.test`, 'ADMIN', 'org_liga', 'CONTEUDO'],
      [U.testeAdmin, `admin${n}@teste.test`, 'ADMIN', 'org_teste', 'GESTOR'],
    ];
    for (const [uid, email, role, orgId, scope] of users) {
      await db.$executeRawUnsafe(
        `INSERT INTO users (id, email, password, name, role, "isActive", "orgId", "adminScope", "createdAt", "updatedAt")
         VALUES ($1, $2, 'x', $3, $4::"UserRole", true, $5, $6, NOW(), NOW())`,
        uid, email, `Pessoa ${email.split('@')[0]}`, role, orgId, scope,
      );
    }
    await db.$executeRawUnsafe(
      `INSERT INTO partners (id, name, category, address, city, state, "zipCode", "isActive", "orgId", "createdAt", "updatedAt")
       VALUES ($1, 'Pet Ensaio', 'PET_SHOP', 'Rua A, 1', 'Botucatu', 'SP', '18600-000', true, 'org_liga', NOW(), NOW())`,
      partnerId,
    );
    for (const [uid, role] of [[U.owner, 'OWNER'], [U.caixa2, 'STAFF']]) {
      await db.$executeRawUnsafe(
        `INSERT INTO partner_accounts (id, "partnerId", "userId", role, "orgId") VALUES ($1, $2, $3, $4, 'org_liga')`,
        `${uid}_acc`, partnerId, uid, role,
      );
    }
    const mems: [string, string, Date][] = [[U.ana, `MEMANA${n % 100000}`, end30], [U.bia, `MEMBIA${n % 100000}`, end3], [U.caio, `MEMCAIO${n % 100000}`, end30]];
    for (const [uid, mid, end] of mems) {
      await db.$executeRawUnsafe(
        `INSERT INTO memberships (id, "userId", "memberId", status, "startDate", "endDate", "nextPayment", "planMonths", "orgId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'ACTIVE', NOW(), $4, $4, 1, 'org_liga', NOW(), NOW())`,
        `${uid}_m`, uid, mid, end,
      );
    }
  });
  clearTenantCaches();

  const T = {
    owner: tok({ userId: U.owner, email: `dono${n}@pet.test`, role: 'PARTNER', orgId: 'org_liga' }),
    caixa2: tok({ userId: U.caixa2, email: `caixa${n}@pet.test`, role: 'PARTNER', orgId: 'org_liga' }),
    ana: tok({ userId: U.ana, email: `ana${n}@liga.test`, role: 'MEMBER', orgId: 'org_liga' }),
    bia: tok({ userId: U.bia, email: `bia${n}@liga.test`, role: 'MEMBER', orgId: 'org_liga' }),
    admin: tok({ userId: U.admin, email: `admin${n}@liga.test`, role: 'ADMIN', orgId: 'org_liga' }),
    conteudo: tok({ userId: U.conteudo, email: `conteudo${n}@liga.test`, role: 'ADMIN', orgId: 'org_liga' }),
    testeAdmin: tok({ userId: U.testeAdmin, email: `admin${n}@teste.test`, role: 'ADMIN', orgId: 'org_teste' }),
  };
  const card = (uidMember: string) => issueCardToken(secret, uidMember === U.ana ? `MEMANA${n % 100000}` : uidMember === U.bia ? `MEMBIA${n % 100000}` : `MEMCAIO${n % 100000}`).code;

  // ------------------------------------------------------------ 1. promoções
  console.log('\nPromoções com limite');
  const p1 = await call(handler, 'POST', '/api/partner/discounts', { token: T.owner, body: { name: 'Ração 10%', kind: 'PERCENT', percentage: 10 } });
  check('promoção nova nasce com 1 por associado', p1.status === 201 && p1.body?.discount?.perMemberLimit === 1 && p1.body?.discount?.totalLimit === null, p1);
  const p2 = await call(handler, 'POST', '/api/partner/discounts', { token: T.owner, body: { name: 'Lanche brinde', kind: 'OTHER', benefitText: 'Lanche grátis', perMemberLimit: 2, totalLimit: 3 } });
  check('promoção com 2 por associado e 3 no total', p2.status === 201 && p2.body?.discount?.perMemberLimit === 2 && p2.body?.discount?.totalLimit === 3, p2);
  const bad = await call(handler, 'POST', '/api/partner/discounts', { token: T.owner, body: { name: 'X', kind: 'PERCENT', percentage: 5, perMemberLimit: 0 } });
  check('limite 0 é recusado', bad.status === 400, bad);
  const d1 = p1.body.discount.id;
  const d2 = p2.body.discount.id;

  const v1 = await call(handler, 'POST', '/api/partner/validate', { token: T.owner, body: { code: card(U.ana) } });
  const disc1 = (v1.body?.discounts || []) as any[];
  check('validação ativa lista as promoções com o que a Ana pode usar', v1.body?.valid === true && disc1.find((d) => d.id === d1)?.remainingForMember === 1 && disc1.find((d) => d.id === d2)?.remainingForMember === 2, v1.body);
  const r1 = await call(handler, 'PATCH', `/api/partner/validations/${v1.body.validationId}`, {
    token: T.owner, body: { items: [{ discountId: d1, quantity: 1 }, { discountId: d2, quantity: 2 }], amount: '80.00' },
  });
  check('registra duas promoções no mesmo atendimento', r1.status === 200, r1);
  const r1b = await call(handler, 'PATCH', `/api/partner/validations/${v1.body.validationId}`, {
    token: T.owner, body: { items: [{ discountId: d1, quantity: 1 }, { discountId: d2, quantity: 2 }], amount: '80.00' },
  });
  check('corrigir o mesmo atendimento não conta em dobro', r1b.status === 200, r1b);

  const v2 = await call(handler, 'POST', '/api/partner/validate', { token: T.owner, body: { code: card(U.ana) } });
  const disc2 = (v2.body?.discounts || []) as any[];
  const a1 = disc2.find((d) => d.id === d1);
  check('na volta, a promoção usada aparece bloqueada com a data', a1?.available === false && a1?.unavailableReason === 'MEMBER_LIMIT' && !!a1?.lastUsedAt, a1);
  const again = await call(handler, 'PATCH', `/api/partner/validations/${v2.body.validationId}`, { token: T.owner, body: { items: [{ discountId: d1 }] } });
  check('segundo uso da mesma promoção é recusado (409)', again.status === 409 && again.body?.code === 'MEMBER_LIMIT', again);
  const legacy = await call(handler, 'PATCH', `/api/partner/validations/${v2.body.validationId}`, { token: T.owner, body: { discountId: d1, amount: 10 } });
  check('app do parceiro antigo (só discountId) também é barrado', legacy.status === 409, legacy);

  const vb = await call(handler, 'POST', '/api/partner/validate', { token: T.owner, body: { code: card(U.bia) } });
  const two = await call(handler, 'PATCH', `/api/partner/validations/${vb.body.validationId}`, { token: T.owner, body: { items: [{ discountId: d2, quantity: 2 }] } });
  check('total disponível: restava 1, pedir 2 é recusado', two.status === 409 && two.body?.code === 'SOLD_OUT', two);
  // dois caixas ao mesmo tempo disputando a última unidade
  const vc = await call(handler, 'POST', '/api/partner/validate', { token: T.caixa2, body: { code: card(U.caio) } });
  const [ra, rb] = await Promise.all([
    call(handler, 'PATCH', `/api/partner/validations/${vb.body.validationId}`, { token: T.owner, body: { items: [{ discountId: d2 }] } }),
    call(handler, 'PATCH', `/api/partner/validations/${vc.body.validationId}`, { token: T.caixa2, body: { items: [{ discountId: d2 }] } }),
  ]);
  const oks = [ra, rb].filter((r) => r.status === 200).length;
  check('dois caixas ao mesmo tempo: só um leva a última unidade', oks === 1 && [ra, rb].some((r) => r.body?.code === 'SOLD_OUT'), [ra, rb]);
  const used: any[] = await runAsSystem(() => db.$queryRawUnsafe(`SELECT COALESCE(SUM(quantity),0)::int AS n FROM partner_discount_uses WHERE "discountId" = $1`, d2));
  check('nunca passa do total (3)', used[0]?.n === 3, used[0]);

  const pubAna = await call(handler, 'GET', '/api/partners', { token: T.ana });
  const anaD1 = (pubAna.body?.partners || []).flatMap((p: any) => p.discounts || []).find((d: any) => d.id === d1);
  check('app da Ana mostra "já usou" na promoção', anaD1?.available === false && anaD1?.usedByMember === 1, anaD1);
  const pubAnon = await call(handler, 'GET', '/api/partners', { org: 'liga-do-bem' });
  const anonD1 = (pubAnon.body?.partners || []).flatMap((p: any) => p.discounts || []).find((d: any) => d.id === d1);
  check('sem login: só o limite, sem dados de uso', anonD1?.limitLabel === '1 por associado' && anonD1?.available === undefined, anonD1);
  // Esgotou (3 de 3): some da vitrine do associado e do Início, continua no balcão como esgotada
  const pubAll = await call(handler, 'GET', '/api/partners', { org: 'liga-do-bem' });
  const allIds = (pubAll.body?.partners || []).flatMap((p: any) => p.discounts || []).map((d: any) => d.id);
  check('promoção esgotada some do app do associado', !allIds.includes(d2) && allIds.includes(d1), allIds);
  const homeSold = await call(handler, 'GET', '/api/home', { token: T.ana });
  const homeIds = (homeSold.body?.promos || []).flatMap((p: any) => (p.discounts || []).map((d: any) => d.id));
  check('e do Início', !homeIds.includes(d2), homeIds);
  const vSold = await call(handler, 'POST', '/api/partner/validate', { token: T.owner, body: { code: card(U.caio) } });
  const soldAtCounter = (vSold.body?.discounts || []).find((d: any) => d.id === d2);
  check('no balcão aparece como esgotada', soldAtCounter?.soldOut === true && soldAtCounter?.available === false, soldAtCounter);
  const shrink = await call(handler, 'PUT', `/api/partner/discounts/${d2}`, { token: T.owner, body: { totalLimit: 2 } });
  check('parceiro não diminui o total depois de entregar', shrink.status === 400 && shrink.body?.code === 'TOTAL_ONLY_UP', shrink);
  const limitLater = await call(handler, 'PUT', `/api/partner/discounts/${d1}`, { token: T.owner, body: { totalLimit: 5 } });
  check('nem limita depois de usada sem limite', limitLater.status === 400, limitLater);
  const grow = await call(handler, 'PUT', `/api/partner/discounts/${d2}`, { token: T.owner, body: { totalLimit: 10 } });
  check('aumentar o total pode (repôs estoque)', grow.status === 200 && grow.body?.discount?.totalLimit === 10, grow);
  const pubBack = await call(handler, 'GET', '/api/partners', { org: 'liga-do-bem' });
  check('com estoque reposto volta a aparecer', (pubBack.body?.partners || []).flatMap((p: any) => p.discounts || []).some((d: any) => d.id === d2 && d.remainingTotal === 7));
  const mine = await call(handler, 'GET', '/api/partner/discounts', { token: T.owner });
  const m2 = (mine.body?.discounts || []).find((d: any) => d.id === d2);
  check('parceiro vê quantas vezes foi usada (soma das quantidades)', m2?.uses === 3, m2);

  // ------------------------------------------------------------ 2. vaquinhas
  console.log('\nVaquinhas');
  const animalId = id('a_thor');
  await runAsSystem(() =>
    db.$executeRawUnsafe(
      `INSERT INTO animals (id, name, species, gender, size, image, "isActive", "isAdopted", "orgId", "createdAt", "updatedAt")
       VALUES ($1, 'Thor', 'DOG', 'MALE', 'MEDIUM', 'https://img.test/thor.jpg', true, false, 'org_liga', NOW(), NOW())`,
      animalId,
    ),
  );
  const c1 = await call(handler, 'POST', '/api/admin/campaigns', {
    token: T.conteudo, body: { title: 'Cirurgia do Thor', summary: 'Pata traseira', story: 'Foi atropelado.', animalId, goalAmount: '100,00', allowOverGoal: false },
  });
  check('perfil Conteúdo cria a vaquinha (rascunho)', c1.status === 201 && c1.body?.campaign?.status === 'DRAFT', c1);
  const cid = c1.body?.campaign?.id;
  check('sem capa, usa a foto do animal', c1.body?.campaign?.coverUrl === 'https://img.test/thor.jpg', c1.body?.campaign);
  const draftPub = await call(handler, 'GET', `/api/campaigns/${cid}`, { org: 'liga-do-bem' });
  check('rascunho não aparece no app', draftPub.status === 404, draftPub);
  const pubd = await call(handler, 'POST', `/api/admin/campaigns/${cid}/publish`, { token: T.admin });
  check('publica', pubd.status === 200 && pubd.body?.campaign?.status === 'ACTIVE', pubd);
  const list = await call(handler, 'GET', '/api/campaigns', { org: 'liga-do-bem' });
  check('aparece na lista do app da Liga', (list.body?.campaigns || []).some((c: any) => c.id === cid), list.body);
  const byAnimal = await call(handler, 'GET', `/api/campaigns?animalId=${animalId}`, { org: 'liga-do-bem' });
  check('filtra pelo animal (página do Thor)', byAnimal.body?.campaigns?.length === 1, byAnimal.body);
  const listTeste = await call(handler, 'GET', '/api/campaigns', { org: 'ong-teste' });
  check('não aparece no app da ONG Teste', !(listTeste.body?.campaigns || []).some((c: any) => c.id === cid), listTeste.body);
  const admTeste = await call(handler, 'GET', '/api/admin/campaigns', { token: T.testeAdmin });
  check('admin da ONG Teste não vê a vaquinha da Liga', admTeste.status === 200 && !(admTeste.body?.campaigns || []).some((c: any) => c.id === cid), admTeste);
  const stealEdit = await call(handler, 'PUT', `/api/admin/campaigns/${cid}`, { token: T.testeAdmin, body: { title: 'Invadida' } });
  check('admin da ONG Teste não edita', stealEdit.status === 404, stealEdit);

  const ok = await runWithOrg('org_liga', () => campaignForDonation(db, cid).then(() => true).catch(() => false));
  check('checkout aceita doar enquanto está aberta', ok);
  await runAsSystem(async () => {
    for (const [name, anon, amount] of [['Maria Souza', false, 35], ['João', true, 25]] as const) {
      await db.$executeRawUnsafe(
        `INSERT INTO donations (id, amount, method, status, "isAnonymous", "donorName", "donorEmail", "campaignId", "orgId", "createdAt", "updatedAt")
         VALUES ($1, $2, 'PIX', 'APPROVED', $3, $4, 'x@x.test', $5, 'org_liga', NOW(), NOW())`,
        id(`don_${name.length}`), amount, anon, name, cid,
      );
    }
    await db.$executeRawUnsafe(
      `INSERT INTO donations (id, amount, method, status, "isAnonymous", "donorName", "donorEmail", "campaignId", "orgId", "createdAt", "updatedAt")
       VALUES ($1, 500, 'PIX', 'PENDING', false, 'Pendente', 'p@x.test', $2, 'org_liga', NOW(), NOW())`,
      id('don_pend'), cid,
    );
  });
  const det = await call(handler, 'GET', `/api/campaigns/${cid}`, { org: 'liga-do-bem' });
  const dc = det.body?.campaign;
  check('arrecadado soma só as doações pagas', dc?.raised === 60 && dc?.donorsCount === 2, dc);
  check('apoiadores: "Maria S." com valor; anônimo sem nome e sem valor', dc?.donors?.some((d: any) => d.name === 'Maria S.' && d.amount === 35) && dc?.donors?.some((d: any) => d.name === 'Anônimo' && d.amount === null), dc?.donors);
  const off = await call(handler, 'PUT', `/api/admin/campaigns/${cid}`, { token: T.admin, body: { offlineAmount: '40' } });
  check('valor recebido por fora entra na barra e bate a meta', off.body?.campaign?.raised === 100 && off.body?.campaign?.status === 'ENDED' && off.body?.campaign?.closedReason === 'GOAL', off.body?.campaign);
  const closed = await runWithOrg('org_liga', () => campaignForDonation(db, cid).then(() => null).catch((e: any) => e));
  check('meta batida (sem aceitar passar): checkout recusa', closed?.code === 'CAMPAIGN_CLOSED', closed && { code: closed.code, msg: closed.message });
  const upd = await call(handler, 'POST', `/api/admin/campaigns/${cid}/updates`, { token: T.admin, body: { text: 'O Thor operou e passa bem!' } });
  check('publica atualização para os doadores', upd.status === 201, upd);
  const det2 = await call(handler, 'GET', `/api/campaigns/${cid}`, { org: 'liga-do-bem' });
  check('atualização aparece no app', det2.body?.campaign?.updates?.[0]?.text === 'O Thor operou e passa bem!', det2.body?.campaign?.updates);
  const del = await call(handler, 'DELETE', `/api/admin/campaigns/${cid}`, { token: T.admin });
  check('com doações não apaga (só encerra)', del.status === 409 && del.body?.code === 'HAS_DONATIONS', del);
  const reopen = await call(handler, 'POST', `/api/admin/campaigns/${cid}/reopen`, { token: T.admin, body: {} });
  check('reabrir com a meta batida e sem aceitar passar continua encerrada', reopen.body?.campaign?.status === 'ENDED', reopen.body?.campaign);
  check('prazo vencido encerra sozinho', effectiveStatus({ status: 'ACTIVE', endsAt: new Date(Date.now() - 1000), allowOverGoal: true, goalAmount: 10 }, 0).reason === 'DEADLINE');
  check('nome do apoiador', donorDisplayName('ana maria de souza', false) === 'Ana S.' && donorDisplayName('X', true) === 'Anônimo');
  const homeAna = await call(handler, 'GET', '/api/home', { token: T.ana });
  check('Início mostra vaquinhas abertas (a encerrada não)', Array.isArray(homeAna.body?.campaigns) && !homeAna.body.campaigns.some((c: any) => c.id === cid), homeAna.body?.campaigns);

  // ------------------------------------------------------------ 3. aviso de vencimento
  console.log('\nAviso de vencimento');
  const homeBia = await call(handler, 'GET', '/api/home', { token: T.bia });
  const mb = homeBia.body?.membership;
  check('faltando 3 dias (padrão 7): renewSoon', mb?.active === true && mb?.daysLeft === 3 && mb?.renewSoon === true && mb?.renewWarnDays === 7, mb);
  const ma = homeAna.body?.membership;
  check('faltando 30 dias: sem aviso', ma?.renewSoon === false && ma?.daysLeft === 30, ma);
  const cfg = await call(handler, 'PUT', '/api/admin/app/config', { token: T.admin, body: { renewWarnDays: 2 } });
  check('ONG muda a antecedência para 2 dias', cfg.status === 200, cfg);
  const homeBia2 = await call(handler, 'GET', '/api/home', { token: T.bia });
  check('com 2 dias de antecedência, 3 dias não avisa', homeBia2.body?.membership?.renewSoon === false && homeBia2.body?.membership?.renewWarnDays === 2, homeBia2.body?.membership);
  const badCfg = await call(handler, 'PUT', '/api/admin/app/config', { token: T.admin, body: { renewWarnDays: 99 } });
  check('antecedência fora de 0–60 é recusada', badCfg.status === 400, badCfg);
  check('dias até o vencimento contam pelo calendário de Brasília', daysUntil('2026-11-24T02:59:59.000Z', Date.parse('2026-11-21T12:00:00Z')) === 2);

  await db.$disconnect();
  console.log(`\n${passed} ok, ${failures.length} falha(s)`);
  if (failures.length) {
    console.log(failures.map((f) => ` - ${f}`).join('\n'));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
