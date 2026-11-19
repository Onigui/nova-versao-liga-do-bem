/**
 * Ensaio com uma segunda ONG de mentira ("ONG Teste") passando pelas rotas de verdade
 * (api/index.ts) com MULTI_ORG_ISOLATION=on, num Postgres limpo.
 *
 * Confere que cada ONG só vê e altera o que é dela no painel e no app, e que os perfis
 * de administrador valem de ponta a ponta. Roda no CI junto com o isolation-check.
 *
 *   DATABASE_URL=… JWT_SECRET=… npx tsx scripts/two-orgs-smoke.ts
 */
process.env.MULTI_ORG_ISOLATION = 'on';
process.env.PLATFORM_ADMIN_EMAILS = 'plataforma@sociong.test';

import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { runAsSystem } from '../api/lib/tenant';
import { clearTenantCaches } from '../api/lib/tenantRequest';

const JWT_SECRET = process.env.JWT_SECRET || '';
const failures: string[] = [];
let passed = 0;
function check(name: string, ok: boolean, detail?: any) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail !== undefined ? ` → ${JSON.stringify(detail).slice(0, 300)}` : ''}`);
  }
}

type Res = { status: number; body: any };
async function call(handler: any, method: string, url: string, opts: { token?: string; org?: string; body?: any } = {}): Promise<Res> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.org) headers['x-org'] = opts.org;
  const req: any = { method, url, headers, body: opts.body ?? (method === 'GET' ? undefined : {}), query: {} };
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

  // 1ª chamada prepara o banco (organizações, colunas orgId, políticas de isolamento)
  const warm = await call(handler, 'GET', '/api/health');
  check('servidor sobe com a separação ligada', warm.status < 500, warm);
  await call(handler, 'GET', '/api/events', { org: 'liga-do-bem' });

  const now = Date.now();
  const ids = {
    platform: `u_plat_${now}`, ligaAdmin: `u_liga_admin_${now}`, ligaMember: `u_liga_m_${now}`,
    testeAdmin: `u_teste_admin_${now}`, testeConteudo: `u_teste_cont_${now}`, testeMember: `u_teste_m_${now}`,
  };
  await runAsSystem(async () => {
    await db.$executeRawUnsafe(
      `INSERT INTO organizations (id, slug, name, status, city, state, "createdAt", "updatedAt")
       VALUES ('org_teste', 'ong-teste', 'ONG Teste', 'ACTIVE', 'Botucatu', 'SP', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
    );
    const users: [string, string, string, string, string | null][] = [
      [ids.platform, 'plataforma@sociong.test', 'ADMIN', 'org_liga', null],
      [ids.ligaAdmin, 'admin@liga.test', 'ADMIN', 'org_liga', 'GESTOR'],
      [ids.ligaMember, 'membro@liga.test', 'MEMBER', 'org_liga', null],
      [ids.testeAdmin, 'admin@teste.test', 'ADMIN', 'org_teste', 'GESTOR'],
      [ids.testeConteudo, 'conteudo@teste.test', 'ADMIN', 'org_teste', 'CONTEUDO'],
      [ids.testeMember, 'membro@teste.test', 'MEMBER', 'org_teste', null],
    ];
    for (const [id, email, role, orgId, scope] of users) {
      await db.$executeRawUnsafe(
        `INSERT INTO users (id, email, password, name, role, "isActive", "orgId", "adminScope", "createdAt", "updatedAt")
         VALUES ($1, $2, 'x', $3, $4::"UserRole", true, $5, $6, NOW(), NOW())`,
        id, email, `Pessoa ${email.split('@')[0]}`, role, orgId, scope,
      );
    }
  });

  clearTenantCaches(); // a lista de ONGs fica 1 min em cache: a ONG Teste acabou de nascer

  const T = {
    platform: tok({ userId: ids.platform, email: 'plataforma@sociong.test', role: 'ADMIN', orgId: 'org_liga' }),
    ligaAdmin: tok({ userId: ids.ligaAdmin, email: 'admin@liga.test', role: 'ADMIN', orgId: 'org_liga' }),
    testeAdmin: tok({ userId: ids.testeAdmin, email: 'admin@teste.test', role: 'ADMIN', orgId: 'org_teste' }),
    testeConteudo: tok({ userId: ids.testeConteudo, email: 'conteudo@teste.test', role: 'ADMIN', orgId: 'org_teste' }),
  };

  console.log('\nPainel: cada ONG vê só a sua gente');
  const mTeste = await call(handler, 'GET', '/api/admin/members', { token: T.testeAdmin });
  const emailsTeste = (mTeste.body?.members || []).map((m: any) => m.email);
  check('ONG Teste lista membros', mTeste.status === 200, mTeste);
  check('ONG Teste não vê ninguém da Liga', !emailsTeste.some((e: string) => e.endsWith('@liga.test')), emailsTeste);
  check('ONG Teste vê os seus', emailsTeste.includes('membro@teste.test'), emailsTeste);
  const mLiga = await call(handler, 'GET', '/api/admin/members', { token: T.ligaAdmin });
  const emailsLiga = (mLiga.body?.members || []).map((m: any) => m.email);
  check('Liga não vê ninguém da ONG Teste', !emailsLiga.some((e: string) => e.endsWith('@teste.test')), emailsLiga);
  check('Liga vê os seus', emailsLiga.includes('membro@liga.test'), emailsLiga);

  console.log('\nPainel: uma ONG não mexe em gente da outra');
  const steal = await call(handler, 'POST', '/api/admin/users/role', { token: T.testeAdmin, body: { email: 'membro@liga.test', role: 'ADMIN' } });
  check('ONG Teste não promove membro da Liga', steal.status === 404 || steal.status === 403, steal);
  const edit = await call(handler, 'PUT', `/api/admin/members/${ids.ligaMember}`, { token: T.testeAdmin, body: { name: 'Invadido Silva' } });
  check('ONG Teste não edita membro da Liga', edit.status === 404 || edit.status === 403, edit);
  const still: any[] = await runAsSystem(() => db.$queryRawUnsafe(`SELECT name, role::text AS role FROM users WHERE id = $1`, ids.ligaMember));
  check('membro da Liga ficou intacto', still[0]?.name !== 'Invadido Silva' && still[0]?.role === 'MEMBER', still[0]);

  console.log('\nEventos: cada ONG no seu app');
  const future = new Date(Date.now() + 7 * 86400000).toISOString();
  const evT = await call(handler, 'POST', '/api/admin/events', { token: T.testeConteudo, body: { title: 'Feira da ONG Teste', type: 'ADOPTION_FAIR', startDate: future } });
  check('perfil Conteúdo da ONG Teste cria evento', evT.status === 200 || evT.status === 201, evT);
  const evL = await call(handler, 'POST', '/api/admin/events', { token: T.ligaAdmin, body: { title: 'Feira da Liga', type: 'ADOPTION_FAIR', startDate: future } });
  check('Gestor da Liga cria evento', evL.status === 200 || evL.status === 201, evL);
  const appLiga = await call(handler, 'GET', '/api/events', { org: 'liga-do-bem' });
  const titlesLiga = (appLiga.body?.events || []).map((e: any) => e.title);
  check('app da Liga mostra o evento da Liga', titlesLiga.includes('Feira da Liga'), titlesLiga);
  check('app da Liga não mostra evento da ONG Teste', !titlesLiga.includes('Feira da ONG Teste'), titlesLiga);
  const appTeste = await call(handler, 'GET', '/api/events', { org: 'ong-teste' });
  const titlesTeste = (appTeste.body?.events || []).map((e: any) => e.title);
  check('app da ONG Teste mostra só o dela', titlesTeste.includes('Feira da ONG Teste') && !titlesTeste.includes('Feira da Liga'), titlesTeste);
  const evRow: any[] = await runAsSystem(() => db.$queryRawUnsafe(`SELECT "orgId" FROM events WHERE title = 'Feira da ONG Teste'`));
  check('evento gravado com a ONG certa', evRow[0]?.orgId === 'org_teste', evRow[0]);

  console.log('\nPerfis de administrador');
  const payC = await call(handler, 'GET', '/api/admin/membership-payments', { token: T.testeConteudo });
  check('perfil Conteúdo não vê pagamentos', payC.status === 403, payC.status);
  const memC = await call(handler, 'POST', '/api/admin/members', { token: T.testeConteudo, body: { name: 'Novo Admin', email: 'novo@teste.test', role: 'ADMIN' } });
  check('perfil Conteúdo não cadastra administrador', memC.status === 403, memC.status);
  const verC = await call(handler, 'GET', '/api/admin/verify', { token: T.testeConteudo });
  check('verify devolve o perfil', verC.body?.adminScope === 'CONTEUDO' && verC.body?.isPlatform === false, verC.body);
  const appV = await call(handler, 'POST', '/api/admin/app/versions', { token: T.testeAdmin, body: {} });
  check('Gestor da ONG não publica versão do app', appV.status === 403, appV.status);
  const plat = await call(handler, 'GET', '/api/platform/orgs', { token: T.testeAdmin });
  check('Gestor da ONG não entra na plataforma', plat.status === 403 || plat.status === 401, plat.status);
  const platOk = await call(handler, 'GET', '/api/platform/orgs', { token: T.platform });
  check('equipe da plataforma vê as duas ONGs', platOk.status === 200 && (platOk.body?.orgs || []).length >= 2, platOk.status);

  console.log('\nRebaixado perde o acesso na hora');
  await runAsSystem(() => db.$executeRawUnsafe(`UPDATE users SET role = 'MEMBER' WHERE id = $1`, ids.testeConteudo));
  // o cache de perfil vale 1 min; força a leitura nova com outro usuário de mesmo token não é possível, então espera o cache
  const demoted = await call(handler, 'GET', '/api/admin/members', { token: T.testeConteudo });
  check('token de quem deixou de ser admin não abre área sem acesso', demoted.status === 401 || demoted.status === 403, demoted.status);

  await db.$disconnect();
  console.log(`\n${passed} ok, ${failures.length} falha(s)`);
  if (failures.length) {
    console.log('Falhou:\n- ' + failures.join('\n- '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
