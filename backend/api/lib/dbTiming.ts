/**
 * Medição do tempo gasto com o banco em cada requisição (sem mudar nenhuma consulta).
 *
 * - instrumentDb: embrulha $queryRawUnsafe/$executeRawUnsafe do Prisma e soma, por requisição,
 *   quantas consultas foram feitas e quanto tempo levaram ida e volta (inclui a rede até o banco).
 * - A linha "⏱" do index.ts mostra isso: `db=7q/420ms`.
 * - dbDiagnostics: rota de admin que mede 5 consultas simples em sequência e 5 em paralelo e mostra
 *   para onde a API está conectando (host/porta/opções, nunca usuário nem senha).
 */
import { AsyncLocalStorage } from 'async_hooks';

export type ReqDbStats = { q: number; ms: number };
export const dbStatsStore = new AsyncLocalStorage<ReqDbStats>();

export function instrumentDb(client: any) {
  if (!client || client.__timed) return client;
  for (const name of ['$queryRawUnsafe', '$executeRawUnsafe']) {
    const orig = client[name];
    if (typeof orig !== 'function') continue;
    client[name] = function timed(...args: any[]) {
      const stats = dbStatsStore.getStore();
      const t0 = Date.now();
      const p = orig.apply(client, args);
      if (!stats || typeof p?.then !== 'function') return p;
      return p.then(
        (v: any) => {
          stats.q++;
          stats.ms += Date.now() - t0;
          return v;
        },
        (e: any) => {
          stats.q++;
          stats.ms += Date.now() - t0;
          throw e;
        },
      );
    };
  }
  client.__timed = true;
  return client;
}

/** Só o necessário para saber se a conexão é a certa: nada de usuário ou senha. */
export function describeDbUrl(raw: string | undefined) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const p = u.searchParams;
    return {
      host: u.hostname,
      port: u.port || '5432',
      pooler: /pooler\.supabase\.com$/.test(u.hostname),
      poolerRegion: (u.hostname.match(/aws-\d+-([a-z]+-[a-z]+-\d)\.pooler/) || [])[1] || null,
      pgbouncer: p.get('pgbouncer'),
      connectionLimit: p.get('connection_limit'),
      poolTimeout: p.get('pool_timeout'),
      sslmode: p.get('sslmode'),
    };
  } catch {
    return { host: 'url inválida' };
  }
}

export async function dbDiagnostics(db: any) {
  const timeOne = async () => {
    const t = Date.now();
    await db.$queryRawUnsafe('SELECT 1');
    return Date.now() - t;
  };
  const sequential: number[] = [];
  for (let i = 0; i < 5; i++) sequential.push(await timeOne());
  const t = Date.now();
  const each = await Promise.all([timeOne(), timeOne(), timeOne(), timeOne(), timeOne()]);
  const parallelTotal = Date.now() - t;
  const server: any[] = await db.$queryRawUnsafe(
    `SELECT current_setting('server_version') AS version, inet_server_addr()::text AS "serverAddr"`,
  ).catch(() => []);
  return {
    functionRegion: process.env.VERCEL_REGION || null,
    database: describeDbUrl(process.env.DATABASE_URL),
    serverVersion: server[0]?.version || null,
    selectOne: {
      sequentialMs: sequential,
      parallel5TotalMs: parallelTotal,
      parallelEachMs: each,
      // Em paralelo deveria levar quase o mesmo que 1 consulta. Se for ~5×, as consultas estão em fila (1 conexão só).
      looksSerialized: parallelTotal > 20 && parallelTotal > [...sequential.slice(1)].sort((a, b) => a - b)[1] * 3,
    },
  };
}
