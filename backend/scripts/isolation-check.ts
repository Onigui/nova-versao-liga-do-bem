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
