/**
 * Fase 2 da plataforma para várias ONGs: separação de dados feita pelo próprio banco.
 *
 * Como funciona
 * - Cada requisição roda "dentro" de uma ONG (runWithOrg) ou em modo sistema (runAsSystem).
 * - Com MULTI_ORG_ISOLATION=on, toda consulta de uma ONG vira uma transação curta:
 *     SET LOCAL ROLE org_member;  SET LOCAL app.org_id = '<ONG>';  <a consulta>
 *   O papel org_member não fura o RLS, e as políticas de cada tabela só deixam ver e gravar
 *   linhas com "orgId" = app.org_id. Mesmo uma consulta esquecida sem WHERE "orgId" fica presa.
 * - O padrão da coluna "orgId" passa a ser a ONG da transação: um INSERT sem "orgId" cai na ONG certa.
 * - Modo sistema (login, webhooks, plataforma, rotas públicas por link) usa o acesso normal.
 *   Se tiver ONG (ex.: cadastro numa ONG, webhook de uma ONG), só define app.org_id para os
 *   INSERTs caírem na ONG certa, sem trocar de papel.
 * - DDL (CREATE/ALTER/DROP/DO…) sempre roda em modo sistema.
 * - Com a chave desligada (padrão), nada muda: o banco recebe exatamente as mesmas consultas.
 */
import { AsyncLocalStorage } from 'async_hooks';
import { dbStatsStore } from './dbTiming';
import { markSchemaApplied, schemaApplied, schemaFingerprint } from './schemaOnce';

export const DEFAULT_ORG = 'org_liga';
export const ORG_ROLE = 'org_member';

export type TenantCtx = {
  orgId: string | null;
  system: boolean;
  /** Credenciais da ONG carregadas no início da requisição (nunca vão para o navegador). */
  secrets?: Record<string, string | null>;
};

export const tenantStore = new AsyncLocalStorage<TenantCtx>();

let forced: boolean | null = null;
/** Só para testes. */
export function forceIsolation(v: boolean | null) {
  forced = v;
}
export function isolationOn() {
  if (forced !== null) return forced;
  return String(process.env.MULTI_ORG_ISOLATION || '').trim().toLowerCase() === 'on';
}

export function runWithOrg<T>(orgId: string, fn: () => T, secrets?: Record<string, string | null>): T {
  return tenantStore.run({ orgId: orgId || DEFAULT_ORG, system: false, secrets }, fn);
}
export function runAsSystem<T>(fn: () => T, orgId: string | null = null, secrets?: Record<string, string | null>): T {
  return tenantStore.run({ orgId, system: true, secrets }, fn);
}
/** ONG da requisição atual (Liga quando não há contexto). */
export function currentOrgId(): string {
  return tenantStore.getStore()?.orgId || DEFAULT_ORG;
}
export function currentSecret(key: string): string | null | undefined {
  const s = tenantStore.getStore()?.secrets;
  return s ? s[key] : undefined;
}

/**
 * Para escrever "atualiza ou cria" por ONG sem ON CONFLICT. Com a chave desligada não mexe
 * em nada (o SQL fica igual ao de antes); ligada, filtra e grava o "orgId" explicitamente,
 * o que vale até em modo sistema (webhooks).
 *   const o = orgScope(3);  `UPDATE t SET v = $2 WHERE key = $1${o.where}`, key, v, ...o.params
 *   const c = orgScope(3);  `INSERT INTO t (key, v${c.col}) VALUES ($1, $2${c.val})`, key, v, ...c.params
 */
export function orgScope(index: number) {
  if (!isolationOn()) return { where: '', col: '', val: '', params: [] as string[] };
  return { where: ` AND "orgId" = $${index}`, col: ', "orgId"', val: `, $${index}`, params: [currentOrgId()] };
}

