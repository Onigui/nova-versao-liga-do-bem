/**
 * Confere a separação de dados entre ONGs (fase 2) com o Prisma de verdade e um Postgres de verdade.
 * Roda no GitHub Actions (.github/workflows/backend-isolation.yml) a cada PR que mexe no backend.
 *
 *   DATABASE_URL=postgres://... npx prisma db push && npx tsx scripts/isolation-check.ts
 */
import { PrismaClient } from '@prisma/client';
import { instrumentDb } from '../api/lib/dbTiming';
import { ensureOrgSchema } from '../api/lib/orgs';
import { grossByMonth, listInvoices, syncFeeInvoices, withFee } from '../api/lib/platformFees';
import { ensurePartnerPushSchema, listSlots, slotTaken } from '../api/lib/partnerPush';
import { decideAdminAccess, canManageAdmins } from '../api/lib/adminAccess';
import { ensureIsolationSchema, forceIsolation, isolationSelfTest, runAsSystem, runWithOrg, scopeDb } from '../api/lib/tenant';

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, extra?: any) {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? '✅' : '❌'} ${name}${!ok && extra !== undefined ? ' — ' + JSON.stringify(extra).slice(0, 400) : ''}`);
}

async function main() {
  const raw = instrumentDb(new PrismaClient());
  const db: any = scopeDb(raw);

  await ensureOrgSchema(db);
  forceIsolation(true); // como em produção depois de ligar: os únicos antigos saem
  const rep = await ensureIsolationSchema(db, true);
  check('esquema de isolamento aplicado', rep.ok, rep.errors);

  await runAsSystem(async () => {
    await db.$executeRawUnsafe(`INSERT INTO organizations (id, slug, name, status) VALUES ('org_b', 'patinhas', 'Patinhas', 'ACTIVE') ON CONFLICT (id) DO NOTHING`);
  });

  // Em qual papel/ONG a consulta roda
  forceIsolation(true);
  const who: any[] = await runWithOrg('org_b', () => db.$queryRawUnsafe(`SELECT current_user::text AS u, current_setting('app.org_id', true) AS org`));
  check('consulta roda como org_member na ONG B', who[0]?.u === 'org_member' && who[0]?.org === 'org_b', who);

  // Transação de verdade (o tx.$queryRawUnsafe medido pelo dbTiming não pode escapar dela)
  forceIsolation(false);
  await db
    .$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`INSERT INTO system_config (id, key, value, type, "updatedAt") VALUES ('rb', 'rollback.test', 'x', 'STRING', NOW())`);
      throw new Error('desfaz');
    })
    .catch(() => {});
  check('erro dentro de $transaction desfaz o SQL cru (atomicidade)', (await raw.systemConfig.count({ where: { key: 'rollback.test' } })) === 0);
  forceIsolation(true);

  // Com a chave desligada nada muda: tudo cai na Liga
  forceIsolation(false);
  await db.user.create({ data: { email: 'liga@x.org', password: 'x', name: 'Liga', role: 'ADMIN' } });
  forceIsolation(true);

  // Modelo do Prisma: create sem orgId cai na ONG da requisição
  await runWithOrg('org_b', () => db.user.create({ data: { email: 'b@x.org', password: 'x', name: 'B', role: 'ADMIN' } }));
  const orgs: any[] = await raw.$queryRawUnsafe(`SELECT email, "orgId" FROM users ORDER BY email`);
  check('user.create cai na ONG certa', JSON.stringify(orgs) === JSON.stringify([{ email: 'b@x.org', orgId: 'org_b' }, { email: 'liga@x.org', orgId: 'org_liga' }]), orgs);

  check('B: user.count = 1', (await runWithOrg('org_b', () => db.user.count())) === 1);
  check('Liga: user.findMany só a Liga', (await runWithOrg('org_liga', () => db.user.findMany())).map((u: any) => u.email).join() === 'liga@x.org');
  check('B: findUnique de usuário da Liga → null', (await runWithOrg('org_b', () => db.user.findUnique({ where: { email: 'liga@x.org' } }))) === null);
  const upd = await runWithOrg('org_b', () => db.user.updateMany({ where: { email: 'liga@x.org' }, data: { name: 'hack' } }));
  check('B: updateMany na Liga → 0', upd.count === 0, upd);
  let err: any = null;
  try {
    await runWithOrg('org_b', () => db.user.update({ where: { email: 'liga@x.org' }, data: { name: 'hack' } }));
  } catch (e) {
    err = e;
  }
  check('B: update direto na Liga → erro (registro não encontrado)', !!err);

  // SQL cru, com parâmetros e com template
  const r1: any[] = await runWithOrg('org_b', () => db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM users WHERE role::text = $1`, 'ADMIN'));
  check('$queryRawUnsafe isolado', r1[0].n === 1, r1);
  const r2: any[] = await runWithOrg('org_b', () => db.$queryRaw`SELECT email FROM users`);
  check('$queryRaw (template) isolado', r2.length === 1 && r2[0].email === 'b@x.org', r2);

  // Transação interativa do próprio app
  const n = await runWithOrg('org_b', () =>
    db.$transaction(async (tx: any) => {
      await tx.systemConfig.create({ data: { key: 'app.name', value: 'Patinhas', type: 'STRING', isPublic: true } });
      return tx.systemConfig.count();
    }),
  );
  check('$transaction(fn) do app isolado e grava na ONG', n === 1, n);
  await runWithOrg('org_liga', () => db.systemConfig.create({ data: { key: 'app.name', value: 'Liga do Bem', type: 'STRING', isPublic: true } }));
  check('mesma chave em duas ONGs (único por ONG)', (await raw.systemConfig.count({ where: { key: 'app.name' } })) === 2);
  const pub = await runWithOrg('org_b', () => db.systemConfig.findMany({ where: { isPublic: true } }));
  check('configuração pública de B só tem a de B', pub.length === 1 && pub[0].value === 'Patinhas', pub);
  const one = await runWithOrg('org_b', () => db.systemConfig.findUnique({ where: { key: 'app.name' } }));
  check('findUnique por key (único antigo no schema do Prisma) acha a de B', one?.value === 'Patinhas', one);

  // Concorrência: várias consultas ao mesmo tempo, de ONGs diferentes
  const mixed = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      runWithOrg(i % 2 ? 'org_b' : 'org_liga', async () => (await db.user.findMany()).map((u: any) => u.email).join()),
    ),
  );
  check('12 consultas em paralelo, cada uma na sua ONG', mixed.every((v, i) => v === (i % 2 ? 'b@x.org' : 'liga@x.org')), mixed);

  // Sistema
  check('modo sistema vê tudo', (await runAsSystem(() => db.user.count())) === 2);
  check('fora de requisição passa direto', (await db.user.count()) === 2);

  // Taxa de 10% sobre o bruto, por ONG, sem teto
  const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 15));
  await runWithOrg('org_b', () =>
    db.payment.create({ data: { amount: 1000, description: 'Anual', type: 'MEMBERSHIP', status: 'APPROVED', gateway: 'PAGBANK', paidAt: lastMonth } }),
  );
  await runWithOrg('org_b', () => db.donation.create({ data: { amount: 250, method: 'PIX', status: 'APPROVED', updatedAt: lastMonth } as any }));
  await runWithOrg('org_b', () => db.$executeRawUnsafe(`UPDATE donations SET "updatedAt" = $1`, lastMonth));
  await runWithOrg('org_liga', () =>
    db.payment.create({ data: { amount: 240, description: 'Anual', type: 'MEMBERSHIP', status: 'APPROVED', gateway: 'PAGBANK', paidAt: lastMonth } }),
  );
  await runWithOrg('org_liga', () =>
    db.payment.create({ data: { amount: 999, description: 'Recusado', type: 'MEMBERSHIP', status: 'REJECTED', gateway: 'PAGBANK', paidAt: lastMonth } }),
  );
  const gb = withFee(await runWithOrg('org_b', () => grossByMonth(db, new Date(), 2)), 0.1);
  check('bruto da B no mês passado: mensalidade + doação (R$ 1.250,00)', gb[0].grossCents === 125000 && gb[0].membershipsCents === 100000 && gb[0].donationsCents === 25000, gb);
  check('taxa de 10% sem teto (R$ 125,00)', gb[0].feeCents === 12500, gb[0]);
  const gl = await runWithOrg('org_liga', () => grossByMonth(db, new Date(), 2));
  check('Liga: só o pagamento aprovado, sem dados da B (R$ 240,00)', gl[0].grossCents === 24000, gl);
  await syncFeeInvoices(db);
  const inv = await listInvoices(db);
  const invB = inv.find((f) => f.orgId === 'org_b');
  const invL = inv.find((f) => f.orgId === 'org_liga');
  check('mês fechado vira cobrança de cada ONG', invB?.feeCents === 12500 && invB?.status === 'PENDING' && invL?.feeCents === 2400, inv);
  await runAsSystem(() => db.$executeRawUnsafe(`UPDATE platform_fee_invoices SET status = 'PAID' WHERE "orgId" = 'org_b'`));
  await runWithOrg('org_b', () =>
    db.payment.create({ data: { amount: 50, description: 'Mensal', type: 'MEMBERSHIP', status: 'APPROVED', gateway: 'PAGBANK', paidAt: lastMonth } }),
  );
  await syncFeeInvoices(db);
  check('cobrança paga não muda depois', (await listInvoices(db, 'org_b'))[0]?.feeCents === 12500);

  // Notificação paga: horário e público separados por ONG
  await runAsSystem(() => ensurePartnerPushSchema(db));
  await ensureIsolationSchema(db, true);
  const mkPartner = (org: string, id: string) =>
    runWithOrg(org, () => db.partner.create({ data: { id, name: id, category: 'Pet shop', address: 'Rua 1', city: 'X', state: 'SP', zipCode: '00000000' } }));
  await mkPartner('org_liga', 'p_liga');
  await mkPartner('org_b', 'p_b');
  const slotAt = new Date(Date.now() + 3 * 864e5);
  slotAt.setUTCHours(15, 0, 0, 0);
  await runWithOrg('org_liga', () =>
    db.$executeRawUnsafe(
      `INSERT INTO partner_push_campaigns (id, "partnerId", "createdById", title, body, "priceCents", status, "scheduledFor", "orgId")
       VALUES ('camp_liga', 'p_liga', 'u', 'Promo', 'Texto', 1990, 'SCHEDULED', $1, 'org_liga')`,
      slotAt,
    ),
  );
  check('horário pego por parceiro da Liga fica ocupado para a Liga', await runAsSystem(() => slotTaken(db, slotAt, undefined, 'org_liga')));
  check('mesmo horário continua livre para a ONG B', !(await runAsSystem(() => slotTaken(db, slotAt, undefined, 'org_b'))));
  check('B não enxerga a campanha da Liga', (await runWithOrg('org_b', () => db.$queryRawUnsafe(`SELECT id FROM partner_push_campaigns`))).length === 0);
  const hhmm = `${String((slotAt.getUTCHours() + 21) % 24).padStart(2, '0')}:00`; // 15h UTC = 12h em Brasília
  const daysB = await runWithOrg('org_b', () => listSlots(db, { slots: [hhmm] }));
  const daysL = await runWithOrg('org_liga', () => listSlots(db, { slots: [hhmm] }));
  const slotIn = (days: any[]) => days.flatMap((d: any) => d.slots).find((x: any) => new Date(x.at).getTime() === slotAt.getTime());
  check('lista de horários: livre na B, ocupado na Liga', slotIn(daysB)?.available === true && slotIn(daysL)?.available === false, { b: slotIn(daysB), l: slotIn(daysL) });

  // Perfis de administrador da ONG
  const can = (path: string, method: string, scope: any, isPlatform = false) => decideAdminAccess({ path, method, scope, isPlatform }).ok;
  check('Conteúdo cria evento', can('/api/admin/events', 'POST', 'CONTEUDO'));
  check('Conteúdo não vê pagamentos', !can('/api/admin/membership-payments', 'GET', 'CONTEUDO'));
  check('Financeiro vê relatórios e não mexe em membros', can('/api/admin/financial-reports', 'GET', 'FINANCEIRO') && !can('/api/admin/members', 'POST', 'FINANCEIRO'));
  check('Atendimento edita membro e não cadastra empresa', can('/api/admin/members/x', 'PUT', 'ATENDIMENTO') && !can('/api/admin/companies', 'POST', 'ATENDIMENTO'));
  check('Gestor da ONG não publica versão do app nem entra na plataforma', !can('/api/admin/app/versions', 'POST', 'GESTOR') && !can('/api/platform/orgs', 'GET', 'GESTOR'));
  check('Gestor lê a ajuda, mas só a plataforma escreve', can('/api/admin/help-info', 'GET', 'GESTOR') && !can('/api/admin/help-info', 'POST', 'GESTOR') && can('/api/admin/help-info', 'POST', 'GESTOR', true));
  check('Só Gestor ou plataforma criam administradores', canManageAdmins(false, 'GESTOR') && canManageAdmins(true, 'CONTEUDO') && !canManageAdmins(false, 'ATENDIMENTO'));
  check('Qualquer perfil vê o início', can('/api/admin/dashboard', 'GET', 'FINANCEIRO') && can('/api/admin/verify', 'GET', 'CONTEUDO'));

  const st = await isolationSelfTest(db);
  check('autoteste', st.ok, st.checks.filter((c) => !c.ok));

  console.log(`\n${pass} ok, ${fail} falha(s)`);
  await raw.$disconnect();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
