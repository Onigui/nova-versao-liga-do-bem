-- Marcas de "tabelas já verificadas" (backend/api/lib/schemaOnce.ts).
-- Criada sozinha pela API na primeira partida; este arquivo é só registro.
CREATE TABLE IF NOT EXISTS app_schema_marks (
  module TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