const SYSTEM_SQL = /^\s*(CREATE|ALTER|DROP|COMMENT|GRANT|REVOKE|DO|TRUNCATE|REINDEX|VACUUM|ANALYZE)\b/i;
const CREATE_TABLE = /^\s*CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(?:"?public"?\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?/i;
const RAW = new Set(['$queryRawUnsafe', '$executeRawUnsafe', '$queryRaw', '$executeRaw']);
const TX_OPTS = { maxWait: 10000, timeout: 30000 };

type Plan = { role: boolean; orgId: string } | null;

/** O que fazer com uma consulta agora: null = passa direto. */
function plan(): Plan {
  if (!isolationOn()) return null;
  const ctx = tenantStore.getStore();
  if (!ctx) return null;
  if (ctx.system) return ctx.orgId ? { role: false, orgId: ctx.orgId } : null;
  return { role: true, orgId: ctx.orgId || DEFAULT_ORG };
}

async function enter(tx: any, p: NonNullable<Plan>) {
  if (p.role) {
    await tx.$executeRawUnsafe(
      `SELECT set_config('role', '${ORG_ROLE}', true), set_config('app.org_id', $1, true)`,
      p.orgId,
    );
  } else {
    await tx.$executeRawUnsafe(`SELECT set_config('app.org_id', $1, true)`, p.orgId);
  }
}

function timed<T>(p: Promise<T>): Promise<T> {
  const stats = dbStatsStore.getStore();
  if (!stats) return p;
  const t0 = Date.now();
  const done = () => {
    stats.q++;
    stats.ms += Date.now() - t0;
  };
  return p.then(
    (v) => {
      done();
      return v;
    },
    (e) => {
      done();
      throw e;
    },
  );
}

function scoped(raw: any, p: NonNullable<Plan>, run: (tx: any) => any) {
  return timed(
    raw.$transaction(async (tx: any) => {
      await enter(tx, p);
      return run(tx);
    }, TX_OPTS),
  );
}

const cache = new WeakMap<object, any>();

/**
 * Embrulha o cliente do Prisma. O mesmo objeto serve para tudo: em cada chamada ele olha
 * o contexto da requisição e decide se passa direto ou se isola.
 */
export function scopeDb<T extends object>(raw: T): T {
  if (!raw) return raw;
  const hit = cache.get(raw);
  if (hit) return hit;
  const delegates = new Map<string, any>();
  const proxy = new Proxy(raw as any, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      if (typeof prop !== 'string') return value;
      if (prop === '__raw') return target;
      if (prop === '__scoped') return true;
      if (RAW.has(prop) && typeof value === 'function') {
        return (...args: any[]) => {
          const p = plan();
          const sql = typeof args[0] === 'string' ? args[0] : Array.isArray(args[0]) ? args[0].join('') : '';
          // Só com a chave ligada (desligada, ninguém usa o papel org_member e a passada completa
          // cuida de tudo quando ligar)
          const created = isolationOn() && typeof args[0] === 'string' ? CREATE_TABLE.exec(args[0]) : null;
          if (created) {
            // Tabela nova nasce fechada para as ONGs; aqui ela ganha RLS e política na hora
            return (async () => {
              const out = await value.apply(target, args);
              await runAsSystem(() => isolateTable(target, created[2])).catch((e: any) => console.warn('⚠️ isolar tabela nova:', created[2], e?.message));
              return out;
            })();
          }
          if (!p || SYSTEM_SQL.test(sql)) return value.apply(target, args);
          return scoped(target, p, (tx) => tx[prop](...args));
        };
      }
      if (prop === '$transaction' && typeof value === 'function') {
        return (arg: any, opts?: any) => {
          const p = plan();
          if (!p) return value.call(target, arg, opts);
          if (typeof arg !== 'function') {
            // Lista de operações já criadas fora do contexto: não dá para isolar com segurança.
            throw new Error('$transaction([...]) não é suportado com MULTI_ORG_ISOLATION=on; use $transaction(async (tx) => ...)');
          }
          return timed(
            value.call(
              target,
              async (tx: any) => {
                await enter(tx, p);
                return arg(tx);
              },
              { ...TX_OPTS, ...(opts || {}) },
            ),
          );
        };
      }
      // Modelos do Prisma (db.user.findUnique, db.systemConfig.findMany…)
      const isModel =
        !prop.startsWith('$') && !prop.startsWith('_') && value && typeof value === 'object' &&
        ['findUnique', 'findFirst', 'findMany', 'create', 'update'].some((m) => typeof (value as any)[m] === 'function');
      if (isModel) {
        let d = delegates.get(prop);
        if (!d) {
          d = new Proxy(value, {
            get(mt, method) {
              const fn = Reflect.get(mt, method);
              if (typeof fn !== 'function' || typeof method !== 'string') return fn;
              return (...args: any[]) => {
                const p = plan();
                if (!p) return fn.apply(mt, args);
                return scoped(target, p, (tx) => tx[prop][method](...args));
              };
            },
          });
          delegates.set(prop, d);
        }
        return d;
      }
      return value;
    },
  });
  cache.set(raw, proxy);
  return proxy;
}

