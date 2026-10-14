-- Nota Fiscal Paulista: apoiadores (doação automática dos cupons para a Liga) e importações da lista de doadores.
-- O módulo backend/api/lib/nfp.ts também cria estas tabelas sozinho.

CREATE TABLE IF NOT EXISTS nfp_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS nfp_supporters (
    "userId" TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('DECLARED','CONFIRMED','LAPSED')),
    "declaredAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lapsedAt" TIMESTAMP(3),
    source TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS nfp_supporters_status_idx ON nfp_supporters(status);

CREATE TABLE IF NOT EXISTS nfp_imports (
    id TEXT PRIMARY KEY,
    "adminId" TEXT,
    "fullList" BOOLEAN NOT NULL DEFAULT false,
    "totalRows" INTEGER NOT NULL,
    matched INTEGER NOT NULL,
    "newlyConfirmed" INTEGER NOT NULL,
    lapsed INTEGER NOT NULL,
    "notFound" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
  );
