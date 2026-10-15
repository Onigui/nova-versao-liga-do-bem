/**
 * Verificação de tabelas uma vez só.
 *
 * Cada módulo garante as próprias tabelas com CREATE ... IF NOT EXISTS. Antes isso rodava a cada
 * partida a frio da função (dezenas de idas e voltas ao banco antes da primeira resposta).
 * Agora cada módulo grava uma "marca" com a impressão digital (hash) do SQL que rodou:
 *  - marca igual → pula tudo (1 consulta por partida a frio, para todos os módulos juntos);
 *  - SQL mudou no código (coluna nova, índice novo, item novo da semente) → hash muda e roda de novo.
 * Se a tabela de marcas não existir ou der qualquer erro, roda como antes (nunca deixa de criar tabela).
 */
import crypto from 'crypto';

let marksPromise: Promise<Map<string, string>> | null = null;

export function schemaFingerprint(...parts: any[]) {
  return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
}

async function loadMarks(db: any): Promise<Map<string, string>> {
  try {
    const rows: any[] = await db.$queryRawUnsafe(`SELECT module, fingerprint FROM app_schema_marks`);
    return new Map((rows || []).map((r) => [String(r.module), String(r.fingerprint)]));
  } catch {
    // Tabela ainda não existe (primeira vez) → cria e segue sem marcas
    try {
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS app_schema_marks (
           module TEXT PRIMARY KEY,
           fingerprint TEXT NOT NULL,
           "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
         )`,
      );
    } catch {
      /* sem permissão? então só não usamos marcas */
    }
    return new Map();
  }
}

/** true = esse módulo já rodou exatamente este SQL antes; pode pular. */
export async function schemaApplied(db: any, module: string, fingerprint: string): Promise<boolean> {
  if (!marksPromise) marksPromise = loadMarks(db);
  try {
    return (await marksPromise).get(module) === fingerprint;
  } catch {
    return false;
  }
}

export async function markSchemaApplied(db: any, module: string, fingerprint: string) {
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO app_schema_marks (module, fingerprint, "appliedAt") VALUES ($1, $2, NOW())
       ON CONFLICT (module) DO UPDATE SET fingerprint = EXCLUDED.fingerprint, "appliedAt" = NOW()`,
      module,
      fingerprint,
    );
    if (marksPromise) (await marksPromise).set(module, fingerprint);
  } catch {
    /* sem marca: na próxima partida roda de novo, como antes */
  }
}

/** Para testes: esquece as marcas carregadas. */
export function resetSchemaMarksCache() {
  marksPromise = null;
}