// ------------------------------------------------------------------ esquema do isolamento

/** Tabelas da plataforma, iguais para todas as ONGs. */
export const GLOBAL_TABLES: Record<string, 'all' | 'read' | 'liga-write' | 'none'> = {
  app_schema_marks: 'all',
  password_reset_tokens: 'all',
  catalog_items: 'all',
  app_versions: 'liga-write',
  organizations: 'read',
  org_onboarding: 'none',
  org_secrets: 'none',
  pagbank_homolog: 'none',
  platform_kv: 'none',
  org_report_users: 'none',
  platform_fee_invoices: 'none',
  _prisma_migrations: 'none',
};

/** Únicos que eram da tabela inteira e passam a ser por ONG. */
export const PER_ORG_UNIQUES: { table: string; cols: string[]; pk?: boolean }[] = [
  { table: 'system_config', cols: ['key'] },
  { table: 'help_info', cols: ['category'] },
  { table: 'subscription_plans', cols: ['code'] },
  { table: 'financial_reports', cols: ['year', 'month', 'type'] },
  { table: 'nfp_settings', cols: ['key'], pk: true },
];

const ORG_DEFAULT = `COALESCE(NULLIF(current_setting('app.org_id', true), ''), '${DEFAULT_ORG}')`;
const ORG_EXPR = `"orgId" = current_setting('app.org_id', true)`;
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

let isoReady: Promise<IsolationReport> | null = null;
let isoDb: any = null;
let isoFlag: boolean | null = null;

export type IsolationReport = { ok: boolean; tables: number; policies: number; errors: string[]; skipped?: boolean; alreadyOk?: number };
const ISOLATION_VERSION = 2;

/**
 * Cria o papel, as permissões, as políticas e os únicos por ONG. Idempotente.
 * Pode rodar com a chave desligada: o usuário normal do banco ignora as políticas,
 * então nada muda até MULTI_ORG_ISOLATION=on.
 */
export function ensureIsolationSchema(db: any, force = false): Promise<IsolationReport> {
  const raw = db?.__raw || db;
  if (!force && isoReady && isoDb === raw && isoFlag === isolationOn()) return isoReady;
  isoDb = raw;
  isoFlag = isolationOn();
  isoReady = runAsSystem(() => applyIsolation(raw, force)).catch((e) => {
    isoReady = null;
    throw e;
  });
  return isoReady;
}

async function listTables(db: any): Promise<{ name: string; hasOrg: boolean }[]> {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT c.relname AS name,
            EXISTS (SELECT 1 FROM information_schema.columns k
                     WHERE k.table_schema = 'public' AND k.table_name = c.relname AND k.column_name = 'orgId') AS "hasOrg"
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY 1`,
  );
  return rows.map((r) => ({ name: String(r.name), hasOrg: !!r.hasOrg }));
}

async function applyIsolation(db: any, force = false): Promise<IsolationReport> {
  // Uma consulta por partida a frio: só refaz se mudou a lista de tabelas ou esta configuração.
  await schemaApplied(db, 'org_isolation', '-'); // cria app_schema_marks antes de listar as tabelas
  const tables = await listTables(db);
  const fp = schemaFingerprint(ISOLATION_VERSION, isolationOn(), tables, GLOBAL_TABLES, PER_ORG_UNIQUES);
  if (!force && (await schemaApplied(db, 'org_isolation', fp))) {
    return { ok: true, tables: tables.length, policies: -1, errors: [], skipped: true };
  }
  const errors: string[] = [];
  const run = async (sql: string, ...params: any[]) => {
    try {
      await db.$executeRawUnsafe(sql, ...params);
    } catch (e: any) {
      errors.push(`${sql.slice(0, 80)}… → ${e?.message || e}`);
    }
  };
  await run(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ORG_ROLE}') THEN
      CREATE ROLE ${ORG_ROLE} NOLOGIN NOBYPASSRLS;
    END IF;
  END $$`);
  // PG16+: SET precisa ser concedido; em versões antigas a sintaxe WITH falha e cai na simples.
  const before = errors.length;
  await run(`GRANT ${ORG_ROLE} TO CURRENT_USER WITH SET TRUE, INHERIT FALSE`);
  if (errors.length > before) {
    errors.length = before;
    await run(`GRANT ${ORG_ROLE} TO CURRENT_USER`);
  }
  await run(`GRANT USAGE ON SCHEMA public TO ${ORG_ROLE}`);
  await run(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${ORG_ROLE}`);
  // Sem privilégio padrão em tabela nova: ela fica FECHADA para as ONGs até ganhar RLS e política
  // (isolateTable, logo depois do CREATE TABLE). Antes era aberta e sem RLS: falhava aberta.
  await run(`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${ORG_ROLE}`);
  await run(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${ORG_ROLE}`);

  // Incremental: pula a tabela que já está certa. Assim cada partida a frio avança, mesmo que a
  // função seja congelada no meio (a primeira passada em produção parou na letra "d").
  const status = force ? new Map<string, TableStatus>() : await tableStatus(db);
  let policies = 0;
  let skipped = 0;
  for (const t of tables) {
    if (!force && isolatedOk(t.name, status.get(t.name))) {
      skipped++;
      continue;
    }
    policies += await isolateOne(db, t, errors);
  }

  for (const u of PER_ORG_UNIQUES) {
    if (!tables.some((t) => t.name === u.table && t.hasOrg)) continue;
    await migrateUnique(db, u, run, isolationOn());
  }
  // Tabela sem "orgId" é bloqueada de propósito; não impede a marca (senão rodaria toda vez).
  const fatal = errors.filter((e) => !e.includes('sem coluna "orgId"'));
  if (!fatal.length) await markSchemaApplied(db, 'org_isolation', fp);
  return { ok: errors.length === 0, tables: tables.length, policies, errors, alreadyOk: skipped } as IsolationReport;
}

type TableStatus = { rls: boolean; pols: string[]; hasOrg: boolean; def: string | null; priv: boolean };

async function tableStatus(db: any): Promise<Map<string, TableStatus>> {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT c.relname AS name, c.relrowsecurity AS rls,
            ARRAY(SELECT p.polname::text FROM pg_policy p WHERE p.polrelid = c.oid ORDER BY 1) AS pols,
            EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'orgId' AND NOT a.attisdropped) AS "hasOrg",
            (SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
              WHERE d.adrelid = c.oid AND a.attname = 'orgId') AS def,
            has_table_privilege('${ORG_ROLE}', c.oid, 'SELECT') AS priv
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
  );
  return new Map(rows.map((r) => [String(r.name), { rls: !!r.rls, pols: r.pols || [], hasOrg: !!r.hasOrg, def: r.def, priv: !!r.priv }]));
}

/** A tabela já tem RLS, as políticas esperadas e (se for por ONG) o padrão do "orgId" da sessão? */
function isolatedOk(name: string, st?: TableStatus) {
  if (!st || !st.rls) return false;
  const mode = GLOBAL_TABLES[name];
  const has = (...p: string[]) => p.every((x) => st.pols.includes(x)) && st.pols.length === p.length;
  if (mode === 'none') return st.pols.length === 0 && !st.priv;
  if (mode === 'read') return has('org_read') && st.priv;
  if (mode === 'all') return has('org_isolation') && st.priv;
  if (mode === 'liga-write') return has('org_read', 'org_write') && st.priv;
  return st.hasOrg && has('org_isolation') && st.priv && /current_setting\('app\.org_id'/.test(st.def || '');
}

/** Statements de isolamento de UMA tabela (e cria "orgId" se faltar). Devolve as políticas criadas. */
async function isolateOne(db: any, t: { name: string; hasOrg: boolean }, errors: string[]): Promise<number> {
  const name = String(t.name);
  const T = q(name);
  const mode = GLOBAL_TABLES[name];
  if (!mode && !t.hasOrg) {
    // Tabela criada por um módulo depois da primeira passada: ganha a coluna aqui mesmo
    // (padrão constante primeiro: instantâneo, sem reescrever a tabela; o padrão da sessão vem abaixo)
    try {
      await db.$executeRawUnsafe(`ALTER TABLE ${T} ADD COLUMN IF NOT EXISTS "orgId" TEXT NOT NULL DEFAULT '${DEFAULT_ORG}'`);
      t.hasOrg = true;
    } catch (e: any) {
      errors.push(`${name}: não deu para criar "orgId" → ${e?.message || e}`);
    }
  }
  const stmts = [
    `ALTER TABLE ${T} ENABLE ROW LEVEL SECURITY`,
    `DROP POLICY IF EXISTS org_isolation ON ${T}`,
    `DROP POLICY IF EXISTS org_read ON ${T}`,
    `DROP POLICY IF EXISTS org_write ON ${T}`,
    `REVOKE ALL ON ${T} FROM ${ORG_ROLE}`,
  ];
  let added = 0;
  if (mode === 'read') {
    stmts.push(`GRANT SELECT ON ${T} TO ${ORG_ROLE}`, `CREATE POLICY org_read ON ${T} FOR SELECT TO ${ORG_ROLE} USING (true)`);
    added = 1;
  } else if (mode === 'all') {
    stmts.push(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ${T} TO ${ORG_ROLE}`,
      `CREATE POLICY org_isolation ON ${T} FOR ALL TO ${ORG_ROLE} USING (true) WITH CHECK (true)`,
    );
    added = 1;
  } else if (mode === 'liga-write') {
    const liga = `current_setting('app.org_id', true) = '${DEFAULT_ORG}'`;
    stmts.push(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ${T} TO ${ORG_ROLE}`,
      `CREATE POLICY org_read ON ${T} FOR SELECT TO ${ORG_ROLE} USING (true)`,
      `CREATE POLICY org_write ON ${T} FOR ALL TO ${ORG_ROLE} USING (${liga}) WITH CHECK (${liga})`,
    );
    added = 2;
  } else if (!mode) {
    if (!t.hasOrg) {
      errors.push(`${name}: sem coluna "orgId" (bloqueada para ONGs)`);
    } else {
      stmts.push(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ${T} TO ${ORG_ROLE}`,
        `ALTER TABLE ${T} ALTER COLUMN "orgId" SET DEFAULT ${ORG_DEFAULT}`,
        `CREATE POLICY org_isolation ON ${T} FOR ALL TO ${ORG_ROLE} USING (${ORG_EXPR}) WITH CHECK (${ORG_EXPR})`,
      );
      added = 1;
    }
  }
  // Uma transação por tabela: troca de política sem janela; lock_timeout curto para nunca
  // enfileirar o app atrás de uma consulta longa (se não pegar a trava, tenta na próxima).
  try {
    // Um bloco só (uma ida ao banco, atômico): troca de política sem janela e lock_timeout curto
    // para nunca enfileirar o app atrás de uma consulta longa (se não pegar a trava, tenta na próxima)
    await db.$executeRawUnsafe(`DO $iso$ BEGIN PERFORM set_config('lock_timeout', '3s', true); ${stmts.join('; ')}; END $iso$`);
  } catch (e: any) {
    errors.push(`${name} → ${e?.message || e}`);
    return 0;
  }
  if (!mode && t.hasOrg) {
    try {
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS ${q(`${name}_orgId_idx`.slice(0, 63))} ON ${T} ("orgId")`);
    } catch {
      /* índice é só desempenho */
    }
  }
  return added;
}

/**
 * Isola uma tabela recém-criada (chamado pelo scopeDb logo depois de um CREATE TABLE).
 * Barato quando ela já está isolada: uma consulta só.
 */
export async function isolateTable(db: any, name: string) {
  const raw = db?.__raw || db;
  const rows: any[] = await raw.$queryRawUnsafe(
    `SELECT c.relrowsecurity AS rls,
            EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS pol,
            EXISTS (SELECT 1 FROM information_schema.columns k
                     WHERE k.table_schema = 'public' AND k.table_name = c.relname AND k.column_name = 'orgId') AS "hasOrg"
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind IN ('r', 'p')`,
    name,
  );
  const r = rows[0];
  if (!r) return { ok: false, skipped: true };
  const mode = GLOBAL_TABLES[name];
  if (r.rls && r.pol && (mode || r.hasOrg)) return { ok: true, skipped: true };
  if (!r.rls && !r.pol && mode === 'none') {
    // tabela só do sistema: basta RLS ligado e nenhuma permissão
  }
  const errors: string[] = [];
  await isolateOne(raw, { name, hasOrg: !!r.hasOrg }, errors);
  return { ok: errors.length === 0, errors };
}

/** Troca o único (key) pelo único ("orgId", key), sem janela sem proteção. */
/**
 * Cria o único ("orgId", …). O antigo (só a chave) só sai com a chave ligada: enquanto estiver
 * desligada, o código antigo (deploy anterior, preview, rollback) continua funcionando.
 */
async function migrateUnique(db: any, u: { table: string; cols: string[]; pk?: boolean }, run: (sql: string) => Promise<void>, dropOld: boolean) {
  const T = q(u.table);
  const want = ['orgId', ...u.cols];
  const idx: any[] = await db.$queryRawUnsafe(
    `SELECT i.relname AS name, ix.indisprimary AS pk, con.conname AS constraint,
            ARRAY(SELECT a.attname::text FROM unnest(ix.indkey) WITH ORDINALITY k(attnum, n)
                   JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum ORDER BY k.n) AS cols
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       LEFT JOIN pg_constraint con ON con.conindid = ix.indexrelid
      WHERE n.nspname = 'public' AND t.relname = $1 AND ix.indisunique`,
    u.table,
  );
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const old = idx.find((i) => same(i.cols, u.cols));
  if (u.pk && dropOld) {
    if (idx.some((i) => i.pk && same(i.cols, want))) return;
    const pk = idx.find((i) => i.pk);
    if (pk) await run(`ALTER TABLE ${T} DROP CONSTRAINT ${q(pk.constraint || pk.name)}`);
    await run(`ALTER TABLE ${T} ADD PRIMARY KEY (${want.map(q).join(', ')})`);
    return;
  }
  if (!idx.some((i) => same(i.cols, want))) {
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS ${q(`${u.table}_org_${u.cols.join('_')}_key`.slice(0, 63))} ON ${T} (${want.map(q).join(', ')})`);
  }
  if (old && dropOld && !u.pk) {
    if (old.constraint) await run(`ALTER TABLE ${T} DROP CONSTRAINT IF EXISTS ${q(old.constraint)}`);
    else await run(`DROP INDEX IF EXISTS ${q(old.name)}`);
  }
}

// ------------------------------------------------------------------ autoteste

/**
 * Prova, no banco de verdade, que a separação funciona, sem deixar rastro (tudo é desfeito).
 * Cria duas ONGs de mentira dentro de uma transação, grava um dado em cada uma e confere:
 * cada ONG vê só o seu, não consegue gravar na outra, e o padrão do "orgId" cai na ONG certa.
 */
export async function isolationSelfTest(db: any) {
  const raw = db?.__raw || db;
  const checks: { name: string; ok: boolean; detail?: string }[] = [];
  const t0 = Date.now();
  const ROLLBACK = '__selftest_rollback__';
  try {
    await raw.$transaction(async (tx: any) => {
      const A = `org_selftest_a_${Date.now()}`;
      const B = `org_selftest_b_${Date.now()}`;
      const key = `selftest_${Date.now()}`;
      const as = async (org: string) =>
        tx.$executeRawUnsafe(`SELECT set_config('role', '${ORG_ROLE}', true), set_config('app.org_id', $1, true)`, org);
      const reset = async () => tx.$executeRawUnsafe(`SELECT set_config('role', 'none', true), set_config('app.org_id', '', true)`);
      // Chaves diferentes por ONG: o autoteste funciona mesmo com o único antigo (chave desligada)
      const count = async () =>
        Number((await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM system_config WHERE key LIKE $1`, `${key}_%`))[0]?.n || 0);
      const ins = (value: string, k = `${key}_${value}`) =>
        tx.$executeRawUnsafe(
          `INSERT INTO system_config (id, key, value, type, "isPublic", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, 'STRING'::"ConfigType", false, NOW(), NOW())`,
          k,
          value,
        );

      await as(A);
      await ins('a');
      await as(B);
      await ins('b');
      checks.push({ name: 'B vê só o próprio dado', ok: (await count()) === 1 });
      const rowB: any[] = await tx.$queryRawUnsafe(`SELECT value, "orgId" FROM system_config WHERE key LIKE $1`, `${key}_%`);
      checks.push({ name: 'padrão do orgId cai na ONG da sessão', ok: rowB[0]?.orgId === B && rowB[0]?.value === 'b' });
      const upd = await tx.$executeRawUnsafe(`UPDATE system_config SET value = 'x' WHERE key LIKE $1 AND "orgId" = $2`, `${key}_%`, A);
      checks.push({ name: 'B não altera dado de A', ok: Number(upd) === 0 });
      let blocked = false;
      await tx.$executeRawUnsafe('SAVEPOINT s1');
      try {
        await tx.$executeRawUnsafe(
          `INSERT INTO system_config (id, key, value, type, "isPublic", "orgId", "createdAt", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, 'intruso', 'STRING'::"ConfigType", false, $2, NOW(), NOW())`,
          key + '_x',
          A,
        );
      } catch {
        blocked = true;
      }
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT s1');
      checks.push({ name: 'B não grava em nome de A', ok: blocked });
      let secretBlocked = false;
      await tx.$executeRawUnsafe('SAVEPOINT s2');
      try {
        await tx.$queryRawUnsafe(`SELECT 1 FROM org_secrets LIMIT 1`);
      } catch {
        secretBlocked = true;
      }
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT s2');
      checks.push({ name: 'ONG não lê credenciais (org_secrets)', ok: secretBlocked });
      await as(A);
      checks.push({ name: 'A vê só o próprio dado', ok: (await count()) === 1 });
      if (isolationOn()) {
        // Com a chave ligada o único antigo já saiu: a mesma chave pode existir em outra ONG
        let dup = true;
        await tx.$executeRawUnsafe('SAVEPOINT s3');
        try {
          await ins('a', `${key}_b`);
        } catch {
          dup = false;
        }
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT s3');
        checks.push({ name: 'mesma chave de configuração em ONGs diferentes', ok: dup });
      }
      const users = Number((await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM users`))[0]?.n || 0);
      checks.push({ name: 'ONG nova não enxerga usuários da Liga', ok: users === 0 });
      await as(DEFAULT_ORG);
      const ligaUsers = Number((await tx.$queryRawUnsafe(`SELECT count(*)::int AS n FROM users`))[0]?.n || 0);
      checks.push({ name: 'Liga continua vendo os seus usuários', ok: ligaUsers > 0, detail: `${ligaUsers}` });
      await reset();
      const all = await count();
      checks.push({ name: 'sistema vê as duas ONGs', ok: all === 2 });
      throw new Error(ROLLBACK);
    }, TX_OPTS);
  } catch (e: any) {
    if (e?.message !== ROLLBACK) checks.push({ name: 'execução', ok: false, detail: e?.message || String(e) });
  }
  try {
    const open: any[] = await raw.$queryRawUnsafe(
      `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
          AND (NOT c.relrowsecurity OR (has_table_privilege('${ORG_ROLE}', c.oid, 'SELECT')
               AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)))`,
    );
    checks.push({
      name: 'toda tabela tem RLS e política',
      ok: open.length === 0,
      detail: open.length ? open.map((r) => r.name).join(', ') : undefined,
    });
  } catch (e: any) {
    checks.push({ name: 'toda tabela tem RLS e política', ok: false, detail: e?.message });
  }
  return { ok: checks.length > 0 && checks.every((c) => c.ok), ms: Date.now() - t0, checks };
}

